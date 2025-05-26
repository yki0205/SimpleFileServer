"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ReactReader } from 'react-reader';
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';

interface EPUBReaderProps {
  src: string;
  className?: string;
  onClose?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  // Fallback
  onFullScreenChange?: (isFullScreen: boolean) => void;
}

export const EPUBReader = ({
  src,
  className,
  onClose,
  onNext,
  onPrev,
  onFullScreenChange,
}: EPUBReaderProps) => {

  // Core reader refs
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Core reader state
  const [location, setLocation] = useState<string | null>(null);
  const [size, setSize] = useState<number>(100);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // Controls timeout ref
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle location change
  const handleLocationChanged = (loc: string) => {
    setLocation(loc);
    // Save to localStorage
    localStorage.setItem(`epub-${src}`, loc);
  };

  // Toggle controls visibility
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Load saved location on init
  useEffect(() => {
    const savedLocation = localStorage.getItem(`epub-${src}`);
    if (savedLocation) {
      setLocation(savedLocation);
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [src]);

  // Change font size
  const changeFontSize = (newSize: number) => {
    setSize(newSize);
    setShowSettings(false);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "select-none",
        "relative h-full w-full",
        "flex flex-col items-center justify-center",
        className
      )}
      onMouseMove={resetControlsTimeout}
    >
      <div className="w-[90vw] h-[90vh] bg-white">
        <ReactReader
          url={src}
          location={location}
          locationChanged={handleLocationChanged}
          epubOptions={{
            flow: "paginated",
            manager: "default"
          }}
          epubInitOptions={{
            openAs: 'epub'
          }}
          getRendition={(rendition) => {
            console.log("EPUB rendition created:", rendition);
            rendition.themes.fontSize(`${size}%`);
          }}
          tocChanged={toc => console.log("TOC changed:", toc)}
          loadingView={<div>Loading...</div>}
        />
      </div>
      
      {/* Controls - simplified version */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-16 pb-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center w-full">
          {/* Navigation controls */}
          <div className="flex items-center gap-4">
            {onPrev && (
              <button
                onClick={onPrev}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Previous book"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            
            {/* Font size controls */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              
              {showSettings && (
                <div className="absolute bottom-full left-0 mb-2 bg-black/90 border-0 text-white min-w-[150px] p-2 rounded-md shadow-lg z-10">
                  <div className="text-sm mb-2 font-medium px-2">Font Size</div>
                  <div className="flex flex-col gap-1">
                    {[80, 90, 100, 110, 120, 130].map(s => (
                      <button
                        key={s}
                        onClick={() => changeFontSize(s)}
                        className={cn(
                          "text-left px-2 py-1 rounded hover:bg-gray-700 text-sm transition-colors cursor-pointer",
                          size === s ? "bg-gray-700" : ""
                        )}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {onNext && (
              <button
                onClick={onNext}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Next book"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/70 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-label="Close reader"
        >
          <X size={24} />
        </button>
      )}
    </div>
  );
};

export default EPUBReader;
