// ==================================================================
// 1) Imports
// ==================================================================
'use client';
// --- External Libraries ---
import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { Dispatch, SetStateAction } from 'react';
import { jsonrepair } from 'jsonrepair';
// --- Internal (Local) Imports ---
import { CompanyInfo, ConsolidatedCompany } from '@/app/types';
import {
  defaultSummarizationTemplate,
  defaultExtractionTemplate,
  defaultConsolidationTemplate,
  defaultVariableExtraction,
  defaultIntermediateConsolidationTemplate,
} from '@/lib/prompts';
import { FileNode } from '@/components/FileTree';
import { getModelConfig } from '@/lib/modelConfig';
import { debug } from 'console';

// ==================================================================
// 2) Types & Interfaces
// ==================================================================
export const getIntermediateConsolidationPrompt = (rawData: Record<string, any>) => {
  // If you want to allow override from localStorage, do so:
  const template =
    typeof window !== 'undefined'
      ? localStorage.getItem('intermediateConsolidationTemplate') || defaultIntermediateConsolidationTemplate
      : defaultIntermediateConsolidationTemplate;

  return template.replace('{rawData}', JSON.stringify(rawData));
};

/**
 * Represents an existing file upload in the system.
 */
export type ExistingUpload = {
  upload_id: number;
  upload_name: string;
};

/**
 * Represents a file payload used to build a file tree.
 */
export interface FilePayload {
  path: string;
  base64Data: string;
  blobUrl: string;
}

// ======================================
// Refactored retrieveInfoFromTexts
// ======================================
/**
 * Retrieves company-level info from extracted texts in chunked fashion,
 * returning the final object instead of calling setState repeatedly.
 */
async function retrieveInfoFromTextsRefactored(
  extractedTexts: Record<string, string>,
  infoRetrievalModel: string,
  logId: string // optional (for logging)
): Promise<Record<string, CompanyInfo[]>> {
  // Holds the final "filePath -> arrayOfCompanies" result
  const allExtracted: Record<string, CompanyInfo[]> = {};

  // 1) Get model config for chunking
  const modelConfig = getModelConfig(infoRetrievalModel);
  const MAX_TOKENS = modelConfig.contextWindow - modelConfig.reservedCompletionTokens - 1000; 

  // 2) Process each file's extracted text
  for (const [fullPath, text] of Object.entries(extractedTexts)) {
    try {
      // Grab (or fallback) to your extraction template, and inject document path
      const rawTemplate =
        typeof window !== 'undefined'
          ? localStorage.getItem('extractionTemplate') || defaultExtractionTemplate
          : defaultExtractionTemplate;
      const templateWithPath = rawTemplate.replace(
        '{documentPath}',
        fullPath
      );
      // Chunking prompt without text for token estimation
      const basePrompt = templateWithPath.replace('{documentText}', '');
      const baseTokens = estimateTokens(basePrompt) + modelConfig.tokenSafetyMargin;

      const chunks = splitTextIntoChunks(
        text,
        MAX_TOKENS - baseTokens,
        modelConfig.maxChunkSize
      );

      // We'll accumulate multiple chunk results into one combined array
      let combinedCompanyData: CompanyInfo[] = [];

      // We'll track some debug text for each chunk's prompt & response
      let combinedPromptDebug = '';
      let combinedResponseDebug = '';

      // 3) LLM calls for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // Inject both document path and the current text chunk
        const chunkPrompt = templateWithPath.replace(
          '{documentText}',
          chunk
        );

        // For debugging, store the chunk prompt
        combinedPromptDebug += `\n\n[CHUNK ${i + 1} PROMPT]\n${chunkPrompt}\n`;

        // POST to /api/llm
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: chunkPrompt,
            model: infoRetrievalModel,
            format: 'json',
            requestType: 'extract',
            logId // optional
          })
        });

        // If LLM call succeeded:
        if (res.ok) {
          const data = await res.json();
          const rawChunkResponse = data.content || '';
          combinedResponseDebug += `\n[CHUNK ${i + 1} RESPONSE]\n${rawChunkResponse}\n`;

          // Attempt to parse the JSON the LLM returned
          const cleaned = rawChunkResponse
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

          try {
            // Attempt to fix incomplete JSON
            const fixed = fixIncompleteJson(cleaned);

            const parsed = JSON.parse(fixed);
            let chunkCompanies: CompanyInfo[] = [];

            // Handle array responses
            if (Array.isArray(parsed)) {
              chunkCompanies = parsed;
            }
            // Handle object with companies array
            else if (parsed?.companies && Array.isArray(parsed.companies)) {
              chunkCompanies = parsed.companies;
            }
            // Handle single company object
            else if (parsed?.name) {
              // Check for required company field
              chunkCompanies = [parsed];
            }

            chunkCompanies = chunkCompanies.map(company => ({
              ...company,
              variables: company.variables || {},
              sources:
                company.sources?.map(s => ({
                  filePath: s.filePath,
                  pageNumber: s.pageNumber || undefined,
                  extractionDate: new Date().toISOString()
                })) || []
            }));

            combinedCompanyData = mergeConsolidatedCompanies([
              combinedCompanyData,
              chunkCompanies
            ]);
          } catch (parseErr) {
            console.error(`Failed to parse chunk JSON for ${fullPath}:`, parseErr);
          }
        } else {
          // LLM call error
          const errText = await res.text();
          console.error(`LLM call failed for chunk ${i + 1} in ${fullPath}: ${errText}`);
          combinedResponseDebug += `\n[CHUNK ${i + 1} ERROR]\n${errText}\n`;
        }
      }

      // 4) Store final array of companies in our local result
      allExtracted[fullPath] = combinedCompanyData;

      // 5) Optionally store the chunk-level debug in a global object.
      //    (In your original code you do `setRawResponses((prev) => ...)`,
      //    but you can either return it or do a single setRawResponses outside).
      // ...
      // e.g.:
      // setRawResponses((prev) => ({
      //   ...prev,
      //   [fullPath]: {
      //     prompt: combinedPromptDebug.trim(),
      //     response: combinedResponseDebug.trim()
      //   }
      // }));

    } catch (error) {
      console.error('Error in retrieveInfoFromTexts for filePath', fullPath, error);
      // In the worst case, store an empty array
      allExtracted[fullPath] = [];
    }
  }

  // 6) Return final map: fullPath -> arrayOfCompanies
  return allExtracted;
}


// ==================================================================
// 3) Utility & Helper Functions
// ==================================================================

/**
 * Estimates the number of tokens in a given text.
 * @param text - The input text.
 * @returns Estimated number of tokens.
 */
export function estimateTokens(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  return Math.floor(wordCount * 1.5 + charCount / 4);
}

/**
 * Performs a deep clone of a given object.
 * @param obj - Object to clone.
 * @returns A deep-cloned copy of the input.
 */
const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));

/**
 * Deep merges source object into target object (with special handling for certain keys, arrays,
 * nested objects, and newly-added fields).
 * @param target - Target object to merge into.
 * @param source - Source object to merge from.
 * @returns The merged object.
 */
const deepMerge = (target: any, source: any) => {
  Object.keys(source).forEach((key) => {
    if (key === 'investments' || key === 'subsidiaries') {
      // Merge arrays while avoiding duplicates
      target[key] = Array.from(
        new Set([
          ...(target[key] || []),
          ...(source[key] || []),
        ])
      );
    } 
    // If both target & source have a nested object at this key, merge them deeply
    else if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    } 
    // If it's a new object field in source (not in target), clone it in
    else if (source[key] instanceof Object && !(key in target)) {
      target[key] = deepClone(source[key]);
    }
    // (If it's a primitive or something else new, let the final Object.assign handle it)
  });

  // Finally, copy over any remaining properties (primitives, etc.)
  return Object.assign(target, source);
};

/**
 * Converts an ArrayBuffer to a Base64-encoded string.
 * @param buffer - The ArrayBuffer to convert.
 * @returns Base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64-encoded string into an ArrayBuffer.
 * @param base64 - The Base64 string.
 * @returns A decoded ArrayBuffer.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Returns the consolidation prompt, either from localStorage or a default.
 * @param rawData - Data to be consolidated.
 * @returns A string prompt ready for an LLM call.
 */
export const getConsolidationPrompt = (rawData: Record<string, any>) => {
  const template =
    typeof window !== 'undefined'
      ? localStorage.getItem('consolidationTemplate') || defaultConsolidationTemplate
      : defaultConsolidationTemplate;
  return template.replace('{rawData}', JSON.stringify(rawData));
};

/**
 * Builds a file tree from an array of file payloads.
 * @param files - The array of FilePayload objects.
 * @returns A hierarchical FileNode array.
 */
export const buildFileTree = (files: FilePayload[]): FileNode[] => {
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

/**
 * Recursively collects all file nodes (type 'file') within a FileNode tree.
 * @param nodes - Array of FileNodes.
 * @returns A flat array of all file-type nodes.
 */
export const getAllFiles = (nodes: FileNode[]): FileNode[] => {
  return nodes.flatMap((node) => {
    if (node.type === 'folder' && node.children) {
      return getAllFiles(node.children);
    }
    return node.type === 'file' ? [node] : [];
  });
};

/**
 * Processes a .zip file, extracting its contents into a file tree.
 * @param file - The uploaded .zip file.
 * @param setFileTree - React state setter to store the resulting FileNode array.
 */
export const processZip = async (
  file: File,
  setFileTree: React.Dispatch<React.SetStateAction<FileNode[]>>
): Promise<void> => {
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(file);

  const files = await Promise.all(
    Object.values(zipContent.files)
      // Exclude directories, macOS metadata and DS_Store files
      .filter((entry) =>
        !entry.dir &&
        !entry.name.includes('__MACOSX') &&
        !entry.name.endsWith('.DS_Store')
      )
      .map(async (entry) => {
        const data = await entry.async('arraybuffer');
        const base64Data = arrayBufferToBase64(data);
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

/**
 * Processes a folder input (multiple files), converting each to a file tree representation.
 * @param fileList - The FileList (from a folder input).
 * @param setFileTree - React state setter to store the resulting FileNode array.
 */
export const processFolder = async (
  fileList: FileList,
  setFileTree: React.Dispatch<React.SetStateAction<FileNode[]>>
) => {
  // Exclude macOS DS_Store files
  const filePromises = Array.from(fileList)
    .filter((file) => file.name !== '.DS_Store')
    .map((file) => {
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

// File: app/dashboard/utils/utils.tsx

/**
 * Splits text into chunks to accommodate token/context window constraints.
 * Now with a fallback to split any oversized sentence/paragraph by character length.
 */
function splitTextIntoChunks(
  text: string,
  maxTokens: number,
  maxChunkSize: number
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/); // Split by blank lines
  let currentChunk: string[] = [];
  let currentTokenCount = 0;

  paragraphs.forEach((para) => {
    const paraTokens = estimateTokens(para);

    if (paraTokens > maxTokens) {
      // First try splitting on sentence boundaries
      const sentences = para.split(/(?<=[.!?])\s+/);

      sentences.forEach((sentence) => {
        const sentenceTokens = estimateTokens(sentence);

        if (sentenceTokens > maxTokens) {
          // Fallback: break this sentence into fixed‑size slices
          for (let i = 0; i < sentence.length; i += maxChunkSize) {
            const part = sentence.slice(i, i + maxChunkSize);
            const partTokens = estimateTokens(part);
            handleParagraph(part, partTokens);
          }
        } else {
          handleSentence(sentence, sentenceTokens);
        }
      });
    } else {
      handleParagraph(para, paraTokens);
    }
  });

  // Push any remaining text
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks;

  function handleSentence(sentence: string, tokens: number) {
    if (
      currentTokenCount + tokens > maxTokens ||
      currentChunk.join("\n\n").length + sentence.length > maxChunkSize
    ) {
      // Flush
      chunks.push(currentChunk.join("\n\n"));
      currentChunk = [];
      currentTokenCount = 0;
    }
    currentChunk.push(sentence);
    currentTokenCount += tokens;
  }

  function handleParagraph(para: string, tokens: number) {
    if (
      currentTokenCount + tokens > maxTokens ||
      currentChunk.join("\n\n").length + para.length > maxChunkSize
    ) {
      // Flush
      chunks.push(currentChunk.join("\n\n"));
      currentChunk = [];
      currentTokenCount = 0;
    }
    currentChunk.push(para);
    currentTokenCount += tokens;
  }
}


export const mergeConsolidatedCompanies = (companiesArray: any[]) => {
  const companyMap = new Map<string, any>();

  companiesArray.flat().forEach((company) => {
    if (!company?.name) return;

    const existing = companyMap.get(company.name);
    // Ensure new company has valid structure
    const cloned = deepClone(company);
    const newCompany = {
      ...cloned,
      variables: cloned.variables || {},
      sources: cloned.sources || [],
    };

    // First occurrence: simply set and move on
    if (!existing) {
      companyMap.set(company.name, newCompany);
      return;
    }

    // --- Merge Variables (with year-based support and numeric sums) ---
    Object.entries(newCompany.variables).forEach(([key, value]) => {
      // In the correction snippet, `value` might be:
      //   - a number
      //   - an object with .value
      //   - an object keyed by years
      const varValue = (value as any)?.value ?? value;
      // Ensure existing "variables[key]" is an object (so we can store year-based merges)
      existing.variables[key] = existing.variables[key] || {};

      // If varValue is an object, check if it's year-based
      if (typeof varValue === 'object') {
        Object.entries(varValue).forEach(([year, yearValue]) => {
          // Merge only if the key is a 4-digit year
          if (/^\d{4}$/.test(year)) {
            existing.variables[key][year] = mergeValues(
              existing.variables[key][year],
              yearValue
            );
          }
        });
      } else {
        // Otherwise, treat it as a top-level numeric or single value
        existing.variables[key].value = mergeValues(
          existing.variables[key]?.value,
          varValue
        );
      }
    });

    // --- Merge Sources ---
    existing.sources = [...(existing.sources || []), ...(newCompany.sources || [])];

    // --- Merge Dates (with proper date-sorting) ---
    existing.dates = Array.from(
      new Set([...(existing.dates || []), ...(newCompany.dates || [])])
    ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // --- Merge lastUpdated ---
    existing.lastUpdated = [existing.lastUpdated, newCompany.lastUpdated]
      .filter(Boolean)
      .sort()
      .pop();

    // Re-store in the Map
    companyMap.set(company.name, existing);
  });

  return Array.from(companyMap.values());
};

// ---------------------------------------------------
// Helper function to merge values safely
// (Sums numeric values, otherwise uses the newest
// non-undefined value)
const mergeValues = (existingVal: any, newVal: any) => {
  if (typeof existingVal === 'number' && typeof newVal === 'number') {
    return existingVal + newVal;
  }
  if (newVal !== undefined && newVal !== null) {
    return newVal;
  }
  return existingVal;
};

// File: app/dashboard/utils/utils.tsx (same file, earlier in the module)

/**
 * Extracts text from an array of selected files (PDF/Excel only).
 * Updated Excel branch to emit one "paragraph" per row.
 */
/**
 * Extracts text from an array of selected files (PDF / Excel only).
 *  – PDFs:  uses pdfjs‑dist and gathers all `TextItem.str` values per page
 *  – XLSX:  keeps the “one paragraph per row” logic you already had
 *  – Other: returns a placeholder explaining why the file was skipped
 *
 * Every paragraph is separated by a blank line so downstream
 * `splitTextIntoChunks()` will treat them as natural chunks.
 */
async function extractTextsFromFiles(
  allFiles: FileNode[],
  base64ToArrayBufferFn: (b64: string) => ArrayBuffer,
  setProgress: (value: number) => void,
  setProcessedFiles: (count: number) => void,
  setProcessingPhase: (phase: string) => void
) {
  /* -------------------------------------------------------------- */
  /* 0.  House‑keeping                                              */
  /* -------------------------------------------------------------- */
  setProcessingPhase('extracting');

  const total           = allFiles.length;
  let   processedCount  = 0;
  const newExtracted: Record<string, string> = {};

  /* -------------------------------------------------------------- */
  /* 1.  Ensure pdf.js worker is wired up (once per tab)            */
  /* -------------------------------------------------------------- */
  if (!GlobalWorkerOptions.workerSrc) {
    // The file already lives in /public, so this resolves correctly
    GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
  }

  /* -------------------------------------------------------------- */
  /* 2.  Loop over every selected file                              */
  /* -------------------------------------------------------------- */
  for (const node of allFiles) {
    let extracted = '';

    try {
      if (!node.base64Data) {
        continue;                                  // nothing to do
      }
      const arrayBuffer = base64ToArrayBufferFn(node.base64Data);

      /* ---------------------------------------------------------- */
      /* 2‑A.  PDF                                                  */
      /* ---------------------------------------------------------- */
      if (node.name.toLowerCase().endsWith('.pdf')) {
        const loadingTask   = getDocument({ data: arrayBuffer });
        const pdf           = await loadingTask.promise;
        const pageTexts: string[] = [];

        for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
          const page           = await pdf.getPage(pageNo);
          const tc             = await page.getTextContent();
          const pageStr        = tc.items
            .map(item => {
              // Both legacy and modern builds expose .str, but we
              // type‑guard just in case (ts 5.4+ narrowings).
              return (item as TextItem).str ?? '';
            })
            .join(' ');
          pageTexts.push(pageStr.trim());
        }
        extracted = pageTexts.join('\n\n');

        /* Clean up to avoid memory leaks in long sessions */
        await pdf.destroy();
        await loadingTask.destroy?.();
      }

      /* ---------------------------------------------------------- */
      /* 2‑B.  Excel (unchanged, just wrapped in a try/catch)       */
      /* ---------------------------------------------------------- */
      else if (node.name.match(/\.(xlsx|xls)$/i)) {
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const rows: string[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const ws      = workbook.Sheets[sheetName];
          const asJson  = XLSX.utils.sheet_to_json<string[][]>(ws, { header: 1 });

          asJson.forEach(row => {
            const rowText = row.join(' ').trim();
            if (rowText) rows.push(`[${sheetName}] ${rowText}`);
          });
        });

        extracted = rows.join('\n\n');
      }

      /* ---------------------------------------------------------- */
      /* 2‑C.  Everything else                                      */
      /* ---------------------------------------------------------- */
      else {
        extracted = '[Text extraction not available for this file type]';
      }
    } catch (err) {
      console.error(`Failed extracting ${node.name}`, err);
      extracted = `[Error extracting "${node.name}": ${(err as Error).message}]`;
    }

    /* ------------------------------------------------------------ */
    /* 3.  Normalise whitespace & store result                      */
    /* ------------------------------------------------------------ */
    newExtracted[node.fullPath!] = extracted
      .replace(/\s+/g, ' ')
      .replace(/ ?\n ?/g, '\n')   // tidy line breaks
      .trim();

    processedCount++;
    setProcessedFiles(processedCount);
    setProgress(Math.round((processedCount / total) * 100));
  }

  return newExtracted;
}



/**
 * Summarizes extracted texts using chunk-based prompts.
 */
async function summarizeExtractedTexts(
  extractedTexts: Record<string, string>,
  summarizationModel: string,
  setProcessingPhase: (phase: string) => void,
  setProgress: (value: number) => void,
  setProcessedFiles: (count: number) => void,
  setSummaries: (summaries: Record<string, string>) => void,
  logId: string,
) {
  setProcessingPhase('summarizing');
  setProgress(0);
  setProcessedFiles(0);

  const newSummaries: Record<string, string> = {};
  const total = Object.keys(extractedTexts).length;
  let count = 0;

  // Example: get your model config
  const modelConfig = getModelConfig(summarizationModel);

  for (const [fullPath, text] of Object.entries(extractedTexts)) {
    try {
      // Grab template from localStorage (or fallback)
      const template =
        typeof window !== 'undefined'
          ? localStorage.getItem('summarizationTemplate') || defaultSummarizationTemplate
          : defaultSummarizationTemplate;

      // Setup chunking
      const basePrompt = template.replace('{documentText}', '');
      const baseTokens = estimateTokens(basePrompt) + modelConfig.tokenSafetyMargin;
      const chunks = splitTextIntoChunks(
        text,
        modelConfig.contextWindow - baseTokens - 8000,
        modelConfig.maxChunkSize
      );

      let fullSummary = '';
      // Summarize each chunk
      for (const chunk of chunks) {
        const chunkPrompt = template.replace('{documentText}', chunk);

        // Example API call
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: chunkPrompt,
            model: summarizationModel,
            requestType: 'summarize',
            logId: logId, // Pass the logId for tracking
          })
        });

        if (res.ok) {
          const data = await res.json();
          fullSummary += data.content + '\n\n';
        } else {
          fullSummary += ' [Chunk Summarization Failed] ';
        }
      }

      // Consolidate chunks if needed
      if (chunks.length > 1) {
        const consolidationPrompt = `Please consolidate these partial summaries into one coherent summary:\n\n${fullSummary}`;
        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: consolidationPrompt,
            model: summarizationModel,
            requestType: 'summarize'
          })
        });
        if (res.ok) {
          const data = await res.json();
          fullSummary = data.content;
        }
      }

      newSummaries[fullPath] = fullSummary.trim();
    } catch (error: any) {
      newSummaries[fullPath] = `Summary failed: ${(error as Error).message}`;
    }

    count++;
    setProcessedFiles(count);
    setProgress(Math.round((count / total) * 100));
  }

  setSummaries(newSummaries);
}

/**
 * Retrieves company-level info from extracted texts (chunk-based).
 */
async function retrieveInfoFromTexts(
  extractedTexts: Record<string, string>,
  infoRetrievalModel: string,
  setProcessingPhase: (phase: string) => void,
  setProgress: (value: number) => void,
  setProcessedFiles: (count: number) => void,
  setExtractedCompanies: React.Dispatch<React.SetStateAction<Record<string, CompanyInfo[]>>>,
  setRawResponses: React.Dispatch<
    React.SetStateAction<Record<string, { prompt: string; response: string }>>
  >,
  logId: string,
  onChunkProgress?: (current: number, total: number) => void
) {
  setProcessingPhase('extracting_companies');
  setProgress(0);
  setProcessedFiles(0);

  const total = Object.keys(extractedTexts).length;
  let count = 0;

  const modelConfig = getModelConfig(infoRetrievalModel);

  for (const [fullPath, text] of Object.entries(extractedTexts)) {
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

      if (onChunkProgress) onChunkProgress(0, chunks.length);

      let allCompanies: CompanyInfo[] = [];
      let combinedPromptDebug = '';
      let combinedResponseDebug = '';

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkPrompt = template.replace('{documentText}', chunk);
        combinedPromptDebug += `\n\n[CHUNK ${i + 1} PROMPT]\n${chunkPrompt}\n`;

        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: chunkPrompt,
            model: infoRetrievalModel,
            format: 'json',
            requestType: 'extract',
            logId: logId, // Pass the logId for tracking
          })
        });

        let chunkResponse = '';
        if (res.ok) {
          const data = await res.json();
          chunkResponse = data.content || '';

          // Append chunk response text to the debug
          combinedResponseDebug += `\n[CHUNK ${i + 1} RESPONSE]\n${chunkResponse}\n`;

          // Attempt to parse as JSON
          let cleaned = ""
          try {

            cleaned = chunkResponse
              .replace(/```json/g, '')
              .replace(/```/g, '')
              .trim();

            cleaned = cleaned.replace(/\n/g, '').trim();
            // Attempt to fix incomplete JSON
            cleaned = fixIncompleteJson(cleaned);
            const parsed = JSON.parse(cleaned);

            let companies = Array.isArray(parsed) ? parsed : parsed?.companies || [];
            // Map 'company_name' to 'name' if present
            companies = companies.map((company: any) => ({
              ...company,
              name: company.company_name || company.name
            }));

            allCompanies = mergeConsolidatedCompanies([allCompanies, companies]);
          } catch (parseErr) {
            //print the problematic string
            console.error(cleaned)
            

          }
        } else {
          const errText = await res.text();
          console.error(`LLM call failed for chunk ${i + 1}: ${errText}`);
          combinedResponseDebug += `\n[CHUNK ${i + 1} ERROR]\n${errText}\n`;
        }

        if (onChunkProgress) onChunkProgress(i + 1, chunks.length);
      }

      // Finally store results for this file
      setExtractedCompanies((prev) => ({
        ...prev,
        [fullPath]: allCompanies
      }));

      setRawResponses((prev) => ({
        ...prev,
        [fullPath]: {
          prompt: combinedPromptDebug.trim(),
          response: combinedResponseDebug.trim()
        }
      }));

    } catch (error) {
      console.error(`Error processing ${fullPath}:`, error);
    }

    count++;
    setProcessedFiles(count);
    setProgress(Math.round((count / total) * 100));
  }
}

export function fixIncompleteJson(raw: string): string {
  const trimmed = raw.trim();

  // 1) Fast path – already valid?
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch { /* continue */ }

  // 2) jsonrepair does heavy lifting
  try {
    const repaired = jsonrepair(trimmed);
    JSON.parse(repaired);          // make sure it really is valid
    return repaired;
  } catch { /* continue */ }

  // 3) Last‑ditch: close unbalanced braces/brackets
  let fixed = trimmed;
  const stack: string[] = [];
  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i];
    if (ch === '{') stack.push('}');
    if (ch === '[') stack.push(']');
    if (ch === '}' || ch === ']') stack.pop();
    if (ch === '"' && fixed[i - 1] !== '\\') {
      // skip string
      i = fixed.indexOf('"', i + 1);
      if (i === -1) break;
    }
  }
  while (stack.length) fixed += stack.pop();

  // Still invalid?  Let the caller deal with it.
  return fixed;
}

// ==================================================================
// 5) Main Analysis Function
// ==================================================================

/**
 * Main function to analyze selected files (text extraction, summarization, info retrieval).
 */
export async function analyzeFiles(
  options: {
    runSummarization: boolean;
    runInfoRetrieval: boolean;
    summarizationModel?: string;
    infoRetrievalModel?: string;
  },
  fileTree: FileNode[],
  getAllFilesFn: (nodes: FileNode[]) => FileNode[],
  base64ToArrayBufferFn: (b64: string) => ArrayBuffer,
  setProcessingPhase: (phase: string) => void,
  setIsAnalyzing: (val: boolean) => void,
  setProgress: (val: number) => void,
  setProcessedFiles: (val: number) => void,
  setTotalFiles: (val: number) => void,
  setExtractedTexts: (val: Record<string, string>) => void,
  setSummaries: (val: Record<string, string>) => void,
  setExtractedCompanies: React.Dispatch<React.SetStateAction<Record<string, CompanyInfo[]>>>,
  setRawResponses: React.Dispatch<
    React.SetStateAction<Record<string, { prompt: string; response: string }>>
  >,
  logId:string,
  onChunkProgress?: (current: number, total: number) => void
) {
  // We'll collect final extracted companies here and return them
  let finalExtractedCompanies: Record<string, CompanyInfo[]> = {};
  try {
    setIsAnalyzing(true);
    setProgress(0);
    setProcessedFiles(0);

    const allFiles = getAllFilesFn(fileTree).filter((f) => f.selected);
    setTotalFiles(allFiles.length);

    // 1) EXTRACT TEXT
    const newExtractedTexts = await extractTextsFromFiles(
      allFiles,
      base64ToArrayBufferFn,
      setProgress,
      setProcessedFiles,
      setProcessingPhase
    );
    setExtractedTexts(newExtractedTexts);

    // 2) SUMMARIZE (optional)
    if (options.runSummarization && options.summarizationModel) {
      await summarizeExtractedTexts(
        newExtractedTexts,
        options.summarizationModel,
        setProcessingPhase,
        setProgress,
        setProcessedFiles,
        setSummaries,
        logId
      );
    }

    // 3) INFO RETRIEVAL (optional)
    if (options.runInfoRetrieval && options.infoRetrievalModel) {
      await retrieveInfoFromTexts(
        newExtractedTexts,
        options.infoRetrievalModel,
        setProcessingPhase,
        setProgress,
        setProcessedFiles,
        setExtractedCompanies,
        setRawResponses,
        logId,
        onChunkProgress
      );
    }

    if (options.runInfoRetrieval && options.infoRetrievalModel) {
      // Use refactored chunked info retrieval, returns final map
      finalExtractedCompanies = await retrieveInfoFromTextsRefactored(
        newExtractedTexts,
        options.infoRetrievalModel,
        logId
      );
      setExtractedCompanies(finalExtractedCompanies);
    }

  } catch (error) {
    console.error('Processing error:', error);
  } finally {
    setIsAnalyzing(false);
    setProcessingPhase('idle');
  }
  // Return the final map of extracted companies (may be empty)
  return finalExtractedCompanies;
}

export const handleConsolidateCompanies = async (
  sessionId: string,
  fileTree: FileNode[],
  extractedTexts: Record<string, string>,
  summaries: Record<string, string>,
  extractedCompanies: Record<string, CompanyInfo[]>,
  rawResponses: Record<string, { prompt: string; response: string }>,
  setIsConsolidating: Dispatch<SetStateAction<boolean>>,
  setLlmConsolidationDebug: Dispatch<SetStateAction<{ prompt: string; response: string }[]>>,
  setSuccessMessage: Dispatch<SetStateAction<string>>,
  mergeCompaniesFn: (companiesArray: any[]) => any[],
  infoRetrievalModel: string,
  router: any,
  onProgress?: (processed: number, total: number, currentFile: string) => void,
  onError?: (filePath: string, errorMsg: string) => void,   // <‑‑ signature change
): Promise<void> => {
  setIsConsolidating(true);

  /** Helper that tries to stringify big JSON safely (truncates) */
  const safeJsonStringify = (obj: any, maxChars = 15_000) => {
    let str = JSON.stringify(obj);
    if (str.length <= maxChars) return str;
    // keep head + tail, drop middle
    const slice = Math.floor(maxChars / 2);
    return `${str.slice(0, slice)} …truncated… ${str.slice(-slice)}`;
  };

  try {
    const allFilePaths = Object.keys(extractedCompanies);
    const total = allFilePaths.length;
    if (total === 0) throw new Error('No companies extracted – cannot consolidate.');

    const consolidationDebug: { prompt: string; response: string }[] = [];
    const perFileConsolidations: CompanyInfo[][] = [];

    let processed = 0;
    onProgress?.(0, total, '');

    for (const filePath of allFilePaths) {
      try {
        const companiesForFile = extractedCompanies[filePath] || [];
        if (companiesForFile.length === 0) {
          perFileConsolidations.push([]);
          continue;
        }

        const filePrompt = getIntermediateConsolidationPrompt({
          companies: companiesForFile,
        }).replace('{rawData}', safeJsonStringify({ companies: companiesForFile }));

        const res = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: filePrompt,
            model: infoRetrievalModel,
            format: 'json',
            requestType: 'consolidation',
            logId: sessionId,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status} ${res.statusText} – ${body.slice(0, 200)}`);
        }

        const { content } = await res.json();
        const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();

        let fileConsolidated: CompanyInfo[] = [];
        try {
          const parsed = JSON.parse(fixIncompleteJson(cleaned));
          if (Array.isArray(parsed)) fileConsolidated = parsed;
          else if (parsed?.companies) fileConsolidated = parsed.companies;
          else if (parsed?.name) fileConsolidated = [parsed];
        } catch (parseErr: any) {
          throw new Error(`JSON parse error – ${parseErr.message}`);
        }

        perFileConsolidations.push(
          fileConsolidated.map(c => ({
            ...c,
            sources:
              c.sources?.map(s => ({
                ...s,
                extractionDate: new Date().toISOString(),
              })) || [],
          }))
        );

        consolidationDebug.push({ prompt: filePrompt, response: cleaned });
      } catch (fileErr: any) {
        onError?.(filePath, fileErr.message);
      } finally {
        processed += 1;
        onProgress?.(processed, total, filePath);
      }
    }

    // ---------- global merge ----------
    const merged = mergeCompaniesFn([perFileConsolidations.flat()]) as ConsolidatedCompany[];
    // Save consolidation debug and merged companies to server
    await saveHeavyData(sessionId, {
      fileTree,
      extractedTexts,
      summaries,
      extractedCompanies,
      rawResponses,
      consolidatedCompanies: merged,
      consolidationDebug,   // include raw consolidation prompts/responses
    });
    setLlmConsolidationDebug(consolidationDebug);
    router.push(`/companies?sessionId=${sessionId}`);
  } catch (err) {
    console.error('Consolidation fatal:', err);
    router.push(`/companies?sessionId=${sessionId}&message=noData`);
  } finally {
    setIsConsolidating(false);
  }
};




// ==================================================================
// 6) Additional Utilities
// ==================================================================

export function addBase64ToTree(nodes: FileNode[]): FileNode[] {
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

/**
 * Re‑builds a FileNode tree that was persisted to disk.
 *
 * ‑ Converts any `base64Data` blob back into `rawData` (ArrayBuffer) so the UI
 *   can display the file immediately without another fetch.
 * ‑ Restores the **selected** flag that determines whether the file is included
 *   in a new analysis.  If the flag is missing (older sessions) we default to
 *   `true`, matching the behaviour of freshly‑uploaded files.
 * ‑ Rewrites `content` to an internal `/api/session-file` URL when the node was
 *   stored on disk (`localPath` present).
 *
 * @param nodes     Tree loaded from heavyData.json
 * @param sessionId Numeric or string session identifier
 * @returns         A new tree ready for the dashboard
 */
export function convertTree(
  nodes: FileNode[],
  sessionId: number | string
): FileNode[] {
  return nodes.map<FileNode>((node) => {
    /* ------------------------------------------------------------------ */
    /* 1.  Preserve / normalise common properties                         */
    /* ------------------------------------------------------------------ */
    const base: FileNode = {
      ...node,
      // ensure we keep the previous state; default to true for back‑compat
      selected: node.selected ?? true,
    };

    /* ------------------------------------------------------------------ */
    /* 2.  Recurse into folders                                           */
    /* ------------------------------------------------------------------ */
    if (base.type === 'folder' && base.children) {
      return {
        ...base,
        children: convertTree(base.children, sessionId),
      };
    }

    /* ------------------------------------------------------------------ */
    /* 3.  File‑specific processing                                       */
    /* ------------------------------------------------------------------ */
    if (base.type === 'file') {
      let rawData = base.rawData;

      // (a)  base64 ➜ ArrayBuffer
      if (base.base64Data) {
        const binary = atob(base.base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        rawData = bytes.buffer;
      }

      // (b)  Build in‑app URL for files stored on disk
      const contentUrl =
        base.localPath
          ? `/api/session-file?sessionId=${sessionId}&filePath=${encodeURIComponent(
              base.localPath
            )}`
          : base.content;

      return {
        ...base,
        rawData,
        base64Data: undefined, // free memory
        content: contentUrl,
      };
    }

    /* ------------------------------------------------------------------ */
    /* 4.  Fallback (shouldn’t really hit)                                */
    /* ------------------------------------------------------------------ */
    return base;
  });
}


/**
 * Toggles selection (selected/unselected) for all files in the file tree.
 */
export const toggleAllFiles = (
  selected: boolean,
  setFileTree: React.Dispatch<React.SetStateAction<FileNode[]>>
) => {
  const updateNodes = (nodes: FileNode[]): FileNode[] =>
    nodes.map((n) => ({
      ...n,
      selected: n.type === 'file' ? selected : n.selected,
      children: n.children ? updateNodes(n.children) : undefined
    }));
  setFileTree((prev) => updateNodes(prev));
};

/**
 * Saves heavy data (file tree, extracted texts, etc.) to the server for a given session.
 */
export const saveHeavyData = async (
  sessionId: string,
  heavyData: {
    fileTree: FileNode[];
    extractedTexts: Record<string, string>;
    summaries: Record<string, string>;
    extractedCompanies: Record<string, CompanyInfo[]>;
    rawResponses: Record<string, { prompt: string; response: string }>;
    consolidatedCompanies?: ConsolidatedCompany[];
    consolidationDebug?: { prompt: string; response: string }[];
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
          consolidatedCompanies: heavyData.consolidatedCompanies || []
        }
      })
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export function handleFileSelect(
  node: FileNode | null,
  setSelectedFile: React.Dispatch<React.SetStateAction<FileNode | null>>
) {
  setSelectedFile(node);
}

export const openSaveModal = async (
  setNewUploadName: React.Dispatch<React.SetStateAction<string>>,
  setExistingUploadId: React.Dispatch<React.SetStateAction<number | null>>,
  setSelectedUploadOption: React.Dispatch<React.SetStateAction<'new' | 'existing'>>,
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>,
  setExistingUploads: React.Dispatch<React.SetStateAction<ExistingUpload[]>>,
  setFetchingUploads: React.Dispatch<React.SetStateAction<boolean>>,
): Promise<void> => {
  // preserve existing session name (e.g. folder name), do not reset
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

export const closeSaveModal = (
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  setShowSaveModal(false);
};

export const handleSaveConfirm = async (
  newUploadName: string,
  saveSession: (sessionName: string) => Promise<string>,
  setShowSaveModal: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  try {
    // Get the session name from your state (you'll need to ensure this is populated)
    const sessionName =
      newUploadName.trim() || `Session ${new Date().toLocaleDateString()}`;
    const sessionId = await saveSession(sessionName);
    localStorage.setItem('currentSessionId', sessionId);
    setShowSaveModal(false);
  } catch (error) {
    console.error('Error in handleSaveConfirm:', error);
    alert('Error saving data: ' + (error as Error).message);
  }
};

export async function saveSession(
  sessionName: string,
  fileTree: FileNode[],
  extractedTexts: Record<string, string>,
  summaries: Record<string, string>,
  extractedCompanies: Record<string, CompanyInfo[]>,
  rawResponses: Record<string, { prompt: string; response: string }>,
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>,
  setSuccessMessage: React.Dispatch<React.SetStateAction<string>>
): Promise<string> {
  /* -------------------------------------------------------------- */
  /*  Fallback name if the caller passes an empty / blank string    */
  /* -------------------------------------------------------------- */
  const fallback   = `Upload — ${new Date().toLocaleString('en-GB')}`;
  const nameToUse  = sessionName?.trim() || fallback;

  /* -------------------------------------------------------------- */
  /*  Prepare file‑tree payload (adds base64 blobs)                 */
  /* -------------------------------------------------------------- */
  const fileTreeWithBase64 = addBase64ToTree(fileTree);

  /* -------------------------------------------------------------- */
  /*  1️⃣  create / upsert the lightweight “session” row            */
  /* -------------------------------------------------------------- */
  const res = await fetch('/api/sessions', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id'   : localStorage.getItem('userId') || '',
    },
    body: JSON.stringify({ sessionName: nameToUse }),
  });
  if (!res.ok) throw new Error('Failed to save session');
  const data = await res.json();                 // { session_id: string }

  /* -------------------------------------------------------------- */
  /*  2️⃣  dump the heavy data (fileTree, texts, etc.)              */
  /* -------------------------------------------------------------- */
  await saveHeavyData(data.session_id, {
    fileTree          : fileTreeWithBase64,
    extractedTexts,
    summaries,
    extractedCompanies,
    rawResponses,
  });

  /* -------------------------------------------------------------- */
  /*  3️⃣  finish up – update state + localStorage                  */
  /* -------------------------------------------------------------- */
  setCurrentSessionId(data.session_id);
  setSuccessMessage('Session saved successfully!');
  localStorage.setItem('currentSessionId', data.session_id);

  return data.session_id;
}


export const handleLoadClick = async (
  setAvailableSessions: React.Dispatch<React.SetStateAction<any[]>>,
  setShowLoadModal: React.Dispatch<React.SetStateAction<boolean>>
) => {
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

export const confirmLoadSession = async (
  sessionId: string,
  setFileTree: Dispatch<SetStateAction<FileNode[]>>,
  setRawResponses: Dispatch<SetStateAction<Record<string, { prompt: string; response: string }>>>,
  setChatHistory: Dispatch<SetStateAction<string | null>>,
  setExtractedTexts: Dispatch<SetStateAction<Record<string, string>>>,
  setSummaries: Dispatch<SetStateAction<Record<string, string>>>,
  setExtractedCompanies: Dispatch<SetStateAction<Record<string, CompanyInfo[]>>>,
  setCurrentSessionId: Dispatch<SetStateAction<string | null>>,
  router: any
) => {
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
    router.push(`/dashboard?sessionId=${sessionId}`); // Redirect to dashboard
  } catch (error) {
    console.error('Error loading session:', error);
    alert('Error loading session: ' + (error as Error).message);
  }
};
