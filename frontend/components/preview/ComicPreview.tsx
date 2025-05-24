"use client"

import React, { useState } from "react";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { ComicReader } from "@/components/reader/ComicReader";

interface ComicPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** Comic source URL */
  title?: string;
  src: string;
}

export const ComicPreview: React.FC<ComicPreviewProps> = ({
  title,
  src,
  controls,
  ...restProps
}) => {

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <PreviewBase
      title={""}
      controls={{
        useFullScreen: isFullScreen,
        showClose: false,
        showDownload: false,
        showNavigation: false,
        showFullscreen: false,
        enableFullscreenToolbar: false,
        enableFullscreenNavigation: false,
        ...controls
      }}
      {...restProps}
    >
      <div className="w-full h-full overflow-hidden rounded-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <ComicReader
          title={title}
          src={src}
          onClose={controls?.onClose}
          onFullScreenChange={setIsFullScreen}
        />
      </div>
    </PreviewBase>
  );
};

export default ComicPreview; 