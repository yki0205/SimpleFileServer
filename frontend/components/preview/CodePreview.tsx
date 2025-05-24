"use client";

import React, { useState, useEffect } from "react";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodePreviewProps extends Omit<PreviewBaseProps, 'children'> {
  /** Code content to display */
  content?: string;
  /** Language of the code */
  language?: string;
  /** File extension (used to determine language if not specified) */
  fileExtension?: string;
  /** File name to display */
  fileName?: string;
  /** Whether the content is loading - can be provided externally since code content is often fetched separately */
  isLoading?: boolean;
  /** Whether there was an error loading the content - can be provided externally */
  hasError?: boolean;
}

function getLanguage(ext: string = ''): string {
  const langMap: Record<string, string> = {
    // Plain text
    'txt': 'text',
    'ini': 'text',
    'cfg': 'text',
    'conf': 'text',

    // Markup and styling
    'html': 'html',
    'css': 'css',
    'md': 'markdown',
    'xml': 'xml',

    // Data formats
    'json': 'json',
    'csv': 'csv',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',

    // Programming languages
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'powershell': 'bash',
    'ps1': 'bash',
    'psm1': 'bash',
  };

  return langMap[ext.toLowerCase()] || 'text';
}

export const CodePreview: React.FC<CodePreviewProps> = ({
  content,
  language,
  fileExtension,
  fileName,
  isLoading = false,
  hasError = false,
  controls,
  ...restProps
}) => {
  // Determine the language to use for syntax highlighting
  const effectiveLanguage = language || (fileExtension ? getLanguage(fileExtension) : 'text');
  
  // Determine if we have an error in the content itself
  const isContentError = Boolean(content && content.startsWith('Error loading file:'));
  const contentToDisplay = content || '';

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError || isContentError}
      errorMessage={isContentError ? contentToDisplay : undefined}
      controls={{
        enableBaseHandleKeyboard: true,
        ...controls,
      }}
      {...restProps}
    >
      <div className="w-[80vw] h-[80vh] overflow-hidden bg-gray-900 rounded-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with file info */}
        {fileName && (
          <div className="sticky top-0 bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm truncate max-w-[50vw]">
                {fileName}
              </span>
              {fileExtension && (
                <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
                  {fileExtension}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-auto flex-1 p-1">
          {isContentError ? (
            <div className="p-4 text-red-400 font-mono">
              {contentToDisplay}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse flex flex-col items-center">
                <div className="h-4 w-32 bg-gray-700 rounded-md mb-2"></div>
                <div className="h-4 w-48 bg-gray-700 rounded-md"></div>
              </div>
            </div>
          ) : !contentToDisplay ? (
            <div className="p-4 text-red-400 font-mono">
              No content available
            </div>
          ) : (
            <SyntaxHighlighter
              language={effectiveLanguage}
              style={vscDarkPlus}
              showLineNumbers
              customStyle={{ margin: 0, height: '100%', background: 'transparent' }}
              codeTagProps={{ style: { fontFamily: 'monospace' } }}
            >
              {contentToDisplay}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </PreviewBase>
  );
};

export default CodePreview; 