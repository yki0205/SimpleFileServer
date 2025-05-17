"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import { useSwipeable } from 'react-swipeable';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
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
  const [zoom, setZoom] = useState(1);
  const [comicType, setComicType] = useState<'cbz' | 'cbr' | 'unknown'>('unknown');
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Function to extract images from a CBZ file (ZIP-based format)
  const extractCBZ = async (data: ArrayBuffer) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(data);
      
      // Get all image files
      const imageFiles: { name: string, data: string }[] = [];
      
      const filePromises = Object.keys(contents.files)
        .filter(filename => {
          const lowerName = filename.toLowerCase();
          return !contents.files[filename].dir && 
                 (lowerName.endsWith('.jpg') || 
                  lowerName.endsWith('.jpeg') || 
                  lowerName.endsWith('.png') || 
                  lowerName.endsWith('.gif') || 
                  lowerName.endsWith('.webp'));
        })
        .map(async filename => {
          const fileData = await contents.files[filename].async('blob');
          const url = URL.createObjectURL(fileData);
          return { name: filename, data: url };
        });
      
      const results = await Promise.all(filePromises);
      
      // Sort files by name to ensure correct order
      results.sort((a, b) => {
        // Extract numbers from filenames for natural sorting
        const aMatch = a.name.match(/(\d+)/g);
        const bMatch = b.name.match(/(\d+)/g);
        
        if (aMatch && bMatch) {
          const aNum = parseInt(aMatch[aMatch.length - 1]);
          const bNum = parseInt(bMatch[bMatch.length - 1]);
          return aNum - bNum;
        }
        
        return a.name.localeCompare(b.name);
      });
      
      const urls = results.map(result => result.data);
      setPages(urls);
      setTotalPages(urls.length);
      setLoading(false);
    } catch (err) {
      console.error('Error extracting CBZ:', err);
      setError('Failed to extract comic book file. The file may be corrupted or in an unsupported format.');
      setLoading(false);
    }
  };

  // Function to handle CBR files (RAR-based format)
  // Note: Web browsers cannot natively extract RAR files, so we would need a server-side endpoint
  const extractCBR = async () => {
    try {
      // Call server endpoint to extract pages
      const response = await axios.get(`/api/extract-comic?path=${encodeURIComponent(src)}`);
      if (response.data.pages && response.data.pages.length > 0) {
        setPages(response.data.pages);
        setTotalPages(response.data.pages.length);
      } else {
        setError('No pages found in the comic book file');
      }
      setLoading(false);
    } catch (err) {
      console.error('Error extracting CBR:', err);
      setError('Failed to extract comic book file. The file may be corrupted or in an unsupported format.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadComic = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Determine file type
        const fileExtension = src.split('.').pop()?.toLowerCase();
        
        if (fileExtension === 'cbz') {
          setComicType('cbz');
          // For CBZ files, we can extract client-side
          const response = await axios.get(src, { responseType: 'arraybuffer' });
          await extractCBZ(response.data);
        } else if (fileExtension === 'cbr') {
          setComicType('cbr');
          // For CBR files, we need server-side extraction
          await extractCBR();
        } else {
          // Try to handle as CBZ anyway
          setComicType('unknown');
          try {
            const response = await axios.get(src, { responseType: 'arraybuffer' });
            await extractCBZ(response.data);
          } catch (err) {
            // If that fails, try the server endpoint
            await extractCBR();
          }
        }
      } catch (err) {
        console.error('Error loading comic:', err);
        setError('Failed to load comic book file. Please try again later.');
        setLoading(false);
      }
    };
    
    loadComic();
    
    return () => {
      // Clean up object URLs to prevent memory leaks
      pages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
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

  const zoomIn = () => {
    setZoom(Math.min(zoom + 0.1, 3));
  };

  const zoomOut = () => {
    setZoom(Math.max(zoom - 0.1, 0.5));
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
        case '+':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case 'Escape':
          onClose?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, zoom, onClose]);

  // Handle touch gestures
  const swipeHandlers = useSwipeable({
    onSwipedLeft: nextPage,
    onSwipedRight: prevPage,
    trackMouse: true
  });

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
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={zoomOut}
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
          >
            <ZoomOut size={18} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={zoomIn}
            className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
          >
            <ZoomIn size={18} />
          </Button>
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

      {/* Comic page display */}
      <div 
        {...swipeHandlers}
        className="flex-1 flex items-center justify-center overflow-auto bg-black"
      >
        <img
          ref={imageRef}
          src={pages[currentPage]}
          alt={`Page ${currentPage + 1}`}
          style={{ 
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease-in-out',
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain'
          }}
          className="select-none"
        />
      </div>
    </div>
  );
}
