"use client"

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";

interface PDFPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** PDF source URL */
  title?: string;
  src: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  title,
  src,
  controls,
  ...restProps
}) => {

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <PreviewBase
      controls={{
        showDownload: false,
        showNavigation: false,
        showFullscreen: true,
        useBrowserFullscreenAPI: true,
        enableFullscreenToolbar: true,
        enableFullscreenNavigation: false,
        enableHandleKeyboard: false,
        ...controls
      }}
      callbacks={{
        onFullScreenChange: (isFullScreen) => setIsFullScreen(isFullScreen),
      }}
      {...restProps}
      title={""}
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