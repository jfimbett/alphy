'use client';

import { useState } from 'react';
import { FolderIcon, FolderOpenIcon, DocumentIcon } from '@heroicons/react/24/outline';

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  rawData?: ArrayBuffer;
  fullPath?: string;
  highlighted?: boolean;
  selected?: boolean;
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedFile?: FileNode | null;
  onSelect: (node: FileNode) => void;
  onToggleConversion?: (path: string) => void;
  onToggleHighlight?: (path: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  onSelect: (node: FileNode) => void;
  isSelected: boolean;
  selectedFile?: FileNode | null;
  onToggleConversion?: (path: string) => void;
  onToggleHighlight?: (path: string) => void;
}

export default function FileTree({
  nodes,
  onSelect,
  selectedFile,
  onToggleConversion,
  onToggleHighlight,
}: FileTreeProps) {
  return (
    <div className="pl-4">
      {nodes.map((node, index) => (
        <TreeNode
          key={index}
          node={node}
          onSelect={onSelect}
          isSelected={selectedFile?.name === node.name}
          selectedFile={selectedFile}
          onToggleConversion={onToggleConversion}
          onToggleHighlight={onToggleHighlight}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  onSelect,
  isSelected,
  selectedFile,
  onToggleConversion,
  onToggleHighlight,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (node.type === 'file') {
      onSelect(node);
    } else {
      setIsOpen(!isOpen);
    }
  };

  const handleDoubleClick = () => {
    // If it's a file and we have a highlight function, call it
    if (node.type === 'file' && onToggleHighlight) {
      onToggleHighlight(node.fullPath!);
    }
  };

  return (
    <div className="pl-4">
      <div className="flex items-center gap-2">
        {/* Conversion Checkbox: only for files */}
        {node.type === 'file' && (
          <input
            type="checkbox"
            checked={node.selected}
            onChange={(e) => {
              e.stopPropagation();
              if (onToggleConversion) {
                onToggleConversion(node.fullPath!);
              }
            }}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
        )}

        <button
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className={`flex items-center gap-2 py-2 w-full text-left rounded-md px-2 transition-colors ${
            node.highlighted ? 'ring-2 ring-blue-500 bg-blue-50 shadow-md' : ''
          } ${
            isSelected ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50'
          }`}
        >
          {/* Folder/File Icon */}
          <span className="w-5 h-5 flex-shrink-0">
            {node.type === 'folder' ? (
              isOpen ? (
                <FolderOpenIcon className="w-5 h-5 text-blue-600" />
              ) : (
                <FolderIcon className="w-5 h-5 text-blue-600" />
              )
            ) : (
              <DocumentIcon className="w-5 h-5 text-gray-500" />
            )}
          </span>

          {/* File/Folder Name */}
          <span
            className={`text-sm ${
              node.type === 'folder' ? 'font-medium text-gray-900' : 'text-gray-700'
            }`}
          >
            {node.name}
          </span>
        </button>
      </div>

      {/* Render child nodes if folder is open */}
      {isOpen && node.children && (
        <div className="pl-4 border-l-2 border-gray-200 ml-3">
          <FileTree
            nodes={node.children}
            onSelect={onSelect}
            selectedFile={selectedFile}
            onToggleConversion={onToggleConversion}
            onToggleHighlight={onToggleHighlight}
          />
        </div>
      )}
    </div>
  );
}
