import React from "react";

type FileAnalysisButtonsProps = {
  fileTree: any[];
  selectedModel: string;
  analyzeFiles: (model: string) => void;
  openSaveModal: () => void;
  toggleAllFiles: (state: boolean) => void;
  allSelected: boolean;
  setAllSelected: (state: boolean) => void;
  getAllFiles: (files: any[]) => any[];
  isAnalyzing: boolean;
  progress: number;
  processingPhase: string;
  processedFiles: number;
  totalFiles: number;
};

const FileAnalysisButtons: React.FC<FileAnalysisButtonsProps> = ({
  fileTree,
  selectedModel,
  analyzeFiles,
  openSaveModal,
  toggleAllFiles,
  allSelected,
  setAllSelected,
  getAllFiles,
  isAnalyzing,
  progress,
  processingPhase,
  processedFiles,
  totalFiles,
}) => {
  if (fileTree.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => analyzeFiles(selectedModel)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Files"}
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
            {allSelected ? "Deselect All" : "Select All"}
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
              {processingPhase === "extracting" &&
                `Converting files to text: ${processedFiles}/${totalFiles} (${progress}%)`}
              {processingPhase === "summarizing" &&
                `Summarizing files: ${processedFiles}/${totalFiles} (${progress}%)`}
              {processingPhase === "extracting_companies" &&
                `Extracting company data: ${processedFiles}/${totalFiles} (${progress}%)`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileAnalysisButtons;
