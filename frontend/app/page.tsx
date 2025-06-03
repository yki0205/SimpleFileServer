"use client";

import "./scrollbar.css";
import { cn, getPreviewType } from "@/lib/utils";
import axios from "axios";
import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { FixedSizeList as List, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  List as ListIcon, Grid3x3, Image as ImageIcon, Search, ArrowLeft, ArrowUp, Home, X,
  Download, Upload, Edit, Trash2, ClipboardCopy, ClipboardPaste, MoveHorizontal, Layout,
  Info, Database, Eye, MoreHorizontal, TestTube2, LogIn, LogOut, User, Scissors, Check,
  CircleCheck, CircleX, ArrowLeftRight, RefreshCw
} from "lucide-react";

import { BreadcrumbNav } from "@/components/nav";
import { Error, Loading, NotFound } from "@/components/status";
import { FileItemListView, FileItemGridView, ImageItem, VideoItem } from "@/components/fileItem";
import { ImagePreview, VideoPreview, AudioPreview, TextPreview, ComicPreview, EPUBPreview, PDFPreview } from "@/components/preview";
import { ConfirmDialog, DetailsDialog, DownloadDialog, UploadDialog, IndexSettingsDialog, WatcherSettingsDialog, LoginDialog } from "@/components/dialog";

import { useAuth } from '@/context/auth-context';


interface FileData {
  name: string;
  path: string;
  size: number;
  mtime: string;
  isDirectory: boolean;
  mimeType?: string;
  cover?: string;
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



interface FileRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    files: FileData[];
    selectedFiles: string[];
    isSelecting: boolean;
    isSearching: boolean;
    onFileClick: (path: string, mimeType: string, isDirectory: boolean) => void;
    onCopy: (path: string) => void;
    onCut: (path: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
    onShowDetails: (file: FileData) => void;
  };
}

const FileRow = React.memo(({ index, style, data }: FileRowProps) => {
  const { files, selectedFiles, isSelecting, isSearching, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails } = data;
  const file = files[index];

  return (
    <div style={style}>
      <ContextMenu>
        <ContextMenuTrigger>
          <FileItemListView
            {...file}
            isSearching={isSearching}
            onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
            className={cn(
              "text-white hover:text-black hover:bg-accent",
              isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-white hover:bg-blue-500/20"
            )}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onShowDetails(file)}>
            <Info className="mr-2" size={16} />
            Details
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopy(file.path)}>
            <ClipboardCopy className="mr-2" size={16} />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCut(file.path)}>
            <Scissors className="mr-2" size={16} />
            Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(file.path)}>
            <Download className="mr-2" size={16} />
            Download
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(file.path)}>
            <Trash2 className="mr-2" size={16} />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
});

interface FileCellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    files: FileData[];
    selectedFiles: string[];
    isSelecting: boolean;
    columnCount: number;
    onFileClick: (path: string, mimeType: string, isDirectory: boolean) => void;
    onCopy: (path: string) => void;
    onCut: (path: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
    onShowDetails: (file: FileData) => void;
  };
}

const FileCell = React.memo(({ columnIndex, rowIndex, style, data }: FileCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= files.length) return null;

  const file = files[index];

  return (
    <div style={style} className="p-1">
      <ContextMenu>
        <ContextMenuTrigger>
          <FileItemGridView
            {...file}
            cover=""
            onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
            className={cn(
              "text-black hover:text-gray-600 hover:bg-accent",
              isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-black hover:bg-blue-500/20"
            )}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onShowDetails(file)}>
            <Info className="mr-2" size={16} />
            Details
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopy(file.path)}>
            <ClipboardCopy className="mr-2" size={16} />
            Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCut(file.path)}>
            <Scissors className="mr-2" size={16} />
            Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(file.path)}>
            <Download className="mr-2" size={16} />
            Download
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(file.path)}>
            <Trash2 className="mr-2" size={16} />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
});

interface ImageCellProps {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  data: {
    files: FileData[];
    selectedFiles: string[];
    isSelecting: boolean;
    columnCount: number;
    onFileClick: (path: string, mimeType: string, isDirectory: boolean) => void;
    onCopy: (path: string) => void;
    onCut: (path: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
    onShowDetails: (file: FileData) => void;
    token?: string;
  };
}

const ImageCell = React.memo(({ columnIndex, rowIndex, style, data }: ImageCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, token } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= files.length) return null;

  const file = files[index];

  if (file.mimeType?.startsWith('image/')) {
    return (
      <div style={style} className="p-1">
        <ContextMenu>
          <ContextMenuTrigger>
            <ImageItem
              src={`/api/raw?path=${encodeURIComponent(file.path)}${token ? `&token=${token}` : ''}`}
              thumbnail={`/api/thumbnail?path=${encodeURIComponent(file.path)}&width=300&quality=80${token ? `&token=${token}` : ''}`}
              alt={file.name}
              onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
              className={cn(
                "w-full h-full object-cover rounded-md cursor-pointer",
                isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-black hover:bg-blue-500/20"
              )}
              loading="eager"
              disablePreview={isSelecting}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onShowDetails(file)}>
              <Info className="mr-2" size={16} />
              Details
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopy(file.path)}>
              <ClipboardCopy className="mr-2" size={16} />
              Copy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCut(file.path)}>
              <Scissors className="mr-2" size={16} />
              Cut
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDownload(file.path)}>
              <Download className="mr-2" size={16} />
              Download
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDelete(file.path)}>
              <Trash2 className="mr-2" size={16} />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  } else if (file.mimeType?.startsWith('video/')) {
    return (
      <div style={style} className="p-1">
        <ContextMenu>
          <ContextMenuTrigger>
            <VideoItem
              alt={file.name}
              thumbnail={`/api/thumbnail?path=${encodeURIComponent(file.path)}&width=300&quality=80${token ? `&token=${token}` : ''}`}
              onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
              className={cn(
                "w-full h-full object-cover rounded-md cursor-pointer",
                isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-black hover:bg-blue-500/20"
              )}
              loading="eager"
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onShowDetails(file)}>
              <Info className="mr-2" size={16} />
              Details
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopy(file.path)}>
              <ClipboardCopy className="mr-2" size={16} />
              Copy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCut(file.path)}>
              <Scissors className="mr-2" size={16} />
              Cut
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDownload(file.path)}>
              <Download className="mr-2" size={16} />
              Download
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDelete(file.path)}>
              <Trash2 className="mr-2" size={16} />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    )
  } else {
    return (
      <div style={style} className="p-1">
        <ContextMenu>
          <ContextMenuTrigger>
            <FileItemGridView
              {...file}
              cover={file.cover ? `/api/thumbnail?path=${encodeURIComponent(file.cover)}&width=300&quality=80${token ? `&token=${token}` : ''}` : undefined}
              onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
              className={cn(
                "text-black hover:text-gray-600 hover:bg-accent",
                isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-black hover:bg-blue-500/20"
              )}
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onShowDetails && onShowDetails(file)}>
              <Info className="mr-2" size={16} />
              Details
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopy(file.path)}>
              <ClipboardCopy className="mr-2" size={16} />
              Copy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCut(file.path)}>
              <Scissors className="mr-2" size={16} />
              Cut
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDownload(file.path)}>
              <Download className="mr-2" size={16} />
              Download
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDelete(file.path)}>
              <Trash2 className="mr-2" size={16} />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    );
  }
});

interface MasonryCellProps {
  index: number;
  style: React.CSSProperties;
  data: {
    files: FileData[];
    selectedFiles: string[];
    isSelecting: boolean;
    columnCount: number;
    columnWidth: number;
    direction: 'ltr' | 'rtl';
    onFileClick: (path: string, mimeType: string, isDirectory: boolean) => void;
    onCopy: (path: string) => void;
    onCut: (path: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
    onShowDetails: (file: FileData) => void;
    token?: string;
  };
}

const MasonryCell = React.memo(({ index, style, data }: MasonryCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, columnWidth, direction, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, token } = data;
  // Each index represents a column of images
  if (index >= columnCount) return null;

  // Get files for this column using distribution algorithm
  const columnFiles = files.filter((_, fileIndex) => fileIndex % columnCount === index);

  return (
    <div
      style={{
        ...style,
        width: columnWidth,
        position: 'absolute',
        left: index * columnWidth,
        top: 0,
        height: 'auto',
        direction
      }}
      className="flex flex-col gap-2 px-1"
    >
      {columnFiles.map((file) => (
        <div key={file.path} className="break-inside-avoid mb-2 w-full">
          <ContextMenu>
            <ContextMenuTrigger>
              <ImageItem
                {...file}
                src={`/api/raw?path=${encodeURIComponent(file.path)}${token ? `&token=${token}` : ''}`}
                thumbnail={`/api/thumbnail?path=${encodeURIComponent(file.path)}&width=300&quality=80${token ? `&token=${token}` : ''}`}
                alt={file.name}
                onClick={() => onFileClick(file.path, file.mimeType || 'application/octet-stream', file.isDirectory)}
                className={cn(
                  "w-full h-auto rounded-md",
                  isSelecting && selectedFiles.includes(file.path) && "border-2 border-blue-500 bg-blue-500/10 hover:text-black hover:bg-blue-500/20"
                )}
                loading="lazy"
              />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onShowDetails(file)}>
                <Info className="mr-2" size={16} />
                Details
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCopy(file.path)}>
                <ClipboardCopy className="mr-2" size={16} />
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onCut(file.path)}>
                <Scissors className="mr-2" size={16} />
                Cut
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDownload(file.path)}>
                <Download className="mr-2" size={16} />
                Download
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDelete(file.path)}>
                <Trash2 className="mr-2" size={16} />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      ))}
    </div>
  );
});



function getFileExtension(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function getColumnCount(width: number) {
  if (width < 768) return 2; // md
  if (width < 1024) return 4; // lg
  if (width < 1280) return 6; // xl
  return 8; // 2xl and above
}

function getButtonStyles(btnCountBefore: number, index: number) {
  const base = cn(
    "fixed",
    "w-10 h-10 rounded-full",
    "bg-black/50 hover:bg-black/70 text-white",
    "flex items-center justify-center",
    "transition-all duration-300",
  )
  const positions = [
    "bottom-8 right-8",
    "bottom-20 right-8",
    "bottom-32 right-8",
    "bottom-44 right-8"
  ]
  return cn(base, positions[Math.min(index, positions.length - 1, btnCountBefore)]);
}

function generateUniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}


const previewSupported: Record<string, boolean> = {
  'image': true,
  'video': true,
  'audio': true,
  'text': true,
  'application': false,
  'pdf': true,
  'epub': true,
  'comic': true,
  'archive': false,
  'other': false,
}



function FileExplorerContent() {
  const { isAuthenticated: isAuthenticatedTemp, isCheckingAuth, username, permissions, logout, token } = useAuth();
  const isAuthenticated = isAuthenticatedTemp && !isCheckingAuth;
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticatedTemp && !isCheckingAuth) {
      setIsLoginDialogOpen(true);
    }
  }, [isAuthenticatedTemp, isCheckingAuth]);

  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPath = searchParams.get('p') || '';
  const searchQuery = searchParams.get('q') || '';
  const isSearching = !!searchQuery;
  const canGoBack = currentPath !== '' || isSearching;

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const [fileToDownload, setFileToDownload] = useState('');
  const [downloadComfirmDialogOpen, setDownloadComfirmDialogOpen] = useState(false);
  const [downloadMultipleDialogOpen, setDownloadMultipleDialogOpen] = useState(false);

  const [fileToDelete, setFileToDelete] = useState('');
  const [filesToDelete, setFilesToDelete] = useState<string[]>([])
  const [deleteComfirmDialogOpen, setDeleteComfirmDialogOpen] = useState(false);
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);

  // TODO: Implement clone and move
  const [filesToClone, setFilesToClone] = useState<string[]>([]);
  const [cloneComfirmDialogOpen, setCloneComfirmDialogOpen] = useState(false);
  const [cloneMultipleDialogOpen, setCloneMultipleDialogOpen] = useState(false);

  const [filesToMove, setFilesToMove] = useState<string[]>([]);
  const [moveComfirmDialogOpen, setMoveComfirmDialogOpen] = useState(false);
  const [moveMultipleDialogOpen, setMoveMultipleDialogOpen] = useState(false);

  const [fileToShowDetails, setFileToShowDetails] = useState<FileData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const [viewMode, setViewModeTemp] = useState<'list' | 'grid' | 'image' | 'imageOnly'>('list');
  const setViewMode = (mode: 'list' | 'grid' | 'image' | 'imageOnly') => {
    if (isSearching && mode === 'imageOnly') return;
    setViewModeTemp(mode);
  }
  const viewModeRef = useRef(viewMode);

  // EXPERIMENTAL FEATURE FOR GRID VIEW, IMAGE VIEW & IMAGE ONLY VIEW
  const [gridDirection, setGridDirection] = useState<'ltr' | 'rtl'>('ltr');

  // EXPERIMENTAL FEATURE FOR IMAGE ONLY VIEW (MASONRY)
  const [useMasonry, setUseMasonry] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // EXPERIMENTAL FEATURE FOR IMAGE VIEW
  const [showDirectoryCovers, setShowDirectoryCovers] = useState(false);

  // Create refs for the virtualized lists/grids
  const listRef = useRef<List>(null);
  const gridRef = useRef<Grid>(null);
  const imageGridRef = useRef<Grid>(null);
  const masonryRef = useRef<HTMLDivElement>(null);
  const activeScrollRef = useRef<any>(null);
  const scrollPosition = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    path: '',
    type: '',
  });

  // States for upload progress tracking
  const [uploadFiles, setUploadFiles] = useState<any[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const xhrRefsRef = useRef<Map<string, XMLHttpRequest>>(new Map());

  // States for download progress tracking
  const [downloadFiles, setDownloadFiles] = useState<any[]>([]);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // EXPERIMENTAL FEATURE FOR FILE INDEXING
  const [useFileIndex, setUseFileIndex] = useState(true);
  const [useFileWatcher, setUseFileWatcher] = useState(true);
  const [showIndexDialog, setShowIndexDialog] = useState(false);
  const [showWatcherDialog, setShowWatcherDialog] = useState(false);


  const cloneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Automatically clear filesToClone and filesToMove after 5 minutes
  useEffect(() => {
    if (filesToClone.length > 0) {
      cloneTimerRef.current = setTimeout(() => {
        setFilesToClone([]);
      }, 5 * 60 * 1000);
    }

    if (filesToMove.length > 0) {
      moveTimerRef.current = setTimeout(() => {
        setFilesToMove([]);
      }, 5 * 60 * 1000);
    }

    return () => {
      cloneTimerRef.current && clearTimeout(cloneTimerRef.current);
      moveTimerRef.current && clearTimeout(moveTimerRef.current);
    };
  }, [filesToClone, filesToMove]);


  const { data: filesData, isLoading: isLoadingFiles, error: errorFiles, refetch: refetchFiles } = useQuery<FilesResponse>({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/files', { params: { dir: currentPath, cover: showDirectoryCovers ? 'true' : 'false' } });
      return response.data;
    },
    enabled: isAuthenticated && !isSearching && viewMode !== 'imageOnly'
  });

  const { data: imagesData, isLoading: imagesLoading, error: imagesError, refetch: refetchImages } = useQuery<ImagesResponse>({
    queryKey: ['images', currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/images', { params: { dir: currentPath } });
      return response.data;
    },
    enabled: isAuthenticated && viewMode === 'imageOnly' && !isSearching
  });

  const { data: searchData, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, currentPath],
    queryFn: async () => {
      const response = await axios.get('/api/search', {
        params: { query: searchQuery, dir: currentPath }
      });
      return response.data;
    },
    enabled: isAuthenticated && isSearching && searchQuery.length > 0 && viewMode !== 'imageOnly'
  });

  const { data: previewContent, isLoading: contentLoading, error: contentError, refetch: refetchPreview } = useQuery({
    queryKey: ['fileContent', preview.path],
    queryFn: async () => {
      if (!preview.isOpen || (preview.type !== 'text')) {
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
    enabled: isAuthenticated && preview.isOpen && (preview.type === 'text'),
    retry: false,
    refetchOnWindowFocus: false
  });

  const sortedFiles = useMemo(() => {
    let files: FileData[] = [];

    if (viewMode === 'imageOnly') {
      files = imagesData?.images || [];
    } else if (isSearching) {
      files = searchData?.results || [];
    } else {
      files = filesData?.files || [];
    }

    if (viewMode === 'imageOnly' && sortBy === 'name') {
      return [...files].sort((a, b) => {
        const pathA = a.path.split('/').concat(a.name).join('/');
        const pathB = b.path.split('/').concat(b.name).join('/');
        return sortOrder === 'asc'
          ? pathA.localeCompare(pathB)
          : pathB.localeCompare(pathA);
      });
    }

    return [...files].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      if (sortBy === 'name') {
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc'
          ? collator.compare(a.name, b.name)
          : collator.compare(b.name, a.name);
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
  }, [filesData?.files, searchData?.results, imagesData?.images, sortBy, sortOrder, viewMode, isSearching]);

  const refetch = useCallback(() => {
    if (viewMode === 'imageOnly') {
      refetchImages();
    } else if (isSearching) {
      refetchSearch();
    } else {
      refetchFiles();
    }
  }, [viewMode, isSearching, refetchSearch, refetchFiles, refetchImages]);

  const navigateTo = (path: string, query: string = '') => {
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
      router.push('/');
    } else {
      navigateTo('', '');
    }
  }

  const scrollToTop = () => {
    if (viewMode === 'list') {
      if (listRef.current) {
        // For Lists, scrollToItem is the most reliable method
        listRef.current.scrollToItem(0, "start");
      }
    } else if (viewMode === 'grid') {
      if (gridRef.current) {
        // For Grids, scrollToItem with columnIndex and rowIndex
        gridRef.current.scrollToItem({
          columnIndex: 0,
          rowIndex: 0,
          align: "start"
        });
      }
    } else if (viewMode === 'image' || (viewMode === 'imageOnly' && !useMasonry)) {
      if (imageGridRef.current) {
        // For Image Grids, same as regular grids
        imageGridRef.current.scrollToItem({
          columnIndex: 0,
          rowIndex: 0,
          align: "start"
        });
      }
    } else if (viewMode === 'imageOnly' && useMasonry && masonryRef.current) {
      masonryRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Reset scroll position
    scrollPosition.current = 0;
    setShowScrollTop(false);
  };



  const handleSelectAll = () => {
    setSelectedFiles(sortedFiles.map(file => file.path));
  }

  const handleClearSelection = () => {
    setSelectedFiles([]);
  }

  const handleInvertSelection = () => {
    setSelectedFiles(sortedFiles.filter(file => !selectedFiles.includes(file.path)).map(file => file.path));
  }



  const openPreview = useCallback((path: string, mimeType: string) => {
    const currentIndex = sortedFiles.findIndex(file => file.path === path);
    if (currentIndex === -1) {
      console.error('File not found in sortedFiles:', path);
      return;
    }

    setPreview({
      isOpen: true,
      path,
      type: getPreviewType(mimeType),
      currentIndex
    });
  }, [sortedFiles]);

  const closePreview = useCallback(() => {
    setPreview({
      isOpen: false,
      path: '',
      type: ''
    });
  }, []);

  const navigatePreview = (direction: 'next' | 'prev') => {
    if (preview.currentIndex === undefined) return;

    if (viewMode === 'imageOnly') {
      if (!sortedFiles) return;
      let newIndex;
      if (direction === 'next') {
        newIndex = (preview.currentIndex + 1) % sortedFiles.length;
      } else {
        newIndex = (preview.currentIndex - 1 + sortedFiles.length) % sortedFiles.length;
      }
      openPreview(sortedFiles[newIndex].path, sortedFiles[newIndex].mimeType || '');
      return;
    }

    const sameTypeFiles = sortedFiles.filter(file => {
      const previewType = getPreviewType(file.mimeType || '');
      return previewType === preview.type;
    });
    if (sameTypeFiles.length <= 1) return;
    const currentIndex = sameTypeFiles.findIndex(file => file.path === preview.path);

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % sameTypeFiles.length;
    } else {
      newIndex = (currentIndex - 1 + sameTypeFiles.length) % sameTypeFiles.length;
    }

    openPreview(sameTypeFiles[newIndex].path, sameTypeFiles[newIndex].mimeType || '');
  }

  const handleFileClick = useCallback((path: string, mimeType: string, isDirectory: boolean) => {
    console.log("Handling file click for", { path, mimeType, isDirectory });

    if (isSelecting) {
      if (selectedFiles.includes(path)) {
        console.log("Removing file from selected files", path);
        setSelectedFiles(prev => prev.filter(file => file !== path));
      } else {
        console.log("Adding file to selected files", path);
        setSelectedFiles(prev => [...prev, path]);
      }
      return;
    }

    if (isDirectory) {
      navigateTo(path, '');
    } else {
      if (previewSupported[getPreviewType(mimeType)]) {
        openPreview(path, mimeType);
      } else {
        setFileToDownload(path);
        setDownloadComfirmDialogOpen(true);
      }
    }
  }, [openPreview, isSelecting, setSelectedFiles, selectedFiles]);




  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewMode === 'imageOnly') {
      setViewMode('image');
    }
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('searchQuery') as string;
    navigateTo(currentPath, query);
  }

  const handleClearSearch = () => {
    if (isSearching) {
      navigateTo(currentPath, '');
    }
  }


  // Handle upload with progress tracking
  const handleUpload = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true; // Allow multiple file selection

    fileInput.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      // Prepare files for tracking
      const uploadList = Array.from(files).map(file => ({
        id: generateUniqueId(),
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending' as const,
        file: file
      }));

      // Add files to tracking state
      setUploadFiles(uploadList);
      setShowUploadDialog(true);

      // Process each file upload
      for (const fileData of uploadList) {
        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();

          // Store the XHR reference in our Map
          xhrRefsRef.current.set(fileData.id, xhr);

          const formData = new FormData();
          formData.append('files', fileData.file);

          // Update file status to uploading
          setUploadFiles(prev => prev.map(f =>
            f.id === fileData.id ? { ...f, status: 'uploading' } : f
          ));

          // Setup progress handler
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);

              setUploadFiles(prev => prev.map(f =>
                f.id === fileData.id ? { ...f, progress } : f
              ));
            }
          });

          // Handle completion
          xhr.addEventListener('load', () => {
            // Remove XHR reference
            xhrRefsRef.current.delete(fileData.id);

            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadFiles(prev => prev.map(f =>
                f.id === fileData.id ? { ...f, progress: 100, status: 'completed' } : f
              ));

              // Refresh file list
              refetch();
            } else {
              setUploadFiles(prev => prev.map(f =>
                f.id === fileData.id ? {
                  ...f,
                  status: 'error',
                  error: `Error: ${xhr.status} ${xhr.statusText}`
                } : f
              ));
            }
            resolve();
          });

          // Handle errors
          xhr.addEventListener('error', () => {
            // Remove XHR reference
            xhrRefsRef.current.delete(fileData.id);

            setUploadFiles(prev => prev.map(f =>
              f.id === fileData.id ? {
                ...f,
                status: 'error',
                error: 'Network error occurred'
              } : f
            ));
            resolve();
          });

          // Handle abort event
          xhr.addEventListener('abort', () => {
            // Remove XHR reference
            xhrRefsRef.current.delete(fileData.id);

            setUploadFiles(prev => prev.map(f =>
              f.id === fileData.id ? {
                ...f,
                status: 'error',
                error: 'Upload cancelled'
              } : f
            ));
            resolve();
          });

          // Start upload
          xhr.open('POST', `/api/upload?dir=${encodeURIComponent(currentPath)}${token ? `&token=${token}` : ''}`);
          xhr.send(formData);
        });
      }
    };

    fileInput.click();
  }

  // Cancel specific upload
  const cancelUpload = (fileId: string) => {
    const xhr = xhrRefsRef.current.get(fileId);
    if (xhr) {
      // Actually abort the XHR request
      xhr.abort();
      // UI state will be updated by the abort event handler
    } else {
      // If XHR not found (already completed or never started), just update the UI
      setUploadFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'error', error: 'Cancelled by user' } : f
      ));
    }
  };

  // Cancel all uploads
  const cancelAllUploads = () => {
    // Abort all pending XHR requests
    uploadFiles.forEach(file => {
      if (file.status === 'pending' || file.status === 'uploading') {
        const xhr = xhrRefsRef.current.get(file.id);
        if (xhr) {
          xhr.abort();
        }
      }
    });

    // Update UI for any uploads that didn't have XHR references
    setUploadFiles(prev => prev.map(f =>
      f.status === 'pending' || f.status === 'uploading'
        ? { ...f, status: 'error', error: 'Cancelled by user' }
        : f
    ));
  };

  // Remove completed or error upload task
  const removeUploadTask = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };



  // Download with progress tracking
  const handleDownload = useCallback((path: string) => {
    const filename = path.split('/').pop() || 'download';

    // Create a download entry
    // const downloadId = crypto.randomUUID();
    const downloadId = generateUniqueId();
    const newDownload = {
      id: downloadId,
      name: filename,
      path: path,
      progress: 0,
      size: 0, // We'll update this when we get the response
      status: 'pending' as const
    };

    // Add to download list
    setDownloadFiles(prev => [...prev, newDownload]);
    setShowDownloadDialog(true);

    // Start download with XHR to track progress
    const xhr = new XMLHttpRequest();

    // Store XHR reference for cancellation
    xhrRefsRef.current.set(downloadId, xhr);

    xhr.open('GET', `/api/raw?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}`);
    xhr.responseType = 'blob';

    // Update status to downloading
    setDownloadFiles(prev => prev.map(f =>
      f.id === downloadId ? { ...f, status: 'downloading' } : f
    ));

    // Track progress
    xhr.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        const size = event.total;

        setDownloadFiles(prev => prev.map(f =>
          f.id === downloadId ? { ...f, progress, size } : f
        ));
      }
    };

    // Handle completion
    xhr.onload = () => {
      // Remove XHR reference
      xhrRefsRef.current.delete(downloadId);

      if (xhr.status === 200) {
        // Create download link
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        // Update status
        setDownloadFiles(prev => prev.map(f =>
          f.id === downloadId ? { ...f, progress: 100, status: 'completed' } : f
        ));
      } else {
        setDownloadFiles(prev => prev.map(f =>
          f.id === downloadId ? {
            ...f,
            status: 'error',
            error: `Error: ${xhr.status} ${xhr.statusText}`
          } : f
        ));
      }
    };

    // Handle errors
    xhr.onerror = () => {
      // Remove XHR reference
      xhrRefsRef.current.delete(downloadId);

      setDownloadFiles(prev => prev.map(f =>
        f.id === downloadId ? {
          ...f,
          status: 'error',
          error: 'Network error occurred'
        } : f
      ));
    };

    // Handle abort event
    xhr.onabort = () => {
      // Remove XHR reference
      xhrRefsRef.current.delete(downloadId);

      setDownloadFiles(prev => prev.map(f =>
        f.id === downloadId ? {
          ...f,
          status: 'error',
          error: 'Download cancelled'
        } : f
      ));
    };

    xhr.send();
  }, []);

  const handleDownloadMultiple = useCallback((paths: string[]) => {
    // This version will send a request to the backend's download endpoint,
    // and the final download will be a zip file.

    // TODO: Implement this version
  }, []);

  const handleDownloadMultiple2 = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    paths.forEach(path => {
      handleDownload(path);
    });
  }, []);

  // Cancel specific download
  const cancelDownload = (fileId: string) => {
    const xhr = xhrRefsRef.current.get(fileId);
    if (xhr) {
      // Actually abort the XHR request
      xhr.abort();
      // UI state will be updated by the abort event handler
    } else {
      // If XHR not found (already completed or never started), just update the UI
      setDownloadFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'error', error: 'Cancelled by user' } : f
      ));
    }
  };

  // Cancel all downloads
  const cancelAllDownloads = () => {
    // Abort all pending XHR requests
    downloadFiles.forEach(file => {
      if (file.status === 'pending' || file.status === 'downloading') {
        const xhr = xhrRefsRef.current.get(file.id);
        if (xhr) {
          xhr.abort();
        }
      }
    });

    // Update UI for any downloads that didn't have XHR references
    setDownloadFiles(prev => prev.map(f =>
      f.status === 'pending' || f.status === 'downloading'
        ? { ...f, status: 'error', error: 'Cancelled by user' }
        : f
    ));
  };

  // Remove completed or error download task
  const removeDownloadTask = (fileId: string) => {
    setDownloadFiles(prev => prev.filter(f => f.id !== fileId));
  };



  const handleMkdir = useCallback((path: string) => {
    fetch(`/api/mkdir?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}`, {
      method: 'POST',
    }).then(() => {
      refetch();
    }).catch((error) => {
      console.error('Error creating directory:', error);
    });
  }, [token, refetch]);

  const handleRmdir = useCallback((path: string) => {
    fetch(`/api/rmdir?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}`, {
      method: 'POST',
    }).then(() => {
      refetch();
    }).catch((error) => {
      console.error('Error removing directory:', error);
    });
  }, [token, refetch]);



  const handleRename = useCallback((path: string, newName: string) => {
    fetch(`/api/rename?path=${encodeURIComponent(path)}&newName=${encodeURIComponent(newName)}${token ? `&token=${token}` : ''}`, {
      method: 'POST',
    }).then(() => {
      refetch();
    }).catch((error) => {
      console.error('Error renaming file:', error);
    });
  }, [token, refetch]);



  const handleDelete = useCallback((path: string) => {
    setFileToDelete(path);
    setDeleteComfirmDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback((path: string) => {
    fetch(`/api/delete?path=${encodeURIComponent(path)}${token ? `&token=${token}` : ''}`, {
      method: 'DELETE',
    }).then(() => {
      setFileToDelete('');
      setDeleteComfirmDialogOpen(false);
      refetch();
    }).catch((error) => {
      console.error('Error deleting file:', error);
    });
  }, [token, refetch]);

  const handleDeleteCancel = useCallback(() => {
    setFileToDelete('');
    setDeleteComfirmDialogOpen(false);
  }, []);

  const handleDeleteMultiple = useCallback((paths: string[]) => {
    setFilesToDelete(paths);
    setDeleteMultipleDialogOpen(true);
  }, []);

  const handleDeleteMultipleConfirm = useCallback((paths: string[]) => {
    fetch(`/api/delete?paths=${encodeURIComponent(paths.join('|'))}${token ? `&token=${token}` : ''}`, {
      method: 'DELETE',
    }).then(() => {
      setFilesToDelete([]);
      setDeleteMultipleDialogOpen(false);
      refetch();
    }).catch((error) => {
      console.error('Error deleting files:', error);
    });
  }, [token, refetch]);

  const handleDeleteMultipleCancel = useCallback(() => {
    setSelectedFiles([]);
    setDeleteMultipleDialogOpen(false);
  }, []);



  const handleCopy = useCallback((path: string) => {
    setFilesToClone([path]);
  }, []);

  const handleCopyMultiple = useCallback((paths: string[]) => {
    setFilesToClone(paths);
  }, []);

  const handlePasteConfirm = useCallback((destinationPath: string) => {
    cloneTimerRef.current && clearTimeout(cloneTimerRef.current);
    fetch(`/api/clone${token ? `?token=${token}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sources: filesToClone,
        destination: destinationPath
      })
    }).then(() => {
      setCloneComfirmDialogOpen(false);
      setFilesToClone([]);
      refetch();
    }).catch((error) => {
      console.error('Error pasting files:', error);
    });
  }, [filesToClone, token, refetch]);

  const handlePasteCancel = useCallback(() => {
    setCloneComfirmDialogOpen(false);
  }, []);



  const handleMoveFrom = useCallback((path: string) => {
    setFilesToMove([path]);
  }, []);

  const handleMoveFromMultiple = useCallback((paths: string[]) => {
    setFilesToMove(paths);
  }, []);

  const handleMoveHereComfirm = useCallback((destinationPath: string) => {
    moveTimerRef.current && clearTimeout(moveTimerRef.current);
    fetch(`/api/move${token ? `?token=${token}` : ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sources: filesToMove,
        destination: destinationPath
      })
    }).then(() => {
      setMoveComfirmDialogOpen(false);
      setFilesToMove([]);
      refetch();
    }).catch((error) => {
      console.error('Error moving files:', error);
    });
  }, [filesToMove, token, refetch]);

  const handleMoveHereCancel = useCallback(() => {
    setMoveComfirmDialogOpen(false)
  }, []);


  const handleVirtualizedScroll = ({ scrollOffset, scrollTop }: any) => {
    const currentScroll = scrollTop ?? scrollOffset ?? 0;
    scrollPosition.current = currentScroll;
    setShowScrollTop(currentScroll > 100);
  };

  const handleShowDetails = useCallback((file: FileData) => {
    setFileToShowDetails(file);
    setDetailsDialogOpen(true);
  }, []);


  // intercept history navigation methods
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

  // update viewModeRef when viewMode changes
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // listen for browser back/forward buttons
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

  // update activeScrollRef when viewMode changes
  useEffect(() => {
    switch (viewMode) {
      case 'list':
        activeScrollRef.current = listRef.current;
        break;
      case 'grid':
        activeScrollRef.current = gridRef.current;
        break;
      case 'image':
        activeScrollRef.current = imageGridRef.current;
        break;
      case 'imageOnly':
        if (useMasonry) {
          activeScrollRef.current = masonryRef.current;
        } else {
          activeScrollRef.current = imageGridRef.current;
        }
        break;
      default:
        activeScrollRef.current = null;
    }
  }, [viewMode, useMasonry]);

  // add a manual scroll listener for masonry view, since it doesn't use react-window
  useEffect(() => {
    if (viewMode === 'imageOnly' && useMasonry && masonryRef.current) {
      const masonryElement = masonryRef.current;

      const handleMasonryScroll = () => {
        scrollPosition.current = masonryElement.scrollTop;
        setShowScrollTop(masonryElement.scrollTop > 100);
      };

      masonryElement.addEventListener('scroll', handleMasonryScroll);
      return () => {
        masonryElement.removeEventListener('scroll', handleMasonryScroll);
      };
    }
  }, [viewMode, useMasonry, masonryRef.current]);

  // close preview when currentPath or searchQuery changes
  useEffect(() => {
    closePreview();
  }, [currentPath, searchQuery])

  const isError = (viewMode === 'imageOnly') ? imagesError :
    (isSearching) ? searchError : errorFiles;

  const isLoading = (viewMode === 'imageOnly') ? imagesLoading :
    (isSearching) ? searchLoading : isLoadingFiles;

  const isNotFound = ((viewMode === 'imageOnly') ? imagesData?.images.length === 0 :
    (isSearching) ? searchData?.results.length === 0 : filesData?.files.length === 0) && !isLoading && !isError;



  const renderList = useCallback(({ height, width }: { height: number; width: number }) => (
    <List
      ref={listRef}
      height={height}
      width={width + 10}
      itemCount={sortedFiles.length}
      itemSize={48}
      overscanCount={20}
      itemData={{
        files: sortedFiles,
        selectedFiles,
        isSelecting,
        isSearching,
        onFileClick: handleFileClick,
        onCopy: handleCopy,
        onCut: handleMoveFrom,
        onDownload: handleDownload,
        onDelete: handleDelete,
        onShowDetails: handleShowDetails
      }}
      className="custom-scrollbar"
      onScroll={handleVirtualizedScroll}
    >
      {FileRow}
    </List>
  ), [sortedFiles, selectedFiles, isSelecting, isSearching, handleFileClick, handleDownload, handleDelete, handleShowDetails]);

  const renderGrid = useCallback(({ height, width }: { height: number; width: number }) => {
    const columnCount = getColumnCount(width);
    const rowCount = Math.ceil(sortedFiles.length / columnCount);
    const cellWidth = width / columnCount;
    const cellHeight = cellWidth;

    return (
      <Grid
        ref={gridRef}
        height={height}
        width={width + 10}
        columnCount={columnCount}
        rowCount={rowCount}
        columnWidth={cellWidth}
        rowHeight={cellHeight}
        overscanRowCount={10}
        overscanColumnCount={5}
        itemData={{
          files: sortedFiles,
          selectedFiles,
          isSelecting,
          columnCount,
          onFileClick: handleFileClick,
          onCopy: handleCopy,
          onCut: handleMoveFrom,
          onDownload: handleDownload,
          onDelete: handleDelete,
          onShowDetails: handleShowDetails
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
      >
        {FileCell}
      </Grid>
    );
  }, [sortedFiles, selectedFiles, isSelecting, getColumnCount, handleFileClick, handleDownload, handleDelete, handleShowDetails]);

  const renderImageGrid = useCallback(({ height, width }: { height: number; width: number }) => {
    const columnCount = getColumnCount(width);
    const rowCount = Math.ceil(sortedFiles.length / columnCount);
    const cellWidth = width / columnCount;
    const cellHeight = cellWidth;

    return (
      <Grid
        ref={imageGridRef}
        height={height}
        width={width + 10}
        columnCount={columnCount}
        rowCount={rowCount}
        columnWidth={cellWidth}
        rowHeight={cellHeight}
        overscanRowCount={10}
        overscanColumnCount={5}
        itemData={{
          files: sortedFiles,
          selectedFiles,
          isSelecting,
          columnCount,
          onFileClick: handleFileClick,
          onCopy: handleCopy,
          onCut: handleMoveFrom,
          onDownload: handleDownload,
          onDelete: handleDelete,
          onShowDetails: handleShowDetails,
          token: token || undefined
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
      >
        {ImageCell}
      </Grid>
    );
  }, [sortedFiles, selectedFiles, isSelecting, getColumnCount, handleFileClick, handleDownload, handleDelete, handleShowDetails]);

  const renderMasonry = useCallback(({ height, width }: { height: number; width: number }) => {
    const columnCount = getColumnCount(width);
    const columnWidth = width / columnCount;

    // Array of column indices
    const columns = Array.from({ length: columnCount }, (_, i) => i);

    return (
      <div
        ref={masonryRef}
        style={{ height, width, position: 'relative', overflowY: 'auto' }}
        className="custom-scrollbar"
      >
        {columns.map(index => (
          <MasonryCell
            key={index}
            index={index}
            style={{}}
            data={{
              files: sortedFiles,
              selectedFiles,
              isSelecting,
              columnCount,
              columnWidth,
              direction: gridDirection,
              onFileClick: handleFileClick,
              onCopy: handleCopy,
              onCut: handleMoveFrom,
              onDownload: handleDownload,
              onDelete: handleDelete,
              onShowDetails: handleShowDetails,
              token: token || undefined
            }}
          />
        ))}
      </div>
    );
  }, [useMasonry, gridDirection, sortedFiles, selectedFiles, isSelecting, getColumnCount, handleFileClick, handleDownload, handleDelete, handleShowDetails]);




  return (
    <main className="container mx-auto min-h-screen flex flex-col p-4 pb-8">
      <header className="flex flex-wrap justify-between mb-2 gap-1">
        <div className="flex-1 order-1 flex gap-1 justify-start">
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
              "transition-colors duration-200",
              "max-sm:hidden"
            )}
          >
            <Upload size={18} />
          </Button>
          {useFileIndex && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowIndexDialog(true)}
              className={cn(
                "text-black",
                "bg-white hover:bg-white/80",
                "transition-colors duration-200",
                "max-sm:hidden"
              )}
            >
              <Database size={18} />
            </Button>
          )}
          {useFileWatcher && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowWatcherDialog(true)}
              className={cn(
                "text-black",
                "bg-white hover:bg-white/80",
                "transition-colors duration-200",
                "max-sm:hidden"
              )}
            >
              <Eye size={18} />
            </Button>
          )}
        </div>

        <form onSubmit={handleSearch} className="flex-1 order-3 max-sm:min-w-[300px] max-sm:w-full sm:max-w-sm flex gap-1 justify-center">
          <Input
            name="searchQuery"
            placeholder="Search files..."
            defaultValue={searchQuery}
            className={cn(
              "w-full",
              "text-white",
              "selection:bg-white selection:text-black"
            )}
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search size={18} />
          </Button>
          {isSearching && (
            <Button type="button" variant="secondary" size="icon" className="text-red-500" onClick={handleClearSearch}>
              <X size={18} />
            </Button>
          )}
        </form>

        <div className="flex-1 order-2 sm:order-4 flex gap-1 justify-end">
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
            <ListIcon size={18} />
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

          <div className="flex items-center">
            {isAuthenticated ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <User className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <User className="w-4 h-4 mr-2" />
                      {username} ({permissions})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsLoginDialogOpen(true)}
                title="Login"
              >
                <LogIn className="w-4 h-4" />
              </Button>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="sm:hidden">
                <MoreHorizontal size={18} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1 sm:hidden">
              <div className="grid gap-1">
                {/* <Button variant="outline" size="sm" className="justify-start" onClick={() => setViewMode('list')}>
                  <ListIcon size={18} /> List View
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setViewMode('grid')}>
                  <Grid3x3 size={18} /> Grid View
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setViewMode('image')}>
                  <ImageIcon size={18} /> Image View
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setViewMode('imageOnly')}>
                  <ImageIcon size={18} /> Image Only
                </Button> */}
                <Button variant="outline" size="sm" className="justify-start" onClick={() => handleUpload()}>
                  <Upload size={18} /> Upload Files
                </Button>
                {useFileIndex && <Button variant="outline" size="sm" className="justify-start" onClick={() => setShowIndexDialog(true)}>
                  <Database size={18} /> Index Settings
                </Button>}
                {useFileWatcher && <Button variant="outline" size="sm" className="justify-start" onClick={() => setShowWatcherDialog(true)}>
                  <Eye size={18} /> Watcher Settings
                </Button>}
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setUseFileIndex(!useFileIndex)}>
                  <TestTube2 size={18} /> {useFileIndex ? 'Disable Index' : 'Enable Index'}
                </Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => setUseFileWatcher(!useFileWatcher)}>
                  <TestTube2 size={18} /> {useFileWatcher ? 'Disable Watcher' : 'Enable Watcher'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

      </header>

      <div className="flex justify-between gap-1">
        {!isSelecting ? (
          <nav ref={navRef} className="flex-1 mb-2">
            {isSearching ? (
              <div className="bg-muted p-1 rounded-md text-sm">
                Searching: "{searchQuery}" in {currentPath || 'root'}
              </div>
            ) : (
              <div className="bg-muted p-1 rounded-md text-sm flex flex-wrap items-center overflow-x-auto whitespace-nowrap">
                <BreadcrumbNav
                  currentPath={currentPath}
                  onNavigate={navigateTo}
                  showRootIcon
                  onRootClick={goHome}
                />
              </div>
            )}
          </nav>
        ) : (
          <div className="h-9 flex-1 mb-2 bg-muted px-4 py-1 rounded-md flex justify-between items-center gap-1">
            <span className="text-sm">
              {selectedFiles.length} files selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { handleMoveFromMultiple(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
              >
                <Scissors size={18} />
                <span className="text-sm max-sm:hidden">Cut</span>
              </button>
              <button
                onClick={() => { handleCopyMultiple(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
              >
                <ClipboardCopy size={18} />
                <span className="text-sm max-sm:hidden">Copy</span>
              </button>
              <button
                onClick={() => { handleDownloadMultiple2(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
              >
                <Download size={18} />
                <span className="text-sm max-sm:hidden">Download</span>
              </button>
              <button
                onClick={() => { handleDeleteMultiple(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-red-500 hover:text-red-600"
              >
                <Trash2 size={18} />
                <span className="text-sm max-sm:hidden">Delete</span>
              </button>
              <button onClick={handleInvertSelection} className="flex items-center gap-1 hover:text-gray-500">
                <ArrowLeftRight size={18} />
                <span className="text-sm max-sm:hidden">Invert</span>
              </button>
              <button onClick={handleSelectAll} className="flex items-center gap-1 text-green-500 hover:text-green-600">
                <Check size={18} />
                <span className="text-sm max-sm:hidden">Select All</span>
              </button>
              <button onClick={handleClearSelection} className="flex items-center gap-1 text-red-500 hover:text-red-600">
                <X size={18} />
                <span className="text-sm max-sm:hidden">Clear</span>
              </button>
            </div>
          </div>
        )}
        {!isSelecting ? (
          <Button variant="outline" size="icon" onClick={() => setIsSelecting(true)}>
            <CircleCheck size={18} />
          </Button>
        ) : (
          <Button variant="outline" size="icon" onClick={() => {
            setIsSelecting(false);
            setSelectedFiles([]);
          }}>
            <CircleX size={18} />
          </Button>
        )}
      </div>

      {!isAuthenticated && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-sm text-muted-foreground">
            Please login to continue
          </div>
        </div>
      )}

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
      ) : null}

      {viewMode === 'imageOnly' ? (
        <div className="flex justify-center text-sm text-muted-foreground mb-1">
          {imagesData?.images.length} images found in {currentPath}
        </div>
      ): (
        <div className="flex justify-center text-sm text-muted-foreground mb-1">
          {sortedFiles.length} files found
        </div>
      )}

      {(isAuthenticated && !isLoading && !isError && !isNotFound) && (
        <>
          {/* List view */}
          {viewMode === 'list' && (
            <div className="w-full h-[calc(100vh-250px)]">
              <AutoSizer>
                {renderList}
              </AutoSizer>
            </div>
          )}
          {/* Grid view */}
          {viewMode === 'grid' && (
            <div className="w-full h-[calc(100vh-250px)]">
              <AutoSizer>
                {renderGrid}
              </AutoSizer>
            </div>
          )}
          {/* Image view */}
          {viewMode === 'image' && (
            <div className="w-full h-[calc(100vh-250px)]">
              <AutoSizer>
                {renderImageGrid}
              </AutoSizer>
            </div>
          )}
          {/* Image Only view */}
          {viewMode === 'imageOnly' && !useMasonry && (
            <div className="w-full h-[calc(100vh-250px)]">
              <AutoSizer>
                {renderImageGrid}
              </AutoSizer>
            </div>
          )}
          {/* Masonry view */}
          {viewMode === 'imageOnly' && useMasonry && (
            <div className="w-full h-[calc(100vh-250px)]">
              <AutoSizer>
                {renderMasonry}
              </AutoSizer>
            </div>
          )}
        </>
      )}

      {/* Preview Overlay */}
      {preview.isOpen && (
        <>
          {/* Image preview */}
          {preview.type === 'image' && (
            <ImagePreview
              isOpen={preview.isOpen}
              title={viewMode === 'imageOnly' ? preview.path : preview.path.split('/').pop()}
              src={`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
                onNext: () => navigatePreview('next'),
                onPrev: () => navigatePreview('prev'),
              }}
            />
          )}

          {/* Video preview */}
          {preview.type === 'video' && (
            <VideoPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
                onNext: () => navigatePreview('next'),
                onPrev: () => navigatePreview('prev'),
              }}
            />
          )}

          {/* Audio preview */}
          {preview.type === 'audio' && (
            <AudioPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
                onNext: () => navigatePreview('next'),
                onPrev: () => navigatePreview('prev'),
              }}
            />
          )}

          {/* Text preview */}
          {(preview.type === 'text') && (
            <TextPreview
              isOpen={preview.isOpen}
              fileName={preview.path.split('/').pop()}
              fileExtension={getFileExtension(preview.path)}
              content={previewContent}
              isLoading={contentLoading}
              hasError={!!contentError}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
              }}
            />
          )}

          {/* PDF preview */}
          {preview.type === 'pdf' && (
            <PDFPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
              }}
            />
          )}

          {/* Comic preview */}
          {preview.type === 'comic' && (
            <ComicPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/comic?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onNext: () => navigatePreview('next'),
                onPrev: () => navigatePreview('prev'),
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
              }}
            />
          )}

          {preview.type === 'epub' && (
            <EPUBPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`}
              controls={{
                onClose: closePreview,
                onDownload: () => window.open(`/api/raw?path=${encodeURIComponent(preview.path)}${token ? `&token=${token}` : ''}`, '_blank'),
              }}
            />
          )}
        </>
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

      {/* Paste here button */}
      {filesToClone.length > 0 && <button
        onClick={() => setCloneComfirmDialogOpen(true)}
        className={cn(
          getButtonStyles(
            (filesToMove.length === 0 ? 0 : 1) +
            (viewMode === 'imageOnly' ? 1 : 0) +
            (showScrollTop ? 1 : 0) +
            (uploadFiles.length === 0 ? 0 : 1) +
            (downloadFiles.length === 0 ? 0 : 1),
            5
          ),
        )}
        aria-label="Paste here"
      >
        <ClipboardPaste size={18} />
      </button>}

      {/* Move here button */}
      {filesToMove.length > 0 && <button
        onClick={() => setMoveComfirmDialogOpen(true)}
        className={cn(
          getButtonStyles(
            (viewMode === 'imageOnly' ? 1 : 0) +
            (showScrollTop ? 1 : 0) +
            (uploadFiles.length === 0 ? 0 : 1) +
            (downloadFiles.length === 0 ? 0 : 1),
            4
          ),
        )}
        aria-label="Move here"
      >
        <MoveHorizontal size={18} />
      </button>}

      {/* Masonry toggle button - only visible in imageOnly mode */}
      {viewMode === 'imageOnly' && <button
        onClick={() => setUseMasonry(!useMasonry)}
        className={cn(
          getButtonStyles(
            (showScrollTop ? 1 : 0) +
            (uploadFiles.length === 0 ? 0 : 1) +
            (downloadFiles.length === 0 ? 0 : 1),
            3
          ),
          useMasonry && "bg-white/50 hover:bg-white/70 text-black",
        )}
        aria-label="Toggle masonry layout"
      >
        <Layout size={24} />
      </button>}

      {/* Scroll to top button */}
      {showScrollTop && <button
        onClick={scrollToTop}
        className={cn(
          getButtonStyles(
            (uploadFiles.length === 0 ? 0 : 1) +
            (downloadFiles.length === 0 ? 0 : 1),
            2
          ),
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>}

      {/* Upload status buttons */}
      {uploadFiles.length > 0 && <button
        onClick={() => setShowUploadDialog(true)}
        className={cn(
          getButtonStyles(
            (downloadFiles.length === 0 ? 0 : 1),
            1
          ),
        )}
        aria-label="Show upload progress"
      >
        <Upload size={20} />
      </button>}

      {/* Download status buttons */}
      {downloadFiles.length > 0 && <button
        onClick={() => setShowDownloadDialog(true)}
        className={cn(
          "fixed",
          getButtonStyles(
            (uploadFiles.length === 0 ? 0 : 1),
            0
          ),
        )}
        aria-label="Show download progress"
      >
        <Download size={20} />
      </button>}

      {/* Upload dialog */}
      <UploadDialog
        open={showUploadDialog}
        setOpen={setShowUploadDialog}
        files={uploadFiles}
        onCancel={cancelUpload}
        onCancelAll={cancelAllUploads}
        removeTask={removeUploadTask}
      />

      {/* Download dialog */}
      <DownloadDialog
        open={showDownloadDialog}
        setOpen={setShowDownloadDialog}
        files={downloadFiles}
        onCancel={cancelDownload}
        onCancelAll={cancelAllDownloads}
        removeTask={removeDownloadTask}
      />

      {/* Details dialog */}
      {fileToShowDetails && (
        <DetailsDialog
          open={detailsDialogOpen}
          setOpen={setDetailsDialogOpen}
          file={fileToShowDetails}
        />
      )}

      {/* Download confirm dialog */}
      <ConfirmDialog
        open={downloadComfirmDialogOpen}
        setOpen={setDownloadComfirmDialogOpen}
        title="Download"
        description="This type of file is not supported, do you want to download it?"
        confirmText="Download"
        cancelText="Cancel"
        onConfirm={() => {
          // window.open(`/api/raw?path=${encodeURIComponent(fileToDownload)}${token ? `&token=${token}` : ''}`, '_blank');
          handleDownload(fileToDownload);
          setFileToDownload('');
          setDownloadComfirmDialogOpen(false);
        }}
        onCancel={() => {
          setFileToDownload('');
          setDownloadComfirmDialogOpen(false);
        }}
      />

      {/* Download multiple files dialog */}
      <ConfirmDialog
        open={downloadMultipleDialogOpen}
        setOpen={setDownloadMultipleDialogOpen}
        title="Download"
        description={`Are you sure you want to download ${selectedFiles.length} files?`}
        confirmText="Download"
        cancelText="Cancel"
        onConfirm={() => {
          handleDownloadMultiple2(selectedFiles);
          setSelectedFiles([]);
          setDownloadMultipleDialogOpen(false);
        }}
        onCancel={() => {
          setSelectedFiles([]);
          setDownloadMultipleDialogOpen(false);
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
        onConfirm={() => handleDeleteConfirm(fileToDelete)}
        onCancel={handleDeleteCancel}
      />

      {/* Delete multiple files dialog */}
      <ConfirmDialog
        open={deleteMultipleDialogOpen}
        setOpen={setDeleteMultipleDialogOpen}
        title="Delete"
        description={`Are you sure you want to delete ${filesToDelete.length} files?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleDeleteMultipleConfirm(filesToDelete)}
        onCancel={handleDeleteMultipleCancel}
      />

      {/* Paste here dialog */}
      <ConfirmDialog
        open={cloneComfirmDialogOpen}
        setOpen={setCloneComfirmDialogOpen}
        title="Paste here"
        description="Are you sure you want to paste these files here?"
        confirmText="Paste"
        cancelText="Cancel"
        onConfirm={() => handlePasteConfirm(currentPath)}
        onCancel={handlePasteCancel}
      />

      {/* Move here dialog */}
      <ConfirmDialog
        open={moveComfirmDialogOpen}
        setOpen={setMoveComfirmDialogOpen}
        title="Move here"
        description="Are you sure you want to move these files here?"
        confirmText="Move"
        cancelText="Cancel"
        onConfirm={() => handleMoveHereComfirm(currentPath)}
        onCancel={handleMoveHereCancel}
      />

      {/* Index settings dialog */}
      <IndexSettingsDialog
        open={showIndexDialog}
        setOpen={setShowIndexDialog}
      />

      {/* Watcher settings dialog */}
      <WatcherSettingsDialog
        open={showWatcherDialog}
        setOpen={setShowWatcherDialog}
      />
      {/* Login dialog */}
      <LoginDialog
        open={isLoginDialogOpen}
        setOpen={setIsLoginDialogOpen}
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