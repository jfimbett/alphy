'use client';

import React, { useState } from 'react';

// 1. ReactMarkdown & plugins
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';       // GitHub-Flavored Markdown
import remarkMath from 'remark-math';     // For math syntax $x^2$
import rehypeKatex from 'rehype-katex';   // For rendering math
import 'katex/dist/katex.min.css';        // KaTeX styles

// 2. Optional Syntax Highlighting
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

//==========================
// HELPER: parseAIResponse
//==========================
export const parseAIResponse = (content: string) => {
  const thinkingEndIndex = content.indexOf('</think>');
  if (thinkingEndIndex === -1) {
    return { thinking: null, answer: content };
  }

  const thinkingStartIndex = content.indexOf('<think>');
  const thinking = content.slice(thinkingStartIndex + 7, thinkingEndIndex);
  const answer = content.slice(thinkingEndIndex + 8);

  return { thinking, answer };
};

//==========================
// MAIN COMPONENT
//==========================
interface ChatMessageProps {
  role: string;
  content: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, content }) => {
  const [showThinking, setShowThinking] = useState(false);

  // Extract the answer vs. hidden <think> text
  const { thinking, answer } = parseAIResponse(content);

  // Decide background colors, text colors, etc.
  const isUser = role === 'user';
  const containerClasses = isUser
    ? 'bg-blue-50 border border-blue-200'
    : 'bg-purple-50 border border-purple-200';

  // Custom renderer for code blocks in Markdown
  const markdownComponents = {
    code({ inline, className, children, ...props }: { inline?: boolean, className?: string, children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || '') || [];
      return !inline ? (
        <SyntaxHighlighter
          language={match[1] || 'text'}
          style={oneDark}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`p-4 rounded-lg mb-2 ${containerClasses}`}>
      <div className="flex items-start gap-2">
        <span className={`text-sm font-medium ${isUser ? 'text-blue-600' : 'text-purple-600'}`}>
          {isUser ? 'You:' : 'AI:'}
        </span>

        <div className="flex-1 text-gray-700">
          {/* ANSWER as Markdown */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {answer}
          </ReactMarkdown>

          {thinking && (
            <div className="mt-2">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {showThinking ? 'Hide' : 'Show'} Reasoning
                <svg
                  className={`w-4 h-4 transition-transform ${showThinking ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showThinking && (
                <div className="mt-2 p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
                  {/* THINKING as Markdown (optional) */}
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {thinking}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
