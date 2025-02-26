import React, { FormEvent, RefObject } from 'react';
import { ChatMessage } from '@/components/ChatMessage';

interface ChatSectionProps {
  chatHistory: Array<{ role: string; content: string }>;
  formRef: React.RefObject<HTMLFormElement | null>;
  handleChatSubmit: (params: { e: React.FormEvent<HTMLFormElement>; selectedFileText: string; globalContext: string; model: string; }) => Promise<void>;
  extractedTexts: Record<string, string>;
  selectedFile?: { fullPath?: string } | null;
  highlightedFiles: Set<string>;
  chatMessage: string;
  setChatMessage: (message: string) => void;
  isChatLoading: boolean;
  selectedModel: string;
}

const ChatSection: React.FC<ChatSectionProps> = ({
  chatHistory,
  formRef,
  handleChatSubmit,
  extractedTexts,
  selectedFile,
  highlightedFiles,
  chatMessage,
  setChatMessage,
  isChatLoading,
  selectedModel
}) => {
  return (
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
  );
};

export default ChatSection;