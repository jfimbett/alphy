'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Components
import FileTree, { FileNode } from '@/components/FileTree';
import SelectedFilePanel from '@/components/dashboard/FilePreviewSection';
import ChatSection from '@/components/dashboard/ChatSection';
import ChatContextRadioButtons from '@/components/dashboard/RadioButtons';
import ModelSelector from '@/components/dashboard/ModelSelector';
import FileAnalysisButtons from '@/components/dashboard/FileAnalysisProgress';
import SaveModal from '@/components/dashboard/SaveSessionModal';
import LoadModal from '@/components/dashboard/LoadSessionModal';
import FileUploadArea from '@/components/dashboard/FileUploadArea'; // We'll use this now

// Hooks
import { useFileProcessing } from './useFileProcessing';
import { useChat } from './useChat';

// Utility
import { addBase64ToTree, convertTree } from './utils/fileTreeHelpers';

// Icons (optional usage)
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Types
import { SessionSummary } from '@/app/history/page';
import { run } from 'node:test';

// ---------------------------------------------------
// Helper Functions (NEWLY ADDED)
// ---------------------------------------------------

// Token estimation with optional GPT-3 encoder
const estimateTokens = (text: string): number => {
  // Simple heuristic (1 token ≈ 4 characters)
  const heuristicEstimate = Math.ceil(text.length / 4);

  // For better accuracy, you could use a tokenizer library like `gpt-3-encoder`:
  // const { encode } = require('gpt-3-encoder');
  // return encode(text).length;

  return heuristicEstimate;
};

// Enhanced merge function with conflict resolution
const mergeConsolidatedCompanies = (companiesArray: any[]) => {
  const companyMap = new Map<string, any>();

  companiesArray.forEach((company) => {
    const existing = companyMap.get(company.name);

    if (!existing) {
      companyMap.set(company.name, {
        ...company,
        variables: deepClone(company.variables),
        dates: [...company.dates],
      });
      return;
    }

    // Merge variables with priority to newer data
    existing.variables = deepMerge(existing.variables, company.variables);

    // Deduplicate and sort dates
    existing.dates = Array.from(new Set([...existing.dates, ...company.dates])).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  });

  return Array.from(companyMap.values());
};

// Deep clone helper
const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));

// Deep merge helper
const deepMerge = (target: any, source: any) => {
  Object.keys(source).forEach((key) => {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  });
  return Object.assign(target, source);
};

// ---------------------------------------------------

type ExistingUpload = {
  upload_id: number;
  upload_name: string;
};

export default function Dashboard() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  // ---------------------------
  // State for File Processing
  // ---------------------------
  const {
    fileTree,
    setFileTree,
    extractedTexts,
    setExtractedTexts,
    summaries,
    setSummaries,
    extractedCompanies,
    rawResponses,
    setRawResponses,
    isAnalyzing,
    processingPhase,
    progress,
    totalFiles,
    processedFiles,
    processZip,
    processFolder,
    analyzeFiles,
    toggleAllFiles,
    saveHeavyData,
    getConsolidationPrompt,
    consolidatedCompanies,
  } = useFileProcessing();

  // ---------------------------
  // State for Chat
  // ---------------------------
  const {
    contextType,
    setContextType,
    chatMessage,
    setChatMessage,
    chatHistory,
    setChatHistory,
    isChatLoading,
    handleChatSubmit,
  } = useChat();

  const [selectedSummarizationModel, setSelectedSummarizationModel] = useState('deepseek:deepseek-chat');
  const [selectedInfoRetrievalModel, setSelectedInfoRetrievalModel] = useState('deepseek:deepseek-reasoner');
  const [runSummarization, setRunSummarization] = useState(true);
  const [runInfoRetrieval, setRunInfoRetrieval] = useState(true);
  const [currentZipName, setCurrentZipName] = useState<string | null>(null);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [showExtracted, setShowExtracted] = useState(false);
  const [allSelected, setAllSelected] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [existingUploads, setExistingUploads] = useState<ExistingUpload[]>([]);
  const [selectedUploadOption, setSelectedUploadOption] = useState<'new' | 'existing'>('new');
  const [newUploadName, setNewUploadName] = useState('');
  const [existingUploadId, setExistingUploadId] = useState<number | null>(null);
  const [fetchingUploads, setFetchingUploads] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<SessionSummary[]>([]);
  const [isConsolidating, setIsConsolidating] = useState(false);

  // New state for LLM consolidation debug info
  const [llmConsolidationDebug, setLlmConsolidationDebug] = useState<
    { prompt: string; response: string }[]
  >([]);

  // New state to toggle showing the debug panel
  const [showDebug, setShowDebug] = useState(false);

  // ---------------------------------------------------
  // Consolidate Companies (UPDATED)
  // ---------------------------------------------------
  const handleConsolidateCompanies = async (sessionId: string) => {

    setIsConsolidating(true);
    try {
      // 1. Calculate token capacity
      const MAX_TOKENS = 65536;
      const SAFETY_MARGIN = 5000;
      const systemMessage = 'You are a helpful assistant.'; // Use actual context if available
      const basePrompt = getConsolidationPrompt([]); // Get template without data

      // Estimate base tokens (system message + empty prompt)
      const baseTokens = estimateTokens(systemMessage) + estimateTokens(basePrompt);
      const availableTokens = MAX_TOKENS - baseTokens - SAFETY_MARGIN;

      if (availableTokens <= 0) {
        throw new Error('Base prompt exceeds token limit');
      }

      // 2. Calculate chunk sizes dynamically
      const chunks: any[][] = [];
      let currentChunk: any[] = [];
      let currentTokens = 0;

      for (const [key, entry] of Object.entries(rawResponses)) {
        const entryText = JSON.stringify(entry);
        // Add 2 tokens for JSON formatting overhead
        const entryTokens = estimateTokens(entryText) + 2; 

        // Check if entry is too big to process alone
        if (entryTokens > availableTokens) {
          throw new Error(
            `Entry too large (${entryTokens} tokens). Max allowed: ${availableTokens}`
          );
        }

        if (currentTokens + entryTokens > availableTokens) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentTokens = 0;
        }

        currentChunk.push(entry);
        currentTokens += entryTokens;
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      // 3. Process chunks in parallel with error handling
      const consolidationDebug: Array<{ prompt: string; response: string }> = [];
      debugger;
      const chunkPromises = chunks.map(async (chunk) => {
        const chunkPrompt = getConsolidationPrompt(chunk);
        try {
          const res = await fetch('/api/llm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: chunkPrompt,
              model: selectedInfoRetrievalModel,
              format: 'json',
              requestType: 'consolidation',
            }),
          });
      
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          
          const { content } = await res.json();
          const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
          consolidationDebug.push({ prompt: chunkPrompt, response: cleanedContent });
      
          // Validate response structure
          const parsed = JSON.parse(cleanedContent);
          if (!Array.isArray(parsed)) {
            console.error('Invalid consolidation format - not an array:', parsed);
            return [];
          }
          
          // Validate minimum required fields
          const validEntries = parsed.filter((item: any) => 
            item?.name && item?.type && item?.variables
          );
          
          return validEntries;
      
        } catch (error) {
          console.error('Chunk processing failed:', error);
          return []; // Return empty array to prevent pipeline failure
        }
      });

      // 4. Process all chunks and merge results
      const chunkResults = await Promise.all(chunkPromises);
      const validResults = chunkResults.filter(Array.isArray);

      if (validResults.length === 0) {
        throw new Error('All consolidation chunks failed validation');
      }

      const mergedData = mergeConsolidatedCompanies(validResults.flat());

      // Add final validation
      if (!mergedData || mergedData.length === 0) {
        console.error('Final merged data validation failed:', {
          chunkResults,
          mergedData
        });
        throw new Error('Consolidation produced empty results');
      }

      // 5. Final validation and save
      if (mergedData.length === 0) {
        throw new Error('Consolidation produced empty results');
      }

      setLlmConsolidationDebug(consolidationDebug);

      // Save your updated data
      await saveHeavyData(sessionId, {
        fileTree,
        extractedTexts,
        summaries,
        extractedCompanies,
        rawResponses,
        consolidatedCompanies: mergedData,
      });

      console.log('Raw chunk data:', chunks);
      console.log('Chunk prompts:', chunks.map(chunk => getConsolidationPrompt(chunk)));
      console.log('LLM Responses:', llmConsolidationDebug);
      console.log('Merged data:', mergedData);

      // Finally, redirect (or do whatever you need)
      router.push(`/companies?sessionId=${sessionId}`);
    } catch (error) {
      console.error('Consolidation error:', error);
      alert(`Consolidation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`);
    } finally {
      setIsConsolidating(false);
    }
  };

  // ---------------------------
  // On Mount: Check User Auth
  // ---------------------------
  useEffect(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) {
      router.push('/login');
    }
  }, [router]);

  // ---------------------------
  // Helper to get all files
  // ---------------------------
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    return nodes.flatMap((node) => {
      if (node.type === 'folder' && node.children) {
        return getAllFiles(node.children);
      }
      return node.type === 'file' ? [node] : [];
    });
  };

  // ---------------------------
  // File Selection
  // ---------------------------
  const handleFileSelect = (node: FileNode) => {
    if (node.type === 'folder') return;
    if (!node.content) node.content = ''; // Ensure content is always a string
    setSelectedFile(node);
  };

  // ---------------------------
  // "Save Session" Modal
  // ---------------------------
  const openSaveModal = async () => {
    setNewUploadName('');
    setExistingUploadId(null);
    setSelectedUploadOption('new');
    try {
      setFetchingUploads(true);
      const res = await fetch('/api/uploads', {
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
      });
      if (!res.ok) throw new Error('Failed to fetch existing uploads');
      const data = await res.json();
      setExistingUploads(data.uploads || []);
    } catch (err) {
      console.error('Error fetching uploads:', err);
      setExistingUploads([]);
    } finally {
      setFetchingUploads(false);
      setShowSaveModal(true);
    }
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
  };

  const handleSaveConfirm = async () => {
    try {
       // Get the session name from your state (you'll need to ensure this is populated)
      const sessionName = newUploadName.trim() || `Session ${new Date().toLocaleDateString()}`;
      const sessionId = await saveSession(sessionName);
      localStorage.setItem('currentSessionId', sessionId);
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error in handleSaveConfirm:', error);
      alert('Error saving data: ' + (error as Error).message);
    }
  };

  async function saveSession(sessionName: string): Promise<string> {
    const fileTreeWithBase64 = addBase64ToTree(fileTree);

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localStorage.getItem('userId') || '',
      },
      body: JSON.stringify({ sessionName }),
    });
    if (!res.ok) throw new Error('Failed to save session');
    const data = await res.json();

    setCurrentSessionId(data.session_id);

    await saveHeavyData(data.session_id, {
        fileTree: fileTreeWithBase64,
        extractedTexts,
        summaries,
        extractedCompanies,
        rawResponses,
      });

    setCurrentSessionId(data.session_id);

    setSuccessMessage('Session saved successfully!');

    return data.session_id;
  }

  // ---------------------------
  // "Load Session" Modal
  // ---------------------------
  const handleLoadClick = async () => {
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'x-user-id': localStorage.getItem('userId') || '' },
      });
      const data = await res.json();
      setAvailableSessions(data.sessions);
      setShowLoadModal(true);
    } catch {
      alert('Error loading sessions');
    }
  };

  const confirmLoadSession = async (sessionId: string) => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        router.push('/login');
        return;
      }

      // 1) Confirm the session is available
      const response = await fetch('/api/sessions', {
        headers: { 'x-user-id': userId },
      });
      if (!response.ok) throw new Error('Failed to load session');
      const data = await response.json();
      if (!data.sessions || data.sessions.length === 0) {
        alert('No session data found.');
        return;
      }

      setCurrentSessionId(sessionId);

      // 2) Fetch heavy data
      const heavyRes = await fetch(`/api/store-heavy-data?sessionId=${sessionId}`);
      if (!heavyRes.ok) throw new Error('Failed to load heavy data');
      const heavyData = await heavyRes.json();

      setRawResponses(heavyData.rawResponses || {});

      // 3) Rebuild the fileTree from base64
      const rebuiltTree = convertTree(heavyData.fileTree || [], sessionId);
      setFileTree(rebuiltTree);

      // 4) Restore chat history, extracted texts, summaries
      setChatHistory(heavyData.chatHistory || []);
      setExtractedTexts(heavyData.extractedTexts || {});
      setSummaries(heavyData.summaries || {});
      localStorage.setItem('currentSessionId', sessionId);
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Error loading session: ' + (error as Error).message);
    }
  };

  // ---------------------------
  // Rendering
  // ---------------------------
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
            {successMessage}
          </div>
        )}

        {/* File Upload Area */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <FileUploadArea
            processZip={processZip}
            processFolder={processFolder}
            handleLoadClick={handleLoadClick}
            isDragActive={false}
          />
        </div>

        {/* Replace the existing ModelSelector section with this */}
        <div className="space-y-4 mb-6 text-gray-600">
          <div className="bg-white p-4 rounded-lg">
            <label className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={runSummarization}
                onChange={(e) => setRunSummarization(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium">Enable Summarization</span>
            </label>
            <ModelSelector
              selectedModel={selectedSummarizationModel}
              onModelChange={setSelectedSummarizationModel}
              disabled={!runSummarization}
            />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <label className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                checked={runInfoRetrieval}
                onChange={(e) => setRunInfoRetrieval(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="font-medium">Enable Information Retrieval</span>
            </label>
            <ModelSelector
              selectedModel={selectedInfoRetrievalModel}
              onModelChange={setSelectedInfoRetrievalModel}
              disabled={!runInfoRetrieval}
            />
          </div>
        </div>

        {/* If we have a file tree, show Analyze + Save Buttons */}
        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <FileAnalysisButtons
                fileTree={fileTree}
                summarizationModel={runSummarization ? selectedSummarizationModel : ''}
                infoRetrievalModel={runInfoRetrieval ? selectedInfoRetrievalModel : ''}
                consolidationModel={runInfoRetrieval ? selectedInfoRetrievalModel : ''}
                runSummarization={runSummarization}
                runInfoRetrieval={runInfoRetrieval}
                analyzeFiles={async () => {
                  try {
                    // Run analysis
                        await analyzeFiles({
                          runSummarization,
                          runInfoRetrieval,
                          summarizationModel: runSummarization ? selectedSummarizationModel : undefined,
                          infoRetrievalModel: runInfoRetrieval ? selectedInfoRetrievalModel : undefined
                        });
                  
                        // Auto-save session with generated name
                        const sessionName = `Analysis ${new Date().toLocaleDateString()}`;
                        const sessionId = await saveSession(sessionName);
                        
                        // Trigger consolidation with the new session ID
                        await handleConsolidateCompanies(sessionId);
                      } catch (error) {
                        console.error('Processing error:', error);
                        alert("Analysis failed: " + (error instanceof Error ? error.message : 'Unknown error'));
                      }
                    }}
                openSaveModal={openSaveModal}
                toggleAllFiles={toggleAllFiles}
                allSelected={allSelected}
                setAllSelected={setAllSelected}
                getAllFiles={getAllFiles}
                isAnalyzing={isAnalyzing}
                progress={progress}
                processingPhase={processingPhase}
                processedFiles={processedFiles}
                totalFiles={totalFiles}
              />
            </div>

            {/* Actual File Tree */}
            <FileTree
              nodes={fileTree}
              onSelect={handleFileSelect}
              selectedFile={
                selectedFile ? { ...selectedFile, content: selectedFile.content || '' } : null
              }
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

        {/* Selected File Preview */}
        {selectedFile && (
          <SelectedFilePanel
            selectedFile={{ ...selectedFile, content: selectedFile.content || '' }}
            extractedTexts={extractedTexts}
            extractedCompanies={extractedCompanies}
            summaries={summaries}
            showExtracted={showExtracted}
            setShowExtracted={setShowExtracted}
            rawResponses={rawResponses}
          />
        )}

        {fileTree.length > 0 && (
          <button
            onClick={() => {
              if (!currentSessionId) {
                alert('Please save the session first');
                return;
              }
              handleConsolidateCompanies(currentSessionId);
            }}
            disabled={isConsolidating || !currentSessionId}
            className={`px-4 py-2 rounded ${
              isConsolidating || !currentSessionId
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isConsolidating ? 'Consolidating...' : 'Consolidate Companies'}
          </button>
        )}

        {/* Toggle Button for Debug Info */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="mb-4 bg-gray-200 text-gray-800 px-3 py-1 rounded ml-2"
        >
          {showDebug ? 'Hide LLM Debug Info' : 'Show LLM Debug Info'}
        </button>

        {showDebug && (
          <div className="bg-white p-4 rounded shadow mb-6 max-h-80 overflow-y-auto text-gray-600">
            <h3 className="text-lg font-semibold mb-2">Extraction Debug Info</h3>
            {Object.entries(rawResponses).map(([filePath, debug]) => (
              <div key={filePath} className="mb-4 border-b pb-2">
                <p className="font-medium text-gray-700">File: {filePath}</p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Prompt:</span> {debug.prompt}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Response:</span> {debug.response}
                </p>
              </div>
            ))}
            {llmConsolidationDebug.length > 0 && (
              <div className="mt-4 border-t pt-2">
                <h3 className="text-lg font-semibold mb-2">Consolidation Debug Info</h3>
                {llmConsolidationDebug.map((debug, index) => (
                  <div key={index} className="mb-4 border-b pb-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Prompt:</span> {debug.prompt}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Response:</span> {debug.response}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
    

        {/* Save Modal */}
        <SaveModal
          showSaveModal={showSaveModal}
          newUploadName={newUploadName}
          setNewUploadName={setNewUploadName}
          closeSaveModal={closeSaveModal}
          handleSaveConfirm={handleSaveConfirm}
        />
      </main>

      {/* Load Modal (rendered outside main for simplicity) */}
      <LoadModal
        showLoadModal={showLoadModal}
        availableSessions={availableSessions}
        confirmLoadSession={confirmLoadSession}
        setShowLoadModal={setShowLoadModal}
      />
    </div>
  );
}
