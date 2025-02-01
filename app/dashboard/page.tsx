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

type ExistingUpload = {
  upload_id: number;
  upload_name: string;
};

export default function Dashboard() {
  const router = useRouter();
  const {
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
    toggleAllFiles
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
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [showExtracted, setShowExtracted] = useState(false);
  const [allSelected, setAllSelected] = useState(true);
  console.log(currentZipName);

  // ---------------------
  // SAVE PROGRESS MODAL
  // ---------------------
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [existingUploads, setExistingUploads] = useState<ExistingUpload[]>([]);
  const [selectedUploadOption, setSelectedUploadOption] = useState<'new' | 'existing'>('new');
  const [newUploadName, setNewUploadName] = useState('');
  const [existingUploadId, setExistingUploadId] = useState<number | null>(null);
  const [fetchingUploads, setFetchingUploads] = useState(false);


  // NEW: For success message
  const [successMessage, setSuccessMessage] = useState('');

  // On mount, check if user is logged in
  useEffect(() => {
    const loggedIn = typeof window !== 'undefined'
      ? localStorage.getItem('loggedIn')
      : null;
    if (!loggedIn) {
      // If not logged in, redirect
      router.push('/login');
    }
  }, [router]);



  const openSaveModal = async () => {
    setNewUploadName('');
    setExistingUploadId(null);
    setSelectedUploadOption('new');
    try {
      setFetchingUploads(true);
      const res = await fetch('/api/uploads');
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
      const fileTreeWithBase64 = addBase64ToTree(fileTree);
      if (selectedUploadOption === 'existing' && existingUploadId) {
        await updateExistingUpload(existingUploadId, fileTreeWithBase64);
      } else {
        if (!newUploadName.trim()) {
          alert('Please enter a valid project name.');
          return;
        }
        await createNewUpload(newUploadName.trim(), fileTreeWithBase64);
      }
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error in handleSaveConfirm:', error);
      alert('Error saving data: ' + (error as Error).message);
    }
  };

  async function createNewUpload(uploadName: string, fileTreeWithBase64: FileNode[]) {
    const response = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileTree: fileTreeWithBase64,
        extractedTexts,
        summaries,
        chatHistory,
        uploadName
      })
    });
    if (!response.ok) throw new Error('Failed to save (createNewUpload)');
    const data = await response.json();
    setSuccessMessage(`Upload saved successfully! Upload ID = ${data.upload_id}`);
    // auto-hide after 3 seconds
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  async function updateExistingUpload(uploadId: number, fileTreeWithBase64: FileNode[]) {
    const response = await fetch(`/api/uploads/${uploadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileTree: fileTreeWithBase64,
        extractedTexts,
        summaries
      })
    });
    if (!response.ok) throw new Error('Failed to update existing upload');
    const data = await response.json();
    setSuccessMessage(`Upload updated successfully with ID = ${data.uploadId}`);
    setTimeout(() => setSuccessMessage(''), 3000);
  }

  // --------------------------------
  // LOAD PROGRESS
  // --------------------------------
  const handleLoadProgress = async () => {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to load session');
      const data = await response.json();
      if (!data.session_data) {
        alert('No session data found.');
        return;
      }
      const { fileTree, extractedTexts, summaries, chatHistory } = data.session_data;
      setFileTree(fileTree || []);
      setExtractedTexts(extractedTexts || {});
      setSummaries(summaries || {});
      setChatHistory(chatHistory || []);
      alert('Session loaded successfully!');
    } catch (error) {
      console.error('Error loading session:', error);
      alert('Error loading session: ' + (error as Error).message);
    }
  };

  // --------------------------------
  // HELPER: Convert rawData -> base64
  // --------------------------------
  function addBase64ToTree(nodes: FileNode[]): FileNode[] {
    return nodes.map((node) => {
      if (node.type === 'folder' && node.children) {
        return { ...node, children: addBase64ToTree(node.children) };
      } else if (node.type === 'file' && node.rawData) {
        const uint8Array = new Uint8Array(node.rawData);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
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
      if (node.type === 'folder' && node.children) return getAllFiles(node.children);
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
         {/* If successMessage is set, show a nice success banner */}
         {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
            {successMessage}
          </div>
        )}

        {/* FOLDER UPLOAD & DISCLAIMER */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
              isDragActive ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-gray-600">{isDragActive ? 'Drop ZIP file here' : 'Drag and drop a ZIP file or click to select'}</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex gap-2">
              <input
                type="file"
                id="folder-upload"
                ref={(input) => { if (input) input.webkitdirectory = true; }}
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
                onClick={handleLoadProgress}
                className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
              >
                Load Progress
              </button>
            </div>
            <small className="text-gray-500">
              Your browser may show a brief warning when uploading a folder. This is normal and ensures you trust the site.
            </small>
          </div>
        </div>
        {/* FILE TREE & ANALYSIS */}
        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={analyzeFiles}
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
                  </span>
                </div>
              )}
            </div>
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
        {/* PREVIEW & EXTRACTED TEXT */}
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
                <p>Excel preview not supported directly in the browser, but you can download the file.</p>
              ) : (
                <p>Preview not available for this file type</p>
              )}
            </div>
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
          <form
            ref={formRef}
            onSubmit={(e) =>
              handleChatSubmit({
                e,
                selectedFileText: extractedTexts[selectedFile?.fullPath || ''],
                globalContext: Array.from(highlightedFiles)
                  .map((path) => extractedTexts[path])
                  .join('\n\n')
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
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Save Progress</h2>
            {fetchingUploads ? (
              <p className="text-gray-600">Loading existing uploads...</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadOption"
                      value="new"
                      checked={selectedUploadOption === 'new'}
                      onChange={() => setSelectedUploadOption('new')}
                      className="mr-2 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Create New Upload</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadOption"
                      value="existing"
                      checked={selectedUploadOption === 'existing'}
                      onChange={() => setSelectedUploadOption('existing')}
                      className="mr-2 text-gray-600"
                    />
                    <span className="text-sm text-gray-700">Update Existing</span>
                  </label>
                </div>
                {selectedUploadOption === 'new' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Upload Name:
                    </label>
                    <input
                      type="text"
                      className="border border-gray-300 rounded w-full p-2 text-gray-800"
                      value={newUploadName}
                      onChange={(e) => setNewUploadName(e.target.value)}
                      placeholder="Enter a project name..."
                    />
                  </div>
                )}
                {selectedUploadOption === 'existing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Existing Upload:
                    </label>
                    <select
                      className="border border-gray-300 rounded w-full p-2"
                      value={existingUploadId || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setExistingUploadId(isNaN(val) ? null : val);
                      }}
                    >
                      <option value="">-- Select an Upload --</option>
                      {existingUploads.map((u) => (
                        <option key={u.upload_id} value={u.upload_id}>
                          ID {u.upload_id} - {u.upload_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
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
                Save
              </button>
            </div>
          </div>
        </div>
      )}      
       </main>
      
    </div>
  );
}
