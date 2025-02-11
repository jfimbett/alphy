'use client';
import { useState } from 'react';
import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { FileNode } from '@/components/FileTree';

// IMPORTANT: pdf.js worker config
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'development';

interface FilePayload {
  path: string;
  base64Data: string; // We'll store file data as base64 from the start
  blobUrl: string;
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode base64 back to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export function useFileProcessing() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [extractedTexts, setExtractedTexts] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  // For progress indicators
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<'extracting' | 'summarizing' | 'idle'>('idle');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);

  // ======================
  // Build File Tree
  // ======================
  const buildFileTree = (files: FilePayload[]): FileNode[] => {
    const root: FileNode = { name: '', type: 'folder', children: [] };

    files.forEach(({ path, base64Data, blobUrl }) => {
      const parts = path.split('/');
      let current = root;
      const pathSegments: string[] = [];

      parts.forEach((part, i) => {
        if (!part) return;
        pathSegments.push(part);

        const existing = current.children?.find((n) => n.name === part);
        if (existing) {
          current = existing;
        } else {
          const isFile = i === parts.length - 1;
          const newNode: FileNode = {
            name: part,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            // Store base64 in node.base64Data
            base64Data: isFile ? base64Data : undefined,
            // content for preview
            content: isFile ? blobUrl : undefined,
            // We no longer store rawData to avoid detachment
            fullPath: pathSegments.join('/'),
          };
          if (!current.children) current.children = [];
          current.children.push(newNode);
          current = newNode;

          // Default to selected
          if (isFile) {
            newNode.selected = true;
          }
        }
      });
    });

    return root.children || [];
  };

  // ======================
  // ZIP UPLOAD PROCESSING
  // ======================
  const processZip = async (file: File) => {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    const files = await Promise.all(
      Object.values(zipContent.files)
        .filter((entry) => !entry.dir)
        .map(async (entry) => {
          // 1) Get raw arraybuffer
          const data = await entry.async('arraybuffer');
          // 2) Immediately convert to base64
          const base64Data = arrayBufferToBase64(data);
          // 3) For browser preview
          const blobUrl = URL.createObjectURL(new Blob([data]));
          return {
            path: entry.name,
            base64Data,
            blobUrl,
          };
        })
    );

    setFileTree(buildFileTree(files));
  };

  // ======================
  // FOLDER UPLOAD
  // ======================
  const processFolder = async (fileList: FileList) => {
    const filePromises = Array.from(fileList).map((file) => {
      return new Promise<FilePayload>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result !== 'string') {
            // Convert arraybuffer to base64
            const base64Data = arrayBufferToBase64(reader.result);
            const blobUrl = URL.createObjectURL(file);
            resolve({
              path: file.webkitRelativePath,
              base64Data,
              blobUrl,
            });
          } else {
            reject(new Error('Failed to read file as ArrayBuffer'));
          }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
      });
    });

    try {
      const files = await Promise.all(filePromises);
      setFileTree(buildFileTree(files));
    } catch (err) {
      console.error('Error reading folder files:', err);
    }
  };

  // Helper: get all files in a tree
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    return nodes.flatMap((node) => {
      if (node.type === 'folder' && node.children) {
        return getAllFiles(node.children);
      }
      return node.type === 'file' ? [node] : [];
    });
  };

  // ======================
  // ANALYZE FILES
  // ======================
  const analyzeFiles = async (model: string) => {
    try {
      const allFiles = getAllFiles(fileTree).filter((f) => f.selected);

      // Phase 1: Extract text
      setProcessingPhase('extracting');
      setIsAnalyzing(true);
      setProgress(0);
      setProcessedFiles(0);

      const total = allFiles.length;
      setTotalFiles(total);

      const newExtractedTexts: Record<string, string> = {};
      let processedCount = 0;

      for (const node of allFiles) {
        let extracted = '';

        // If for some reason it's missing base64Data, skip
        if (!node.base64Data) continue;

        // Decode to ArrayBuffer for PDF or XLSX
        const arrayBuffer = base64ToArrayBuffer(node.base64Data);

        // PDF Extraction
        if (node.name.toLowerCase().endsWith('.pdf')) {
          try {
            const data = new Uint8Array(arrayBuffer);
            const pdf = await getDocument({ data }).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              text += content.items
                .filter((item): item is TextItem => 'str' in item)
                .map((item: TextItem) => item.str)
                .join(' ') + '\n';
            }
            extracted = text;
          } catch (err) {
            console.error(`Failed to extract text from ${node.name}`, err);
            extracted = '[Error extracting PDF text]';
          }
        }
        // Excel Extraction
        else if (node.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
          try {
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            let excelText = '';
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const sheetAsJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              (sheetAsJson as (string | number | boolean | null)[][]).forEach((row) => {
                excelText += row.join(' ') + '\n';
              });
              excelText += '\n';
            });
            extracted = excelText;
          } catch (err) {
            console.error(`Failed to extract text from ${node.name}`, err);
            extracted = '[Error extracting Excel text]';
          }
        }
        // Other file types
        else {
          extracted = '[Text extraction not available for this file type]';
        }

        newExtractedTexts[node.fullPath!] = extracted.trim().replace(/\s+/g, ' ');

        processedCount++;
        setProcessedFiles(processedCount);
        setProgress(Math.round((processedCount / total) * 100));
      }

     


      setExtractedTexts(newExtractedTexts);

      // Phase 2: Summarization
      setProcessingPhase('summarizing');
      setProgress(0);
      setProcessedFiles(0);

      const newSummaries: Record<string, string> = {};
      let summaryCount = 0;
      const textEntries = Object.entries(newExtractedTexts);

      for (const [fullPath, text] of textEntries) {
        try {
          const prompt = `Summarize the following text in one paragraph,
focusing on key financial metrics, risks, and opportunities.
Recall that the text could be written in different languages other than English.\n\n${text}`;

          if (DEVELOPMENT) {
            newSummaries[fullPath] = 'Some random text for development purposes...';
          } else {
            const res = await fetch('/api/llm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt,
                context: text.substring(0, 2000) || '',
                history: [],
                model: model,
              }),
            });

            if (!res.ok) {
              newSummaries[fullPath] = 'Summary failed: API error';
            } else {
              const data = await res.json();
              newSummaries[fullPath] = data.content;
            }
          }
        } catch (error) {
          newSummaries[fullPath] = `Summary failed: ${(error as Error).message}`;
        }

        summaryCount++;
        setProcessedFiles(summaryCount);
        setProgress(Math.round((summaryCount / textEntries.length) * 100));
      }

      setSummaries(newSummaries);
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setIsAnalyzing(false);
      setProcessingPhase('idle');
    }
  };

  // ======================
  // SELECT/DESELECT ALL
  // ======================
  const toggleAllFiles = (selected: boolean) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => ({
        ...n,
        selected: n.type === 'file' ? selected : n.selected,
        children: n.children ? updateNodes(n.children) : undefined,
      }));
    setFileTree((prev) => updateNodes(prev));
  };

   // Example snippet after analysis completes OR on "Save Session":
   async function saveHeavyData(sessionId: string) {
    try {
      const res = await fetch('/api/store-heavy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          heavyData: {
            fileTree,
            extractedTexts,
            summaries,
          },
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save heavy data');
      }
      console.log('Heavy data saved successfully');
    } catch (error) {
      console.error(error);
    }
  }

  return {
    fileTree,
    setFileTree,
    extractedTexts,
    setExtractedTexts,
    summaries,
    setSummaries,
    isAnalyzing,
    processingPhase,
    progress,
    totalFiles,
    processedFiles,
    processZip,
    processFolder,
    analyzeFiles,
    toggleAllFiles,
    buildFileTree,
    saveHeavyData, // <- Add this to your return object
  };
}
