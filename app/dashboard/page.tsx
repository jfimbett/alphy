'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import Navbar from '@/components/Navbar';
import FileTree, { FileNode } from '@/components/FileTree';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { ChatMessage } from '@/components/ChatMessage';
import { SummaryContent } from '@/components/SummaryContent';
import { ExtractedTextContent } from '@/components/ExtractedTextComponent';



// For development, I do not need to make the actual API call to the local LLM server.
const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'development';

export default function Dashboard() {
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [contextType, setContextType] = useState<  'none' | 'local' | 'global'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [processingPhase, setProcessingPhase] = useState<'extracting' | 'summarizing' | 'idle'>('idle');
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [extractedTexts, setExtractedTexts] = useState<Record<string, string>>({});

  // For selecting/deselecting all files:
  const [allSelected, setAllSelected] = useState(true);

  const toggleAllFiles = (selected: boolean) => {
    const updateNodes = (nodes: FileNode[]): FileNode[] =>
      nodes.map((n) => ({
        ...n,
        selected: n.type === 'file' ? selected : n.selected,
        children: n.children ? updateNodes(n.children) : undefined,
      }));
    setFileTree((prev) => updateNodes(prev));
    setAllSelected(selected);
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubscribed] = useState(false);

  // Track progress in percentage (0 to 100)
  const [progress, setProgress] = useState(0);

  // Optional: If you also want the raw count:
  const [totalFiles, setTotalFiles] = useState(0);
  const [processedFiles, setProcessedFiles] = useState(0);

  // ======================
  // Chat Handler (no chat history appended now)
  // ======================
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !chatMessage.trim()) return;

    setIsChatLoading(true);
    // We still keep track of local chatHistory for the UI
    const newHistory = [...chatHistory, { role: 'user', content: chatMessage }];

    try {
      let context = '';

      if (contextType === 'local') {
        context = extractedTexts[selectedFile.fullPath!] || '';
      } else if (contextType === 'global') {
        context = Array.from(highlightedFiles)
          .map((path) => extractedTexts[path])
          .join('\n\n')
          .slice(0, 5000);
      }

      // Remove `history: chatHistory.slice(-2)` from the body
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatMessage + ('\n\n Context: \n\n' + context ? context : ''),
          // Not appending chat history here
        }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const data = await res.json();
      setChatHistory([...newHistory, { role: 'assistant', content: data.content }]);
      setChatMessage('');
    } catch (error) {
      console.error('Chat Error:', error);
      // Handle error state
    } finally {
      setIsChatLoading(false);
    }
  };

  // ======================
  // DROPZONE CONFIGURATION
  // ======================
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const zipFile = acceptedFiles.find((file) => file.name.endsWith('.zip'));
      if (zipFile) await processZip(zipFile);
    },
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
  });

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
          const data = await entry.async('arraybuffer');
          return {
            path: entry.name,
            data,
            blobUrl: URL.createObjectURL(new Blob([data])),
          };
        })
    );
    setFileTree(buildFileTree(files));
  };

  // ======================
  // FOLDER UPLOAD
  // ======================
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const filePromises = Array.from(e.target.files).map((file) => {
      return new Promise<{ path: string; data: ArrayBuffer; blobUrl: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result !== 'string') {
            resolve({
              path: file.webkitRelativePath,
              data: reader.result, // The actual ArrayBuffer
              blobUrl: URL.createObjectURL(file),
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

  // ======================
  // BUILD FILE TREE
  // ======================
  const buildFileTree = (
    files: { path: string; data: ArrayBuffer; blobUrl: string }[]
  ): FileNode[] => {
    const root: FileNode = { name: '', type: 'folder', children: [] };

    files.forEach(({ path, data, blobUrl }) => {
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
            rawData: isFile ? data : undefined,
            content: isFile ? blobUrl : undefined,
            fullPath: pathSegments.join('/'),
          };
          current.children?.push(newNode);
          current = newNode;

          if (isFile) {
            newNode.selected = true; // Default to checked
          }
        }
      });
    });

    return root.children || [];
  };

  // ======================
  // HANDLE FILE SELECTION
  // ======================
  const handleFileSelect = useCallback((node: FileNode) => {
    if (node.type === 'folder') return;
    setSelectedFile(node);
  }, []);

  // Helper to get all files from the tree
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    return nodes.flatMap((node) => {
      if (node.type === 'folder' && node.children) {
        return getAllFiles(node.children);
      }
      return node.type === 'file' ? [node] : [];
    });
  };

  // ======================
  // ANALYZE ALL FILES
  // ======================
  const analyzeFiles = async () => {
    try {
      const selectedFiles = getAllFiles(fileTree).filter((f) => f.selected);

      // Phase 1: Extract text
      setProcessingPhase('extracting');
      setIsAnalyzing(true);
      setProgress(0);
      setProcessedFiles(0);

      const total = selectedFiles.length;
      setTotalFiles(total);

      const newExtractedTexts: Record<string, string> = {};
      let processedCount = 0;

      const traverseAndExtract = async (nodes: FileNode[]) => {
        for (const node of nodes) {
          if (node.type === 'folder' && node.children) {
            await traverseAndExtract(node.children);
          } else if (node.type === 'file' && node.rawData) {
            let extracted = '';

            // PDF Extraction
            if (node.name.toLowerCase().endsWith('.pdf')) {
              try {
                const data = new Uint8Array(node.rawData as ArrayBuffer);
                const pdf = await getDocument({ data }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const content = await page.getTextContent();
                  text +=
                    content.items
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
                const workbook = XLSX.read(new Uint8Array(node.rawData), {
                  type: 'array',
                });
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
        }
      };

      await traverseAndExtract(selectedFiles);
      setExtractedTexts(newExtractedTexts);

      // Phase 2: Summarization
      setProcessingPhase('summarizing');
      setProgress(0);
      setProcessedFiles(0);

      const newSummaries: Record<string, string> = {};
      let summaryCount = 0;

      for (const [fullPath, text] of Object.entries(newExtractedTexts)) {
        try {
          const prompt = `Summarize the following text in one paragraph,
            focusing on key financial metrics, risks, and opportunities.
            Recall that the text could be written in different languages other than English.
            \n\n${text}`;

          if (DEVELOPMENT) {
            newSummaries[fullPath] = 'Some random text for development purposes.....';
          } else {
            const res = await fetch('/api/llm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: prompt,
                context: text.substring(0, 2000) || '', // keep context short
                history: [], // No chat history appended
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
        setProgress(Math.round((summaryCount / Object.keys(newExtractedTexts).length) * 100));
      }

      setSummaries(newSummaries);
    } catch (error) {
      console.error('Processing error:', error);
    } finally {
      setIsAnalyzing(false);
      setProcessingPhase('idle');
    }
  };

  // State for toggling extracted text
  const [showExtracted, setShowExtracted] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* DRAG & DROP / FOLDER UPLOAD */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
              isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-gray-600">
              {isDragActive ? 'Drop ZIP file here' : 'Drag and drop a ZIP file or click to select'}
            </p>
          </div>

          <div className="mt-4 flex gap-4">
            <input
              type="file"
              id="folder-upload"
              ref={(input) => {
                if (input) input.webkitdirectory = true;
              }}
              onChange={handleFolderUpload}
              className="hidden"
            />
            <button
              onClick={() => document.getElementById('folder-upload')?.click()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Upload Folder
            </button>
          </div>
        </div>

        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={analyzeFiles}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Files'}
              </button>

              <button
                onClick={() => toggleAllFiles(!allSelected)}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>

              <span className="text-sm text-gray-600 ml-4">
                {getAllFiles(fileTree).filter((f) => f.selected).length} files selected
              </span>

              {/* Progress info (only show while analyzing) */}
              {isAnalyzing && (
                <div className="flex flex-col items-end space-y-2">
                  <div className="w-64 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">
                    {processingPhase === 'extracting' &&
                      `Converting files to text: ${processedFiles}/${totalFiles} (${progress}%)`}
                    {processingPhase === 'summarizing' &&
                      `Summarizing files: ${processedFiles}/${totalFiles} (${progress}%)`}
                  </span>
                </div>
              )}
            </div>

            {/* File Tree */}
            <FileTree
              nodes={fileTree}
              onSelect={handleFileSelect}
              selectedFile={selectedFile}
              onToggleConversion={(path) => {
                const updateNodes = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((n) => ({
                    ...n,
                    selected: n.fullPath === path ? !n.selected : n.selected,
                    children: n.children ? updateNodes(n.children) : undefined,
                  }));
                setFileTree((prev) => updateNodes(prev));
              }}
              onToggleHighlight={(path) => {
                const newHighlighted = new Set(highlightedFiles);
                if (newHighlighted.has(path)) {
                  newHighlighted.delete(path);
                } else {
                  newHighlighted.add(path);
                }
                setHighlightedFiles(newHighlighted);

                const updateNodes = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((n) => ({
                    ...n,
                    highlighted: newHighlighted.has(n.fullPath!),
                    children: n.children ? updateNodes(n.children) : undefined,
                  }));
                setFileTree(updateNodes(fileTree));
              }}
            />
          </div>
        )}

        {/* FILE PREVIEW & EXTRACTED TEXT */}
        {selectedFile && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">{selectedFile.name}</h3>

            {/* File Preview */}
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-600 mb-2">File Preview</h4>
              {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedFile.content}
                  className="w-full h-96 border rounded-lg"
                  title="PDF Preview"
                />
              ) : selectedFile.name.toLowerCase().match(/\.(xlsx|xls)$/) ? (
                <p>Excel preview not supported directly in the browser, but you can download the file.</p>
              ) : (
                <p>Preview not available for this file type</p>
              )}
            </div>

            {/* Extracted Text: show/hide toggle */}
            {extractedTexts[selectedFile.fullPath || ''] && (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-800 mb-2">Extracted Text</h4>
                  <button
                    onClick={() => setShowExtracted((prev) => !prev)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    {showExtracted ? 'Hide' : 'Show'} Extracted Text
                  </button>
                </div>

                {showExtracted && (
                  <div className="border p-3 rounded bg-gray-50 text-sm text-gray-800">
                    {/* Replace the old raw text with the new Markdown component */}
                    <ExtractedTextContent content={extractedTexts[selectedFile.fullPath || '']} />
                  </div>
                )}
              </div>
            )}


            {/* AI Summary & Reasoning */}
            {summaries[selectedFile.fullPath || ''] && (
              <div className="mt-8 border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm mr-2">
                    AI Summary
                  </span>
                  Key Insights
                </h4>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <SummaryContent content={summaries[selectedFile.fullPath || '']} />
                  <div className="mt-4 flex items-center text-sm text-green-700">
                    <InformationCircleIcon className="w-4 h-4 mr-1" />
                    Summary generated by AI - verify against original documents
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTEXT SELECTION */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* NEW: No Context */}
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                <input
                  type="radio"
                  checked={contextType === 'none'}
                  onChange={() => setContextType('none')}
                  className="w-4 h-4"
                />
                <span className="flex items-center gap-1">
                  No Context
                  <span className="text-gray-500 text-xs">(Question only)</span>
                </span>
              </label>


            <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <input
                type="radio"
                checked={contextType === 'local'}
                onChange={() => setContextType('local')}
                className="w-4 h-4"
              />
              <span className="flex items-center gap-1">
                Local Context
                <span className="text-gray-500 text-xs">(Current file only)</span>
              </span>
            </label>
            <label className="flex items-center gap-1 text-sm font-medium text-gray-700 ml-4">
              <input
                type="radio"
                checked={contextType === 'global'}
                onChange={() => setContextType('global')}
                className="w-4 h-4"
              />
              <span className="flex items-center gap-1">
                Global Context
                <span className="text-gray-500 text-xs">
                  ({getAllFiles(fileTree).filter((f) => f.selected).length} files selected)
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* CHAT */}
        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-900">
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm mr-2">
              Ask Me Anything
            </span>
            About This File
          </h3>

          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {chatHistory.map((msg, idx) => (
              <ChatMessage key={idx} role={msg.role} content={msg.content} />
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="flex gap-2 text-gray-600">
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="flex-1 p-2 border rounded-lg"
              placeholder="Ask a question about this file..."
              rows={2}
              disabled={isChatLoading}
            />
            <button
              type="submit"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              disabled={isChatLoading}
            >
              {isChatLoading ? 'Sending...' : 'Ask'}
            </button>
          </form>
        </div>

        {/* SUBSCRIBE SECTION */}
        {!isSubscribed && (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors">
              Subscribe Now
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
