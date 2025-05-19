"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Error } from "@/components/status/Error";
import { Loading } from "@/components/status/Loading";
import { 
    X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
    Maximize, Minimize, ArrowLeftRight
  } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

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
  /** Use full screen without max-width/height constraints */
  useFullScreen?: boolean;
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
    /** Show fullscreen button */
    showFullscreen?: boolean;
    /** Show direction toggle button */
    showDirectionToggle?: boolean;
    /** Enable backdrop click to close */
    enableBackdropClose?: boolean;
    /** Enable touch navigation */
    enableTouchNavigation?: boolean;
    /** Enable wheel navigation */
    enableWheelNavigation?: boolean;
    /** Enable Ctrl+wheel zoom */
    enableCtrlWheelZoom?: boolean;
    /** Enable base handle keyboard events */
    enableBaseHandleKeyboard?: boolean;
    /** Prevent browser default zooming */
    preventBrowserZoom?: boolean;
    /** Prevent browser context menu (right-click) */
    preventContextMenu?: boolean;
    /** Prevent text selection in the preview */
    preventTextSelection?: boolean;
    /** Prevent image dragging */
    preventDrag?: boolean;
    /** Prevent pinch-to-zoom on mobile */
    preventPinchZoom?: boolean;
    /** Prevent browser back/forward navigation on swipe */
    preventBrowserNavigation?: boolean;
  };
  /** Event handlers */
  onClose?: () => void;
  onDownload?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Callback when fullscreen state changes */
  onFullScreenChange?: (isFullScreen: boolean) => void;
  /** Callback when direction changes */
  onDirectionChange?: (direction: 'ltr' | 'rtl') => void;
}

const defaultControls = {
  showClose: true,
  showDownload: true,
  showNavigation: true,
  showZoom: false,
  showFullscreen: false,
  showDirectionToggle: false,
  enableBackdropClose: true,
  enableTouchNavigation: false,
  enableWheelNavigation: false,
  enableCtrlWheelZoom: false,
  enableBaseHandleKeyboard: false,
  preventBrowserZoom: false,
  preventContextMenu: false,
  preventTextSelection: false,
  preventDrag: false,
  preventPinchZoom: false,
  preventBrowserNavigation: false
};

export const PreviewBase: React.FC<PreviewBaseProps> = ({
  isOpen,
  title,
  direction: initialDirection = 'ltr',
  isLoading = false,
  hasError = false,
  errorMessage = "Error loading preview. Please try again.",
  loadingMessage = "Loading preview...",
  children,
  useFullScreen = false,
  controls: controlsProp,
  onClose,
  onDownload,
  onPrev,
  onNext,
  onZoomIn,
  onZoomOut,
  onFullScreenChange,
  onDirectionChange,
}) => {
  if (!isOpen) return null;
  
  // Internal state management
  const [showControls, setShowControls] = useState(true);
  const [direction, setDirection] = useState<'ltr' | 'rtl'>(initialDirection);
  const [isFullScreen, setIsFullScreen] = useState(useFullScreen);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update internal direction state when prop changes (for external control)
  useEffect(() => {
    setDirection(initialDirection);
  }, [initialDirection]);

  // Merge provided controls with defaults
  const controls = { ...defaultControls, ...controlsProp };

  // Handle fullscreen toggle
  const handleFullScreen = useCallback(() => {
    const newFullScreenState = !isFullScreen;
    setIsFullScreen(newFullScreenState);
    onFullScreenChange?.(newFullScreenState);
  }, [isFullScreen, onFullScreenChange]);

  // Toggle direction
  const handleToggleDirection = useCallback(() => {
    const newDirection = direction === 'ltr' ? 'rtl' : 'ltr';
    setDirection(newDirection);
    onDirectionChange?.(newDirection);
  }, [direction, onDirectionChange]);

  // Internal event handlers
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && controls.enableBackdropClose && onClose) {
      onClose();
    }
  }, [controls.enableBackdropClose, onClose]);

  // Prevent context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (controls.preventContextMenu) {
      e.preventDefault();
      return false;
    }
  }, [controls.preventContextMenu]);

  // Handle wheel events, including Ctrl+wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Handle Ctrl+wheel zoom if enabled
    if (e.ctrlKey && controls.enableCtrlWheelZoom) {
      e.preventDefault();
      e.stopPropagation();

      // Call zoom in or out based on wheel direction
      if (e.deltaY < 0 && onZoomIn) {
        onZoomIn();
      } else if (e.deltaY > 0 && onZoomOut) {
        onZoomOut();
      }
      
      return false;
    }
    
    // Handle wheel navigation if enabled
    if (controls.enableWheelNavigation && onPrev && onNext) {
      e.stopPropagation();

      if (e.deltaY > 0) {
        direction === 'rtl' ? onPrev() : onNext();
      } else if (e.deltaY < 0) {
        direction === 'rtl' ? onNext() : onPrev();
      }
    }
  }, [controls.enableCtrlWheelZoom, controls.enableWheelNavigation, direction, onNext, onPrev, onZoomIn, onZoomOut]);

  // Auto-hide controls after inactivity in fullscreen mode
  useEffect(() => {
    if (isFullScreen && showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullScreen, showControls]);

  // Reset controls timeout on mouse movement
  const handleMouseMove = useCallback(() => {
    if (isFullScreen) {
      setShowControls(true);
    }
  }, [isFullScreen]);

  // Apply browser behavior prevention
  useEffect(() => {
    if (!containerRef.current) return;
    
    const containerElement = containerRef.current;
    const options = { passive: false };
    
    // Prevent default browser zoom on Ctrl+wheel
    const preventDefaultZoom = (e: WheelEvent) => {
      if (controls.preventBrowserZoom && e.ctrlKey) {
        e.preventDefault();
        return false;
      }
    };
    
    // Prevent pinch-to-zoom on touchscreens
    const preventPinchZoom = (e: TouchEvent) => {
      if (controls.preventPinchZoom && e.touches.length > 1) {
        e.preventDefault();
        return false;
      }
    };
    
    // Prevent browser back/forward navigation on swipe
    const preventBrowserNav = (e: TouchEvent) => {
      if (controls.preventBrowserNavigation) {
        if (Math.abs(e.touches[0].clientX - window.innerWidth) < 20) {
          e.preventDefault();
        }
      }
    };
    
    // Add all event listeners
    if (controls.preventBrowserZoom) {
      containerElement.addEventListener('wheel', preventDefaultZoom, options);
    }
    
    if (controls.preventPinchZoom) {
      containerElement.addEventListener('touchstart', preventPinchZoom, options);
      containerElement.addEventListener('touchmove', preventPinchZoom, options);
    }
    
    if (controls.preventBrowserNavigation) {
      containerElement.addEventListener('touchstart', preventBrowserNav, options);
    }
    
    // Apply CSS for text selection and drag prevention
    if (controls.preventTextSelection) {
      containerElement.style.userSelect = 'none';
      containerElement.style.webkitUserSelect = 'none';
    }
    
    if (controls.preventDrag) {
      // Use setAttribute for non-standard CSS properties
      containerElement.setAttribute('style', `${containerElement.getAttribute('style') || ''}; -webkit-user-drag: none;`);
      const images = containerElement.querySelectorAll('img');
      images.forEach(img => {
        img.draggable = false;
        img.setAttribute('draggable', 'false');
      });
    }
    
    // Cleanup function
    return () => {
      if (controls.preventBrowserZoom) {
        containerElement.removeEventListener('wheel', preventDefaultZoom);
      }
      
      if (controls.preventPinchZoom) {
        containerElement.removeEventListener('touchstart', preventPinchZoom);
        containerElement.removeEventListener('touchmove', preventPinchZoom);
      }
      
      if (controls.preventBrowserNavigation) {
        containerElement.removeEventListener('touchstart', preventBrowserNav);
      }
      
      // Reset styles
      if (controls.preventTextSelection) {
        containerElement.style.userSelect = '';
        containerElement.style.webkitUserSelect = '';
      }
      
      if (controls.preventDrag) {
        // Remove non-standard CSS properties
        const style = containerElement.getAttribute('style') || '';
        containerElement.setAttribute('style', style.replace('-webkit-user-drag: none;', ''));
        
        const images = containerElement.querySelectorAll('img');
        images.forEach(img => {
          img.draggable = true;
          img.removeAttribute('draggable');
        });
      }
    };
  }, [
    controls.preventBrowserZoom,
    controls.preventPinchZoom,
    controls.preventTextSelection,
    controls.preventDrag,
    controls.preventBrowserNavigation
  ]);

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

  // Handle clicks in fullscreen mode areas
  const handleLeftAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      if (onPrev) {
        onPrev();
      } else {
        setShowControls(true);
      }
    }
  }, [isFullScreen, onPrev]);

  const handleRightAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      if (onNext) {
        onNext();
      } else {
        setShowControls(true);
      }
    }
  }, [isFullScreen, onNext]);

  const handleCenterAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      setShowControls(!showControls);
    }
  }, [isFullScreen, showControls]);

  // Handle keyboard events for navigation
  useEffect(() => {
    if (!controls.enableBaseHandleKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Left arrow key
      if (e.key === 'ArrowLeft' && onPrev && onNext) {
        direction === 'rtl' ? onNext() : onPrev();
      }

      if (e.key === 'ArrowRight' && onPrev && onNext) {
        direction === 'rtl' ? onPrev() : onNext();
      }
      
      if (e.key === 'Escape' && (useFullScreen || controls.showFullscreen)) {
        setIsFullScreen(false);
        onFullScreenChange?.(false);
      }

      if (e.key === 'Enter' && (useFullScreen || controls.showFullscreen)) {
        handleFullScreen();
      }
      
      if (e.key === ' ') {
        setShowControls(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, onPrev, onNext, direction, onFullScreenChange]);

  // Determine CSS classes based on fullscreen state
  const rootClasses = isFullScreen 
    ? "fixed inset-0 z-[9999] flex items-center justify-center bg-black" 
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm";

  return (
    <div
      className={rootClasses}
      onClick={handleBackdropClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      ref={containerRef}
    >
      {/* Main content with loading/error states */}
      <div 
        className={`relative ${isFullScreen ? 'w-screen h-screen' : 'max-w-[90vw] max-h-[90vh]'} flex items-center justify-center`} 
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="w-full h-full relative">
          {children}
        </div>
      </div>

      {/* Fullscreen navigation areas - must be after content to be on top */}
      {isFullScreen && (
        <>
          <div 
            className="absolute left-0 top-0 w-1/4 h-full z-[100] cursor-pointer" 
            onClick={handleLeftAreaClick}
            data-testid="left-nav-area"
          >
            {/* Visual indication on hover - Left area */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <ChevronLeft size={30} className="text-white" />
            </div>
          </div>
          <div 
            className="absolute left-1/4 top-0 w-1/2 h-full z-[100] cursor-pointer" 
            onClick={handleCenterAreaClick}
            data-testid="center-nav-area"
          />
          <div 
            className="absolute right-0 top-0 w-1/4 h-full z-[100] cursor-pointer" 
            onClick={handleRightAreaClick}
            data-testid="right-nav-area"
          >
            {/* Visual indication on hover - Right area */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <ChevronRight size={30} className="text-white" />
            </div>
          </div>
        </>
      )}

      {/* Title */}
      {title && (
        <div className={`fixed top-4 left-4 z-[200] max-w-[50vw] transition-opacity duration-300 ${isFullScreen && !showControls ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className="text-white text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold font-mono truncate select-none"> 
            {title}
          </h3>
        </div>
      )}

      {/* Navigation buttons - only shown in non-fullscreen mode */}
      {controls.showNavigation && onPrev && onNext && !isFullScreen && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute z-[200] left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
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
            className="absolute z-[200] right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              direction === 'rtl' ? onPrev() : onNext();
            }}
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}

      {/* Top right controls */}
      <div className={`absolute z-[200] top-4 right-4 flex gap-2 transition-opacity duration-300 ${isFullScreen && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {controls.showDirectionToggle && (
          <Toggle
            pressed={direction === 'rtl'}
            onPressedChange={() => handleToggleDirection()}
            className="bg-black/50 hover:bg-black/70 border border-white/20 text-white hover:text-white/80 data-[state=on]:text-black data-[state=on]:bg-white/70"
            title={`Direction: ${direction === 'ltr' ? 'Left to Right' : 'Right to Left'}`}
          >
            <ArrowLeftRight size={24} />
          </Toggle>
        )}
        
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
        
        {controls.showFullscreen && (
          <Toggle
            pressed={isFullScreen}
            onPressedChange={() => handleFullScreen()}
            className="bg-black/50 hover:bg-black/70 border border-white/20 text-white hover:text-white/80 data-[state=on]:text-black data-[state=on]:bg-white/70"
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </Toggle>
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
    </div>
  );
};

export default PreviewBase;
