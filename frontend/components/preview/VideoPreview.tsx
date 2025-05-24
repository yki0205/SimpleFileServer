"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { Video } from "@/components/video/Video";

interface VideoPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError' | 'onFullScreen' | 'onToggleDirection'> {
  /** Video source URL */
  src: string;
  /** Whether to autoplay the video */
  autoPlay?: boolean;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  src,
  autoPlay = true,
  controls,
  ...restProps
}) => {
  const currentSrcRef = useRef(src);
  const cachedVideosRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    cachedVideosRef.current.add(src);
    setIsLoading(false);
  }, [src]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  useEffect(() => {
    currentSrcRef.current = src;

    const checkIfCached = () => {
      if (cachedVideosRef.current.has(src)) {
        setIsLoading(false);
        return;
      }

      const video = document.createElement('video');

      video.onloadedmetadata = () => {
        cachedVideosRef.current.add(src);
        setIsLoading(false);
      };

      video.oncanplay = () => {
        cachedVideosRef.current.add(src);
        setIsLoading(false);
      };

      video.onerror = () => {
        setIsLoading(false);
        setHasError(true);
      };

      video.src = src;
      video.preload = "metadata";
      video.muted = true;

      if (video.readyState >= 2) {
        cachedVideosRef.current.add(src);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    };

    checkIfCached();
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log('Video load timeout, forcing state update');
        setIsLoading(false);
      }
    }, 60000); // 60 second timeout

    return () => clearTimeout(timeoutId);
  }, [src, isLoading]);

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
      <div ref={containerRef} className="flex flex-col items-center w-full">
        <Video
          src={src}
          autoPlay={autoPlay}
          className={cn(
            (isLoading || hasError) && "opacity-0",
            "max-w-full max-h-[80vh] shadow-2xl"
          )}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </PreviewBase>
  );
};

export default VideoPreview; 