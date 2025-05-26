"use client";

import React, { useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import EpubReader from "@/components/reader/EpubReader";

interface EpubPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError' | 'onFullScreen' | 'onToggleDirection'> {
  /** EPUB source URL */
  src: string;
}

export const EpubPreview: React.FC<EpubPreviewProps> = ({
  src,
  controls,
  ...restProps
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Simple check if the URL exists
  useEffect(() => {
    const checkResource = async () => {
      try {
        const response = await fetch(src, { method: 'HEAD' });
        if (!response.ok) {
          setHasError(true);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking EPUB resource:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    checkResource();
  }, [src]);

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError}
      controls={{
        showClose: false,
        showDownload: false,
        showNavigation: false,
        enableHandleKeyboard: false,
        preventContextMenu: true,
        ...controls
      }}
      {...restProps}
    >
      <div className={cn(
        (isLoading || hasError) && "opacity-0",
        "max-w-[90vw] max-h-[90vh] h-[90vh]"
      )}>
        <EpubReader
          src={src}
          onNext={controls?.onNext}
          onPrev={controls?.onPrev}
        />
      </div>
    </PreviewBase>
  );
};

export default EpubPreview; 