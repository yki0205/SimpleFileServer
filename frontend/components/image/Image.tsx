"use client"

import { useState, useEffect, useRef } from "react";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { ImageOff, RotateCw, RefreshCw, Download, X } from "lucide-react";

interface ImageProps {
  src: string,
  alt: string,
  onClick?: () => void,
  className?: string
}

export function Image({ src, alt, onClick, className }: ImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [previewPosition, setPreviewPosition] = useState<'left' | 'right'>('right');
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 });
  const [verticalOffset, setVerticalOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    
    const separator = src.includes('?') ? '&' : '?';
    // setImgSrc(`${src}${separator}_t=${Date.now()}`);
    setImgSrc(src);
  }, [src]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setIsLoading(true);
    
    const separator = src.includes('?') ? '&' : '?';
    setImgSrc(`${src}${separator}_t=${Date.now()}`);
  }

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(src, '_blank');
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovered(false);
  }

  const calculatePreviewDimensions = () => {
    if (!containerRef.current || imageNaturalSize.width === 0 || imageNaturalSize.height === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const spaceOnRight = windowWidth - rect.right;
    const spaceOnLeft = rect.left;
    
    // Determine which side has more space
    const position = spaceOnRight > spaceOnLeft ? 'right' : 'left';
    setPreviewPosition(position);
    
    // Calculate available space
    const availableWidth = position === 'right' ? spaceOnRight : spaceOnLeft;
    const availableHeight = windowHeight;
    
    // Calculate dimensions while maintaining aspect ratio
    const aspectRatio = imageNaturalSize.width / imageNaturalSize.height;
    
    let width, height;
    
    // First try to fit by width
    width = availableWidth;
    height = width / aspectRatio;
    
    // If height exceeds available height, fit by height instead
    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspectRatio;
    }
    
    setPreviewDimensions({
      width,
      height
    });

    // Calculate vertical position to keep preview within screen bounds
    const previewHalfHeight = height / 2;
    const containerCenterY = rect.top + rect.height / 2;
    
    let offset = 0;
    
    // Check if preview would go above the screen
    if (containerCenterY - previewHalfHeight < 0) {
      offset = previewHalfHeight - containerCenterY;
    }
    
    // Check if preview would go below the screen
    else if (containerCenterY + previewHalfHeight > windowHeight) {
      offset = windowHeight - (containerCenterY + previewHalfHeight);
    }
    
    setVerticalOffset(offset);
  };

  const handleMouseEnter = () => {
    calculatePreviewDimensions();
    
    const timeout = setTimeout(() => {
      setIsHovered(true);
    }, 200); // 200ms hover delay before showing preview
    setHoverTimeout(timeout);
  }

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovered(false);
  }

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.target as HTMLImageElement;
    setImageNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    setIsLoading(false);
  }

  // Update dimensions when window is resized
  useEffect(() => {
    const handleResize = () => {
      if (isHovered) {
        calculatePreviewDimensions();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isHovered]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative transition-all duration-300 flex items-center justify-center",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {error ? (
        <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-md h-full w-full">
          <ImageOff className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load image</p>
          <button 
            onClick={handleRetry}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline group"
          >
            <RefreshCw className="h-3 w-3 group-hover:animate-spin" /> Retry
          </button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <RotateCw className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          
          {/* Thumbnail image (shown by default) */}
          <NextImage
            src={imgSrc}
            alt={alt}
            className={cn(
              "object-cover transition-all duration-300",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleImageLoad}
            onError={() => {
              setError(true);
              setIsLoading(false);
            }}
            onClick={onClick}
            width={200}
            height={200}
          />
          
          {/* Preview image shown on hover */}
          {isHovered && !isLoading && !error && previewDimensions.width > 0 && (
            <div 
              className={cn(
                "max-sm:hidden",
                "absolute z-50 bg-background rounded-lg shadow-xl overflow-hidden border border-border",
                previewPosition === 'right' ? "left-full" : "right-full"
              )}
              style={{
                width: `${previewDimensions.width}px`,
                height: `${previewDimensions.height}px`,
                top: `calc(50% + ${verticalOffset}px)`,
                transform: 'translateY(-50%)'
              }}
            >
              <NextImage
                src={imgSrc}
                alt={alt}
                className="object-contain"
                fill
                sizes={`${previewDimensions.width}px`}
                priority
              />
              <button
                onClick={handleDownload}
                className="absolute top-2 right-11 bg-black/50 hover:bg-black/70 text-white px-2 py-1 rounded-md"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleClose}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-red-500 px-2 py-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}