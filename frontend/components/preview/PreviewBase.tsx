"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Error } from "@/components/status/Error";
import { Loading } from "@/components/status/Loading";
import { 
    X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut
  } from "lucide-react";

export interface PreviewBaseProps {
  /** Whether the preview is open */
  isOpen: boolean;
  /** Title to display at the top left */
  title?: string;
  /** Direction for RTL/LTR navigation */
  direction?: 'ltr' | 'rtl';
  /** Whether the preview is loading */
  isLoading?: boolean;
  /** Whether there was an error loading the preview */
  hasError?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Loading message to display */
  loadingMessage?: string;
  /** Main content to display in the preview */
  children?: React.ReactNode;
  /** Controls configuration */
  controls?: {
    /** Show close button */
    showClose?: boolean;
    /** Show download button */
    showDownload?: boolean;
    /** Show navigation buttons */
    showNavigation?: boolean;
    /** Show zoom buttons */
    showZoom?: boolean;
    /** Enable backdrop click to close */
    enableBackdropClose?: boolean;
    /** Enable touch navigation */
    enableTouchNavigation?: boolean;
    /** Enable wheel navigation */
    enableWheelNavigation?: boolean;
  };
  /** Event handlers */
  onClose?: () => void;
  onDownload?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

const defaultControls = {
  showClose: true,
  showDownload: true,
  showNavigation: true,
  showZoom: false,
  enableBackdropClose: true,
  enableTouchNavigation: false,
  enableWheelNavigation: false
};

export const PreviewBase: React.FC<PreviewBaseProps> = ({
  isOpen,
  title,
  direction = 'ltr',
  isLoading = false,
  hasError = false,
  errorMessage = "Error loading preview. Please try again.",
  loadingMessage = "Loading preview...",
  children,
  controls: controlsProp,
  onClose,
  onDownload,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut
}) => {
  if (!isOpen) return null;

  // Merge provided controls with defaults
  const controls = { ...defaultControls, ...controlsProp };

  // Internal event handlers
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && controls.enableBackdropClose && onClose) {
      onClose();
    }
  }, [controls.enableBackdropClose, onClose]);

  // Touch event handling for navigation
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!controls.enableTouchNavigation) return;
    touchStartX.current = e.touches[0].clientX;
  }, [controls.enableTouchNavigation]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!controls.enableTouchNavigation) return;
    touchEndX.current = e.touches[0].clientX;
  }, [controls.enableTouchNavigation]);

  const handleTouchEnd = useCallback(() => {
    if (!controls.enableTouchNavigation || !touchStartX.current || !touchEndX.current) return;
    if (!onNext || !onPrev) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      direction === 'rtl' ? onPrev() : onNext();
    } else if (isRightSwipe) {
      direction === 'rtl' ? onNext() : onPrev();
    }

    // Reset values
    touchStartX.current = null;
    touchEndX.current = null;
  }, [controls.enableTouchNavigation, direction, onNext, onPrev]);

  // Wheel event handling for navigation
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!controls.enableWheelNavigation || !onNext || !onPrev) return;
    
    e.stopPropagation();

    if (e.deltaY > 0) {
      direction === 'rtl' ? onPrev() : onNext();
    } else if (e.deltaY < 0) {
      direction === 'rtl' ? onNext() : onPrev();
    }
  }, [controls.enableWheelNavigation, direction, onNext, onPrev]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Title */}
      {title && (
        <div className="fixed top-4 left-4 z-[60] max-w-[50vw]">
          <h3 className="text-white text-xl font-bold px-4 py-2 bg-black/50 rounded-md truncate">
            {title}
          </h3>
        </div>
      )}

      {/* Top right controls */}
      <div className="absolute z-10 top-4 right-4 flex gap-2">
        {controls.showZoom && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
              onClick={onZoomIn}
              disabled={!onZoomIn}
            >
              <ZoomIn size={24} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
              onClick={onZoomOut}
              disabled={!onZoomOut}
            >
              <ZoomOut size={24} />
            </Button>
          </>
        )}
        
        {controls.showDownload && (
          <Button
            variant="outline"
            size="icon"
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.();
            }}
            disabled={!onDownload}
          >
            <Download size={20} />
          </Button>
        )}
        
        {controls.showClose && (
          <Button
            variant="outline"
            size="icon"
            className="bg-black/50 hover:bg-black/70 border-white/20 text-red-500 hover:text-red-500/80"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            disabled={!onClose}
          >
            <X size={20} />
          </Button>
        )}
      </div>

      {/* Navigation buttons */}
      {controls.showNavigation && onPrev && onNext && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute z-10 left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              direction === 'rtl' ? onNext() : onPrev();
            }}
          >
            <ChevronLeft size={24} />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute z-10 right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              direction === 'rtl' ? onPrev() : onNext();
            }}
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}

      {/* Main content with loading/error states */}
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Loading and Error states */}
        <div className="absolute z-[-1] flex items-center justify-center">
          {hasError ? (
            <Error message={errorMessage} className="text-white w-100" />
          ) : isLoading ? (
            <Loading message={loadingMessage} className="text-white w-100" />
          ) : (
            <></>
          )}
        </div>
        
        {/* Actual content */}
        {children}
      </div>
    </div>
  );
};

export default PreviewBase;
