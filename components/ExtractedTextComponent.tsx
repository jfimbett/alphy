'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';       // for GitHub-Flavored Markdown
import remarkMath from 'remark-math';     // for LaTeX math
import rehypeKatex from 'rehype-katex';   // to render LaTeX using KaTeX
import 'katex/dist/katex.min.css';        // KaTeX CSS

// Optional: If you want code syntax highlighting, you could import:
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ExtractedTextProps {
  content: string;
}

export const ExtractedTextContent: React.FC<ExtractedTextProps> = ({ content }) => {
  // If you also want custom rendering for code blocks, you can define components like so:
  /*
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
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
  */

  return (
    <div className="prose max-w-none text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        // components={markdownComponents} // only if you want code highlighting
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
