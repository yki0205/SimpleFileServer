"use client";

import "./scrollbar.css";
import { cn } from "@/lib/utils";
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
import {
  List as ListIcon, Grid3x3, Image as ImageIcon, Search, ArrowLeft, ArrowUp, Home,
  Download, Upload, Edit, Trash2, ClipboardCopy, ClipboardPaste, MoveHorizontal
} from "lucide-react";

import { Error } from "@/components/status/Error";
import { Loading } from "@/components/status/Loading";
import { NotFound } from "@/components/status/NotFound";
import { Image } from "@/components/image/Image";
import { FileItemListView } from "@/components/fileItem/FileItemListView";
import { FileItemGridView } from "@/components/fileItem/FileItemGridView";
import { ConfirmDialog } from "@/components/dialog/ComfirmDialog";

import { ImagePreview, VideoPreview, AudioPreview, CodePreview, ComicPreview } from "@/components/preview";
import BreadcrumbNav from "@/components/nav/BreadcrumbNav";


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



interface FileRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    files: FileData[];
    isSearching: boolean;
    onFileClick: (path: string, type: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
  };
}

const FileRow = React.memo(({ index, style, data }: FileRowProps) => {
  const { files, isSearching, onFileClick, onDownload, onDelete } = data;
  const file = files[index];

  return (
    <div style={style}>
      <ContextMenu>
        <ContextMenuTrigger>
          <FileItemListView
            {...file}
            isSearching={isSearching}
            onClick={() => onFileClick(file.path, file.type)}
            className="text-white hover:text-black hover:bg-accent"
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
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
    columnCount: number;
    onFileClick: (path: string, type: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
  };
}

const FileCell = React.memo(({ columnIndex, rowIndex, style, data }: FileCellProps) => {
  const { files, columnCount, onFileClick, onDownload, onDelete } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= files.length) return null;

  const file = files[index];

  return (
    <div style={style} className="p-1">
      <ContextMenu>
        <ContextMenuTrigger>
          <FileItemGridView
            {...file}
            onClick={() => onFileClick(file.path, file.type)}
            className="text-black hover:text-gray-600 hover:bg-accent"
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
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
    columnCount: number;
    onFileClick: (path: string, type: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
  };
}

const ImageCell = React.memo(({ columnIndex, rowIndex, style, data }: ImageCellProps) => {
  const { files, columnCount, onFileClick, onDownload, onDelete } = data;
  const index = rowIndex * columnCount + columnIndex;
  if (index >= files.length) return null;

  const file = files[index];

  if (file.type === 'image') {
    return (
      <div style={style} className="p-1">
        <Image
          src={`/api/download?path=${encodeURIComponent(file.path)}`}
          alt={file.name}
          onClick={() => onFileClick(file.path, file.type)}
          className="w-full h-full object-cover rounded-md cursor-pointer"
          loading="eager"
        />
      </div>
    );
  } else {
    return (
      <div style={style} className="p-1">
        <ContextMenu>
          <ContextMenuTrigger>
            <FileItemGridView
              {...file}
              onClick={() => onFileClick(file.path, file.type)}
              className="text-black hover:text-gray-600 hover:bg-accent"
            />
          </ContextMenuTrigger>
          <ContextMenuContent>
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
    columnCount: number;
    columnWidth: number;
    direction: 'ltr' | 'rtl';
    onFileClick: (path: string, type: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
  };
}

const MasonryCell = React.memo(({ index, style, data }: MasonryCellProps) => {
  const { files, columnCount, columnWidth, direction, onFileClick } = data;
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
          <Image
            {...file}
            src={`/api/download?path=${encodeURIComponent(file.path)}`}
            alt={file.name}
            onClick={() => onFileClick(file.path, file.type)}
            className="w-full h-auto rounded-md"
            loading="lazy"
          />
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


const previewSupported: Record<string, boolean> = {
  'image': true,
  'video': true,
  'audio': true,
  'code': true,
  'document': true,
  'comic': true,
  'pdf': false
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

  // EXPERIMENTAL FEATURE FOR IMAGE ONLY VIEW
  const [useMasonry, setUseMasonry] = useState(false);
  const [gridDirection, setGridDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Create refs for the virtualized lists/grids
  const listRef = useRef<List>(null);
  const gridRef = useRef<Grid>(null);
  const imageGridRef = useRef<Grid>(null);
  const masonryRef = useRef<HTMLDivElement>(null);
  const activeScrollRef = useRef<any>(null);
  const scrollPosition = useRef(0);
  const navRef = useRef<HTMLDivElement>(null);
  const [navWidth, setNavWidth] = useState(0);

  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    path: '',
    type: '',
  });

  const currentPath = searchParams.get('p') || '';
  const searchQuery = searchParams.get('q') || '';
  const isSearching = !!searchQuery;
  const canGoBack = currentPath !== '' || isSearching;


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
    enabled: viewMode === 'imageOnly' && !isSearching
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
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
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
      window.location.reload();
    } else {
      navigateTo('', '');
    }
  }

  const scrollToTop = () => {
    console.log("Scrolling to top", { viewMode, useMasonry });
    console.log("Refs:", {
      list: listRef.current,
      grid: gridRef.current,
      imageGrid: imageGridRef.current,
      masonry: masonryRef.current
    });

    if (viewMode === 'list') {
      if (listRef.current) {
        console.log("Scrolling list to top");
        // For Lists, scrollToItem is the most reliable method
        listRef.current.scrollToItem(0, "start");
      }
    } else if (viewMode === 'grid') {
      if (gridRef.current) {
        console.log("Scrolling grid to top");
        // For Grids, scrollToItem with columnIndex and rowIndex
        gridRef.current.scrollToItem({
          columnIndex: 0,
          rowIndex: 0,
          align: "start"
        });
      }
    } else if (viewMode === 'image' || (viewMode === 'imageOnly' && !useMasonry)) {
      if (imageGridRef.current) {
        console.log("Scrolling image grid to top");
        // For Image Grids, same as regular grids
        imageGridRef.current.scrollToItem({
          columnIndex: 0,
          rowIndex: 0,
          align: "start"
        });
      }
    } else if (viewMode === 'imageOnly' && useMasonry && masonryRef.current) {
      console.log("Scrolling masonry to top");
      masonryRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Reset scroll position
    scrollPosition.current = 0;
    setShowScrollTop(false);
  };



  const openPreview = useCallback((path: string, type: string) => {
    const currentIndex = sortedFiles.findIndex(file => file.path === path);
    if (currentIndex === -1) {
      console.error('File not found in sortedFiles:', path);
      return;
    }

    setPreview({
      isOpen: true,
      path,
      type,
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



  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewMode === 'imageOnly') {
      setViewMode('image');
    }
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('searchQuery') as string;
    navigateTo(currentPath, query);
  }

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

  const handleMkdir = useCallback((path: string) => {
    // TODO: Implement mkdir
  }, []);

  const handleRename = useCallback((path: string, newName: string) => {
    // TODO: Implement rename
  }, []);

  const handleDelete = useCallback((path: string) => {
    setFileToDelete(path);
    setDeleteComfirmDialogOpen(true);
  }, []);

  const handleCopy = useCallback((path: string) => {
    // TODO: Implement copy
  }, []);

  const handlePaste = useCallback((path: string) => {
    // TODO: Implement paste
  }, []);

  const handleMove = useCallback((path: string) => {
    // TODO: Implement move
  }, []);

  const handleDownload = useCallback((path: string) => {
    window.open(`/api/download?path=${encodeURIComponent(path)}`, '_blank');
  }, []);

  const handleFileClick = useCallback((path: string, type: string) => {
    if (type === 'directory') {
      navigateTo(path, '');
    } else if (previewSupported[type as keyof typeof previewSupported]) {
      openPreview(path, type);
    } else {
      setFileToDownload(path);
      setDownloadComfirmDialogOpen(true);
    }
  }, [openPreview]);

  const handleVirtualizedScroll = ({ scrollOffset, scrollTop }: any) => {
    const currentScroll = scrollTop ?? scrollOffset ?? 0;
    scrollPosition.current = currentScroll;
    setShowScrollTop(currentScroll > 100);
  };



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

  useEffect(() => {
    if (navRef.current) {
      setNavWidth(navRef.current.offsetWidth);
    }
  }, [navRef.current]);


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
        isSearching,
        onFileClick: handleFileClick,
        onDownload: handleDownload,
        onDelete: handleDelete
      }}
      className="custom-scrollbar"
      onScroll={handleVirtualizedScroll}
    >
      {FileRow}
    </List>
  ), [sortedFiles, isSearching, handleFileClick, handleDownload, handleDelete]);

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
          columnCount,
          onFileClick: handleFileClick,
          onDownload: handleDownload,
          onDelete: handleDelete
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
      >
        {FileCell}
      </Grid>
    );
  }, [sortedFiles, getColumnCount, handleFileClick, handleDownload, handleDelete]);

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
          columnCount,
          onFileClick: handleFileClick,
          onDownload: handleDownload,
          onDelete: handleDelete
        }}
        className="custom-scrollbar"
        onScroll={handleVirtualizedScroll}
      >
        {ImageCell}
      </Grid>
    );
  }, [sortedFiles, getColumnCount, handleFileClick, handleDownload, handleDelete]);

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
              columnCount,
              columnWidth,
              direction: gridDirection,
              onFileClick: handleFileClick,
              onDownload: handleDownload,
              onDelete: handleDelete
            }}
          />
        ))}
      </div>
    );
  }, [useMasonry, gridDirection, sortedFiles, getColumnCount, handleFileClick, handleDownload, handleDelete]);



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
        </div>
      </header>

      <nav ref={navRef} className="mb-2">
        {isSearching ? (
          <div className="bg-muted px-1 py-1 rounded-md text-sm">
            Searching: "{searchQuery}" in {currentPath || 'root'}
          </div>
        ) : (
          <div className="bg-muted px-1 py-1 rounded-md text-sm flex flex-wrap items-center overflow-x-auto whitespace-nowrap">
            <BreadcrumbNav 
              navWidth={navWidth}
              currentPath={currentPath} 
              onNavigate={navigateTo} 
              showRootIcon
              onRootClick={goHome}
            />
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
      ) : null}

      {viewMode === 'imageOnly' && (
        <div className="flex justify-center text-sm text-muted-foreground mb-1">
          {imagesData?.images.length} images found in {currentPath}
        </div>
      )}

      {(!isLoading && !isError && !isNotFound) && (
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
              src={`/api/download?path=${encodeURIComponent(preview.path)}`}
              onClose={closePreview}
              onDownload={() => window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank')}
              onNext={() => navigatePreview('next')}
              onPrev={() => navigatePreview('prev')}
              direction={viewMode === 'imageOnly' && gridDirection === 'rtl' ? 'rtl' : 'ltr'}
            />
          )}

          {/* Video preview */}
          {preview.type === 'video' && (
            <VideoPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/download?path=${encodeURIComponent(preview.path)}`}
              onClose={closePreview}
              onDownload={() => window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank')}
              onNext={() => navigatePreview('next')}
              onPrev={() => navigatePreview('prev')}
            />
          )}

          {/* Audio preview */}
          {preview.type === 'audio' && (
            <AudioPreview
              isOpen={preview.isOpen}
              title={preview.path.split('/').pop()}
              src={`/api/download?path=${encodeURIComponent(preview.path)}`}
              onClose={closePreview}
              onDownload={() => window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank')}
              onNext={() => navigatePreview('next')}
              onPrev={() => navigatePreview('prev')}
            />
          )}

          {/* Code preview & Document preview */}
          {(preview.type === 'code' || preview.type === 'document') && (
            <CodePreview
              isOpen={preview.isOpen}
              fileName={preview.path.split('/').pop()}
              fileExtension={getFileExtension(preview.path)}
              content={previewContent}
              isLoading={contentLoading}
              hasError={!!contentError}
              onClose={closePreview}
              onDownload={() => window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank')}
            />
          )}

          {/* Comic preview */}
          {preview.type === 'comic' && (
            <ComicPreview
              isOpen={preview.isOpen}
              // title={preview.path.split('/').pop()}
              src={`/api/comic?path=${encodeURIComponent(preview.path)}`}
              onClose={closePreview}
              onDownload={() => window.open(`/api/download?path=${encodeURIComponent(preview.path)}`, '_blank')}
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