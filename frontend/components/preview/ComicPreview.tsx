import React from "react";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";
import { ComicReader } from "@/components/reader/ComicReader";

interface ComicPreviewProps extends Omit<PreviewBaseProps, 'children' | 'isLoading' | 'hasError'> {
  /** Comic source URL */
  src: string;
}

export const ComicPreview: React.FC<ComicPreviewProps> = ({
  src,
  onClose,
  controls,
  ...restProps
}) => {
  return (
    <PreviewBase
      onClose={onClose}
      controls={{
        showClose: false,
        showDownload: false,
        showNavigation: false,
        ...controls
      }}
      {...restProps}
    >
      <div className="w-full h-full overflow-hidden rounded-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <ComicReader
          src={src}
          onClose={onClose}
        />
      </div>
    </PreviewBase>
  );
};

export default ComicPreview; 