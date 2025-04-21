'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Components
import FileTree, { FileNode } from '@/components/FileTree';
import SelectedFilePanel from '@/components/dashboard/FilePreviewSection';
import ChatSection from '@/components/dashboard/ChatSection';
import ChatContextRadioButtons from '@/components/dashboard/RadioButtons';
import FileAnalysisButtons from '@/components/dashboard/FileAnalysisProgress';
import SaveModal from '@/components/dashboard/SaveSessionModal';
import LoadModal from '@/components/dashboard/LoadSessionModal';
import FileUploadArea from '@/components/dashboard/FileUploadArea';
import { ConsolidatedCompany } from '../types';

// Icons (optional usage)
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Types
import { SessionSummary } from '@/app/history/page';
import Navbar from '@/components/Navbar';

import { getModelConfig, MODEL_TOKEN_LIMITS } from '@/lib/modelConfig';

import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';

import { CompanyInfo } from '@/app/types';

import {
  defaultSummarizationTemplate,
  defaultExtractionTemplate,
  defaultConsolidationTemplate,
  defaultVariableExtraction
} from '@/lib/prompts';

import {
  estimateTokens,
  mergeConsolidatedCompanies,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  FilePayload
} from '@/app/dashboard/utils/utils';
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
const DEVELOPMENT = process.env.NEXT_PUBLIC_LLM_DEV_MODE === 'development';

import {
  getConsolidationPrompt,
  buildFileTree,
  getAllFiles,
  processZip,
  processFolder,
  toggleAllFiles,
  handleConsolidateCompanies,
  addBase64ToTree,
  convertTree,
  handleFileSelect,
  handleLoadClick,
  openSaveModal,
  closeSaveModal,
  handleSaveConfirm,
  confirmLoadSession,
  analyzeFiles,
  saveSession,
  ExistingUpload
} from '@/app/dashboard/utils/utils';

export default function Dashboard() {
  /* ------------------------------------------------------------------ */
  /*  ➤ CONSOLIDATION STATE                                             */
  /* ------------------------------------------------------------------ */
  const [consolidateProgress, setConsolidateProgress]               = useState(0);
  const [totalFilesToConsolidate, setTotalFilesToConsolidate]       = useState(0);
  const [currentConsolidatingFile, setCurrentConsolidatingFile]     = useState('');
  const [errorFiles, setErrorFiles]                                 = useState<{ file: string; error: string }[]>([]);

  /* ------------------------------------------------------------------ */
  /*  ➤ ANALYSIS STATE                                                  */
  /* ------------------------------------------------------------------ */
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
  // Default analysis toggles are configured in Settings (localStorage)
  const [runSummarization, setRunSummarization] = useState<boolean>(() => {
    // Avoid accessing localStorage during SSR
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('runSummarizationDefault') === 'true';
  });
  const [runInfoRetrieval, setRunInfoRetrieval] = useState<boolean>(() => {
    // Avoid accessing localStorage during SSR
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('runInfoRetrievalDefault') !== 'false';
  });
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
  const [currentChunk, setCurrentChunk]                             = useState(0);
  const [totalChunks, setTotalChunks]                               = useState(0);
  const [chunkProgress, setChunkProgress]                           = useState(0);

  /* ------------------------------------------------------------------ */
  /*  ➤ NEW LOCAL STATE (friendly name + auto‑consolidate flag)         */
  /* ------------------------------------------------------------------ */
  const [uploadName, setUploadName] = useState<string>('');

  /* ------------------------------------------------------------------ */
  /*  ➤ ROUTER + REFS                                                   */
  /* ------------------------------------------------------------------ */
  const router  = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  /* ------------------------------------------------------------------ */
  /*  ➤ AUTH / RESTORE SESSION                                          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loginTS = localStorage.getItem('loginTimestamp');
      const userId = localStorage.getItem('userId');
      const now = Date.now();
      const TTL = 24 * 60 * 60 * 1000; // 24h session TTL
      // If no login timestamp, session expired or no user, redirect to login
      if (!loginTS || !userId || now - parseInt(loginTS) > TTL) {
        localStorage.removeItem('loginTimestamp');
        localStorage.removeItem('userId');
        localStorage.removeItem('currentSessionId');
        router.push('/login');
        return;
      }
      const savedSessionId = localStorage.getItem('currentSessionId');
      if (savedSessionId) {
        // Verify stored session exists before restoring
        (async () => {
          try {
            const resp = await fetch('/api/sessions', {
              headers: { 'x-user-id': localStorage.getItem('userId') || '' },
            });
            if (!resp.ok) {
              localStorage.removeItem('currentSessionId');
              return;
            }
            const data = await resp.json();
            const sessions: Array<{ session_id: number }> = data.sessions || [];
            const exists = sessions.some(s => s.session_id.toString() === savedSessionId);
            if (exists) {
              setCurrentSessionId(savedSessionId);
            } else {
              localStorage.removeItem('currentSessionId');
            }
          } catch (err) {
            console.warn('Error verifying saved session ID', err);
            localStorage.removeItem('currentSessionId');
          }
        })();
      }
    }
  }, [router]);

  /* ------------------------------------------------------------------ */
  /*  ➤ RESTORE HEAVY DATA ON MOUNT                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!currentSessionId) return;
    // Fetch and restore heavy data (fileTree, texts, summaries, companies, responses)
    (async () => {
      try {
        const res = await fetch(`/api/store-heavy-data?sessionId=${currentSessionId}`);
        if (!res.ok) {
          console.error('Failed to load heavy data');
          return;
        }
        const data = await res.json();
        // Rebuild file tree with correct local paths or base64
        const rebuiltTree = convertTree(data.fileTree || [], currentSessionId);
        setFileTree(rebuiltTree);
        // Restore extracted texts, summaries, companies, and raw responses
        setExtractedTexts(data.extractedTexts || {});
        setSummaries(data.summaries || {});
        setExtractedCompanies(data.extractedCompanies || {});
        setRawResponses(data.rawResponses || {});
      } catch (error) {
        console.error('Error loading heavy data:', error);
      }
    })();
  }, [currentSessionId]);

  /* ------------------------------------------------------------------ */
  /*  STEP ❶ – capture the folder / zip name                            */
  /* ------------------------------------------------------------------ */
  const onZipUploaded = async (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, '');   // strip extension
    setUploadName(baseName);
    await processZip(file, setFileTree);
  };

  const onFolderUploaded = async (files: FileList) => {
    const rootDir = files[0]?.webkitRelativePath.split('/')[0] ?? 'Upload';
    setUploadName(rootDir);
    await processFolder(files, setFileTree);
  };

  /* ------------------------------------------------------------------ */
  /*  STEP ❷ – full analysis + auto‑save with friendly name             */
  /* ------------------------------------------------------------------ */
  async function runFullAnalysis() {
    try {
      /* ---- 1. run analysis ----------------------------------------- */
      // Determine models from settings, defaulting to first model key
      const defaultModel = Object.keys(MODEL_TOKEN_LIMITS)[0] || '';
      const summarizationModel = runSummarization
        ? localStorage.getItem('summarizationModel') || defaultModel
        : undefined;
      const infoRetrievalModel = runInfoRetrieval
        ? localStorage.getItem('infoRetrievalModel') || defaultModel
        : undefined;
      // Perform analysis; get back the per-file extracted companies
      const finalExtractedCompanies = await analyzeFiles(
        {
          runSummarization,
          runInfoRetrieval,
          summarizationModel,
          infoRetrievalModel,
        },
        fileTree,
        getAllFiles,
        base64ToArrayBuffer,
        (phase: string) =>
          setProcessingPhase(
            phase as 'extracting' | 'summarizing' | 'idle' | 'extracting_companies'
          ),
        setIsAnalyzing,
        setProgress,
        setProcessedFiles,
        setTotalFiles,
        setExtractedTexts,
        setSummaries,
        setExtractedCompanies,
        setRawResponses,
        currentSessionId || `temp-${Date.now()}`,
        /* optional onChunk callback for streaming back‑end */ 
        (current, total) => {
          setCurrentChunk(current);
          setTotalChunks(total);
          setChunkProgress(Math.round((current / Math.max(total, 1)) * 100));
        }
      );

      /* ---- 2. build session name ----------------------------------- */
      const when = new Date().toLocaleString('en-GB', {
        day:'2-digit', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
      const niceName = `${uploadName || 'Session'} — ${when}`;

      /* ---- 3. save session and trigger consolidation ---------------- */
      // Create session and store initial heavy data
      const sessionId = await saveSession(
        niceName,
        fileTree,
        extractedTexts,
        summaries,
        finalExtractedCompanies,
        rawResponses,
        setCurrentSessionId,
        setSuccessMessage
      );
      // Determine consolidation model
      const consolidationModel = runInfoRetrieval
        ? localStorage.getItem('infoRetrievalModel') || defaultModel
        : '';
      // Kick off consolidation automatically
      handleConsolidateCompanies(
        sessionId,
        fileTree,
        extractedTexts,
        summaries,
        finalExtractedCompanies,
        rawResponses,
        setIsConsolidating,
        setLlmConsolidationDebug,
        setSuccessMessage,
        mergeConsolidatedCompanies,
        consolidationModel,
        router,
        /* onProgress */ (processed, total, currentFile) => {
          setConsolidateProgress(processed);
          setTotalFilesToConsolidate(total);
          setCurrentConsolidatingFile(currentFile);
        },
        /* onError */ (errorFile, msg) => {
          setErrorFiles(prev => [...prev, { file: errorFile, error: msg }]);
        }
      );

    } catch (err) {
      console.error('Analysis failed:', err);
      alert(
        'Analysis failed: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }

  // Auto-consolidation has been removed; consolidation can now be triggered manually via the UI

  /* ------------------------------------------------------------------ */
  /*  ➤ RENDER                                                          */
  /* ------------------------------------------------------------------ */
  // Default model for analysis if none set
  const defaultModel = Object.keys(MODEL_TOKEN_LIMITS)[0] || '';
  return (
    <div className="min-h-screen bg-gray-50 relative">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Success message */}
        {successMessage && (
          <div className="mb-4 bg-green-100 border border-green-200 text-green-800 p-3 rounded-md">
            {successMessage}
          </div>
        )}

        {/* ① – File upload area --------------------------------------- */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <FileUploadArea
            processZip={onZipUploaded}
            processFolder={onFolderUploaded}
            handleLoadClick={() =>
              handleLoadClick(setAvailableSessions, setShowLoadModal)
            }
            isDragActive={false}
          />
        </div>


        {/* ③ – analyze / save buttons + file tree --------------------- */}
        {fileTree.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="mb-4 flex items-center justify-between">
                <FileAnalysisButtons
                  fileTree={fileTree}
                summarizationModel={
                  runSummarization
                    ? localStorage.getItem('summarizationModel') || defaultModel
                    : ''
                }
                infoRetrievalModel={
                  runInfoRetrieval
                    ? localStorage.getItem('infoRetrievalModel') || defaultModel
                    : ''
                }
                consolidationModel={
                  runInfoRetrieval
                    ? localStorage.getItem('infoRetrievalModel') || defaultModel
                    : ''
                }
                runSummarization={runSummarization}
                runInfoRetrieval={runInfoRetrieval}
                analyzeFiles={runFullAnalysis}
                openSaveModal={() => {
                  // default session name to the current upload folder when saving
                  setNewUploadName(uploadName);
                  openSaveModal(
                    setNewUploadName,
                    setExistingUploadId,
                    setSelectedUploadOption,
                    setShowSaveModal,
                    setExistingUploads,
                    setFetchingUploads
                  );
                }}
                toggleAllFiles={(state) => toggleAllFiles(state, setFileTree)}
                allSelected={allSelected}
                setAllSelected={setAllSelected}
                getAllFiles={getAllFiles}
                isAnalyzing={isAnalyzing}
                progress={progress}
                processingPhase={processingPhase}
                processedFiles={processedFiles}
                totalFiles={totalFiles}
                chunkProgress={chunkProgress}
                currentChunk={currentChunk}
                totalChunks={totalChunks}
              />
            </div>

            {/* Consolidation progress bar */}
            {isConsolidating && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm text-gray-600">
                  <span>
                    Processing: {currentConsolidatingFile || 'Initializing…'}
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
                      {errorFiles.map(({ file, error }, idx) => (
                        <li key={idx} className="text-sm text-red-500">
                          <strong>{file.split('/').pop()}</strong> – {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* File tree */}
            <FileTree
              nodes={fileTree}
              onSelect={(node) => handleFileSelect(node || null, setSelectedFile)}
              selectedFile={
                selectedFile
                  ? { ...selectedFile, content: selectedFile.content || '' }
                  : null
              }
              onToggleConversion={(path) => {
                const toggle = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((n) => ({
                    ...n,
                    selected: n.fullPath === path ? !n.selected : n.selected,
                    children: n.children ? toggle(n.children) : undefined,
                  }));
                setFileTree((prev) => toggle(prev));
              }}
              onToggleHighlight={(path) => {
                const hl = new Set(highlightedFiles);
                if (hl.has(path)) hl.delete(path);
                else hl.add(path);
                setHighlightedFiles(hl);

                const propagate = (nodes: FileNode[]): FileNode[] =>
                  nodes.map((n) => ({
                    ...n,
                    highlighted: hl.has(n.fullPath!),
                    children: n.children ? propagate(n.children) : undefined,
                  }));
                setFileTree(propagate(fileTree));
              }}
            />
          </div>
        )}

        {/* ④ – selected file preview ---------------------------------- */}
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


        {/* ⑥ – save modal -------------------------------------------- */}
        <SaveModal
          showSaveModal={showSaveModal}
          newUploadName={newUploadName}
          setNewUploadName={setNewUploadName}
          closeSaveModal={() => closeSaveModal(setShowSaveModal)}
          handleSaveConfirm={() =>
            handleSaveConfirm(
              newUploadName,
              (sessionName: string) =>
                saveSession(
                  sessionName,
                  fileTree,
                  extractedTexts,
                  summaries,
                  extractedCompanies,
                  rawResponses,
                  setCurrentSessionId,
                  setSuccessMessage
                ),
              setShowSaveModal
            )
          }
        />
      </main>

      {/* Load modal (portal) */}
      <LoadModal
        showLoadModal={showLoadModal}
        availableSessions={availableSessions}
        confirmLoadSession={(sessionId) =>
          confirmLoadSession(
            sessionId,
            setFileTree,
            setRawResponses,
            () => {}, // Placeholder for setChatHistory if needed
            setExtractedTexts,
            setSummaries,
            setExtractedCompanies,
            setCurrentSessionId,
            router
          )
        }
        setShowLoadModal={setShowLoadModal}
      />
    </div>
  );
}
