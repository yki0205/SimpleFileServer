"use client";

import React, { useState, useCallback, useEffect } from "react";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { ComicReader } from "@/components/reader/ComicReader";

interface ComicPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** Comic source URL */
  src: string;
}

export const ComicPreview: React.FC<ComicPreviewProps> = ({
  src,
  onClose,
  controls,
  ...restProps
}) => {
  // Internal loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Since ComicReader might not support onLoad/onError props,
  // use a timeout to simulate content loading
  useEffect(() => {
    // Start with loading state
    setIsLoading(true);
    setHasError(false);
    
    // Assume comic takes a few seconds to load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [src]);

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError}
      onClose={onClose}
      controls={{
        showClose: false,
        showDownload: false,
        showNavigation: false,
        ...controls
      }}
      {...restProps}
    >
      <div className="max-w-[95vw] max-h-[90vh] overflow-hidden bg-black rounded-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <ComicReader
          src={src}
          onClose={onClose}
        />
      </div>
    </PreviewBase>
  );
};

export default ComicPreview; 