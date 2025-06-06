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
  CircleCheck, CircleX, ArrowLeftRight, RefreshCcw, FolderUp, FolderPlus, CheckCheck,
  Loader2
} from "lucide-react";

import { BreadcrumbNav } from "@/components/nav";
import { FloatingButtons, FloatingButton } from "@/components/button";
import { Error, Loading, NotFound } from "@/components/status";
import { FileItemListView, FileItemGridView, ImageItem, VideoItem } from "@/components/fileItem";
import { ImagePreview, VideoPreview, AudioPreview, TextPreview, ComicPreview, EPUBPreview, PDFPreview } from "@/components/preview";
import {
  ConfirmDialog, DetailsDialog, DownloadDialog, UploadDialog,
  IndexSettingsDialog, WatcherSettingsDialog, LoginDialog, InputDialog
} from "@/components/dialog";

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
    onQuickSelect: (path: string) => void;
    onRename: (path: string) => void;
  };
}

const FileRow = React.memo(({ index, style, data }: FileRowProps) => {
  const { files, selectedFiles, isSelecting, isSearching, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, onQuickSelect, onRename } = data;
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
          <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
            <Check className="mr-2" size={16} />
            Select
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRename(file.path)}>
            <Edit className="mr-2" size={16} />
            Rename
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
    onQuickSelect: (path: string) => void;
    onRename: (path: string) => void;
  };
}

const FileCell = React.memo(({ columnIndex, rowIndex, style, data }: FileCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, onQuickSelect, onRename } = data;
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
          <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
            <Check className="mr-2" size={16} />
            Select
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRename(file.path)}>
            <Edit className="mr-2" size={16} />
            Rename
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
    onQuickSelect: (path: string) => void;
    onRename: (path: string) => void;
    token?: string;
  };
}

const ImageCell = React.memo(({ columnIndex, rowIndex, style, data }: ImageCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, onQuickSelect, onRename, token } = data;
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
            <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
              <Check className="mr-2" size={16} />
              Select
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRename(file.path)}>
              <Edit className="mr-2" size={16} />
              Rename
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
            <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
              <Check className="mr-2" size={16} />
              Select
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRename(file.path)}>
              <Edit className="mr-2" size={16} />
              Rename
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
            <ContextMenuItem onClick={() => onShowDetails(file)}>
              <Info className="mr-2" size={16} />
              Details
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
              <Check className="mr-2" size={16} />
              Select
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRename(file.path)}>
              <Edit className="mr-2" size={16} />
              Rename
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
    onQuickSelect: (path: string) => void;
    onRename: (path: string) => void;
    token?: string;
  };
}

const MasonryCell = React.memo(({ index, style, data }: MasonryCellProps) => {
  const { files, selectedFiles, isSelecting, columnCount, columnWidth, direction, onFileClick, onCopy, onCut, onDownload, onDelete, onShowDetails, onQuickSelect, onRename, token } = data;
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
                disablePreview={true}
              />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onShowDetails(file)}>
                <Info className="mr-2" size={16} />
                Details
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onQuickSelect(file.path)}>
                <Check className="mr-2" size={16} />
                Select
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onRename(file.path)}>
                <Edit className="mr-2" size={16} />
                Rename
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
  const { isAuthenticated, isCheckingAuth, username, permissions, logout, token } = useAuth();
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !isCheckingAuth) {
      setIsLoginDialogOpen(true);
    }
  }, [isAuthenticated, isCheckingAuth]);

  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPath = searchParams.get('p') || '';
  const searchQuery = searchParams.get('q') || '';
  const isSearching = !!searchQuery;
  const canGoBack = currentPath !== '' || isSearching;

  const [isImageOnlyMode, setIsImageOnlyModeTemp] = useState(false);
  const setIsImageOnlyMode = (mode: boolean) => {
    if (isSearching && mode) {
      // Can't use image-only mode with search
      return;
    }
    setIsImageOnlyModeTemp(mode);
  }
  const isImageOnlyModeRef = useRef(isImageOnlyMode);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const isSelectingRef = useRef(isSelecting);

  const [fileToRename, setFileToRename] = useState('');
  const [renameInputDialogOpen, setRenameInputDialogOpen] = useState(false);

  const [mkdirInputDialogOpen, setMkdirInputDialogOpen] = useState(false);

  const [fileToDownload, setFileToDownload] = useState('');
  const [downloadComfirmDialogOpen, setDownloadComfirmDialogOpen] = useState(false);
  const [downloadMultipleDialogOpen, setDownloadMultipleDialogOpen] = useState(false);

  const [fileToDelete, setFileToDelete] = useState('');
  const [deleteComfirmDialogOpen, setDeleteComfirmDialogOpen] = useState(false);
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false);

  const [filesToClone, setFilesToClone] = useState<string[]>([]);
  const [cloneComfirmDialogOpen, setCloneComfirmDialogOpen] = useState(false);

  const [filesToMove, setFilesToMove] = useState<string[]>([]);
  const [moveComfirmDialogOpen, setMoveComfirmDialogOpen] = useState(false);

  const [fileToShowDetails, setFileToShowDetails] = useState<FileData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'image'>('list');
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


  // Pagination state
  const [usePagination, setUsePagination] = useState(true);
  const [page, setPage] = useState(1);
  const pageRef = useRef(page);
  const [accumulatedFiles, setAccumulatedFiles] = useState<FileData[]>([]);
  const [isUpdatingAccumulated, setIsUpdatingAccumulated] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Page size for API requests
  const PAGE_SIZE = 500;
  // Buffer to trigger next page load before reaching the end
  const SCROLL_BUFFER = 10;

  const [isChangingPath, setIsChangingPath] = useState(false);


  const { data: filesExplorerData, isLoading: isLoadingData, error: errorData, refetch: refetchData, isRefetching: isRefetchingData } = useQuery({
    queryKey: ['fileExplorer', currentPath, searchQuery, isImageOnlyMode, page, showDirectoryCovers, usePagination],
    queryFn: async () => {
      if (!isAuthenticated) {
        return { files: [], hasMore: false, total: 0 };
      }

      let response;

      if (isSearching && searchQuery.length > 0) {
        // Search mode
        response = await axios.get('/api/search', {
          params: usePagination ? {
            query: searchQuery,
            dir: currentPath,
            page: page,
            limit: PAGE_SIZE
          } : {
            query: searchQuery,
            dir: currentPath,
          }
        });
        return {
          files: response.data.results,
          hasMore: response.data.hasMore,
          total: response.data.total || response.data.results?.length || 0
        };
      } else if (isImageOnlyMode) {
        // Image mode
        response = await axios.get('/api/images', {
          params: usePagination ? {
            dir: currentPath,
            page: page,
            limit: PAGE_SIZE
          } : {
            dir: currentPath,
          }
        });
        return {
          files: response.data.images,
          hasMore: response.data.hasMore,
          total: response.data.total || response.data.images?.length || 0
        };
      } else {
        // Default files mode
        response = await axios.get('/api/files', {
          params: usePagination ? {
            dir: currentPath,
            cover: showDirectoryCovers ? 'true' : 'false',
            page: page,
            limit: PAGE_SIZE,
          } : {
            dir: currentPath,
            cover: showDirectoryCovers ? 'true' : 'false',
          }
        });
        return {
          files: response.data.files,
          hasMore: response.data.hasMore,
          total: response.data.total || response.data.files?.length || 0
        };
      }
    },
    enabled: isAuthenticated,
  });

  // Add a delay before showing loading indicator
  useEffect(() => {
    if (isLoadingData || isRefetchingData) {
      // Set a timer to show loading indicator after 300ms
      loadingTimerRef.current = setTimeout(() => {
        setShowLoadingIndicator(true);
      }, 300);
    } else {
      // Clear timer and hide loading indicator when loading is complete
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setShowLoadingIndicator(false);
    }

    return () => {
      // Clean up timer on unmount
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [isLoadingData, isRefetchingData]);

  // Handle paginated data updates
  useEffect(() => {
    if (!filesExplorerData || isRefetchingData) return;
    setIsUpdatingAccumulated(true);

    // For paginated views
    if (page === 1) {
      setAccumulatedFiles(filesExplorerData.files || []);
    } else {
      setAccumulatedFiles(prev => [...prev, ...(filesExplorerData.files || [])]);
    }
    setHasMoreFiles(filesExplorerData.hasMore || false);
    setTotalFiles(filesExplorerData.total || filesExplorerData.files?.length || 0);

    // Reset loading flag when data is loaded
    setIsLoadingMore(false);
    setIsUpdatingAccumulated(false);
    setIsChangingPath(false);
  }, [filesExplorerData, isRefetchingData, page, currentPath, searchQuery]);

  const _isLoading = isLoadingData || isUpdatingAccumulated || isChangingPath;
  const isLoading = showLoadingIndicator && _isLoading;
  const isError = errorData;
  const isNotFound = !_isLoading && !isError && totalFiles === 0;

  const { data: previewContent, isLoading: contentLoading, error: contentError, refetch: refetchPreviewContent } = useQuery({
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
    if (isImageOnlyMode && sortBy === 'name') {
      return [...accumulatedFiles].sort((a, b) => {
        const pathA = a.path.split('/').concat(a.name).join('/');
        const pathB = b.path.split('/').concat(b.name).join('/');
        return sortOrder === 'asc'
          ? pathA.localeCompare(pathB)
          : pathB.localeCompare(pathA);
      });
    }

    return [...accumulatedFiles].sort((a, b) => {
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
  }, [accumulatedFiles, sortBy, sortOrder]);



  const navigateTo = (path: string, query: string = '') => {

    if (path === currentPath && query === searchQuery) return;

    if (isImageOnlyMode) {
      setIsImageOnlyMode(false);
    }

    if (isSelecting) {
      setIsSelecting(false);
      setSelectedFiles([]);
    }

    // NOTE: It's not a good idea, but it works
    setIsChangingPath(true);

    setPage(1);
    setAccumulatedFiles([]);
    setTotalFiles(0);
    setHasMoreFiles(false);
    setIsLoadingMore(false);

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
      listRef.current?.scrollToItem(0, "start");
    } else if (viewMode === 'grid') {
      gridRef.current?.scrollToItem({ columnIndex: 0, rowIndex: 0, align: "start" });
    } else if (viewMode === 'image' && !(isImageOnlyMode && useMasonry)) {
      if (isImageOnlyMode && useMasonry) {
        masonryRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        imageGridRef.current?.scrollToItem({ columnIndex: 0, rowIndex: 0, align: "start" });
      }
    }
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

  const handleQuickSelect = useCallback((path: string) => {
    if (!isSelecting) {
      setIsSelecting(true);
    }

    if (selectedFiles.includes(path)) {
      setSelectedFiles(prev => prev.filter(file => file !== path));
    } else {
      setSelectedFiles(prev => [...prev, path]);
    }
  }, [isSelecting, selectedFiles]);



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

    if (isImageOnlyMode) {
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
  }, [openPreview, isSelecting, selectedFiles]);




  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isImageOnlyMode) {
      setIsImageOnlyMode(false);
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



  const handleShowDetails = useCallback((file: FileData) => {
    setFileToShowDetails(file);
    setDetailsDialogOpen(true);
  }, []);



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
              refetchData();
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

  const handleFolderUpload = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    // Set directory selection attributes
    // TypeScript doesn't recognize webkitdirectory by default
    (fileInput as any).webkitdirectory = true;
    (fileInput as any).directory = true; // For Firefox compatibility

    fileInput.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      // Prepare files for tracking with proper typing
      const uploadList = Array.from(files).map(file => {
        // Use webkitRelativePath for folder structure path if available
        const relativePath = (file as any).webkitRelativePath || file.name;

        return {
          id: generateUniqueId(),
          name: relativePath,
          size: file.size,
          progress: 0,
          status: 'pending' as const,
          file: file
        };
      });

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
              refetchData();
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
          xhr.open('POST', `/api/upload-folder?dir=${encodeURIComponent(currentPath)}${token ? `&token=${token}` : ''}`);
          xhr.send(formData);
        });
      }
    };

    fileInput.click();
  }

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

  const removeUploadTask = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };



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

  const removeDownloadTask = (fileId: string) => {
    setDownloadFiles(prev => prev.filter(f => f.id !== fileId));
  };



  const handleRename = useCallback((path: string) => {
    setFileToRename(path);
    setRenameInputDialogOpen(true);
  }, []);

  const handleRenameConfirm = useCallback((newName: string) => {
    fetch(`/api/rename?path=${encodeURIComponent(fileToRename)}&newName=${encodeURIComponent(newName)}${token ? `&token=${token}` : ''}`, {
      method: 'POST',
    }).then(() => {
      refetchData();
      setRenameInputDialogOpen(false);
    }).catch((error) => {
      console.error('Error renaming file:', error);
    });
  }, [token, refetchData, fileToRename]);

  const handleRenameCancel = useCallback(() => {
    setRenameInputDialogOpen(false);
  }, []);



  const handleMkdir = useCallback(() => {
    setMkdirInputDialogOpen(true);
  }, []);

  const handleMkdirConfirm = useCallback((path: string, name: string) => {
    fetch(`/api/mkdir?path=${encodeURIComponent(path)}&name=${encodeURIComponent(name)}${token ? `&token=${token}` : ''}`, {
      method: 'POST',
    }).then(() => {
      refetchData();
      setMkdirInputDialogOpen(false);
    }).catch((error) => {
      console.error('Error creating directory:', error);
    });
  }, [token, refetchData]);

  const handleMkdirCancel = useCallback(() => {
    setMkdirInputDialogOpen(false);
  }, []);



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
      refetchData();
    }).catch((error) => {
      console.error('Error deleting file:', error);
    });
  }, [token, refetchData]);

  const handleDeleteCancel = useCallback(() => {
    setFileToDelete('');
    setDeleteComfirmDialogOpen(false);
  }, []);

  const handleDeleteMultiple = useCallback((paths: string[]) => {
    setDeleteMultipleDialogOpen(true);
  }, []);

  const handleDeleteMultipleConfirm = useCallback((paths: string[]) => {
    fetch(`/api/delete?paths=${encodeURIComponent(paths.join('|'))}${token ? `&token=${token}` : ''}`, {
      method: 'DELETE',
    }).then(() => {
      setSelectedFiles([]);
      setIsSelecting(false);
      setDeleteMultipleDialogOpen(false);
      refetchData();
    }).catch((error) => {
      console.error('Error deleting files:', error);
    });
  }, [token, refetchData]);

  const handleDeleteMultipleCancel = useCallback(() => {
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
      refetchData();
    }).catch((error) => {
      console.error('Error pasting files:', error);
    });
  }, [filesToClone, token, refetchData]);

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
      refetchData();
    }).catch((error) => {
      console.error('Error moving files:', error);
    });
  }, [filesToMove, token, refetchData]);

  const handleMoveHereCancel = useCallback(() => {
    setMoveComfirmDialogOpen(false)
  }, []);



  const handleVirtualizedScroll = ({ scrollOffset, scrollTop }: any) => {
    const currentScroll = scrollTop ?? scrollOffset ?? 0;
    scrollPosition.current = currentScroll;
    setShowScrollTop(currentScroll > 100);

    // For lists and grids we rely on onItemsRendered instead
  };

  const loadNextPage = useCallback(() => {
    if (isLoadingMore || !hasMoreFiles) return;

    setIsLoadingMore(true);
    setPage(prevPage => prevPage + 1);
  }, [isLoadingMore, hasMoreFiles]);

  // Handle end of list detection to load more data
  const handleItemsRendered = useCallback(({ visibleStartIndex, visibleStopIndex }: { visibleStartIndex: number, visibleStopIndex: number }) => {
    const itemCount = sortedFiles.length;
    if (!isLoadingMore && hasMoreFiles && visibleStopIndex >= itemCount - SCROLL_BUFFER) {
      loadNextPage();
    }
  }, [sortedFiles.length, isLoadingMore, hasMoreFiles, loadNextPage]);



  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    isSelectingRef.current = isSelecting;
  }, [isSelecting]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    switch (viewMode) {
      case 'list':
        activeScrollRef.current = listRef.current;
        break;
      case 'grid':
        activeScrollRef.current = gridRef.current;
        break;
      case 'image':
        if (isImageOnlyMode && useMasonry) {
          activeScrollRef.current = masonryRef.current;
        } else {
          activeScrollRef.current = imageGridRef.current;
        }
        break;
      default:
        activeScrollRef.current = null;
    }
  }, [viewMode, isImageOnlyMode, useMasonry]);


  useEffect(() => {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    // Override pushState method
    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
      // Use ref instead of state directly
      if (isImageOnlyModeRef.current) {
        // Use setTimeout to move state update to next event loop
        setTimeout(() => {
          setIsImageOnlyMode(false);
        }, 0);
      }
      if (isSelectingRef.current) {
        setTimeout(() => {
          setIsSelecting(false);
          setSelectedFiles([]);
        }, 0);
      }
      if (pageRef.current !== 1) {
        setPage(1);
      }
      return originalPushState(data, unused, url);
    };

    // Override replaceState method
    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
      // Use ref instead of state directly
      if (isImageOnlyModeRef.current) {
        // Use setTimeout to move state update to next event loop
        setTimeout(() => {
          setIsImageOnlyMode(false);
        }, 0);
      }
      if (isSelectingRef.current) {
        setTimeout(() => {
          setIsSelecting(false);
          setSelectedFiles([]);
        }, 0);
      }
      if (pageRef.current !== 1) {
        setPage(1);
      }
      return originalReplaceState(data, unused, url);
    };

    return () => {
      // Restore original methods
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (isImageOnlyMode) {
        setIsImageOnlyMode(false);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isImageOnlyMode]);

  useEffect(() => {
    const handlePopState = () => {
      if (isSelectingRef.current) {
        setIsSelecting(false);
        setSelectedFiles([]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSelecting]);

  useEffect(() => {
    const handlePopState = () => {
      if (pageRef.current !== 1) {
        setPage(1);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [page])


  // add a manual scroll listener for masonry view, since it doesn't use react-window
  useEffect(() => {
    console.log('masonryRef.current', masonryRef.current);
    if (isImageOnlyMode && useMasonry && viewMode === 'image' && masonryRef.current) {
      const masonryElement = masonryRef.current;

      const handleMasonryScroll = () => {
        const scrollTop = masonryElement.scrollTop;
        const scrollHeight = masonryElement.scrollHeight;
        const clientHeight = masonryElement.clientHeight;

        scrollPosition.current = scrollTop;
        setShowScrollTop(scrollTop > 100);
        
        // Check if scrolled near the bottom (with 200px buffer)
        const scrollBuffer = 200;
        console.log(isLoadingMore, hasMoreFiles, scrollTop + clientHeight, scrollHeight - scrollBuffer);
        if (!isLoadingMore && hasMoreFiles && scrollTop + clientHeight >= scrollHeight - scrollBuffer) {
          loadNextPage();
        }
      };

      masonryElement.addEventListener('scroll', handleMasonryScroll);
      return () => {
        masonryElement.removeEventListener('scroll', handleMasonryScroll);
      };
    }
  }, [isImageOnlyMode, useMasonry, viewMode, isLoadingMore, hasMoreFiles, loadNextPage]);

  // close preview when currentPath or searchQuery changes
  useEffect(() => {
    closePreview();
  }, [currentPath, searchQuery])



  const renderList = useCallback(({ height, width }: { height: number; width: number }) => (
    <List
      ref={listRef}
      height={height}
      width={width}
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
        onShowDetails: handleShowDetails,
        onQuickSelect: handleQuickSelect,
        onRename: handleRename
      }}
      className="custom-scrollbar"
      onScroll={handleVirtualizedScroll}
      onItemsRendered={({ visibleStartIndex, visibleStopIndex }) => {
        const itemCount = sortedFiles.length;
        if (!isLoadingMore && hasMoreFiles && visibleStopIndex >= itemCount - SCROLL_BUFFER) {
          loadNextPage();
        }
      }}
    >
      {FileRow}
    </List>
  ),
    [sortedFiles, selectedFiles, isSelecting, isSearching, handleFileClick, handleDownload, handleDelete, handleShowDetails, handleQuickSelect, handleRename, handleItemsRendered]);

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
          onShowDetails: handleShowDetails,
          onQuickSelect: handleQuickSelect,
          onRename: handleRename
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
        onItemsRendered={({ visibleRowStartIndex, visibleRowStopIndex }) => {
          // Convert row indices to item indices for grid layout
          const visibleStartIndex = visibleRowStartIndex * columnCount;
          const visibleStopIndex = (visibleRowStopIndex + 1) * columnCount - 1;
          handleItemsRendered({ visibleStartIndex, visibleStopIndex });
        }}
      >
        {FileCell}
      </Grid>
    );
  }, [sortedFiles, selectedFiles, isSelecting, handleFileClick, handleDownload, handleDelete, handleShowDetails, handleQuickSelect, handleRename, handleItemsRendered]);

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
          onQuickSelect: handleQuickSelect,
          onRename: handleRename,
          token: token || undefined
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
        onItemsRendered={({ visibleRowStartIndex, visibleRowStopIndex }) => {
          // Convert row indices to item indices for grid layout
          const visibleStartIndex = visibleRowStartIndex * columnCount;
          const visibleStopIndex = (visibleRowStopIndex + 1) * columnCount - 1;
          handleItemsRendered({ visibleStartIndex, visibleStopIndex });
        }}
      >
        {ImageCell}
      </Grid>
    );
  }, [token, sortedFiles, selectedFiles, isSelecting, handleFileClick, handleDownload, handleDelete, handleShowDetails, handleQuickSelect, handleRename, handleItemsRendered]);

  const renderMasonry = useCallback(({ height, width }: { height: number; width: number }) => {
    const columnCount = getColumnCount(width);
    const columnWidth = width / columnCount;

    // Array of column indices
    const columns = Array.from({ length: columnCount }, (_, i) => i);

    return (
      <div
        ref={masonryRef}
        style={{ height, width: width + 10, position: 'relative', overflowY: 'auto' }}
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
              onQuickSelect: handleQuickSelect,
              onRename: handleRename,
              token: token || undefined
            }}
          />
        ))}
      </div>
    );
  }, [token, useMasonry, gridDirection, sortedFiles, selectedFiles, isSelecting, handleFileClick, handleDownload, handleDelete, handleShowDetails, handleQuickSelect, handleRename]);




  return (
    <main className="container mx-auto min-h-screen flex flex-col p-4 pb-8 gap-2">
      <header className="flex flex-col md:flex-row gap-1">

        <div className="w-full flex justify-between gap-1">
          <div className="flex-1 flex gap-1 justify-start">
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
            <Button
              variant="outline"
              size="icon"
              onClick={handleFolderUpload}
              className={cn(
                "text-black",
                "bg-white hover:bg-white/80",
                "transition-colors duration-200",
                "max-sm:hidden"
              )}
            >
              <FolderUp size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleMkdir}
              className={cn(
                "text-black",
                "bg-white hover:bg-white/80",
                "transition-colors duration-200",
                "max-sm:hidden"
              )}
            >
              <FolderPlus size={18} />
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchData()}
              className={cn(
                "group",
                "text-blue-700 hover:text-blue-800",
                "bg-white hover:bg-white/80",
                "transition-colors duration-200"
              )}
            >
              <RefreshCcw size={18} className="group-hover:animate-spin" />
            </Button>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-md:hidden max-w-sm flex gap-1 justify-center">
            <Input
              name="searchQuery"
              placeholder="Search files..."
              defaultValue={searchQuery}
              className={cn(
                "w-full",
                "backdrop-blur-sm",
                "text-white",
                "selection:bg-white selection:text-black",
                "focus-visible:ring-[1px]"
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

          <div className="flex-1 flex gap-1 justify-end">
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
              className="max-sm:hidden"
            >
              <ListIcon size={18} />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="max-sm:hidden"
            >
              <Grid3x3 size={18} />
            </Button>
            <Button
              variant={viewMode === 'image' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('image')}
              className="max-sm:hidden"
            >
              <ImageIcon size={18} />
            </Button>
            <Button
              variant={isImageOnlyMode ? 'default' : 'outline'}
              size="icon"
              onClick={() => setIsImageOnlyMode(!isImageOnlyMode)}
              className={cn(
                "max-sm:hidden",
                "text-yellow-500 hover:text-white hover:bg-yellow-500/20",
                isSearching && 'hidden',
                isImageOnlyMode && 'text-white bg-yellow-600/20 hover:bg-yellow-400/50'
              )}
            >
              <ImageIcon size={18} />
            </Button>

            <div className="flex items-center">
              {isCheckingAuth ? (
                <Button variant="outline" size="icon" disabled>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </Button>
              ) : isAuthenticated ? (
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
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsLoginDialogOpen(true)}
                  title="Login"
                  className="max-sm:hidden"
                >
                  <LogIn className="w-4 h-4" />
                </Button>
              )}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal size={18} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1">
                <div className="grid gap-1">
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setViewMode('list')}>
                    <ListIcon size={18} /> List View
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setViewMode('grid')}>
                    <Grid3x3 size={18} /> Grid View
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setViewMode('image')}>
                    <ImageIcon size={18} /> Image View
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setIsImageOnlyMode(true)}>
                    <ImageIcon size={18} className="text-yellow-500" /> Image Only
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => handleUpload()}>
                    <Upload size={18} /> Upload Files
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => handleFolderUpload()}>
                    <FolderUp size={18} /> Upload Folder
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={handleMkdir}>
                    <FolderPlus size={18} /> Create Directory
                  </Button>
                  {useFileIndex && <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setShowIndexDialog(true)}>
                    <Database size={18} /> Index Settings
                  </Button>}
                  {useFileWatcher && <Button variant="outline" size="sm" className="justify-start sm:hidden" onClick={() => setShowWatcherDialog(true)}>
                    <Eye size={18} /> Watcher Settings
                  </Button>}
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setUsePagination(!usePagination)}>
                    <TestTube2 size={18} /> {usePagination ? 'Disable Pagination' : 'Enable Pagination'}
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setUseMasonry(!useMasonry)}>
                    <TestTube2 size={18} /> {useMasonry ? 'Disable Masonry' : 'Enable Masonry'}
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setUseFileIndex(!useFileIndex)}>
                    <TestTube2 size={18} /> {useFileIndex ? 'Disable Index' : 'Enable Index'}
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setUseFileWatcher(!useFileWatcher)}>
                    <TestTube2 size={18} /> {useFileWatcher ? 'Disable Watcher' : 'Enable Watcher'}
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setShowDirectoryCovers(!showDirectoryCovers)}>
                    <TestTube2 size={18} /> {showDirectoryCovers ? 'Hide Directory Covers' : 'Show Directory Covers'}
                  </Button>
                  {/* <Button variant="outline" size="sm" className="justify-start" onClick={() => setGridDirection(gridDirection === 'ltr' ? 'rtl' : 'ltr')}>
                    <ArrowLeftRight size={18} /> Grid Direction: {gridDirection === 'ltr' ? 'LTR' : 'RTL'}
                  </Button> */}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex-1 md:hidden w-full flex gap-1 justify-center">
          <Input
            name="searchQuery"
            placeholder="Search files..."
            defaultValue={searchQuery}
            className={cn(
              "w-full",
              "backdrop-blur-sm",
              "text-white",
              "selection:bg-white selection:text-black",
              "focus-visible:ring-[1px]"
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

      </header>

      <div className="flex justify-between gap-1">
        {!isSelecting ? (
          <nav ref={navRef} className="flex-1">
            {isSearching ? (
              <div className="bg-muted p-1 rounded-md text-sm">
                Searching: "{searchQuery}" in {currentPath || 'root'}
              </div>
            ) : (
              <div className="bg-muted p-1 rounded-md">
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
          <div className="h-9 flex-1 bg-muted px-4 py-1 rounded-md flex justify-between items-center gap-1">
            <span className="text-sm">
              {selectedFiles.length} files selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { handleMoveFromMultiple(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-600"
              >
                <Scissors size={18} />
                <span className="text-sm max-sm:hidden">Cut</span>
              </button>
              <button
                onClick={() => { handleCopyMultiple(selectedFiles); setIsSelecting(false); setSelectedFiles([]) }}
                className="flex items-center gap-1 text-gray-500 hover:text-gray-600"
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
                onClick={() => { handleDeleteMultiple(selectedFiles) }}
                className="flex items-center gap-1 text-red-500 hover:text-red-600"
              >
                <Trash2 size={18} />
                <span className="text-sm max-sm:hidden">Delete</span>
              </button>
              <button onClick={handleInvertSelection} className="flex items-center gap-1 hover:text-gray-500">
                <ArrowLeftRight size={18} />
                <span className="text-sm max-sm:hidden">Invert</span>
              </button>
              <button onClick={handleSelectAll} className="flex items-center gap-1 text-green-700 hover:text-green-800">
                <CheckCheck size={18} />
                <span className="text-sm max-sm:hidden">Select All</span>
              </button>
              <button onClick={handleClearSelection} className="flex items-center gap-1 text-red-700 hover:text-red-800">
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

      <div className="relative w-full flex-1">
        {isCheckingAuth ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Loading message="Checking authentication..." />
          </div>
        ) : !isAuthenticated ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Error message="Please login to continue" />
          </div>
        ) : isError ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Error message="Error loading files. Please try again." />
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <Loading message="Loading files..." />
          </div>
        ) : isNotFound ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            <NotFound message="No files found" />
          </div>
        ) : null}

        <div className={cn(
          "absolute inset-0 backdrop-blur-xs hover:backdrop-blur-sm transition-all duration-300 rounded-md",
          (!isAuthenticated || isLoading || isError || isNotFound) && "opacity-0"
        )}>
          {viewMode === 'list' && (
            <AutoSizer>
              {renderList}
            </AutoSizer>
          )}
          {viewMode === 'grid' && (
            <AutoSizer>
              {renderGrid}
            </AutoSizer>
          )}
          {viewMode === 'image' && (
            <>
              {isImageOnlyMode && useMasonry ? (
                <AutoSizer>
                  {renderMasonry}
                </AutoSizer>
              ) : (
                <AutoSizer>
                  {renderImageGrid}
                </AutoSizer>
              )}
            </>
          )}
        </div>
      </div>

      {/* Show total files count with loaded count */}
      <div className={cn(
        "flex justify-center text-sm text-muted/70 select-none",
        (!isAuthenticated || _isLoading || isError || isNotFound) && "opacity-0"
      )}>
        {usePagination ?
          `${sortedFiles.length} of ${totalFiles} files loaded`
          :
          `${totalFiles} files found`
        }
      </div>


      {/* Preview Overlay */}
      {preview.isOpen && (
        <>
          {/* Image preview */}
          {preview.type === 'image' && (
            <ImagePreview
              isOpen={preview.isOpen}
              title={isImageOnlyMode ? preview.path : preview.path.split('/').pop()}
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

      <Separator />
      <footer className="flex justify-center items-center">
        <p className="text-sm text-muted-foreground font-bold font-mono">
          Developed by <a href="https://github.com/Kobayashi2003" className="underline">Kobayashi2003</a>
        </p>
        <span className="mx-2">•</span>
        <a href="https://github.com/Kobayashi2003" className="rounded-full overflow-hidden">
          <img src="github_icon.png" alt="GitHub" className="w-4 h-4" />
        </a>
      </footer>

      <FloatingButtons direction="up">
        {/* Paste here button */}
        {filesToClone.length > 0 && (
          <FloatingButton
            icon={<ClipboardPaste size={18} />}
            onClick={() => setCloneComfirmDialogOpen(true)}
            label="Paste here"
          />
        )}

        {/* Move here button */}
        {filesToMove.length > 0 && (
          <FloatingButton
            icon={<MoveHorizontal size={18} />}
            onClick={() => setMoveComfirmDialogOpen(true)}
            label="Move here"
          />
        )}

        {/* Scroll to top button */}
        {showScrollTop && (
          <FloatingButton
            icon={<ArrowUp size={24} />}
            onClick={scrollToTop}
            label="Scroll to top"
          />
        )}

        {/* Upload status button */}
        {uploadFiles.length > 0 && (
          <FloatingButton
            icon={<Upload size={20} />}
            onClick={() => setShowUploadDialog(true)}
            label="Show upload progress"
          />
        )}

        {/* Download status button */}
        {downloadFiles.length > 0 && (
          <FloatingButton
            icon={<Download size={20} />}
            onClick={() => setShowDownloadDialog(true)}
            label="Show download progress"
          />
        )}
      </FloatingButtons>

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
        description={`Are you sure you want to delete ${selectedFiles.length} files?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => handleDeleteMultipleConfirm(selectedFiles)}
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

      {/* Rename input dialog */}
      <InputDialog
        open={renameInputDialogOpen}
        setOpen={setRenameInputDialogOpen}
        title="Rename"
        description="Enter the new name for the file"
        confirmText="Rename"
        cancelText="Cancel"
        defaultValue={fileToRename.split('/').pop()}
        placeholder="New name"
        onConfirm={(newName) => handleRenameConfirm(newName.trim())}
        onCancel={handleRenameCancel}
      />

      {/* Mkdir input dialog */}
      <InputDialog
        open={mkdirInputDialogOpen}
        setOpen={setMkdirInputDialogOpen}
        title="Mkdir"
        description="Enter the name for the new directory"
        confirmText="Create"
        cancelText="Cancel"
        defaultValue={currentPath.split('/').pop()}
        placeholder="New directory name"
        onConfirm={(name) => handleMkdirConfirm(currentPath, name.trim())}
        onCancel={handleMkdirCancel}
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