"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSwipeable } from 'react-swipeable';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/status/Loading';
import { Error } from '@/components/status/Error';

interface ComicReaderProps {
  src: string;
  onClose?: () => void;
}

export function ComicReader({ src, onClose }: ComicReaderProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pages, setPages] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    
    // Image zoom and position state
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastTouchDistance, setLastTouchDistance] = useState(0);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when changing pages
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentPage]);

  useEffect(() => {
    const loadComic = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Extract the actual file path from the download URL
        let filePath = src;
        
        // If src is a download URL, extract the path parameter
        if (src.startsWith('/api/download?path=')) {
          const urlParams = new URLSearchParams(src.substring(src.indexOf('?')));
          filePath = urlParams.get('path') || src;
        }
        
        // Use server endpoint for all comic file formats
        const response = await axios.get(`/api/comic?path=${encodeURIComponent(filePath)}`);
        
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

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          nextPage();
          break;
        case 'ArrowLeft':
          prevPage();
          break;
        case 'Escape':
          onClose?.();
          break;
        case '+':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, onClose, zoom]);

  // Handle touch gestures
  const swipeHandlers = useSwipeable({
    onSwipedLeft: nextPage,
    onSwipedRight: prevPage,
    trackMouse: true,
  });

  // Handle image load to get actual dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageSize({ width: naturalWidth, height: naturalHeight });
    }
  };

  // Zoom functions
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

  // 双指捏合缩放结束后进行调整
  const adjustAfterZoom = () => {
    // 如果缩放系数非常接近1，则自动重置为1
    if (zoom > 0.9 && zoom < 1.1) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Image drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    resetZoom();
  };

  // Apply to window to capture mouse events even outside the component
  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  // 触摸处理函数
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指触摸 - 准备缩放
      const distance = getTouchDistance(e);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && zoom > 1) {
      // 单指触摸 - 准备拖动
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // 只有在缩放时才阻止默认行为，以允许在未缩放时正常滑动翻页
    if ((e.touches.length === 2) || (zoom > 1 && e.touches.length === 1)) {
      e.preventDefault();
    }

    if (e.touches.length === 2) {
      // 双指缩放
      const distance = getTouchDistance(e);
      if (lastTouchDistance > 0) {
        const delta = distance - lastTouchDistance;
        // 调整触摸缩放的灵敏度
        const zoomDelta = delta * 0.005; // 降低灵敏度以增加控制感
        const newZoom = Math.max(0.1, Math.min(5, zoom + zoomDelta));
        setZoom(newZoom);
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      // 单指拖动
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // 添加拖动边界，不允许拖太远
      const maxDragDistance = Math.max(imageSize.width, imageSize.height) * zoom;
      const boundedX = Math.max(-maxDragDistance, Math.min(maxDragDistance, newX));
      const boundedY = Math.max(-maxDragDistance, Math.min(maxDragDistance, newY));
      
      setPosition({ x: boundedX, y: boundedY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (lastTouchDistance > 0) {
      setLastTouchDistance(0);
      // 在缩放结束时进行调整
      adjustAfterZoom();
    }
  };

  // 计算两指之间的距离
  const getTouchDistance = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  if (loading) {
    return <Loading message="Loading comic book..." />;
  }

  if (error) {
    return <Error message={error} />;
  }

  if (pages.length === 0) {
    return <Error message="No pages found in the comic book file" />;
  }

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col">
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-black/40">
        <div className="flex items-center gap-2">
          <span className="text-white">
            {currentPage + 1} / {totalPages}
          </span>
          <div className="ml-4 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={zoomOut}
              disabled={zoom <= 0.1}
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <ZoomOut size={16} />
            </Button>
            <span className="text-white mx-2">{Math.round(zoom * 100)}%</span>
            <Button
              variant="outline"
              size="icon"
              onClick={zoomIn}
              disabled={zoom >= 5}
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <ZoomIn size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={resetZoom}
              className="ml-1 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
            >
              <RotateCw size={16} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="bg-black/50 hover:bg-black/70 border-white/20 text-red-500 hover:text-red-500/80"
            >
              <X size={18} />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <Button
        variant="outline"
        size="icon"
        onClick={prevPage}
        disabled={currentPage === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
      >
        <ChevronLeft size={24} />
      </Button>
      
      <Button
        variant="outline"
        size="icon"
        onClick={nextPage}
        disabled={currentPage === totalPages - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
      >
        <ChevronRight size={24} />
      </Button>

      {/* Container wrapper with extended content area */}
      <div className="flex-1 overflow-hidden bg-black">
        {/* Comic page display with extended visibility */}
        <div 
          {...(zoom <= 1 ? swipeHandlers : {})}
          className="w-full h-full flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          style={{ 
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            padding: zoom > 1 ? '10%' : 0, // 增加更多的视觉空间
            transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // 更平滑的过渡
          }}
        >
          <div 
            className="relative flex items-center justify-center"
            style={{ 
              transform: `scale(${zoom})`,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              margin: zoom > 1 ? '-10%' : 0, // 匹配外部padding
            }}
          >
            {pages[currentPage] && (
              <img
                ref={imageRef}
                src={pages[currentPage]}
                alt={`Page ${currentPage + 1}`}
                style={{ 
                  maxWidth: '95vw',
                  maxHeight: 'calc(100vh - 120px)',
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
        </div>
      </div>
    </div>
  );
}
