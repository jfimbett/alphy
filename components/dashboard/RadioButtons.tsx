import React, { useState } from 'react';
import { FileNode } from '@/components/FileTree';

interface ChatContextRadioButtonsProps {
    fileTree: FileNode[];
    getAllFiles: (files: FileNode[]) => FileNode[];
  }

const ChatContextRadioButtons: React.FC<ChatContextRadioButtonsProps> = ({ fileTree, getAllFiles }) => {
  const [contextType, setContextType] = useState<'none' | 'local' | 'global'>('none');

  return (
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
  );
};

export default ChatContextRadioButtons;
