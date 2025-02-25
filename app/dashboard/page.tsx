'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FileTree, { FileNode } from '@/components/FileTree';
import { ChatMessage } from '@/components/ChatMessage';
import { SummaryContent } from '@/components/SummaryContent';
import { ExtractedTextContent } from '@/components/ExtractedTextComponent';
import { useFileProcessing } from './useFileProcessing';
import { useChat } from './useChat';
import { useDropzone } from 'react-dropzone';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { SessionSummary } from '@/app/history/page';
import { CompanyInfoComponent } from '@/components/CompanyInfoComponent';

type ExistingUpload = {
  upload_id: number;
  upload_name: string;
};

export default function Dashboard() {

  const [selectedModel, setSelectedModel] = useState('local:deepseek-r1:70b');


  const router = useRouter();

  const {
    fileTree,
    setFileTree,
    extractedTexts,
    setExtractedTexts,
    summaries,
    setSummaries,
    extractedCompanies,
    isAnalyzing,
    processingPhase,
    progress,
    totalFiles,
    processedFiles,
    processZip,
    processFolder,
    analyzeFiles,
    toggleAllFiles,
    saveHeavyData
  } = useFileProcessing();

  const {
    contextType,
    setContextType,
    chatMessage,
    setChatMessage,
    chatHistory,
    setChatHistory,
    isChatLoading,
    handleChatSubmit
  } = useChat();

  const [currentZipName, setCurrentZipName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [showExtracted, setShowExtracted] = useState(false);
  const [allSelected, setAllSelected] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // ---------------------
  // SAVE PROGRESS MODAL
  // ---------------------
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [existingUploads, setExistingUploads] = useState<ExistingUpload[]>([]);
  const [selectedUploadOption, setSelectedUploadOption] = useState<'new' | 'existing'>('new');
  const [newUploadName, setNewUploadName] = useState('');
  const [existingUploadId, setExistingUploadId] = useState<number | null>(null);
  const [fetchingUploads, setFetchingUploads] = useState(false);


  const [showLoadModal, setShowLoadModal] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<SessionSummary[]>([]);

  // New load handler
  const handleLoadClick = async () => {
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'x-user-id': localStorage.getItem('userId') || '' }
      });
      const data = await res.json();
      setAvailableSessions(data.sessions);
      setShowLoadModal(true);
    } catch {
      alert('Error loading sessions');
    }
  };

  // Updated load confirmation
  const confirmLoadSession = async (sessionId: string) => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/sessions', {
        headers: { 'x-user-id': userId }
      });
      
      if (!response.ok) throw new Error('Failed to load session');
      const data = await response.json();

      if (!data.sessions || data.sessions.length === 0) {
        alert('No session data found.');
        return;
      }

      setCurrentSessionId(sessionId);

      // 2) Fetch heavy data
      const heavyRes = await fetch(
        `/api/store-heavy-data?sessionId=${sessionId}`
      );
      if (!heavyRes.ok) throw new Error('Failed to load heavy data');
      const heavyData = await heavyRes.json();

      // 3) Rebuild the fileTree from base64
      const rebuiltTree = convertTree(heavyData.fileTree || [], sessionId);
      setFileTree(rebuiltTree);

      // 4) Also restore chat history, extracted texts, summaries
      setChatHistory(heavyData.chatHistory || []);
      setExtractedTexts(heavyData.extractedTexts || {});
      setSummaries(heavyData.summaries || {});
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Error loading session: ' + (error as Error).message);
    }
  };

  // print to console the variables not used for now
  console.log(fetchingUploads, existingUploadId, selectedUploadOption, existingUploads, currentSessionId, currentZipName);

  // On mount, check if user is logged in
  useEffect(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) {
      router.push('/login');
    }
  }, [router]);

  // --------------------------------
  // Open/Close "Save Session" Modal
  // --------------------------------
  const openSaveModal = async () => {
    setNewUploadName('');
    setExistingUploadId(null);
    setSelectedUploadOption('new');
    try {
      setFetchingUploads(true);
      const res = await fetch('/api/uploads', {
        headers: { 'x-user-id': localStorage.getItem('userId') || '' }
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

  // --------------------------------
  // Actually "Save Session"
  // --------------------------------
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
    console.log('fileTreeWithBase64', fileTreeWithBase64);
    // 2) Create a minimal session row in DB (or skip if you prefer)
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localStorage.getItem('userId') || ''
      },
      body: JSON.stringify({
        sessionName: newUploadName.trim()
      })
    });
    if (!res.ok) throw new Error('Failed to save session');
    const data = await res.json();
    setCurrentSessionId(data.session_id);
  
    // 3) Store heavy data (fileTree, chatHistory, extracted, summaries)
    await saveHeavyData(data.session_id);
  
    setSuccessMessage('Session saved successfully!');
    setTimeout(() => setSuccessMessage(''), 5000);
  
    return data.session_id;
  }



  // Helper to convert base64 -> rawData
  function convertTree(nodes: FileNode[], sessionId: number | string): FileNode[] {
    return nodes.map((node) => {
      if (node.type === 'folder' && node.children) {
        return { ...node, children: convertTree(node.children, sessionId) };
      }


      // If it's a file, handle base64 => rawData and also localPath => node.content
      if (node.type === "file") {
        // 1) If there's base64Data, convert to rawData
        if (node.base64Data) {
          const binaryString = atob(node.base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          node.rawData = bytes.buffer;
          node.base64Data = undefined; // free it up
        }

        // 2) If there's a localPath (meaning we wrote this file to disk),
        // build the route for inline preview
        if (node.localPath) {

          node.content = `/api/session-file?sessionId=${sessionId}&filePath=${encodeURIComponent(node.localPath || '')}`;
        }
      }
      return node;
      });
      }

  // The addBase64ToTree function from your code, ensuring each file node has base64Data
function addBase64ToTree(nodes: FileNode[]): FileNode[] {
  return nodes.map((node) => {
    if (node.type === 'folder' && node.children) {
      return { ...node, children: addBase64ToTree(node.children) };
    }
    if (node.type === 'file' && node.rawData) {
      const uint8 = new Uint8Array(node.rawData);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64Data = btoa(binary);
      return { ...node, base64Data };
    }
    return node;
  });
}

  // --------------------------------
  // FILE SELECTION / HELPERS
  // --------------------------------
  const handleFileSelect = (node: FileNode) => {
    if (node.type === 'folder') return;
    setSelectedFile(node);
  };
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    return nodes.flatMap((node) => {
      if (node.type === 'folder' && node.children) {
        return getAllFiles(node.children);
      }
      return node.type === 'file' ? [node] : [];
    });
  };

  // --------------------------------
  // DROPZONE
  // --------------------------------
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      const zipFile = acceptedFiles.find((file) => file.name.endsWith('.zip'));
      if (zipFile) {
        setCurrentZipName(zipFile.name.replace('.zip', ''));
        await processZip(zipFile);
      }
    },
    accept: { 'application/zip': ['.zip'] },
    multiple: false
  });

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

        {/* Drag & Drop / Folder Upload */}
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
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex gap-2">
              <input
                type="file"
                id="folder-upload"
                ref={(input) => {
                  if (input) input.webkitdirectory = true;
                }}
                onChange={(e) => {
                  if (!e.target.files) return;
                  processFolder(e.target.files);
                }}
                className="hidden"
              />
              <button
                onClick={() => document.getElementById('folder-upload')?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Upload Folder
              </button>
              <button
                onClick={handleLoadClick}
                className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                Load Progress
              </button>
            </div>
            <small className="text-gray-500">
              Your browser may show a brief warning when uploading a folder. This is normal.
            </small>
          </div>
        </div>

        {/* Model Selection */}
        <div className="mb-4 text-gray-800">
  <label className="block text-sm font-medium mb-1">AI Model</label>
  <select
    value={selectedModel}
    onChange={(e) => setSelectedModel(e.target.value)}
    className="w-full p-2 border rounded bg-white"
  >
    {/* Local Models */}
    <optgroup label="Local Models" style={{ backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_Hugging_Face.svg/1200px-Logo_of_Hugging_Face.svg.png')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left center', paddingLeft: '24px' }}>
      <option value="local:deepseek-r1:70b">DeepSeek R1 70B (Local)</option>
      <option value="local:llama2">Llama 2 (Local)</option>
      <option value="local:falcon-40b">Falcon 40B (Local)</option>
      <option value="local:mistral-7b">Mistral 7B (Local)</option>
      <option value="local:stablelm-zephyr">StableLM Zephyr (Local)</option>
    </optgroup>


    <optgroup label="OpenAI Models" style={{ backgroundImage: `url('https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/OpenAI_Logo.svg/1200px-OpenAI_Logo.svg.png')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left center', paddingLeft: '24px' }}>
      <option value="openai:gpt-3.5-turbo">GPT-3.5 Turbo (OpenAI)</option>
      <option value="openai:gpt-4.0-turbo">GPT-4.0 Turbo (OpenAI)</option>
      <option value="openai:codex-2.0-turbo">Codex 2.0 Turbo (OpenAI)</option>
    </optgroup>
  </select>
</div>
   

        {/* If we have a file tree, show Analyze + Save Buttons */}
        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => analyzeFiles(selectedModel)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Files'}
                </button>
                <button
                  onClick={openSaveModal}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                >
                  Save Progress
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    toggleAllFiles(!allSelected);
                    setAllSelected(!allSelected);
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600">
                  {getAllFiles(fileTree).filter((f) => f.selected).length} files selected
                </span>
              </div>
              {isAnalyzing && (
                <div className="flex flex-col items-end space-y-2 ml-4">
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
                    {processingPhase === 'extracting_companies' &&
                  `Extracting company data: ${processedFiles}/${totalFiles} (${progress}%)`}
                  </span>
                </div>
              )}
            </div>

            {/* Actual File Tree */}
            <FileTree
              nodes={fileTree}
              onSelect={handleFileSelect}
              selectedFile={selectedFile}
              onToggleConversion={(path) => {
                const updateNodes = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((n) => ({
                    ...n,
                    selected: n.fullPath === path ? !n.selected : n.selected,
                    children: n.children ? updateNodes(n.children) : undefined
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
                    children: n.children ? updateNodes(n.children) : undefined
                  }));
                setFileTree(updateNodes(fileTree));
              }}
            />
          </div>
        )}

        {/* Selected File Panel */}
        {selectedFile && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">{selectedFile.name}</h3>
            <div className="mb-8">
              <h4 className="text-sm font-medium text-gray-600 mb-2">File Preview</h4>
              {selectedFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedFile.content}
                  className="w-full h-96 border rounded-lg"
                  title="PDF Preview"
                />
              ) : selectedFile.name.toLowerCase().match(/\.(xlsx|xls)$/) ? (
                <p>Excel preview not supported directly in the browser.</p>
              ) : (
                <p>Preview not available for this file type</p>
              )}
            </div>

            {/* Extracted Text Section */}
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
                    <ExtractedTextContent content={extractedTexts[selectedFile.fullPath || '']} />
                  </div>
                )}
              </div>
            )}

            {/* Extracted Companies Section */}
            {extractedCompanies[selectedFile.fullPath || '']?.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-2">
                    Companies
                  </span>
                  Extracted Entities
                </h4>
                <CompanyInfoComponent 
                  companies={extractedCompanies[selectedFile.fullPath || '']} 
                />
              </div>
            )}

            {/* Summaries Section */}
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

        {/* Radio Buttons for Chat Context */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
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

        {/* Chat Section */}
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
          <form
            ref={formRef}
            onSubmit={(e) =>
              handleChatSubmit({
                e,
                selectedFileText: extractedTexts[selectedFile?.fullPath || ''],
                globalContext: Array.from(highlightedFiles)
                  .map((path) => extractedTexts[path])
                  .join('\n\n'),
                  model: selectedModel
              })
            }
            className="flex gap-2 text-gray-600"
          >
            <textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
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

        {/* SAVE PROGRESS MODAL */}
        {showSaveModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Save Session</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Name:
                  </label>
                  <input
                    type="text"
                    className="border border-gray-300 rounded w-full p-2 text-gray-800"
                    value={newUploadName}
                    onChange={(e) => setNewUploadName(e.target.value)}
                    placeholder="Enter a session name..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={closeSaveModal}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfirm}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Save Session
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Select Session</h3>
            {availableSessions.map(session => (
              <div key={session.session_id} 
                  className="p-3 hover:bg-gray-100 cursor-pointer text-gray-600"
                  onClick={() => confirmLoadSession(session.session_id.toString())}>
                <p>{session.session_name}</p>
                <small>{new Date(session.created_at).toLocaleDateString()}</small>
              </div>
            ))}
            <button onClick={() => setShowLoadModal(false)} className="mt-4 text-gray-800">
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
