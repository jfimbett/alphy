'use client';
import { useState } from 'react';
import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { FileNode } from '@/components/FileTree';
import { CompanyInfo } from '@/app/types';
import { ConsolidatedCompany } from '@/app/types';
import { 
  defaultSummarizationTemplate,
  defaultExtractionTemplate,
  defaultConsolidationTemplate,
  defaultVariableExtraction
} from '@/lib/prompts';
import { getModelConfig } from '@/lib/modelConfig';

GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'development';

interface FilePayload {
  path: string;
  base64Data: string;
  blobUrl: string;
}


function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  return Math.floor((wordCount * 1.5) + (charCount / 4));
}

function mergeConsolidatedCompanies(companyLists: CompanyInfo[][]): CompanyInfo[] {
  // Replace this with your real merging logic if needed.
  // For now, just flatten all arrays into one.
  return companyLists.flat();
}

// ======================
// Helper to convert ArrayBuffer to base64
// ======================
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ======================
// Helper to decode base64 back to ArrayBuffer
// ======================
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
  const [rawResponses, setRawResponses] = useState<Record<string, { prompt: string; response: string }>>({});
  const [extractedCompanies, setExtractedCompanies] = useState<Record<string, CompanyInfo[]>>({});
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [extractedTexts, setExtractedTexts] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<'extracting' | 'summarizing' | 'idle' | 'extracting_companies'>('idle');
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);

  const getConsolidationPrompt = (rawData: Record<string, any>) => {
    const template = typeof window !== 'undefined' 
      ? localStorage.getItem('consolidationTemplate') || defaultConsolidationTemplate 
      : defaultConsolidationTemplate;
    return template.replace('{rawData}', JSON.stringify(rawData));
  };

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
            base64Data: isFile ? base64Data : undefined,
            content: isFile ? blobUrl : undefined,
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
  // ANALYZE FILES (UPDATED WITH CHUNKING)
  // ======================
  const analyzeFiles = async (options: {
    runSummarization: boolean;
    runInfoRetrieval: boolean;
    summarizationModel?: string;
    infoRetrievalModel?: string;
  }) => {
    try {
      const allFiles = getAllFiles(fileTree).filter((f) => f.selected);
      setProcessingPhase('extracting');
      setIsAnalyzing(true);
      setProgress(0);
      setProcessedFiles(0);

      const total = allFiles.length;
      setTotalFiles(total);

      const newExtractedTexts: Record<string, string> = {};
      let processedCount = 0;

      // -------------------------
      // EXTRACT TEXT FROM FILES
      // -------------------------
      for (const node of allFiles) {
        let extracted = '';

        if (!node.base64Data) continue;

        const arrayBuffer = base64ToArrayBuffer(node.base64Data);

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
        } else if (node.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
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
        } else {
          // Fallback for unsupported file formats
          extracted = '[Text extraction not available for this file type]';
        }

        newExtractedTexts[node.fullPath!] = extracted.trim().replace(/\s+/g, ' ');
        processedCount++;
        setProcessedFiles(processedCount);
        setProgress(Math.round((processedCount / total) * 100));
      }

      setExtractedTexts(newExtractedTexts);

      // -------------------------
      // SUMMARIZATION WITH CHUNKING
      // -------------------------
      if (options.runSummarization && options.summarizationModel) {
        setProcessingPhase('summarizing');
        setProgress(0);
        setProcessedFiles(0);

        const newSummaries: Record<string, string> = {};
        const modelConfig = getModelConfig(options.summarizationModel);

        let count = 0;
        for (const [fullPath, text] of Object.entries(newExtractedTexts)) {
          try {
            const template =
              typeof window !== 'undefined'
                ? localStorage.getItem('summarizationTemplate') || defaultSummarizationTemplate
                : defaultSummarizationTemplate;

            // We'll do a 2-step chunk approach:
            //   1) Summarize each chunk
            //   2) If multiple chunks, consolidate
            const basePrompt = template.replace('{documentText}', '');
            const baseTokens = estimateTokens(basePrompt) + modelConfig.tokenSafetyMargin;

            // Split text into smaller chunks that fit the model context window
            const chunks = splitTextIntoChunks(
              text,
              modelConfig.contextWindow - baseTokens - 8000,
              modelConfig.maxChunkSize
            );

            let fullSummary = '';
            for (const chunk of chunks) {
              // Summarize chunk
              const chunkPrompt = template.replace('{documentText}', chunk);
              const res = await fetch('/api/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: chunkPrompt,
                  model: options.summarizationModel,
                  requestType: 'summarize',
                }),
              });

              if (res.ok) {
                const data = await res.json();
                fullSummary += data.content + '\n\n';
              } else {
                // In case of error on one chunk, skip or handle gracefully
                fullSummary += ' [Chunk Summarization Failed] ';
              }
            }

            // If there was more than one chunk, do a final consolidation
            if (chunks.length > 1) {
              const consolidationPrompt = `Please consolidate these partial summaries into one coherent summary:\n\n${fullSummary}`;
              const res = await fetch('/api/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: consolidationPrompt,
                  model: options.summarizationModel,
                  requestType: 'summarize',
                }),
              });

              if (res.ok) {
                const data = await res.json();
                fullSummary = data.content;
              }
            }

            newSummaries[fullPath] = fullSummary.trim();
          } catch (error) {
            newSummaries[fullPath] = `Summary failed: ${(error as Error).message}`;
          }

          count++;
          setProcessedFiles(count);
          setProgress(Math.round((count / Object.keys(newExtractedTexts).length) * 100));
        }

        setSummaries(newSummaries);
      }

      // -------------------------
      // INFO RETRIEVAL WITH CHUNKING
      // -------------------------
      if (options.runInfoRetrieval && options.infoRetrievalModel) {
        setProcessingPhase('extracting_companies');
        setProgress(0);
        setProcessedFiles(0);

        const modelConfig = getModelConfig(options.infoRetrievalModel);
        let count = 0;

        for (const [fullPath, text] of Object.entries(newExtractedTexts)) {
          try {
            const template =
              typeof window !== 'undefined'
                ? localStorage.getItem('extractionTemplate') || defaultExtractionTemplate
                : defaultExtractionTemplate;

            const basePrompt = template.replace('{documentText}', '');
            const baseTokens = estimateTokens(basePrompt) + modelConfig.tokenSafetyMargin;

            const chunks = splitTextIntoChunks(
              text,
              modelConfig.contextWindow - baseTokens - 8000,
              modelConfig.maxChunkSize
            );

            let allCompanies: CompanyInfo[] = [];
            for (const chunk of chunks) {
              const chunkPrompt = template.replace('{documentText}', chunk);
              const res = await fetch('/api/llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: chunkPrompt,
                  model: options.infoRetrievalModel,
                  format: 'json',
                  requestType: 'extract',
                }),
              });

              if (res.ok) {
                const data = await res.json();
                // The returned text often includes Markdown code fences around JSON
                const cleaned = data.content.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                  const companies: CompanyInfo[] = JSON.parse(cleaned);
                  // Merge chunk-level results into a single array
                  allCompanies = mergeConsolidatedCompanies([allCompanies, companies]);
                } catch (parseErr) {
                  console.error(`Failed to parse chunk companies for ${fullPath}:`, parseErr);
                }
              }
            }

            // Finally store everything for this file
            setExtractedCompanies((prev) => ({
              ...prev,
              [fullPath]: allCompanies,
            }));
          } catch (error) {
            console.error(`Error processing ${fullPath}:`, error);
          }

          count++;
          setProcessedFiles(count);
          setProgress(Math.round((count / Object.keys(newExtractedTexts).length) * 100));
        }
      }
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

  // ======================
  // SAVE HEAVY DATA
  // ======================
  const saveHeavyData = async (
    sessionId: string,
    heavyData: {
      fileTree: FileNode[];
      extractedTexts: Record<string, string>;
      summaries: Record<string, string>;
      extractedCompanies: Record<string, CompanyInfo[]>;
      rawResponses: Record<string, { prompt: string; response: string }>;
      consolidatedCompanies?: ConsolidatedCompany[];
    }
  ) => {
    try {
      await fetch('/api/store-heavy-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          heavyData: {
            ...heavyData,
            consolidatedCompanies: heavyData.consolidatedCompanies || [],
          },
        }),
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

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
    getConsolidationPrompt, // exposed for use in dashboard
    saveHeavyData,
    extractedCompanies,
    setExtractedCompanies,
    rawResponses,
    setRawResponses,
    // if you're still using it in other places
    consolidatedCompanies: [] as ConsolidatedCompany[],
  };
}

// ======================
// Utility function for chunking text
// ======================
function splitTextIntoChunks(
  text: string,
  maxTokens: number,
  maxChunkSize: number
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  // First split by sections using common headings
  const sections = text.split(/(\n\s*[A-Z][A-Z0-9 ]{10,}\n)/g);
  
  let buffer = '';
  sections.forEach((section, index) => {
    if (index % 2 === 1) { // It's a heading
      buffer += section;
    } else {
      const sectionWithHeading = buffer + section;
      buffer = '';
      
      // Then split by paragraphs within each section
      const paragraphs = sectionWithHeading.split('\n\n');
      
      paragraphs.forEach(para => {
        const paraTokens = estimateTokens(para);
        
        if (paraTokens > maxTokens) {
          // Handle very large paragraphs with sentence splitting
          const sentences = para.split(/[.!?]\s+/g);
          sentences.forEach(sentence => {
            const sentenceTokens = estimateTokens(sentence);
            if (currentTokens + sentenceTokens > maxTokens || 
                currentChunk.length + sentence.length > maxChunkSize) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
              currentTokens = 0;
            }
            currentChunk += sentence + '. ';
            currentTokens += sentenceTokens;
          });
        } else {
          if (currentTokens + paraTokens > maxTokens || 
              currentChunk.length + para.length > maxChunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
            currentTokens = 0;
          }
          currentChunk += para + '\n\n';
          currentTokens += paraTokens;
        }
      });
    }
  });

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
