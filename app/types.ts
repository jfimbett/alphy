export interface CompanySource {
  filePath: string;
  pageNumber?: number;
  extractionDate: string;
}

export type CompanyInfo = {
    name: string;
    sector?: string;
    years?: number[];
    variables?: Record<string, VariableData>;
    sources?: CompanySource[];
  };

  export interface VariableData {
    value?: number | string;
    currency?: string;
    unit?: string;
  }
  
  export interface ConsolidatedCompany extends CompanyInfo {
    variables: Record<string, VariableData>;
    dates: string[];
    children?: ConsolidatedCompany[];
    ownershipPath: string[];
    parent: ConsolidatedCompany | null;
  }

  // In types.ts
export interface SessionSummary {
  session_id: number;
  session_name: string;
  created_at: string;
  file_count: number;
}

export interface SessionData {
  session_name: string;
  fileTree?: FileNode[];
  extractedTexts: Record<string, string>;
  summaries: Record<string, string>;
  rawResponses: Record<string, { prompt: string; response: string }>;
  consolidatedCompanies?: ConsolidatedCompany[];
}

// In types.ts
export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  base64Data?: string;
  fullPath?: string;
  selected?: boolean;
  highlighted?: boolean;
  localPath?: string; // Added for file storage tracking
}

// In types.ts
export type CompanyMap = Map<string, ConsolidatedCompany>;
export type ExtractedTexts = Record<string, string>;
export type FileTree = FileNode[];