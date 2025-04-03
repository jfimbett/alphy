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
import FileUploadArea from '@/components/dashboard/FileUploadArea'; 
import { ConsolidatedCompany } from '../types';

// Icons (optional usage)
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Types
import { SessionSummary } from '@/app/history/page';
import { run } from 'node:test';
import Navbar from '@/components/Navbar';

import { getModelConfig } from '@/lib/modelConfig';

import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';

import { CompanyInfo } from '@/app/types';

import { defaultSummarizationTemplate, defaultExtractionTemplate, defaultConsolidationTemplate, defaultVariableExtraction} from '@/lib/prompts';

import  {estimateTokens, mergeConsolidatedCompanies, arrayBufferToBase64, base64ToArrayBuffer, FilePayload}  from '@/app/dashboard/utils/utils';
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'development';

import {getConsolidationPrompt, buildFileTree, getAllFiles, processZip, processFolder, 
  toggleAllFiles, handleConsolidateCompanies, addBase64ToTree, convertTree, handleFileSelect, handleLoadClick, openSaveModal, closeSaveModal,
  handleSaveConfirm, confirmLoadSession,
  analyzeFiles, saveHeavyData, saveSession, ExistingUpload} from '@/app/dashboard/utils/utils';


export default function Dashboard() {
    // Add these state variables near other useState hooks
  const [consolidateProgress, setConsolidateProgress]               = useState(0);
  const [totalFilesToConsolidate, setTotalFilesToConsolidate]       = useState(0);
  const [currentConsolidatingFile, setCurrentConsolidatingFile]     = useState('');
  const [errorFiles, setErrorFiles]                                 = useState<string[]>([]);
  const router                                                      = useRouter();
  const formRef                                                     = useRef<HTMLFormElement | null>(null);
  const [rawResponses, setRawResponses]                             = useState<Record<string, { prompt: string; response: string }>>({});
  const [extractedCompanies, setExtractedCompanies]                 = useState<Record<string, CompanyInfo[]>>({});
  const [fileTree, setFileTree]                                     = useState<FileNode[]>([]);
  const [extractedTexts, setExtractedTexts]                         = useState<Record<string, string>>({});
  const [summaries, setSummaries]                                   = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing]                               = useState(false);
  const [processingPhase, setProcessingPhase]                       = useState<'extracting' | 'summarizing' | 'idle' | 'extracting_companies'>('idle');
  const [progress, setProgress]                                     = useState(0);
  const [totalFiles, setTotalFiles]                                 = useState(0);
  const [processedFiles, setProcessedFiles]                         = useState(0);
  const [selectedSummarizationModel, setSelectedSummarizationModel] = useState('deepseek:deepseek-chat');
  const [selectedInfoRetrievalModel, setSelectedInfoRetrievalModel] = useState('deepseek:deepseek-reasoner');
  const [runSummarization, setRunSummarization]                     = useState(true);
  const [runInfoRetrieval, setRunInfoRetrieval]                     = useState(true);
  const [currentZipName, setCurrentZipName]                         = useState<string | null>(null);
  const [highlightedFiles, setHighlightedFiles]                     = useState<Set<string>>(new Set());
  const [showExtracted, setShowExtracted]                           = useState(false);
  const [allSelected, setAllSelected]                               = useState(true);
  const [currentSessionId, setCurrentSessionId]                     = useState<string | null>(null);
  const [selectedFile, setSelectedFile]                             = useState<FileNode | null>(null);
  const [successMessage, setSuccessMessage]                         = useState('');
  const [showSaveModal, setShowSaveModal]                           = useState(false);
  const [existingUploads, setExistingUploads]                       = useState<ExistingUpload[]>([]);
  const [selectedUploadOption, setSelectedUploadOption]             = useState<'new' | 'existing'>('new');
  const [newUploadName, setNewUploadName]                           = useState('');
  const [existingUploadId, setExistingUploadId]                     = useState<number | null>(null);
  const [fetchingUploads, setFetchingUploads]                       = useState(false);
  const [showLoadModal, setShowLoadModal]                           = useState(false);
  const [availableSessions, setAvailableSessions]                   = useState<SessionSummary[]>([]);
  const [isConsolidating, setIsConsolidating]                       = useState(false);
  const [llmConsolidationDebug, setLlmConsolidationDebug]           = useState<{ prompt: string; response: string }[]>([]);
  const [showDebug, setShowDebug]                                   = useState(false);

  

  useEffect(() => {
    const userId =
      typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    const currentSessionId = localStorage.getItem('currentSessionId');
    if (!userId) {
      router.push('/login');
    } else if (currentSessionId) {
      setCurrentSessionId(currentSessionId);
    }
  }, [router]);

 
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
            {successMessage}
            {/* Ensure this closing tag matches an opening tag */}
          </div>
        )}

        {/* File Upload Area */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <FileUploadArea
            processZip={(file) => processZip(file, setFileTree)}
            processFolder={(fileList) => processFolder(fileList, setFileTree)}
            handleLoadClick={() => handleLoadClick(setAvailableSessions, setShowLoadModal)}
            isDragActive={false}
          />
        </div>

        {/* Summarization / Info Retrieval Toggles & Model Selectors */}
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
                summarizationModel={
                  runSummarization ? selectedSummarizationModel : ''
                }
                infoRetrievalModel={
                  runInfoRetrieval ? selectedInfoRetrievalModel : ''
                }
                consolidationModel={
                  runInfoRetrieval ? selectedInfoRetrievalModel : ''
                }
                runSummarization={runSummarization}
                runInfoRetrieval={runInfoRetrieval}
                analyzeFiles={async () => {
                  try {
                    // Run analysis
                    await analyzeFiles(
                      {
                        runSummarization,
                        runInfoRetrieval,
                        summarizationModel: runSummarization
                          ? selectedSummarizationModel
                          : undefined,
                        infoRetrievalModel: runInfoRetrieval
                          ? selectedInfoRetrievalModel
                          : undefined,
                      },
                      fileTree,
                      getAllFiles,
                      base64ToArrayBuffer,
                      (phase: string) => setProcessingPhase(phase as 'extracting' | 'summarizing' | 'idle' | 'extracting_companies'),
                      setIsAnalyzing,
                      setProgress,
                      setProcessedFiles,
                      setTotalFiles,
                      setExtractedTexts,
                      setSummaries,
                      setExtractedCompanies,
                      setRawResponses,
                      currentSessionId || 'temp-${Date.now()}'
                    );

                    // Auto-save session with generated name
                    const sessionName = `Analysis ${new Date().toLocaleDateString()}`;
                    const sessionId = await saveSession(
                      sessionName,
                      fileTree,
                      extractedTexts,
                      summaries,
                      extractedCompanies,
                      rawResponses,
                      setCurrentSessionId,
                      setSuccessMessage
                    );
                  } catch (error) {
                    console.error('Processing error:', error);
                    alert(
                      'Analysis failed: ' +
                        (error instanceof Error ? error.message : 'Unknown error')
                    );
                  }
                }}
                openSaveModal={() => openSaveModal(setNewUploadName, setExistingUploadId, setSelectedUploadOption, setShowSaveModal, setExistingUploads, setFetchingUploads)}
                toggleAllFiles={(state) => toggleAllFiles(state, setFileTree)}
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
              onSelect={(node) => handleFileSelect(node || null, setSelectedFile)}
              selectedFile={
                selectedFile
                  ? { ...selectedFile, content: selectedFile.content || '' }
                  : null
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

<div className="bg-white p-4 rounded-lg shadow-sm mb-6">
  <div className="flex items-center justify-between mb-4">
    <div>
      <button
        onClick={() => {
          if (!currentSessionId) {
            alert('Please save the session first');
            return;
          }
          setErrorFiles([]);
          handleConsolidateCompanies(
            currentSessionId,
            fileTree,
            extractedTexts,
            summaries,
            extractedCompanies,
            rawResponses,
            setIsConsolidating,
            setLlmConsolidationDebug,
            setSuccessMessage,
            mergeConsolidatedCompanies,
            selectedInfoRetrievalModel,
            router,
            (processed, total, currentFile) => {
              setConsolidateProgress(processed);
              setTotalFilesToConsolidate(total);
              setCurrentConsolidatingFile(currentFile);
            },
            (errorFile) => {
              setErrorFiles(prev => [...prev, errorFile]);
            }
          );
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
    </div>
  </div>

  {isConsolidating && (
    <div className="mt-4">
      <div className="mb-2 flex justify-between text-sm text-gray-600">
        <span>
          Processing: {currentConsolidatingFile || 'Initializing...'}
        </span>
        <span>
          {consolidateProgress} / {totalFilesToConsolidate}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{
            width: `${(consolidateProgress / Math.max(totalFilesToConsolidate, 1)) * 100}%`
          }}
        ></div>
      </div>

      {errorFiles.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          <h4 className="font-semibold text-red-600 mb-2">
            Errors occurred in these files:
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {errorFiles.map((file, index) => (
              <li key={index} className="text-sm text-red-500">
                {file.split('/').pop()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )}
</div>

        {/* Toggle Button for Debug Info */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="mb-4 bg-gray-200 text-gray-800 px-3 py-1 rounded ml-2"
        >
          {showDebug ? 'Hide LLM Debug Info' : 'Show LLM Debug Info'}
        </button>

        {/* Debug Info */}
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
                <h3 className="text-lg font-semibold mb-2">
                  Consolidation Debug Info
                </h3>
                {llmConsolidationDebug.map((debug, index) => (
                  <div key={index} className="mb-4 border-b pb-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Prompt:</span> {debug.prompt}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Response:</span>{' '}
                      {debug.response}
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
          closeSaveModal={() => closeSaveModal(setShowSaveModal)}
          handleSaveConfirm={() => handleSaveConfirm(newUploadName, (sessionName: string) => saveSession(sessionName, fileTree, extractedTexts, summaries, extractedCompanies, rawResponses, setCurrentSessionId, setSuccessMessage), setShowSaveModal)}
        />
      </main>

      {/* Load Modal (rendered outside main for simplicity) */}
      <LoadModal
        showLoadModal={showLoadModal}
        availableSessions={availableSessions}
        confirmLoadSession={(sessionId) =>
          confirmLoadSession(
            sessionId,
            setFileTree,
            setRawResponses,
            () => {}, // Placeholder for setChatHistory
            setExtractedTexts,
            setSummaries,
            setExtractedCompanies,
            setCurrentSessionId,
            router // Added the missing argument
          )
        }
        setShowLoadModal={setShowLoadModal}
      />
    </div>
  );
}
