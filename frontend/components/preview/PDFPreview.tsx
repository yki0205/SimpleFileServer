"use client"

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";

interface PDFPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** PDF source URL */
  src: string;
  /** iframe title */
  title?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  title,
  src,
  controls,
  ...restProps
}) => {

  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!isFullScreen) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
        setIsFullScreen(!isFullScreen);
      }

      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
          setIsFullScreen(false);
        } else {
          controls?.onClose?.();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, controls?.onClose]);

  return (
    <PreviewBase
      controls={{
        showClose: false,
        showDownload: false,
        showNavigation: false,
        enableHandleKeyboard: false,
        ...controls
      }}
      {...restProps}
    >
      <iframe
        title={title}
        src={src}
        className={cn(
          isFullScreen ? "w-screen h-screen" : "w-[90vw] h-[90vh]"
        )}
      />
    </PreviewBase>
  );
};

export default PDFPreview; 