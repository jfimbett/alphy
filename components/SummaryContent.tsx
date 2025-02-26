'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';       


// If you also want syntax highlighting for code blocks:
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const parseAIResponse = (content: string) => {
  const thinkingEndIndex = content.indexOf('</think>');
  if (thinkingEndIndex === -1) {
    return { thinking: null, answer: content.trim() };
  }
  const thinkingStartIndex = content.indexOf('<think>');
  const thinking = content.slice(thinkingStartIndex + 7, thinkingEndIndex).trim();
  const answer = content.slice(thinkingEndIndex + 8).trim();
  return { thinking, answer };
};

interface SummaryContentProps {
  content: string;
}

export const SummaryContent: React.FC<SummaryContentProps> = ({ content }) => {
  const [showThinking, setShowThinking] = useState(false);
  const { thinking, answer } = parseAIResponse(content);

  // Optionally define custom renderers for code blocks, etc.
  // const markdownComponents = {
  //   code({ node, inline, className, children, ...props }) {
  //     const match = /language-(\w+)/.exec(className || '') || [];
  //     return !inline ? (
  //       <SyntaxHighlighter
  //         language={match[1] || 'text'}
  //         style={oneDark}
  //         PreTag="div"
  //         {...props}
  //       >
  //         {String(children).replace(/\n$/, '')}
  //       </SyntaxHighlighter>
  //     ) : (
  //       <code className={className} {...props}>
  //         {children}
  //       </code>
  //     );
  //   },
  // };

  return (
    <div className="prose max-w-none text-gray-700">
      {/* ANSWER as Markdown */}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
      
        {answer}
      </ReactMarkdown>

      {thinking && (
        <div className="mt-2">
          <button
            onClick={() => setShowThinking((prev) => !prev)}
            className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
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
            <div className="mt-2 p-3 bg-green-100 rounded-lg text-sm text-green-700 justify-center">
              {/* THINKING as Markdown */}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {thinking}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
