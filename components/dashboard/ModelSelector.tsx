import { useState } from 'react';

export default function ModelSelector({
  selectedModel,
  onModelChange,
  disabled
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}) {
  const models = [
    'deepseek:deepseek-reasoner',
    'deepseek:deepseek-chat',
  ]
  return (
    <select
      value={selectedModel}
      onChange={(e) => onModelChange(e.target.value)}
      disabled={disabled}
      className={`w-full p-2 border rounded ${disabled ? 'bg-gray-100' : ''}`}
    >
      {models.map((model) => (
        <option key={model} value={model}>
          {model.split(':')[1]}
        </option>
      ))}
    </select>
  )
}