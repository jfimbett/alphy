import { useState } from 'react';

export default function ModelSelector({
  selectedModel,
  onModelChange
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  return (
    <div className="mb-4 text-gray-800">
      <label className="block text-sm font-medium mb-1">AI Model</label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="w-full p-2 border rounded bg-white"
      >
        <optgroup label="DeepSeek Cloud">
          <option value="deepseek:deepseek-reasoner">DeepSeek-R1</option>
          <option value="deepseek:deepseek-chat">DeepSeek Chat</option>
        </optgroup>
      </select>
    </div>
  );
}