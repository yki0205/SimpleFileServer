"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import PreviewBase, { PreviewBaseProps } from "./PreviewBase";

interface ImagePreviewProps extends Omit<PreviewBaseProps, 'children' | 'onZoomIn' | 'onZoomOut' | 'isLoading' | 'hasError'> {
  /** Image source URL */
  src: string;
  /** Alternative text for the image */
  alt?: string;
  /** Initial zoom level (1 = normal size) */
  initialZoom?: number;
  /** Max zoom level */
  maxZoom?: number;
  /** Min zoom level */
  minZoom?: number;
  /** Zoom step size */
  zoomStep?: number;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  alt = "Preview",
  initialZoom = 1,
  maxZoom = 5,
  minZoom = 0.1,
  zoomStep = 0.5,
  controls,
  ...restProps
}) => {
  // Internal state for zoom and position
  const [zoom, setZoom] = useState(initialZoom);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPosition = useRef({ x: 0, y: 0 });
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const moveSpeedRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  
  // Internal loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setZoom(initialZoom);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, [src]);

  // Handle image load event
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Handle image error event
  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Reset position when zoom changes to 1 or less
  useEffect(() => {
    if (zoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(maxZoom, prev + zoomStep));
  }, [maxZoom, zoomStep]);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(minZoom, prev - zoomStep));
  }, [minZoom, zoomStep]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle inertia animation
  const applyInertia = useCallback(() => {
    if (moveSpeedRef.current.x === 0 && moveSpeedRef.current.y === 0) {
      return;
    }

    // Apply inertia with friction
    moveSpeedRef.current.x *= 0.9;
    moveSpeedRef.current.y *= 0.9;

    // Stop when speed is very low
    if (
      Math.abs(moveSpeedRef.current.x) < 0.5 && 
      Math.abs(moveSpeedRef.current.y) < 0.5
    ) {
      moveSpeedRef.current = { x: 0, y: 0 };
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    setPosition(prev => ({
      x: prev.x + moveSpeedRef.current.x,
      y: prev.y + moveSpeedRef.current.y
    }));

    animationRef.current = requestAnimationFrame(applyInertia);
  }, []);

  // Handle image mouse events for dragging
  const handleImageMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1) return; // Only enable dragging when zoomed in
    
    // Cancel any ongoing inertia animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsDragging(true);
    dragStartPosition.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
    moveSpeedRef.current = { x: 0, y: 0 };
    e.preventDefault();
  }, [zoom, position]);

  const handleImageMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    
    // Calculate movement speed for inertia
    moveSpeedRef.current = {
      x: (e.clientX - lastMousePosition.current.x) * 0.8, // Scale down speed
      y: (e.clientY - lastMousePosition.current.y) * 0.8
    };
    
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
    
    setPosition({
      x: e.clientX - dragStartPosition.current.x,
      y: e.clientY - dragStartPosition.current.y
    });
    e.preventDefault();
  }, [isDragging]);

  const handleImageMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      
      // Start inertia if we have speed
      if (
        (Math.abs(moveSpeedRef.current.x) > 0.5 || 
         Math.abs(moveSpeedRef.current.y) > 0.5) &&
        zoom > 1
      ) {
        animationRef.current = requestAnimationFrame(applyInertia);
      }
    }
  }, [isDragging, applyInertia, zoom]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleImageMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleImageMouseUp]);

  // Calculate transform styles with proper transition handling
  const getImageStyles = () => {
    const safeZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    
    return {
      transform: `scale(${safeZoom})`,
      translate: `${position.x}px ${position.y}px`,
      // Apply smooth transitions only for zoom, not for position when using inertia
      transition: isDragging || animationRef.current 
        ? 'transform 0.2s ease' // Only zoom transitions when dragging or inertia is active
        : 'transform 0.2s ease, translate 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' // Smooth easing for manual positioning
    };
  };

  return (
    <PreviewBase
      isLoading={isLoading}
      hasError={hasError}
      onZoomIn={handleZoomIn}
      onZoomOut={handleZoomOut}
      controls={{
        showZoom: true,
        enableTouchNavigation: zoom <= 1,
        enableWheelNavigation: true,
        ...controls
      }}
      {...restProps}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          (isLoading || hasError) && "opacity-0",
          "max-w-full max-h-[90vh] object-contain shadow-2xl",
          isDragging && "cursor-grabbing", 
          zoom > 1 && !isDragging && "cursor-grab"
        )}
        style={getImageStyles()}
        onLoad={handleImageLoad}
        onError={handleImageError}
        onDoubleClick={handleResetZoom}
        onMouseDown={handleImageMouseDown}
        onMouseMove={handleImageMouseMove}
        onMouseUp={handleImageMouseUp}
        onMouseLeave={() => isDragging && handleImageMouseUp()}
        onTouchStart={(e) => {
          if (zoom <= 1) return;
          
          // Cancel any ongoing inertia animation
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          
          setIsDragging(true);
          const touch = e.touches[0];
          dragStartPosition.current = {
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
          };
          lastMousePosition.current = { x: touch.clientX, y: touch.clientY };
          moveSpeedRef.current = { x: 0, y: 0 };
          e.preventDefault();
        }}
        onTouchMove={(e) => {
          if (!isDragging) return;
          
          const touch = e.touches[0];
          
          // Calculate movement speed for inertia
          moveSpeedRef.current = {
            x: (touch.clientX - lastMousePosition.current.x) * 0.8,
            y: (touch.clientY - lastMousePosition.current.y) * 0.8
          };
          
          lastMousePosition.current = { x: touch.clientX, y: touch.clientY };
          
          setPosition({
            x: touch.clientX - dragStartPosition.current.x,
            y: touch.clientY - dragStartPosition.current.y
          });
          e.preventDefault();
        }}
        onTouchEnd={() => handleImageMouseUp()}
        onTouchCancel={() => handleImageMouseUp()}
      />
    </PreviewBase>
  );
};

export default ImagePreview; 