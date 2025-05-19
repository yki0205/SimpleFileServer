"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
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

  const currentSrcRef = useRef(src);
  const cachedAudioRef = useRef<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    cachedAudioRef.current.add(src);
    setIsLoading(false);
  }, [src]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  useEffect(() => {
    currentSrcRef.current = src;
    
    const checkIfCached = () => {
      if (cachedAudioRef.current.has(src)) {
        setIsLoading(false);
        return;
      }
      
      const audio = new Audio();
      
      audio.onloadedmetadata = () => {
        cachedAudioRef.current.add(src);
        setIsLoading(false);
      };
      
      audio.oncanplaythrough = () => {
        cachedAudioRef.current.add(src);
        setIsLoading(false);
      };
      
      audio.onerror = () => {
        setIsLoading(false);
        setHasError(true);
      };
      
      audio.src = src;
      audio.preload = "metadata";
      
      if (audio.readyState >= 2) {
        cachedAudioRef.current.add(src);
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
        console.log('Audio load timeout, forcing state update');
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
          onCanPlay={handleLoad}
          onLoadedMetadata={handleLoad}
          onError={handleError}
        />
      </div>
    </PreviewBase>
  );
};

export default AudioPreview; 