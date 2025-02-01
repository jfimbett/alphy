'use client';
import { useState } from 'react';

interface ChatMessage {
  role: string;
  content: string;
}

export type ContextType = 'none' | 'local' | 'global';

export function useChat() {
  const [contextType, setContextType] = useState<ContextType>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Submit chat to your LLM
  const handleChatSubmit = async ({
    e,
    selectedFileText,
    globalContext,
  }: {
    e: React.FormEvent;
    selectedFileText: string | undefined;
    globalContext: string | undefined;
  }) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setIsChatLoading(true);
    const newHistory = [...chatHistory, { role: 'user', content: chatMessage }];

    try {
      let context = '';
      if (contextType === 'local' && selectedFileText) {
        context = selectedFileText;
      } else if (contextType === 'global' && globalContext) {
        // Example: limit the length if needed
        context = globalContext.slice(0, 5000);
      }

      const promptWithContext = context
        ? chatMessage + '\n\nContext:\n\n' + context
        : chatMessage;

      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptWithContext }),
      });

      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();

      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: data.content },
      ]);
      setChatMessage('');
    } catch (error) {
      console.error('Chat Error:', error);
    } finally {
      setIsChatLoading(false);
    }
  };

  return {
    contextType,
    setContextType,
    chatMessage,
    setChatMessage,
    chatHistory,
    setChatHistory,
    isChatLoading,
    handleChatSubmit,
  };
}
