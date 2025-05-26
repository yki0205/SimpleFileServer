"use client";

import React, { useCallback, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { EPUBReader } from "@/components/reader";

interface EpubPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError' | 'onFullScreen' | 'onToggleDirection'> {
  /** EPUB source URL */
  src: string;
}


export const EpubPreview: React.FC<EpubPreviewProps> = ({
  src,
  controls,
  ...restProps
}) => {

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <PreviewBase
      title={""}
      controls={{
        // useFullScreen: isFullScreen,
        useBrowserFullscreenAPI: true,
        showClose: false,
        showDownload: false,
        showNavigation: false,
        showFullscreen: false,
        enableFullscreenToolbar: false,
        enableFullscreenNavigation: false,
        enableHandleKeyboard: false,
        ...controls
      }}
      {...restProps}
    >
      <EPUBReader
        src={src}
        onClose={controls?.onClose}
        onNext={controls?.onNext}
        onPrev={controls?.onPrev}
        onFullScreenChange={setIsFullScreen}
      />
    </PreviewBase>
  );
};

export default EpubPreview; 