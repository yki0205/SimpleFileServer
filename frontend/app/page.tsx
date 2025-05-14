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
  List, Grid3x3, Image as ImageIcon, Search, ArrowLeft, Home,
  Download, Upload, X, ChevronLeft, ChevronRight, FolderPlus,
  Edit, Trash2, ClipboardCopy, ClipboardPaste, MoveHorizontal
} from "lucide-react";

import { Error } from "@/components/status/Error";
import { Loading } from "@/components/status/Loading";
import { NotFound } from "@/components/status/NotFound";
import { Image } from "@/components/image/Image";
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

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'image'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    path: '',
    type: '',
  });
  const [previewLoading, setPreviewLoading] = useState(false);

  const currentPath = searchParams.get('p') || '';
  const searchQuery = searchParams.get('q') || '';
  const isSearching = !!searchQuery;
  const canGoBack = currentPath !== '' || isSearching;

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50; // Minimum distance required for a swipe

  const { data, isLoading, error, refetch } = useQuery<FilesResponse>({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/files', {
        params: { dir: currentPath }
      });
      return response.data;
    },
    enabled: !isSearching
  });

  const { data: searchData, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/search', {
        params: { query: searchQuery, dir: currentPath }
      });
      return response.data;
    },
    enabled: isSearching && searchQuery.length > 0
  });

  const { data: previewContent, isLoading: isContentLoading, error: contentError, refetch: refetchPreview } = useQuery({
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

  const filesToDisplay = isSearching
    ? searchData?.results || []
    : data?.files || [];

  const sortedFiles = [...filesToDisplay].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    if (sortBy === 'name') {
      return sortOrder === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
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
    navigateTo('', '');
  }

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
          refetch();
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

    const currentIndex = sortedFiles.findIndex(file => file.path === path);

    setPreview({
      isOpen: true,
      path,
      type,
      currentIndex
    });
    setPreviewLoading(false);
  }

  const closePreview = () => {
    setPreview({
      isOpen: false,
      path: '',
      type: ''
    });
  }

  const navigatePreview = (direction: 'next' | 'prev') => {
    if (preview.currentIndex === undefined) return;

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

  // Touch event handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!preview.isOpen) return;

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
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [preview.isOpen, preview.path]);

  useEffect(() => {
    closePreview();
  }, [currentPath, searchQuery])


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
              "max-sm:hidden",
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
            onClick={() => setViewMode('image')}
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
                    className="cursor-pointer hover:bg-gray-300 rounded-md p-1"
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </nav>

      {(isLoading || searchLoading) && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loading message="Loading files..." />
        </div>
      )}
      {(error || searchError) && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Error message="Error loading files. Please try again." />
        </div>
      )}
      {(!isLoading && !searchLoading && !error && !searchError && sortedFiles.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <NotFound message="No files found." />
        </div>
      )}

      {/* List view */}
      {(!isLoading && !searchLoading && sortedFiles.length > 0 && viewMode === 'list') && (
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
              <ContextMenu key={file.path}>
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
      {(!isLoading && !searchLoading && sortedFiles.length > 0 && viewMode === 'grid') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {sortedFiles.map((file) => (
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
          ))}
        </div>
      )}

      {/* Image view */}
      {(!isLoading && !searchLoading && sortedFiles.length > 0 && viewMode === 'image') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {sortedFiles.map((file) => {
            if (file.type === 'image') {
              return (
                <Image
                  key={file.path}
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

      {/* Preview Overlay */}
      {preview.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={handleBackdropClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Title at top-left corner of the browser window */}
          {(preview.type === 'image' || preview.type === 'video' || preview.type === 'audio') && (
            <div className="fixed top-4 left-4 z-[60] max-w-[50vw]">
              <h3 className="text-white text-xl font-bold px-4 py-2 bg-black/50 rounded-md truncate">
                {preview.path.split('/').pop()}
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
                  navigatePreview('prev');
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
                  navigatePreview('next');
                }}
              >
                <ChevronRight size={24} />
              </Button>
            </>
          )}

          {previewLoading ? (
            <div className="flex items-center justify-center">
              <Loading message="Loading preview..." />
            </div>
          ) : (
            <>
              {preview.type === 'image' && (
                <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <div className="absolute inset-0 z-[-1]">
                    <img
                      src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                      alt="Preview"
                      className="w-full h-full object-cover blur-xl opacity-30"
                    />
                  </div>
                  <img
                    src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                    alt="Preview"
                    className="max-w-full max-h-[90vh] object-contain shadow-2xl"
                  />
                </div>
              )}

              {preview.type === 'video' && (
                <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-gray-900 to-black opacity-70"></div>
                  <div className="flex flex-col items-center">
                    {/* <h3 className="text-white text-xl font-bold mb-4">{preview.path.split('/').pop()}</h3> */}
                    <video
                      controls
                      autoPlay
                      className="max-w-full max-h-[80vh] shadow-2xl object-contain"
                      src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                    />
                  </div>
                </div>
              )}

              {preview.type === 'audio' && (
                <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-gray-900 to-black opacity-70"></div>
                  <div className="flex flex-col items-center">
                    {/* <h3 className="text-white text-xl font-bold mb-4">{preview.path.split('/').pop()}</h3> */}
                    <audio
                      controls
                      className="max-w-full shadow-2xl"
                      src={`/api/download?path=${encodeURIComponent(preview.path)}`}
                    />
                  </div>
                </div>
              )}

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
                    {isContentLoading ? (
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
            </>
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
              refetch();
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