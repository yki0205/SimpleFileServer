"use client"

import React, { useState } from "react";
import { cn } from "@/lib/utils";
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
        enableBackdropClose: true,
        preventBrowserZoom: true,
        preventPinchZoom: true,
        preventContextMenu: true,
        preventTextSelection: true,
        preventDrag: true,
        preventBrowserNavigation: true,
        preventPullToRefresh: true,
        ...controls
      }}
      {...restProps}
    >
      <ComicReader
        title={title}
        src={src}
        onClose={controls?.onClose}
        onNext={controls?.onNext}
        onPrev={controls?.onPrev}
        onDownload={controls?.onDownload}
        onFullScreenChange={setIsFullScreen}
        className={cn(
          "rounded-md overflow-hidden",
          isFullScreen ? "w-screen h-screen" : "w-[90vw] h-[90vh]"
        )}
      />
    </PreviewBase>
  );
};

export default ComicPreview; 