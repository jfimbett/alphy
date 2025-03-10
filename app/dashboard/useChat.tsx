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
    model
  }: {
    e: React.FormEvent<HTMLFormElement>;
    selectedFileText: string;
    globalContext: string;
    model: string;
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

      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' ,
          'x-user-id': localStorage.getItem('userId') || ''
        },
        body: JSON.stringify({ 
          prompt: chatMessage,
          context: context,
          history: newHistory,
          model: model,
          format: contextType === 'global' ? 'json' : undefined
         }),
      });

  
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
  
      setChatHistory([...newHistory, { role: 'assistant', content: data.content }]);
      setChatMessage('');
      
    } catch (error) {
      console.error('Chat Error:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${(error as Error).message} - Please try again`
      }]);
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
