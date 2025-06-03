"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { EPUBReader } from "@/components/reader";

interface EPUBPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError' | 'onFullScreen' | 'onToggleDirection'> {
  /** EPUB source URL */
  src: string;
}


export const EPUBPreview: React.FC<EPUBPreviewProps> = ({
  src,
  controls,
  ...restProps
}) => {

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <PreviewBase
      controls={{
        showNavigation: false,
        useBrowserFullscreenAPI: true,
        showFullscreen: true,
        enableFullscreenToolbar: false,
        enableFullscreenNavigation: false,
        enableHandleKeyboard: false,
        ...controls
      }}
      callbacks={{
        onFullScreenChange: setIsFullScreen,
      }}
      {...restProps}
      title={""}
    >
      <EPUBReader
        key={`epub-reader-${isFullScreen ? 'fullscreen' : 'normal'}`}
        src={src}
        className={cn(
          isFullScreen ? "w-screen h-screen" : "w-[90vw] h-[90vh]"
        )}
      />
    </PreviewBase>
  );
};

export default EPUBPreview; 
