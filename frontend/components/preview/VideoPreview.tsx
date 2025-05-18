"use client";

import React, { useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { Video } from "@/components/video/Video";

interface VideoPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** Video source URL */
  src: string;
  /** Whether to autoplay the video */
  autoPlay?: boolean;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  src,
  autoPlay = true,
  onClose,
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

  // Handle video load event
  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Handle video error event
  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError}
      onClose={onClose}
      controls={{
        ...controls
      }}
      {...restProps}
    >
      <div className="flex flex-col items-center w-full">
        <Video
          src={src}
          autoPlay={autoPlay}
          className={cn(
            (isLoading || hasError) && "opacity-0",
            "max-w-full max-h-[80vh] shadow-2xl"
          )}
          onLoad={handleLoad}
          onError={handleError}
          onClose={onClose}
        />
      </div>
    </PreviewBase>
  );
};

export default VideoPreview; 