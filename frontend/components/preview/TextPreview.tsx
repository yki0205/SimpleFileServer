import React from "react";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface TextPreviewProps extends Omit<PreviewBaseProps, 'children'> {
  /** Text content to display */
  content?: string;
  /** File extension of the content */
  fileExtension?: string;
  /** File name to display */
  fileName?: string;
  /** Whether the content is loading - can be provided externally since code content is often fetched separately */
  isLoading?: boolean;
  /** Whether there was an error loading the content - can be provided externally */
  hasError?: boolean;
}

export const TextPreview: React.FC<TextPreviewProps> = ({
  content,
  fileExtension,
  fileName,
  isLoading = false,
  hasError = false,
  controls,
  ...restProps
}) => {

  const isContentError = Boolean(content && content.startsWith('Error loading file:'));
  const contentToDisplay = content || '';

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError || isContentError}
      errorMessage={isContentError ? contentToDisplay : undefined}
      controls={{
        enableBackdropClose: true,

        useBrowserFullscreenAPI: true,

        enableHandleKeyboard: true,
        enableBaseHandleKeyboard: true,

        ...controls,
      }}
      {...restProps}
    >
      <div className="w-screen h-screen md:w-[90vw] md:h-[90vh] overflow-hidden rounded-md flex flex-col text-white" onClick={(e) => e.stopPropagation()}>
        {/* Header with file info */}
        {fileName && (
          <div className="sticky top-0 bg-black/70 py-2 px-4 flex justify-between items-center">
            <span className="text-sm truncate max-w-[50vw]">
              {fileName}
            </span>
            <div className="flex items-center gap-2">
              {controls?.onDownload && <Button variant="ghost" size="icon" onClick={controls.onDownload}>
                <Download className="w-4 h-4" />
              </Button>}
              {controls?.onClose && <Button variant="ghost" size="icon" onClick={controls.onClose}>
                <X className="w-4 h-4" />
              </Button>}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-auto flex-1 custom-scrollbar border border-t-0 border-black/70 select-text selection:bg-gray-700/60">
          {isContentError ? (
            <div className="p-4 text-red-400">
              {contentToDisplay}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-start justify-center h-full p-6">
              {Array.from({ length: 25 }).map((_, index) => {
                const width = Math.random() * 30 + (index % 4 === 0 ? 60 : 20);
                return (
                  <div key={index} className={`h-[0.8vh] bg-gray-700/60 rounded-full mb-[2vh] animate-pulse`}
                    style={{ width: `${width}%`, animationDelay: `${index * 0.05}s` }}
                  />
                )
              })}
            </div>
          ) : !contentToDisplay ? (
            <div className="p-4 text-red-400">
              No content available
            </div>
          ) : (
            <SyntaxHighlighter
              language={fileExtension}
              style={oneDark}
              showLineNumbers
              wrapLines={true}
              customStyle={{
                margin: 0,
                height: '100%',
                background: 'transparent'
              }}
              codeTagProps={{
                className: 'font-mono text-xs sm:text-sm'
              }}
            >
              {contentToDisplay}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </PreviewBase>
  );
};

export default TextPreview; 