"use client";

import React, { useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";

interface AudioPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** Audio source URL */
  src: string;
}

export const AudioPreview: React.FC<AudioPreviewProps> = ({
  src,
  controls,
  ...restProps
}) => {
  // Internal loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  // Handle audio load event
  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Handle audio error event
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError}
      controls={{
        ...controls
      }}
      {...restProps}
    >
      <div className="flex flex-col items-center">
        <audio
          controls
          className={cn(
            "max-w-full shadow-2xl",
            (isLoading || hasError) && "opacity-0"
          )}
          src={src}
          onLoadedData={handleLoad}
          onError={handleError}
        />
      </div>
    </PreviewBase>
  );
};

export default AudioPreview; 