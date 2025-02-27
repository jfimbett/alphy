'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Components
import Navbar from '@/components/Navbar';
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
    fileTree, setFileTree, extractedTexts, setExtractedTexts, summaries, setSummaries, extractedCompanies, 
    rawResponses, setRawResponses,
    isAnalyzing, processingPhase, progress, totalFiles, 
    processedFiles, processZip, processFolder, analyzeFiles, 
    toggleAllFiles, saveHeavyData, consolidatedCompanies
  } = useFileProcessing();

  // ---------------------------
  // State for Chat
  // ---------------------------
  const { contextType, setContextType, chatMessage, setChatMessage, chatHistory, setChatHistory, isChatLoading, handleChatSubmit,
  } = useChat();

  // ---------------------------
  // Local UI States
  // ---------------------------
  const [selectedModel, setSelectedModel] = useState('deepseek:deepseek-reasoner');
  const [currentZipName, setCurrentZipName] = useState<string | null>(null);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [showExtracted, setShowExtracted] = useState(false);
  const [allSelected, setAllSelected] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // ---------------------------
  // Save Modal States
  // ---------------------------
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [existingUploads, setExistingUploads] = useState<ExistingUpload[]>([]);
  const [selectedUploadOption, setSelectedUploadOption] = useState<'new' | 'existing'>('new');
  const [newUploadName, setNewUploadName] = useState('');
  const [existingUploadId, setExistingUploadId] = useState<number | null>(null);
  const [fetchingUploads, setFetchingUploads] = useState(false);

  // ---------------------------
  // Load Modal States
  // ---------------------------
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<SessionSummary[]>([]);

  // consolidating information
  const [isConsolidating, setIsConsolidating] = useState(false);

  const handleConsolidateCompanies = async () => {
    if (!currentSessionId) {
      alert('Please save the session first')
      return
    }
  
    setIsConsolidating(true)
    try {
      // Prepare consolidation prompt
      const consolidationPrompt = `Consolidate all company information from these documents into a structured JSON format. Follow these rules:
      1. Group information by company name
      2. Standardize variable names (snake_case, English)
      3. Split currency and values (e.g., "NOK 28.0m" → {value: 28.0, currency: "NOK", unit: "m"})
      4. Maintain all dates associated with each company
      5. Remove duplicates
      
      Output format: [{
        "name": "Company Name",
        "variables": {
          "variable_name": { "value": number, "currency": string, "unit": string }
        },
        "dates": string[]
      }]
      
      Raw data: ${JSON.stringify(rawResponses)}`
  
      // Call LLM API
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: consolidationPrompt,
          model: selectedModel,
          format: 'json',
          requestType: 'consolidation'
        })
      })
  
      if (!res.ok) throw new Error('Consolidation failed')
      
      const { content } = await res.json()
      const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '');
      const consolidatedData = JSON.parse(cleanedContent);
  
      // Save consolidated data
      await saveHeavyData(currentSessionId, {
        fileTree,
        extractedTexts,
        summaries,
        extractedCompanies,
        rawResponses,
        consolidatedCompanies: consolidatedData
      });
  
      router.push(`/companies?sessionId=${currentSessionId}`)
    } catch (error) {
      console.error('Consolidation error:', error)
      alert(`Consolidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsConsolidating(false)
    }
  }

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
      await saveSession();
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error in handleSaveConfirm:', error);
      alert('Error saving data: ' + (error as Error).message);
    }
  };

  async function saveSession(): Promise<string> {
    // 1) Convert rawData -> base64
    const fileTreeWithBase64 = addBase64ToTree(fileTree);

    // 2) Create a minimal session row in DB
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localStorage.getItem('userId') || '',
      },
      body: JSON.stringify({
        sessionName: newUploadName.trim(),
      }),
    });
    if (!res.ok) throw new Error('Failed to save session');
    const data = await res.json();
    setCurrentSessionId(data.session_id);

    // 3) Store heavy data (fileTree, chatHistory, extracted, summaries)
    await saveHeavyData(data.session_id, {
      fileTree: fileTreeWithBase64,
      extractedTexts,
      summaries,
      extractedCompanies,
      rawResponses
    });

    setSuccessMessage('Session saved successfully!');
    setTimeout(() => setSuccessMessage(''), 5000);

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
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
            {successMessage}
          </div>
        )}

        {/* -----
             File Upload Area
             You can remove the inline code if your <FileUploadArea> handles everything.
         ----- */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <FileUploadArea
            processZip={processZip}
            processFolder={processFolder}
            handleLoadClick={handleLoadClick}
            isDragActive={false}
          />
        </div>

        {/* Model Selector + Optional Info Icon */}
        <div className="flex items-center gap-2 mb-4">
          <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
          {/* Optionally show an info icon */}
          <InformationCircleIcon className="h-5 w-5 text-gray-500" title="Select your model" />
        </div>

        {/* If we have a file tree, show Analyze + Save Buttons */}
        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <FileAnalysisButtons
                fileTree={fileTree}
                selectedModel={selectedModel}
                analyzeFiles={analyzeFiles}
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
              selectedFile={selectedFile ? { ...selectedFile, content: selectedFile.content || '' } : null}
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
            onClick={handleConsolidateCompanies}
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

        {/* Radio Buttons to change "contextType"? */}
        <ChatContextRadioButtons fileTree={fileTree} getAllFiles={getAllFiles} />

        {/* Chat Section */}
        <ChatSection
          chatHistory={chatHistory}
          formRef={formRef}
          handleChatSubmit={handleChatSubmit}
          extractedTexts={extractedTexts}
          selectedFile={selectedFile}
          highlightedFiles={highlightedFiles}
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          isChatLoading={isChatLoading}
          selectedModel={selectedModel}
        />

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
