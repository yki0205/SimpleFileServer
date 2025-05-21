"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Loading } from '@/components/status/Loading';
import { Error } from '@/components/status/Error';
import { NotFound } from '@/components/status/NotFound';
import { X, Book, ArrowRightLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Maximize, Minimize } from 'lucide-react';

interface ComicReaderProps {
  src: string;
  onClose?: () => void;
  onFullScreenChange?: (isFullScreen: boolean) => void;
}

export function ComicReader({ src, onClose, onFullScreenChange }: ComicReaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Image zoom and position state
  const [zoom, setZoom] = useState(1);
  const [useFullScreen, setUseFullScreen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  // UI control states
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reader settings
  const [isRightToLeft, setIsRightToLeft] = useState(false);
  const [isDoublePage, setIsDoublePage] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const secondImageRef = useRef<HTMLImageElement>(null);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);

  // Add a debounce mechanism to prevent rapid page changes
  const [lastPageChangeTime, setLastPageChangeTime] = useState(0);

  // Add state for input controls
  const [isPageInputActive, setIsPageInputActive] = useState(false);
  const [isZoomInputActive, setIsZoomInputActive] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');
  const [zoomInputValue, setZoomInputValue] = useState('');

  // Update double tap tracking with more permissive thresholds
  const [lastTapTime, setLastTapTime] = useState(0);
  const [lastTapPosition, setLastTapPosition] = useState({ x: 0, y: 0 });
  const doubleTapDelay = 500; // increased from 300ms to 500ms
  const doubleTapDistance = 50; // increased from 30px to 50px
  
  // Add state for visual feedback
  const [showDoubleTapFeedback, setShowDoubleTapFeedback] = useState(false);

  const nextPage = useCallback(() => {
    if (zoom > 1) return;

    if (isDoublePage) {
      if (currentPage < totalPages - 2) {
        setCurrentPage(currentPage + 2);
      } else if (currentPage < totalPages - 1) {
        // Handle case when there's only one page left
        setCurrentPage(currentPage + 1);
      }
    } else {
      if (currentPage < totalPages - 1) {
        setCurrentPage(currentPage + 1);
      }
    }
  }, [currentPage, totalPages, zoom, isDoublePage]);

  const prevPage = useCallback(() => {
    if (zoom > 1) return;

    if (isDoublePage) {
      if (currentPage > 1) {
        setCurrentPage(currentPage - 2);
      } else if (currentPage === 1) {
        // Handle case when we're at page 1 to go back to page 0
        setCurrentPage(0);
      }
    } else {
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }
  }, [currentPage, zoom, isDoublePage]);

  const debouncedNextPage = useCallback(() => {
    const now = Date.now();
    if (now - lastPageChangeTime > 300) { // Only allow page change every 300ms
      setLastPageChangeTime(now);
      nextPage();
    }
  }, [nextPage, lastPageChangeTime]);

  const debouncedPrevPage = useCallback(() => {
    const now = Date.now();
    if (now - lastPageChangeTime > 300) { // Only allow page change every 300ms
      setLastPageChangeTime(now);
      prevPage();
    }
  }, [prevPage, lastPageChangeTime]);

  const handleLeftSideClick = useCallback(() => {
    isRightToLeft ? debouncedNextPage() : debouncedPrevPage();
  }, [isRightToLeft, debouncedNextPage, debouncedPrevPage]);

  const handleRightSideClick = useCallback(() => {
    isRightToLeft ? debouncedPrevPage() : debouncedNextPage();
  }, [isRightToLeft, debouncedNextPage, debouncedPrevPage]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    // Check if Ctrl key is pressed for pinch to zoom behavior
    if (e.ctrlKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
      setZoom(prevZoom => {
        const newZoom = prevZoom * zoomFactor;
        return Math.max(0.1, Math.min(5, newZoom));
      });
    } else if (zoom > 1) {
      // When zoomed in, use wheel for panning
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    } else {
      // When not zoomed and Ctrl is not pressed, use wheel for page navigation
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (e.deltaY > 0) {
          debouncedNextPage();
        } else {
          debouncedPrevPage();
        }
      }
    }
  }, [zoom, debouncedNextPage, debouncedPrevPage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
      e.preventDefault();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      e.preventDefault();
      return;
    }

    // Only handle click events if not dragging
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPosition = clickX / rect.width;

    if (zoom <= 1) {
      // Left third of the screen
      if (clickPosition < 0.3) {
        e.preventDefault();
        e.stopPropagation();
        handleLeftSideClick();
        return;
      }

      // Right third of the screen
      if (clickPosition > 0.7) {
        e.preventDefault();
        e.stopPropagation();
        handleRightSideClick();
        return;
      }
    }

    // Center area - toggle controls
    toggleControls();
  };

  // handleMouseMove2 is used to hide the controls after 3 seconds of inactivity
  const handleMouseMove2 = useCallback(() => {
    if (showControls) {
      // Clear existing timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      // Set new timeout
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [showControls]);

  const handleDoubleClick = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleFullScreenChange = (isFullScreen: boolean) => {
    setUseFullScreen(isFullScreen);
    if (onFullScreenChange) {
      onFullScreenChange(isFullScreen);
    }
  };

  // Zoom control functions
  const zoomIn = () => {
    setZoom(prevZoom => Math.min(prevZoom + 0.25, 5));
  };

  const zoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.25, 0.1));
  };

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // getTouchDistance is used to get the distance between the two fingers
  const getTouchDistance = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Check if the touch event occurs in the image area
    const target = e.target as HTMLElement;
    const isImageArea = target.tagName === 'IMG' || 
                        target.classList.contains('image-container');
    
    // Always prevent default behavior in the image area
    if (isImageArea || e.touches.length === 2 || (zoom > 1 && isDragging)) {
      e.preventDefault();
    }

    if (e.touches.length === 2) {
      const distance = getTouchDistance(e);
      if (lastTouchDistance > 0) {
        const delta = distance - lastTouchDistance;
        const zoomDelta = delta * 0.001;
        const newZoom = Math.max(0.1, Math.min(5, zoom + zoomDelta));
        setZoom(newZoom);
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // setIsDragging is used to set the dragging state to true
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;

      // add drag boundary, not allowed to drag too far
      const maxDragDistance = Math.max(imageSize.width, imageSize.height) * zoom;
      const boundedX = Math.max(-maxDragDistance, Math.min(maxDragDistance, newX));
      const boundedY = Math.max(-maxDragDistance, Math.min(maxDragDistance, newY));

      setPosition({ x: boundedX, y: boundedY });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Check if the touch event occurs in the image area
    const target = e.target as HTMLElement;
    const isImageArea = target.tagName === 'IMG' || 
                        target.classList.contains('image-container');
    
    // Only prevent default behavior in the image area
    if (isImageArea) {
      e.preventDefault();
    }

    // Check for double tap when a single finger is used
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const currentTime = Date.now();
      const x = touch.clientX;
      const y = touch.clientY;
      
      // Calculate distance from last tap
      const dx = x - lastTapPosition.x;
      const dy = y - lastTapPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If double tap detected (within time and distance threshold)
      if (zoom !== 1 && currentTime - lastTapTime < doubleTapDelay && distance < doubleTapDistance) {
        // Visual feedback that double-tap was detected
        setShowDoubleTapFeedback(true);
        setTimeout(() => setShowDoubleTapFeedback(false), 300);
        
        // Reset zoom and position (same as double click)
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        
        // Reset tap tracking to prevent triple-tap issues
        setLastTapTime(0);
        return;
      }
      
      // Store info for potential next tap
      setLastTapTime(currentTime);
      setLastTapPosition({ x, y });
    }

    if (e.touches.length === 2) {
      // getTouchDistance is used to get the distance between the two fingers
      const distance = getTouchDistance(e);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && zoom > 1) {
      // setIsDragging is used to set the dragging state to true
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }

    // Track for swipe detection
    if (zoom <= 1 && e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
      setTouchStartY(e.touches[0].clientY);
      setTouchStartTime(Date.now());
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isDragging) {
      setIsDragging(false);
      if (lastTouchDistance > 0) {
        setLastTouchDistance(0);
        if (zoom > 0.9 && zoom < 1.1) {
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        }
      }
      return;
    }

    // First check for swipe gestures
    if (touchStartX !== null && touchStartY !== null && touchStartTime !== null && zoom <= 1 && !isDragging) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      // Calculate swipe distance and speed
      const distanceX = touchEndX - touchStartX;
      const distanceY = touchEndY - touchStartY;
      const elapsedTime = touchEndTime - touchStartTime;

      // Check if horizontal movement is greater than vertical movement
      if (Math.abs(distanceX) > Math.abs(distanceY)) {
        // Check if the swipe is fast enough (less than 500ms) or long enough (more than 50px)
        if (elapsedTime < 500 || Math.abs(distanceX) > 50) {
          // Determine swipe direction
          if (distanceX > 30) {
            // Swiped right
            if (isRightToLeft) {
              debouncedNextPage();
            } else {
              debouncedPrevPage();
            }
            e.preventDefault();
            // Reset after handling
            setTouchStartX(null);
            setTouchStartY(null);
            setTouchStartTime(null);
            return;
          } else if (distanceX < -30) {
            // Swiped left
            if (isRightToLeft) {
              debouncedPrevPage();
            } else {
              debouncedNextPage();
            }
            e.preventDefault();
            // Reset after handling
            setTouchStartX(null);
            setTouchStartY(null);
            setTouchStartTime(null);
            return;
          }
        }
      }
    }

    // Reset tracking values
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchStartTime(null);

    // Handle tap like a click if not already handled as a swipe
    if (e.changedTouches.length === 1 && zoom <= 1) {
      const touch = e.changedTouches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const touchX = touch.clientX - rect.left;
      const touchPosition = touchX / rect.width;

      // Left third of the screen
      if (touchPosition < 0.3) {
        e.preventDefault();
        e.stopPropagation();
        handleLeftSideClick();
        return;
      }

      // Right third of the screen
      if (touchPosition > 0.7) {
        e.preventDefault();
        e.stopPropagation();
        handleRightSideClick();
        return;
      }

      // Center - toggle controls
      toggleControls();

      // Prevent any potential synthetic mouse events from affecting controls
      e.preventDefault();
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  const toggleControls = () => {
    setShowControls(prev => !prev);

    // Clear any existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    // Set a new timeout to hide controls
    if (!showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Hide after 3 seconds
    }
  };

  // Handle page input
  const handlePageClick = () => {
    setPageInputValue(String(currentPage + 1));
    setIsPageInputActive(true);
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum - 1);
    }
    setIsPageInputActive(false);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    } else if (e.key === 'Escape') {
      setIsPageInputActive(false);
    }
  };

  // Handle zoom input
  const handleZoomClick = () => {
    setZoomInputValue(String(Math.round(zoom * 100)));
    setIsZoomInputActive(true);
  };

  const handleZoomInputBlur = () => {
    const zoomValue = parseInt(zoomInputValue, 10);
    if (!isNaN(zoomValue) && zoomValue >= 10 && zoomValue <= 500) {
      setZoom(zoomValue / 100);
    }
    setIsZoomInputActive(false);
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInputValue(e.target.value);
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleZoomInputBlur();
    } else if (e.key === 'Escape') {
      setIsZoomInputActive(false);
    }
  };

  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentPage]);

  // Load comic book
  useEffect(() => {
    const loadComic = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(src);

        if (response.data.pages && response.data.pages.length > 0) {
          setPages(response.data.pages);
          setTotalPages(response.data.pages.length);
        } else {
          setError('No pages found in the comic book file');
        }
      } catch (err) {
        setError('Failed to load comic book file. The file may be corrupted or in an unsupported format.');
      } finally {
        setLoading(false);
      }
    };

    loadComic();
  }, [src]);

  // Reset position when zoom changes to 1 or less
  useEffect(() => {
    if (zoom > 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard navigation when zoomed in
      if (zoom > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === ' ')) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          isRightToLeft ? debouncedPrevPage() : debouncedNextPage();
          break;
        case 'ArrowLeft':
          isRightToLeft ? debouncedNextPage() : debouncedPrevPage();
          break;
        case 'Escape':
          if (useFullScreen) {
            // First exit fullscreen if in fullscreen mode
            handleFullScreenChange(false);
          } else {
            // Otherwise close the reader
          onClose?.();
          }
          break;
        case 'Enter':
          // Toggle fullscreen
          handleFullScreenChange(!useFullScreen);
          break;
        case ' ':
          e.preventDefault();
          debouncedNextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoom, isRightToLeft, onClose, debouncedNextPage, debouncedPrevPage, useFullScreen, handleFullScreenChange]);

  // Set up wheel event listener
  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  // Clear timeout when component unmounts
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Apply global listeners for mouse movement
  useEffect(() => {
    if (showControls) {
      // Skip attaching mousemove for touch devices to prevent immediate control hiding
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      if (!isTouchDevice) {
        window.addEventListener('mousemove', handleMouseMove2);
        return () => window.removeEventListener('mousemove', handleMouseMove2);
      }
    }
  }, [showControls, handleMouseMove2]);

  // Apply to window to capture mouse events even outside the component
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  useEffect(() => {
    // prevent double-finger zoom and pull-down refresh
    const preventDefaultTouchAction = (e: TouchEvent) => {
      // prevent default behavior in the reader range
      if (containerRef.current?.contains(e.target as Node)) {
        // check if the touch event occurs in the toolbar
        const target = e.target as HTMLElement;
        const isControlsArea = target.closest('.reader-controls');
        
        // if not in the control area, prevent default behavior
        if (!isControlsArea) {
          e.preventDefault();
        }
      }
    };

    // add passive: false to ensure preventDefault works
    document.addEventListener('touchstart', preventDefaultTouchAction, { passive: false });
    document.addEventListener('touchmove', preventDefaultTouchAction, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventDefaultTouchAction);
      document.removeEventListener('touchmove', preventDefaultTouchAction);
    };
  }, []);

  if (loading) {
    return <Loading message="Loading comic book..." className="text-white" />;
  }

  if (error) {
    return <Error message={error} className="text-red-500" />;
  }

  if (pages.length === 0) {
    return <NotFound message="No pages found in the comic book file" className="text-white" />;
  }

  // Determine page indexes for double page mode
  const currentPageIndex = currentPage;
  const nextPageIndex = currentPage + 1 < totalPages ? currentPage + 1 : -1;

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full flex flex-col"
      style={{ 
        touchAction: 'none', // prevent default touch behavior
        overscrollBehavior: 'none', // prevent pull-down refresh
        WebkitOverflowScrolling: 'touch' // improve scrolling performance on iOS
      }}
    >
      {/* Double-tap visual feedback */}
      {showDoubleTapFeedback && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="bg-white/30 rounded-full w-16 h-16 flex items-center justify-center animate-pulse">
            <div className="bg-white/60 rounded-full w-8 h-8"></div>
          </div>
        </div>
      )}

      {/* Controls - only show when showControls is true */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-2 bg-black/60 transition-opacity duration-300 ease-in-out reader-controls ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center gap-2">
          {isPageInputActive ? (
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              className="w-16 px-1 py-0.5 text-center text-sm text-white bg-black/50 border border-white/20 rounded focus:outline-none focus:border-white/40"
              autoFocus
            />
          ) : (
            <span 
              className="text-white cursor-pointer hover:text-white/80"
              onClick={handlePageClick}
            >
              {currentPage + 1} / {totalPages}
            </span>
          )}
          <div className="flex items-center gap-1 max-sm:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={zoomOut}
              disabled={zoom <= 0.1}
              className="h-7 w-7 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <ZoomOut size={16} />
            </Button>
            {isZoomInputActive ? (
              <input
                type="text"
                value={zoomInputValue}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                onKeyDown={handleZoomInputKeyDown}
                className="w-16 px-1 py-0.5 text-center text-sm text-white bg-black/50 border border-white/20 rounded focus:outline-none focus:border-white/40"
                autoFocus
              />
            ) : (
              <span 
                className="text-white mx-2 cursor-pointer hover:text-white/80"
                onClick={handleZoomClick}
              >
                {Math.round(zoom * 100)}%
              </span>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={zoomIn}
              disabled={zoom >= 5}
              className="h-7 w-7 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <ZoomIn size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetZoom}
              className="h-7 w-7 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <RotateCw size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Toggle
            pressed={isRightToLeft}
            onPressedChange={setIsRightToLeft}
            aria-label="Reading direction"
            title="Reading direction (Right-to-Left / Left-to-Right)"
            className="text-white hover:text-white/80 bg-transparent hover:bg-white/20"
          >
            <ArrowRightLeft size={18} />
          </Toggle>

          <Toggle
            pressed={useFullScreen}
            onPressedChange={handleFullScreenChange}
            aria-label="Full screen"
            title="Full screen"
            className="text-white hover:text-white/80 bg-transparent hover:bg-white/20"
          >
            {useFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </Toggle>

          <Toggle
            pressed={isDoublePage}
            onPressedChange={setIsDoublePage}
            aria-label="Double page view"
            title="Double page view"
            className="text-white hover:text-white/80 bg-transparent hover:bg-white/20"
          >
            <Book size={18} />
          </Toggle>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-red-500 hover:text-red-500/80 bg-transparent hover:bg-red-500/20"
          >
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Page navigation indicators (only visible when not zoomed) */}
      {zoom <= 1 && (
        <>
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 z-5 text-white/40 pointer-events-none"
            style={{ opacity: showControls ? 0.7 : 0 }}
          >
            <ChevronLeft size={32} />
          </div>

          <div
            className="absolute right-4 top-1/2 -translate-y-1/2 z-5 text-white/40 pointer-events-none"
            style={{ opacity: showControls ? 0.7 : 0 }}
          >
            <ChevronRight size={32} />
          </div>
        </>
      )}

      {/* Comic page display */}
      <div
        className="w-full h-full flex items-center justify-center bg-black image-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          padding: zoom > 1 ? '10%' : 0,
          transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: 'manipulation', // Allow taps but prevent zooming
        }}
      >
        {isDoublePage ? (
          <div
            className="relative flex items-center justify-center"
            style={{
              transform: `scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              margin: zoom > 1 ? '-10%' : 0,
              maxWidth: useFullScreen ? '100vw' : '95vw',
              maxHeight: useFullScreen ? '100vh' : 'calc(100vh - 80px)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {/* First page (or only page if at the end) */}
            {isRightToLeft && nextPageIndex !== -1 ? (
              <img
                ref={secondImageRef}
                src={pages[nextPageIndex]}
                alt={`Page ${nextPageIndex + 1}`}
                style={{
                  maxHeight: useFullScreen ? '100vh' : 'calc(100vh - 100px)',
                  maxWidth: useFullScreen ? '48vw' : '45vw',
                  width: 'auto',
                  height: 'auto',
                  objectFit: "contain",
                  transform: `translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform',
                  transformOrigin: 'center center',
                }}
                className="select-none"
                draggable={false}
                onLoad={handleImageLoad}
              />
            ) : (
              <img
                ref={imageRef}
                src={pages[currentPageIndex]}
                alt={`Page ${currentPageIndex + 1}`}
                style={{
                  maxHeight: useFullScreen ? '100vh' : 'calc(100vh - 100px)',
                  maxWidth: useFullScreen ? '48vw' : '45vw',
                  width: 'auto',
                  height: 'auto',
                  objectFit: "contain",
                  transform: `translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform',
                  transformOrigin: 'center center',
                }}
                className="select-none"
                onLoad={handleImageLoad}
                draggable={false}
              />
            )}

            {/* Second page if available */}
            {nextPageIndex !== -1 && (
              <img
                ref={isRightToLeft ? imageRef : secondImageRef}
                src={pages[isRightToLeft ? currentPageIndex : nextPageIndex]}
                alt={`Page ${(isRightToLeft ? currentPageIndex : nextPageIndex) + 1}`}
                style={{
                  maxHeight: useFullScreen ? '100vh' : 'calc(100vh - 100px)',
                  maxWidth: useFullScreen ? '48vw' : '45vw',
                  width: 'auto',
                  height: 'auto',
                  objectFit: "contain",
                  transform: `translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform',
                  transformOrigin: 'center center',
                }}
                className="select-none"
                onLoad={handleImageLoad}
                draggable={false}
              />
            )}
          </div>
        ) : (
          <div
            className="relative flex items-center justify-center"
            style={{
              transform: `scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              margin: zoom > 1 ? '-10%' : 0,
            }}
          >
            {pages[currentPage] && (
              <img
                ref={imageRef}
                src={pages[currentPage]}
                alt={`Page ${currentPage + 1}`}
                style={{
                  maxWidth: useFullScreen ? '100vw' : '95vw',
                  maxHeight: useFullScreen ? '100vh' : 'calc(100vh - 80px)',
                  width: 'auto',
                  height: 'auto',
                  objectFit: "contain",
                  transform: `translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                  transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  willChange: 'transform',
                  transformOrigin: 'center center',
                }}
                className="select-none"
                onLoad={handleImageLoad}
                draggable={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
