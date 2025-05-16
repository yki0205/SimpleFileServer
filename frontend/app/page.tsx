"use client";

import { cn } from "@/lib/utils";
import axios from "axios";
import React, { Suspense, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  List, Grid3x3, Image as ImageIcon, Search, ArrowLeft, ArrowUp, Home,
  Download, Upload, X, ChevronLeft, ChevronRight, FolderPlus,
  Edit, Trash2, ClipboardCopy, ClipboardPaste, MoveHorizontal 
} from "lucide-react";

import { Error } from "@/components/status/Error";
import { Loading } from "@/components/status/Loading";
import { NotFound } from "@/components/status/NotFound";
import { Image } from "@/components/image/Image";
import { Video } from "@/components/video/Video";
import { FileItemListView } from "@/components/fileItem/FileItemListView";
import { FileItemGridView } from "@/components/fileItem/FileItemGridView";
import { ConfirmDialog } from "@/components/dialog/ComfirmDialog";

interface FileData {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: string;
}

interface FilesResponse {
  files: FileData[];
}

interface ImagesResponse {
  images: FileData[];
}

interface SearchResponse {
  results: FileData[];
}

interface PreviewState {
  isOpen: boolean;
  path: string;
  type: string;
  content?: string;
  currentIndex?: number;
}

function FileExplorerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fileToDownload, setFileToDownload] = useState('');
  const [downloadComfirmDialogOpen, setDownloadComfirmDialogOpen] = useState(false);

  const [fileToDelete, setFileToDelete] = useState('');
  const [deleteComfirmDialogOpen, setDeleteComfirmDialogOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'image' | 'imageOnly'>('list');
  const viewModeRef = useRef(viewMode);

  // EXPERIMENTAL FEATURE
  const [useMasonry, setUseMasonry] = useState(false);
  const [gridDirection, setGridDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    path: '',
    type: '',
  });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const currentPath = searchParams.get('p') || '';
  const searchQuery = searchParams.get('q') || '';
  const isSearching = !!searchQuery;
  const canGoBack = currentPath !== '' || isSearching;

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50; // Minimum distance required for a swipe





  const { data: filesData, isLoading: isLoadingFiles, error: errorFiles, refetch: refetchFiles } = useQuery<FilesResponse>({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/files', { params: { dir: currentPath } });
      return response.data;
    },
    enabled: !isSearching && viewMode !== 'imageOnly'
  });

  const { data: imagesData, isLoading: imagesLoading, error: imagesError, refetch: refetchImages } = useQuery<ImagesResponse>({
    queryKey: ['images', currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/images', { params: { dir: currentPath } });
      return response.data;
    },
    enabled: viewMode === 'imageOnly'
  });

  const { data: searchData, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/search', {
        params: { query: searchQuery, dir: currentPath }
      });
      return response.data;
    },
    enabled: isSearching && searchQuery.length > 0 && viewMode !== 'imageOnly'
  });

  const { data: previewContent, isLoading: contentLoading, error: contentError, refetch: refetchPreview } = useQuery({
    queryKey: ['fileContent', preview.path],
    queryFn: async () => {
      if (!preview.isOpen || (preview.type !== 'code' && preview.type !== 'document')) {
        return null;
      }

      try {
        const response = await axios.get(`/api/content`, {
          params: { path: preview.path },
          responseType: 'text'
        });
        return response.data;
      } catch (error: any) {
        if (error.response) {
          return `Error loading file: Server returned ${error.response.status} ${error.response.statusText}`;
        }
        return `Error loading file: ${error.message || 'Unknown error'}`;
      }
    },
    enabled: preview.isOpen && (preview.type === 'code' || preview.type === 'document'),
    retry: false,
    refetchOnWindowFocus: false
  });

  const filesToDisplay = (() => {
    if (viewMode === 'imageOnly') {
      return imagesData?.images || [];
    } else if (isSearching) {
      return searchData?.results || [];
    }
    return filesData?.files || [];
  })();

  // TODO: I don't know. Maybe make natural sort an additional option will be better.
  // I will try to implement it later.
  const naturalSort = (a: string, b: string): number => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    return collator.compare(a, b);
  };

  const sortedFiles = [...filesToDisplay].sort((a, b) => {

    if (viewMode === 'imageOnly' && sortBy === 'name') {
      const pathA = a.path.split('/').concat(a.name);
      const pathB = b.path.split('/').concat(b.name);
      return sortOrder === 'asc'
        // ? pathA.join('/').localeCompare(pathB.join('/'))
        // : pathB.join('/').localeCompare(pathA.join('/'));
        ? naturalSort(pathA.join('/'), pathB.join('/'))
        : naturalSort(pathB.join('/'), pathA.join('/'));
    }

    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    if (sortBy === 'name') {
      return sortOrder === 'asc'
        // ? a.name.localeCompare(b.name)
        // : b.name.localeCompare(a.name);
        ? naturalSort(a.name, b.name)
        : naturalSort(b.name, a.name);
    } else if (sortBy === 'size') {
      return sortOrder === 'asc'
        ? a.size - b.size
        : b.size - a.size;
    } else if (sortBy === 'date') {
      const dateA = new Date(a.mtime).getTime();
      const dateB = new Date(b.mtime).getTime();
      return sortOrder === 'asc'
        ? dateA - dateB
        : dateB - dateA;
    }
    return 0;
  });





  const navigateTo = (path: string, query: string) => {
    if (viewMode === 'imageOnly') {
      setViewMode('image');
    }

    const params = new URLSearchParams();
    if (path) params.set('p', path);
    if (query) params.set('q', query);
    router.push(`/?${params.toString()}`);
  }

  const goBack = () => {
    if (isSearching) {
      navigateTo(currentPath, '');
      return;
    }

    const pathParts = currentPath.split('/');
    pathParts.pop();
    const newPath = pathParts.join('/');
    navigateTo(newPath, '');
  }

  const goHome = () => {
    if (currentPath === '') {
      window.location.reload();
    } else {
      navigateTo('', '');
    }
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };







  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('searchQuery') as string;
    navigateTo(currentPath, query);
  }

  const handleMkdir = (path: string) => {
    // TODO: Implement mkdir
  }

  const handleRename = (path: string, newName: string) => {
    // TODO: Implement rename
  }

  const handleDelete = (path: string) => {
    setFileToDelete(path);
    setDeleteComfirmDialogOpen(true);
  }

  const handleCopy = (path: string) => {
    // TODO: Implement copy
  }

  const handlePaste = (path: string) => {
    // TODO: Implement paste
  }

  const handleMove = (path: string) => {
    // TODO: Implement move
  }

  const handleDownload = (path: string) => {
    window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
  };

  const handleUpload = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true; // Allow multiple file selection

    fileInput.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      try {
        const response = await axios.post(`/api/upload?dir=${encodeURIComponent(currentPath)}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        if (isSearching) {
          refetchSearch();
        } else {
          refetchFiles();
        }

        console.log('Files uploaded successfully:', response.data);
      } catch (error: any) {
        console.error('Upload error:', error.response?.data || error.message);
      }
    };

    fileInput.click();
  }

  const handleFileClick = (path: string, type: string) => {
    if (type === 'directory') {
      navigateTo(path, '');
    } else if (type === 'image' || type === 'video' || type === 'audio' || type === 'code' || type === 'document') {
      openPreview(path, type);
    } else {
      setFileToDownload(path);
      setDownloadComfirmDialogOpen(true);
    }
  }






  const openPreview = async (path: string, type: string) => {
    setPreviewLoading(true);
    setPreviewError(false);
    const currentIndex = sortedFiles.findIndex(file => file.path === path);

    setPreview({
      isOpen: true,
      path,
      type,
      currentIndex
    });
    if (type === 'code' || type === 'document') {
      // The state of code and document is controlled by contentLoading and contentError
      setPreviewLoading(false);
      setPreviewError(false);
    }
  }

  const closePreview = () => {
    setPreview({
      isOpen: false,
      path: '',
      type: ''
    });
    setPreviewLoading(false);
    setPreviewError(false);
  }

  const navigatePreview = (direction: 'next' | 'prev') => {
    if (preview.currentIndex === undefined) return;

    // Set loading state immediately when navigating
    setPreviewLoading(true);
    setPreviewError(false);
    if (viewMode === 'imageOnly') {
      if (!sortedFiles) return;
      let newIndex;
      if (direction === 'next') {
        newIndex = (preview.currentIndex + 1) % sortedFiles.length;
      } else {
        newIndex = (preview.currentIndex - 1 + sortedFiles.length) % sortedFiles.length;
      }
      openPreview(sortedFiles[newIndex].path, sortedFiles[newIndex].type);
      return;
    }

    const sameTypeFiles = sortedFiles.filter(file => file.type === preview.type);
    if (sameTypeFiles.length <= 1) return;
    const currentIndex = sameTypeFiles.findIndex(file => file.path === preview.path);

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % sameTypeFiles.length;
    } else {
      newIndex = (currentIndex - 1 + sameTypeFiles.length) % sameTypeFiles.length;
    }

    openPreview(sameTypeFiles[newIndex].path, sameTypeFiles[newIndex].type);
  }






  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closePreview();
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (preview.type !== 'image') return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (preview.type !== 'image') return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    if (preview.type !== 'image') return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      navigatePreview('next');
    } else if (isRightSwipe) {
      navigatePreview('prev');
    }

    // Reset values
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!preview.isOpen) return;
    if (preview.type === 'video' || preview.type === 'code' || preview.type === 'document') return;

    e.preventDefault();
    e.stopPropagation();

    if (e.deltaY > 0) {
      navigatePreview('next');
    } else if (e.deltaY < 0) {
      navigatePreview('prev');
    }
  };





  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  const getLanguage = (ext: string) => {
    const langMap: Record<string, string> = {
      // Plain text
      'txt': 'text',
      'ini': 'text',
      'cfg': 'text',
      'conf': 'text',

      // Markup and styling
      'html': 'html',
      'css': 'css',
      'md': 'markdown',
      'xml': 'xml',

      // Data formats
      'json': 'text',
      'csv': 'csv',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',

      // Programming languages
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'powershell': 'bash',
      'ps1': 'bash',
      'psm1': 'bash',
    };

    return langMap[ext] || 'text';
  };






  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!preview.isOpen) return;
      if (preview.type !== 'video') {
        switch (e.key) {
          case 'ArrowLeft':
            navigatePreview('prev');
            break;
          case 'ArrowRight':
            navigatePreview('next');
            break;
          case 'ArrowUp':
            // Optional: implement additional navigation
            break;
          case 'ArrowDown':
            // Optional: implement additional navigation
            break;
          case 'Escape':
            closePreview();
            break;
        }
      }
      // Video keyboard shortcuts are now handled by the Video component
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [preview.isOpen, preview.path]);

  useEffect(() => {
    // TODO: This is a workaround for the issue that the scroll event is still triggered on the background element
    // even though the handleWheel function is preventing the default behavior. So I choose to disable the scroll of the whole body.
    const originalStyle = window.getComputedStyle(document.body).overflow;
    if (preview.isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [preview.isOpen]);

  useEffect(() => {
    closePreview();
  }, [currentPath, searchQuery])

  // Listen for browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (viewMode === 'imageOnly') {
        setViewMode('image');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [viewMode]);

  // Update ref when viewMode changes
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Intercept history navigation methods
  useEffect(() => {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    // Override pushState method
    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      // Use ref instead of state directly
      if (viewModeRef.current === 'imageOnly') {
        // Use setTimeout to move state update to next event loop
        setTimeout(() => {
          setViewMode('image');
        }, 0);
      }
      return originalPushState(data, unused, url);
    };

    // Override replaceState method
    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      // Use ref instead of state directly
      if (viewModeRef.current === 'imageOnly') {
        // Use setTimeout to move state update to next event loop
        setTimeout(() => {
          setViewMode('image');
        }, 0);
      }
      return originalReplaceState(data, unused, url);
    };

    return () => {
      // Restore original methods
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);





  const isError = (viewMode === 'imageOnly') ? imagesError :
    (isSearching) ? searchError : errorFiles;

  const isLoading = (viewMode === 'imageOnly') ? imagesLoading :
    (isSearching) ? searchLoading : isLoadingFiles;

  const isNotFound = ((viewMode === 'imageOnly') ? imagesData?.images.length === 0 :
    (isSearching) ? searchData?.results.length === 0 : filesData?.files.length === 0) && !isLoading && !isError;





  return (
    <main className="container mx-auto min-h-screen flex flex-col p-4 pb-8">
      <header className="flex flex-wrap justify-between mb-2 gap-1">
        <div className="order-1 flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack}
            className={cn(
              "text-black",
              "bg-white hover:bg-white/80",
              "transition-colors duration-200"
            )}
          >
            <ArrowLeft size={18} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goHome}
            className={cn(
              "text-black",
              "bg-white hover:bg-white/80",
              "transition-colors duration-200"
            )}
          >
            <Home size={18} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleUpload}
            className={cn(
              "text-black",
              "bg-white hover:bg-white/80",
              "transition-colors duration-200"
            )}
          >
            <Upload size={18} />
          </Button>

        </div>

        <form onSubmit={handleSearch} className="order-3 max-sm:w-full flex gap-1">
          <Input
            name="searchQuery"
            placeholder="Search files..."
            defaultValue={searchQuery}
            className={cn(
              "w-full md:w-[200px]",
              "text-white",
              "selection:bg-white selection:text-black"
            )}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search size={18} />
          </Button>
        </form>

        <div className="order-2 sm:order-4 flex gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 min-w-20 h-full font-bold font-mono select-none">
                {sortBy === 'name' ? 'Name' : sortBy === 'size' ? 'Size' : 'Date'}
                {sortOrder === 'asc' ? ' ↑' : ' ↓'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1">
              <div className="grid gap-1">
                <Button
                  variant={sortBy === 'name' ? "default" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setSortBy('name');
                    setSortOrder(sortBy === 'name' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc');
                  }}
                >
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant={sortBy === 'size' ? "default" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setSortBy('size');
                    setSortOrder(sortBy === 'size' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc');
                  }}
                >
                  Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
                <Button
                  variant={sortBy === 'date' ? "default" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setSortBy('date');
                    setSortOrder(sortBy === 'date' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc');
                  }}
                >
                  Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List size={18} />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid3x3 size={18} />
          </Button>
          <Button
            variant={viewMode === 'image' ? 'default' : 'outline'}
            size="icon"
            onClick={() => {
              if (viewMode === 'image') {
                setViewMode('imageOnly');
              } else {
                setViewMode('image');
              }
            }}
            className={cn(viewMode === 'imageOnly' && 'text-white bg-yellow-600/20 hover:bg-yellow-400/50')}
          >
            <ImageIcon size={18} />
          </Button>
        </div>
      </header>

      <nav className="mb-2">
        {isSearching ? (
          <div className="bg-muted px-1 py-1 rounded-md text-sm">
            Searching: "{searchQuery}" in {currentPath || 'root'}
          </div>
        ) : (
          <div className="bg-muted px-1 py-1 rounded-md text-sm flex flex-wrap items-center">
            <button onClick={goHome}
              className="cursor-pointer hover:bg-gray-300 rounded-md p-1"
            >
              <Home size={18} />
            </button>
            {currentPath.split('/').filter(Boolean).map((segment, index, array) => {
              const pathToSegment = array.slice(0, index + 1).join('/');
              return (
                <React.Fragment key={index}>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <button onClick={() => navigateTo(pathToSegment, '')}
                    className="cursor-pointer hover:bg-gray-300 rounded-md p-1 truncate"
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </nav>

      {isError ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Error message="Error loading files. Please try again." />
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loading message="Loading files..." />
        </div>
      ) : isNotFound ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <NotFound message="No files found." />
        </div>
      ) : (
        <></>
      )}

      {viewMode === 'imageOnly' && (
        <div className="flex justify-center text-sm text-muted-foreground mb-1">
          {imagesData?.images.length} images found in {currentPath}
        </div>
      )}

      {(!isLoading && !isError && !isNotFound) && (
        <>
          {/* List view */}
          {viewMode === 'list' && (
            <div className="border rounded-md w-full">
              <div className={cn(
                "border rounded-md p-2",
                "bg-white/80 text-black",
                "flex items-center",
                "text-sm sm:text-base font-bold font-mono",
                "select-none"
              )}>
                <div className="w-8" />
                <div className="flex-1">
                  <button className="cursor-pointer" onClick={() => {
                    if (sortBy === "name") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    } else {
                      setSortBy("name")
                      setSortOrder("asc")
                    }
                  }}>
                    Name
                    {sortBy === "name" && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </div>
                {isSearching && (
                  <div className="w-80 text-right">Path</div>
                )}
                <div className="hidden md:block w-24 text-right">
                  <button className="cursor-pointer" onClick={() => {
                    if (sortBy === "size") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    } else {
                      setSortBy("size")
                      setSortOrder("asc")
                    }
                  }}>
                    Size
                    {sortBy === "size" && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </div>
                <div className="hidden md:block w-32 text-right">
                  <button className="cursor-pointer" onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                    } else {
                      setSortBy("date")
                      setSortOrder("asc")
                    }
                  }}>
                    Modified
                    {sortBy === "date" && <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {sortedFiles.map((file) => (
                  <ContextMenu key={`${file.path}_${sortBy}_${sortOrder}`}>
                    <ContextMenuTrigger>
                      <FileItemListView
                        {...file}
                        isSearching={isSearching}
                        onClick={() => handleFileClick(file.path, file.type)}
                        className="text-white hover:text-black hover:bg-accent"
                      />
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleDownload(file.path)}>
                        <Download className="mr-2" size={16} />
                        Download
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleDelete(file.path)}>
                        <Trash2 className="mr-2" size={16} />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            </div>
          )}
          {/* Grid view */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {sortedFiles.map((file) => (
                <ContextMenu key={`${file.path}_${sortBy}_${sortOrder}`}>
                  <ContextMenuTrigger>
                    <FileItemGridView
                      {...file}
                      onClick={() => handleFileClick(file.path, file.type)}
                      className="text-black hover:text-gray-600 hover:bg-accent"
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleDownload(file.path)}>
                      <Download className="mr-2" size={16} />
                      Download
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDelete(file.path)}>
                      <Trash2 className="mr-2" size={16} />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          )}
          {/* Image view */}
          {viewMode === 'image' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {sortedFiles.map((file) => {
                if (file.type === 'image') {
                  return (
                    <Image
                      key={`${file.path}_${sortBy}_${sortOrder}`}
                      {...file}
                      src={`/api/download?path=${encodeURIComponent(file.path)}`}
                      alt={file.name}
                      onClick={() => handleFileClick(file.path, file.type)}
                      className={cn(
                        "w-full h-full",
                        "min-w-[150px]",
                        "max-w-[250px]",
                        "object-cover",
                        "cursor-pointer",
                      )}
                    />
                  )
                } else {
                  return (
                    <ContextMenu key={file.path}>
                      <ContextMenuTrigger>
                        <FileItemGridView
                          {...file}
                          onClick={() => handleFileClick(file.path, file.type)}
                          className="text-black hover:text-gray-600 hover:bg-accent"
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleDownload(file.path)}>
                          <Download className="mr-2" size={16} />
                          Download
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDelete(file.path)}>
                          <Trash2 className="mr-2" size={16} />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                }
              })}
            </div>
          )}
          {/* Image Only view */}
          {viewMode === 'imageOnly' && (
            <div className={cn(
              useMasonry ? "columns-2 sm:columns-3 md:columns-4 lg:columns-6 gap-2" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2",
            )}
            style={{
              direction: gridDirection
            }}
            >
              {sortedFiles.map((file) => (
                <div key={`${file.path}_${sortBy}_${sortOrder}`} className={cn(
                  useMasonry && "break-inside-avoid mb-2"
                )}>
                  <Image
                    {...file}
                    src={`/api/download?path=${encodeURIComponent(file.path)}`}
                    alt={file.name}
                    onClick={() => handleFileClick(file.path, file.type)}
                    className="w-full h-auto rounded-md"
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview Overlay */}
      {preview.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleBackdropClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {(preview.type === 'image' || preview.type === 'video' || preview.type === 'audio') && (
            <div className="fixed top-4 left-4 z-[60] max-w-[50vw]">
              <h3 className="text-white text-xl font-bold px-4 py-2 bg-black/50 rounded-md truncate">
                {viewMode === 'imageOnly' ? preview.path : preview.path.split('/').pop()}
              </h3>
            </div>
          )}

          <div className="absolute z-10 top-4 right-4 flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank');
              }}
            >
              <Download size={20} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="bg-black/50 hover:bg-black/70 border-white/20 text-red-500 hover:text-red-500/80"
              onClick={(e) => {
                e.stopPropagation();
                closePreview();
              }}
            >
              <X size={20} />
            </Button>
          </div>

          {(preview.type === 'image' || preview.type === 'video' || preview.type === 'audio' || preview.type === 'code' || preview.type === 'document') && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute z-10 left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 border-white/20 text-white hover:text-white/80"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewMode === 'imageOnly' && gridDirection === 'rtl') {
                    navigatePreview('next');
                  } else {
                    navigatePreview('prev');
                  }
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
                  if (viewMode === 'imageOnly' && gridDirection === 'rtl') {
                    navigatePreview('prev');
                  } else {
                    navigatePreview('next');
                  }
                }}
              >
                <ChevronRight size={24} />
              </Button>
            </>
          )}

          {/* Image view */}
          {preview.type === 'image' && (
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <div className="absolute z-[-1] flex items-center justify-center">
                {previewError ? (
                  <Error message="Error loading preview. Please try again." className="text-white w-100" />
                ) : previewLoading ? (
                  <Loading message="Loading preview..." className="text-white w-100" />
                ) : (
                  <></>
                )}
              </div>
              <img
                src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                alt="Preview"
                className={cn(
                  (previewLoading || previewError) && "opacity-0",
                  "max-w-full max-h-[90vh] object-contain shadow-2xl"
                )}
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
              />
            </div>
          )}

          {/* Video view */}
          {preview.type === 'video' && (
            <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <div className="absolute z-[-1] flex items-center justify-center">
                {previewError ? (
                  <Error message="Error loading preview. Please try again." className="text-white w-100" />
                ) : previewLoading ? (
                  <Loading message="Loading preview..." className="text-white w-100" />
                ) : (
                  <></>
                )}
              </div>
              <div className="flex flex-col items-center w-full">
                {/* TODO */}
                <Video
                  src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                  autoPlay={true}
                  className={cn(
                    (previewLoading || previewError) && "opacity-0",
                    "max-w-full max-h-[80vh] shadow-2xl"
                  )}
                  onLoad={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError(true);
                  }}
                  onClose={closePreview}
                />
              </div>
            </div>
          )}

          {/* Audio view */}
          {preview.type === 'audio' && (
            <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <div className="absolute z-[-1] flex items-center justify-center">
                {previewError ? (
                  <Error message="Error loading preview. Please try again." className="text-white w-100" />
                ) : previewLoading ? (
                  <Loading message="Loading preview..." className="text-white w-100" />
                ) : (
                  <></>
                )}
              </div>
              <div className="flex flex-col items-center">
                <audio
                  controls
                  className={cn(
                    "max-w-full shadow-2xl",
                    (previewLoading || previewError) && "opacity-0"
                  )}
                  src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                  onLoadedData={() => setPreviewLoading(false)}
                  onError={() => {
                    setPreviewLoading(false);
                    setPreviewError(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Code view & Document view */}
          {(preview.type === 'code' || preview.type === 'document') && (
            <div className="w-[80vw] h-[80vh] overflow-hidden bg-gray-900 rounded-md shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gray-800 p-3 flex justify-between items-center border-b border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono text-sm truncate max-w-[50vw]">
                    {preview.path.split('/').pop()}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
                    {getFileExtension(preview.path)}
                  </span>
                </div>
              </div>
              <div className="overflow-auto flex-1 p-1">
                {contentError ? (
                  <div className="p-4 text-red-400 font-mono">
                    {previewContent}
                  </div>
                ) : contentLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="h-4 w-32 bg-gray-700 rounded-md mb-2"></div>
                      <div className="h-4 w-48 bg-gray-700 rounded-md"></div>
                    </div>
                  </div>
                ) : previewContent && previewContent.startsWith('Error loading file:') ? (
                  <div className="p-4 text-red-400 font-mono">
                    {previewContent}
                  </div>
                ) : previewContent ? (
                  <SyntaxHighlighter
                    language={getLanguage(getFileExtension(preview.path))}
                    style={vscDarkPlus}
                    showLineNumbers
                    customStyle={{ margin: 0, height: '100%', background: 'transparent' }}
                    codeTagProps={{ style: { fontFamily: 'monospace' } }}
                  >
                    {previewContent}
                  </SyntaxHighlighter>
                ) : (
                  <div className="p-4 text-red-400 font-mono">
                    No content available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Separator className="my-4" />
      <footer className="flex justify-center items-center">
        <p className="text-sm text-muted-foreground font-bold font-mono">
          Developed by <a href="https://github.com/Kobayashi2003" className="underline">Kobayashi2003</a>
        </p>
        <span className="mx-2">•</span>
        <a href="https://github.com/Kobayashi2003" className="rounded-full overflow-hidden">
          <img src="github_icon.png" alt="GitHub" className="w-4 h-4" />
        </a>
      </footer>

      {/* Scroll to top button */}
      <button
        onClick={scrollToTop}
        className={cn(
          "fixed bottom-8 right-8",
          "w-10 h-10 rounded-full",
          "bg-black/50 hover:bg-black/70",
          "text-white",
          "flex items-center justify-center",
          "transition-all duration-300",
          "shadow-lg",
          "focus:outline-none focus:ring-2 focus:ring-white/50",
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>

      {/* Download confirm dialog */}
      <ConfirmDialog
        open={downloadComfirmDialogOpen}
        setOpen={setDownloadComfirmDialogOpen}
        title="Download"
        description="This type of file is not supported, do you want to download it?"
        confirmText="Download"
        cancelText="Cancel"
        onConfirm={() => {
          window.open(`/api/download?path=${encodeURIComponent(fileToDownload)}`, '_blank');
          setFileToDownload('');
          setDownloadComfirmDialogOpen(false);
        }}
        onCancel={() => {
          setFileToDownload('');
          setDownloadComfirmDialogOpen(false);
        }}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteComfirmDialogOpen}
        setOpen={setDeleteComfirmDialogOpen}
        title="Delete"
        description="Are you sure you want to delete this file?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          fetch(`/api/delete?path=${encodeURIComponent(fileToDelete)}`, {
            method: 'DELETE',
          }).then(() => {
            setFileToDelete('');
            setDeleteComfirmDialogOpen(false);
            if (isSearching) {
              refetchSearch();
            } else {
              refetchFiles();
            }
          });
        }}
        onCancel={() => {
          setFileToDelete('');
          setDeleteComfirmDialogOpen(false);
        }}
      />
    </main>
  );
}

export default function FileExplorer() {
  return (
    <Suspense fallback={<Loading message="Loading..." />}>
      <FileExplorerContent />
    </Suspense>
  );
}