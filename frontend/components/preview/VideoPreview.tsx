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

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  const handleLoad = useCallback(() => {
    cachedVideosRef.current.add(src);
    if (src === currentSrcRef.current) {
      setIsLoading(false);
    }
  }, [src]);

  const handleError = useCallback(() => {
    if (src === currentSrcRef.current) {
      setIsLoading(false);
      setHasError(true);
    }
  }, []);

  useEffect(() => {
    currentSrcRef.current = src;

    const checkIfCached = () => {
      if (cachedVideosRef.current.has(src)) {
        if (src === currentSrcRef.current) {
          setIsLoading(false);
        }
        return;
      }

      const video = document.createElement('video');

      video.onloadedmetadata = () => {
        cachedVideosRef.current.add(src);
        if (src === currentSrcRef.current) {
          setIsLoading(false);
        }
      };

      video.oncanplay = () => {
        cachedVideosRef.current.add(src);
        if (src === currentSrcRef.current) {
          setIsLoading(false);
        }
      };

      video.onerror = () => {
        if (src === currentSrcRef.current) {
          setIsLoading(false);
          setHasError(true);
        }
      };

      video.src = src;
      video.preload = "metadata";
      video.muted = true;

      if (video.readyState >= 2) {
        cachedVideosRef.current.add(src);
        if (src === currentSrcRef.current) {
          setIsLoading(false);
        }
      } else {
        if (src === currentSrcRef.current) {
          setIsLoading(true);
        }
      }
    };

    checkIfCached();
    setHasError(false);
  }, [src]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoading && src === currentSrcRef.current) {
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
      <Video
        src={src}
        autoPlay={autoPlay}
        className={cn(
          (isLoading || hasError) && "opacity-0"
        )}
        onLoad={handleLoad}
        onError={handleError}
        onNext={controls?.onNext}
        onPrev={controls?.onPrev}
        onFullscreen={setIsFullscreen}
        onPictureInPicture={setIsPictureInPicture}
      />
    </PreviewBase>
  );
};

export default VideoPreview; 