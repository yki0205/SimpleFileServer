"use client"

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { ImageOff, RotateCw, RefreshCw, Download, X } from "lucide-react";

interface ImageItemProps {
  src: string,
  alt: string,
  thumbnail?: string,
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down',
  loading?: 'lazy' | 'eager',
  onClick?: () => void,
  className?: string,
  disablePreview?: boolean
}

export function ImageItem({ src, alt, thumbnail, onClick, className, disablePreview = false, fit = 'contain', loading = 'lazy' }: ImageItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);
  const [isPreviewError, setIsPreviewError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);
  const [thumbSrc, setThumbSrc] = useState(thumbnail || src);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 });
  const [previewCoordinates, setPreviewCoordinates] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isBrowser, setIsBrowser] = useState(false);

  // Set browser state on mount
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    setImgSrc(src);
    setThumbSrc(thumbnail || src);
  }, [src, thumbnail]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsError(false);
    setIsLoading(true);
    
    const timestamp = Date.now();
    const addQueryParam = (url: string) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}_t=${timestamp}`;
    };
    
    setImgSrc(addQueryParam(src));
    setThumbSrc(addQueryParam(thumbnail || src));
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
    if (!containerRef.current || imageNaturalSize.width === 0 || imageNaturalSize.height === 0) return false;

    const rect = containerRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const spaceOnRight = windowWidth - rect.right;
    const spaceOnLeft = rect.left;
    
    // Determine which side has more space
    const position = spaceOnRight > spaceOnLeft ? 'right' : 'left';
    
    // Calculate available space
    const availableWidth = position === 'right' ? spaceOnRight : spaceOnLeft;
    const availableHeight = windowHeight;
    
    // Calculate dimensions while maintaining aspect ratio
    const aspectRatio = imageNaturalSize.width / imageNaturalSize.height;
    
    let width, height;
    
    // First try to fit by width
    width = Math.min(availableWidth, 1000); // Cap max width
    height = width / aspectRatio;
    
    // If height exceeds available height, fit by height instead
    if (height > availableHeight) {
      height = availableHeight;
      width = height * aspectRatio;
    }
    
    // Set dimensions (must be at least 100px to be visible)
    if (width < 100 || height < 100) return false;
    
    setPreviewDimensions({
      width,
      height
    });

    // Calculate position for portal
    const centerY = rect.top + rect.height / 2;
    let yPos = centerY - height / 2;
    
    // Ensure preview stays within screen bounds
    if (yPos < 0) yPos = 0;
    if (yPos + height > windowHeight) yPos = windowHeight - height;
    
    // Calculate X position based on available space
    const xPos = position === 'right' ? rect.right : rect.left - width;
    
    setPreviewCoordinates({
      x: xPos,
      y: yPos
    });
    
    return true;
  };

  const handleMouseEnter = () => {
    if (disablePreview) return;
    
    const dimensionsValid = calculatePreviewDimensions();
    if (!dimensionsValid) return;
    
    const timeout = setTimeout(() => {
      setIsHovered(true);
      setIsPreviewLoading(true);
      setIsPreviewError(false);
    }, 500); // 500ms hover delay before showing preview
    setHoverTimeout(timeout);
  }

  const handleMouseLeave = () => {
    if (disablePreview) return;
    
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setIsHovered(false);
    setIsPreviewLoading(false);
    setIsPreviewError(false);
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

  // Render preview in portal
  const renderPreview = () => {
    if (!isBrowser || !isHovered || isLoading || isError || previewDimensions.width <= 0) return null;
    
    // Get or create portal container
    let portalContainer = document.getElementById('image-preview-portal');
    if (!portalContainer) {
      portalContainer = document.createElement('div');
      portalContainer.id = 'image-preview-portal';
      portalContainer.style.position = 'fixed';
      portalContainer.style.top = '0';
      portalContainer.style.left = '0';
      portalContainer.style.zIndex = '9999';
      portalContainer.style.pointerEvents = 'none';
      document.body.appendChild(portalContainer);
    }
    
    return createPortal(
      <div 
        className={cn(
          "w-full h-full",
          "rounded-lg shadow-xl overflow-hidden border border-border",
          "max-sm:hidden",
          "pointer-events-auto",
        )}
        style={{
          position: 'fixed',
          left: `${previewCoordinates.x}px`,
          top: `${previewCoordinates.y}px`,
          width: `${previewDimensions.width}px`,
          height: `${previewDimensions.height}px`,
        }}
      >
        {isPreviewLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
            <RotateCw className="h-6 w-6 text-white animate-spin" />
            <p className="text-sm text-white">Loading...</p>
          </div>
        )}

        <NextImage
          src={imgSrc}
          alt={alt}
          className={cn(
            "w-full h-full",
            "object-contain",
            isPreviewLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsPreviewLoading(false)}
          onError={() => {
            setIsPreviewLoading(false);
            setIsPreviewError(true);
          }}
          fill
          sizes={`${previewDimensions.width}px`}
          priority
        />
        <button
          onClick={handleDownload}
          className="absolute top-2 right-11 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-white"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>,
      portalContainer
    );
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "w-full h-full",
        "relative flex items-center justify-center",
        "cursor-pointer select-none",
        "text-primary bg-transparent",
        "transition-all duration-300",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isError ? (
        <div className={cn(
          "w-full h-full",
          "flex flex-col items-center justify-center gap-2",
          "text-muted-foreground"
        )}>
          <ImageOff className="h-8 w-8" />
          <p className="text-sm text-red-500">Failed to load image</p>
          <button 
            onClick={handleRetry}
            className="flex items-center justify-center gap-1 text-xs hover:underline group"
          >
            <RefreshCw className="h-3 w-3 group-hover:animate-spin" /> Retry
          </button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <RotateCw className="h-6 w-6 animate-spin" />
            </div>
          )}
          
          {/* Thumbnail image (shown by default) */}
          <NextImage
            src={thumbSrc}
            alt={alt}
            className={cn(
              "w-full h-full",
              fit === 'contain' && "object-contain",
              fit === 'cover' && "object-cover",
              fit === 'fill' && "object-fill",
              fit === 'none' && "object-none",
              fit === 'scale-down' && "object-scale-down",
              isLoading ? "opacity-0" : "opacity-100",
              "transition-all duration-300"
            )}
            loading={loading}
            onLoad={handleImageLoad}
            onError={() => {
              setIsError(true);
              setIsLoading(false);
            }}
            onClick={onClick}
            width={200}
            height={200}
          />
          
          {/* Preview image is now rendered through portal */}
          {renderPreview()}
        </>
      )}
    </div>
  )
}