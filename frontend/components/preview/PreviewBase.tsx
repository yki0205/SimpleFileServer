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
    /** Enable backdrop click to close */
    enableBackdropClose?: boolean;
    /** Close event handler */
    onClose?: () => void;

    /** Show download button */
    showDownload?: boolean;
    /** Download event handler */
    onDownload?: () => void;

    /** Show zoom buttons */
    showZoom?: boolean;
    /** Enable Ctrl+wheel zoom */
    enableCtrlWheelZoom?: boolean;
    /** Zoom in event handler */
    onZoomIn?: () => void;
    /** Zoom out event handler */
    onZoomOut?: () => void;

    /** Show direction toggle button */
    showDirectionToggle?: boolean;
    /** Direction for RTL/LTR navigation (force) */
    direction?: 'ltr' | 'rtl';

    /** Show fullscreen button */
    showFullscreen?: boolean;
    /** Use full screen without max-width/height constraints (force fullscreen) */
    useFullScreen?: boolean;
    /** Use browser fullscreen API to enter fullscreen mode (This will not work when you use "useFullScreen" option) */
    useBrowserFullscreenAPI?: boolean;
    /** Enable toolbar in fullscreen mode */
    enableFullscreenToolbar?: boolean;
    /** Enable navigation in fullscreen mode */
    enableFullscreenNavigation?: boolean;

    /** Show navigation buttons */
    showNavigation?: boolean;
    /** Enable touch navigation */
    enableTouchNavigation?: boolean;
    /** Enable wheel navigation */
    enableWheelNavigation?: boolean;
    /** Reverse wheel navigation */
    reverseWheelNavigation?: boolean;
    /** On prev event handler */
    onPrev?: () => void;
    /** On next event handler */
    onNext?: () => void;

    /** Enable handle keyboard events */
    enableHandleKeyboard?: boolean;
    /** Enable base handle keyboard events */
    enableBaseHandleKeyboard?: boolean;
    /** Custom keyboard handlers that can override base handlers */
    customKeyHandlers?: Record<string, () => void>;

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

  /** Callback functions */
  callbacks?: {
    /** Callback when fullscreen state changes */
    onFullScreenChange?: (isFullScreen: boolean) => void;
    /** Callback when direction changes */
    onDirectionChange?: (direction: 'ltr' | 'rtl') => void;
  }
}

const defaultControls = {
  showClose: true,
  enableBackdropClose: true,

  showDownload: true,

  showZoom: false,
  enableCtrlWheelZoom: false,

  showDirectionToggle: false,
  direction: undefined as 'ltr' | 'rtl' | undefined,

  showNavigation: true,
  enableWheelNavigation: false,
  enableTouchNavigation: false,
  reverseWheelNavigation: false,

  showFullscreen: false,
  useFullScreen: false,
  useBrowserFullscreenAPI: false,
  enableFullscreenNavigation: true,
  enableFullscreenToolbar: true,

  enableHandleKeyboard: true,
  enableBaseHandleKeyboard: true,
  customKeyHandlers: {},

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
  isLoading = false,
  hasError = false,
  errorMessage = "Error loading preview. Please try again.",
  loadingMessage = "Loading preview...",
  children,
  controls: controlsProp,
  callbacks
}) => {
  if (!isOpen) return null;

  // Merge provided controls with defaults
  const controls = { ...defaultControls, ...controlsProp };

  // Extract common handlers from controls for easier access
  const {
    showClose,
    enableBackdropClose,
    onClose,

    showDownload,
    onDownload,

    showZoom,
    enableCtrlWheelZoom,
    onZoomIn,
    onZoomOut,

    showDirectionToggle,
    direction: forceDirection,

    showFullscreen,
    useFullScreen: forceFullScreen,
    useBrowserFullscreenAPI,
    enableFullscreenNavigation,
    enableFullscreenToolbar,

    showNavigation,
    enableTouchNavigation,
    enableWheelNavigation,
    reverseWheelNavigation,
    onPrev,
    onNext,

    enableHandleKeyboard,
    enableBaseHandleKeyboard,
    customKeyHandlers,

  } = controls;

  const {
    onFullScreenChange,
    onDirectionChange,
  } = callbacks || {};

  // Internal state management
  const [showControls, setShowControls] = useState(true);

  const [directionTemp, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  const direction = forceDirection || directionTemp;

  const [isFullScreenTemp, setIsFullScreen] = useState(false);
  const isFullScreen = forceFullScreen || isFullScreenTemp;

  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  // Internal event handlers
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && enableBackdropClose) {
      onClose?.();
    }
  }, [enableBackdropClose, onClose]);

  // Toggle fullscreen
  const handleFullScreen = useCallback(() => {
    const newFullScreenState = !isFullScreen;
    setIsFullScreen(newFullScreenState);
    
    // Handle browser fullscreen API if enabled
    if (useBrowserFullscreenAPI && containerRef.current) {
      try {
        if (newFullScreenState) {
          if (containerRef.current.requestFullscreen) {
            containerRef.current.requestFullscreen();
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            (containerRef.current as any).webkitRequestFullscreen();
          } else if ((containerRef.current as any).msRequestFullscreen) {
            (containerRef.current as any).msRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
          }
        }
      } catch (error) {
        console.error("Error toggling browser fullscreen mode:", error);
      }
    }
    
    onFullScreenChange?.(newFullScreenState);
  }, [isFullScreen, onFullScreenChange, useBrowserFullscreenAPI]);

  // Listen for browser fullscreen changes if using browser fullscreen API
  useEffect(() => {
    if (!useBrowserFullscreenAPI) return;
    
    const handleBrowserFullscreenChange = () => {
      const isDocFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      
      // Only update state if it doesn't match current browser fullscreen state
      if (isFullScreen !== isDocFullscreen) {
        setIsFullScreen(isDocFullscreen);
        onFullScreenChange?.(isDocFullscreen);
      }
    };
    
    document.addEventListener("fullscreenchange", handleBrowserFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleBrowserFullscreenChange);
    document.addEventListener("msfullscreenchange", handleBrowserFullscreenChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleBrowserFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleBrowserFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleBrowserFullscreenChange);
    };
  }, [isFullScreen, onFullScreenChange, useBrowserFullscreenAPI]);

  // Escape key should also exit browser fullscreen if active
  useEffect(() => {
    if (!useBrowserFullscreenAPI) return;
    
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
        onFullScreenChange?.(false);
      }
    };
    
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isFullScreen, onFullScreenChange, useBrowserFullscreenAPI]);

  // Toggle direction
  const handleToggleDirection = useCallback(() => {
    const newDirection = direction === 'ltr' ? 'rtl' : 'ltr';
    setDirection(newDirection);
    onDirectionChange?.(newDirection);
  }, [direction, onDirectionChange]);

  // Handle wheel events, including Ctrl+wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Handle Ctrl+wheel zoom if enabled
    if (e.ctrlKey && enableCtrlWheelZoom) {
      e.preventDefault();
      e.stopPropagation();

      // Call zoom in or out based on wheel direction
      if (e.deltaY < 0) {
        onZoomIn?.();
      } else if (e.deltaY > 0) {
        onZoomOut?.();
      }

      return false;
    }

    // Handle wheel navigation if enabled
    if (enableWheelNavigation) {
      e.stopPropagation();

      if (e.deltaY > 0) {
        reverseWheelNavigation ? onPrev?.() : onNext?.();
      } else if (e.deltaY < 0) {
        reverseWheelNavigation ? onNext?.() : onPrev?.();
      }
    }
  }, [enableCtrlWheelZoom, enableWheelNavigation, reverseWheelNavigation, direction, onNext, onPrev, onZoomIn, onZoomOut]);


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

  // Determine CSS classes based on fullscreen state
  const rootClasses = isFullScreen
    ? "select-none fixed inset-0 z-[9999] flex items-center justify-center bg-black"
    : "select-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm";


  // Touch event handling for navigation
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableTouchNavigation) return;
    touchStartX.current = e.touches[0].clientX;
  }, [enableTouchNavigation]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableTouchNavigation) return;
    touchEndX.current = e.touches[0].clientX;
  }, [enableTouchNavigation]);

  const handleTouchEnd = useCallback(() => {
    if (!enableTouchNavigation || !touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      direction === 'rtl' ? onPrev?.() : onNext?.();
    } else if (isRightSwipe) {
      direction === 'rtl' ? onNext?.() : onPrev?.();
    }

    // Reset values
    touchStartX.current = null;
    touchEndX.current = null;
  }, [enableTouchNavigation, direction, onNext, onPrev]);


  // Handle clicks in fullscreen mode areas
  const handleLeftAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      if (direction === 'ltr') {
        onPrev?.();
      } else if (direction === 'rtl') {
        onNext?.();
      } else {
        setShowControls(true);
      }
    }
  }, [isFullScreen, onPrev, onNext, direction]);

  const handleRightAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      if (direction === 'ltr') {
        onNext?.();
      } else if (direction === 'rtl') {
        onPrev?.();
      } else {
        setShowControls(true);
      }
    }
  }, [isFullScreen, onNext, onPrev, direction]);

  const handleCenterAreaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isFullScreen) {
      setShowControls(!showControls);
    }
  }, [isFullScreen, showControls]);

  // Handle keyboard events for navigation
  useEffect(() => {
    if (!enableHandleKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const defaultArrowLeftHandler = () => {
        direction === 'rtl' ? onNext?.() : onPrev?.();
      }

      const defaultArrowRightHandler = () => {
        direction === 'rtl' ? onPrev?.() : onNext?.();
      }

      const defaultEscapeHandler = () => {
        setIsFullScreen(false);
        onFullScreenChange?.(false);
      }

      const defaultEnterHandler = () => {
        handleFullScreen();
      }

      const defaultSpaceHandler = () => {
        setShowControls(prev => !prev);
      }

      const defaultKeyHandlers = enableBaseHandleKeyboard ? {
        'ArrowLeft': defaultArrowLeftHandler,
        'ArrowRight': defaultArrowRightHandler,
        'Escape': defaultEscapeHandler,
        'Enter': defaultEnterHandler,
        ' ': defaultSpaceHandler,
      } : {};

      const keyHandlers = { ...defaultKeyHandlers, ...customKeyHandlers };

      if (keyHandlers[e.key as keyof typeof keyHandlers]) {
        keyHandlers[e.key as keyof typeof keyHandlers]?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleFullScreen, onFullScreenChange, onPrev, onNext,
    direction, enableHandleKeyboard, enableBaseHandleKeyboard, customKeyHandlers,
  ]);


  // Prevent context menu (right-click)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (controls.preventContextMenu) {
      e.preventDefault();
      return false;
    }
  }, [controls.preventContextMenu]);

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
        className={`relative flex items-center justify-center`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading and Error states */}
        <div className="absolute z-[-1] flex items-center justify-center">
          {hasError ? (
            <Error message={errorMessage} className="text-white w-100" />
          ) : isLoading ? (
            <Loading message={loadingMessage} className="text-white w-100" />
          ) : null}
        </div>

        {/* Actual content */}
        {children}
      </div>

      {/* Fullscreen navigation areas - must be after content to be on top */}
      {isFullScreen && enableFullscreenNavigation && (
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
        <div className={`absolute max-sm:bottom-4 sm:top-4 left-4 z-[200] sm:max-w-[50vw] transition-opacity duration-300 ${isFullScreen && (!showControls || !enableFullscreenToolbar) ? 'opacity-0' : 'opacity-100'}`}>
          <h3 className="text-white text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold font-mono max-sm:text-wrap sm:truncate">
            {title}
          </h3>
        </div>
      )}

      {/* Navigation buttons - only shown in non-fullscreen mode */}
      {!isFullScreen && showNavigation && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute z-[200] left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            onClick={(e) => {
              e.stopPropagation();
              direction === 'rtl' ? onNext?.() : onPrev?.();
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
              direction === 'rtl' ? onPrev?.() : onNext?.();
            }}
          >
            <ChevronRight size={24} />
          </Button>
        </>
      )}

      {/* Top right controls */}
      <div className={`absolute z-[200] top-4 right-4 flex gap-2 transition-opacity duration-300 ${isFullScreen && (!showControls || !enableFullscreenToolbar) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {showDirectionToggle && (
          <Toggle
            pressed={direction === 'rtl'}
            onPressedChange={() => handleToggleDirection()}
            className="bg-black/50 hover:bg-black/70 border border-white/20 text-white hover:text-white/80 data-[state=on]:text-black data-[state=on]:bg-white/70"
            title={`Direction: ${direction === 'ltr' ? 'Left to Right' : 'Right to Left'}`}
          >
            <ArrowLeftRight size={24} />
          </Toggle>
        )}

        {showZoom && (
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

        {showFullscreen && (
          <Toggle
            pressed={isFullScreen}
            onPressedChange={() => handleFullScreen()}
            className="bg-black/50 hover:bg-black/70 border border-white/20 text-white hover:text-white/80 data-[state=on]:text-black data-[state=on]:bg-white/70"
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </Toggle>
        )}

        {showDownload && (
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

        {showClose && (
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
