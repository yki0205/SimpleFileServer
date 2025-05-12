"use client";

import axios from "axios";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileItem } from "@/components/FileItem";
import { List, Grid3x3, Image as ImageIcon, Search, ArrowLeft, Home } from "lucide-react";

interface FileData {
  name: string;
  path: string;
  isDirectory: boolean;
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

const API_URL = 'http://localhost:3002';

export default function FileExplorer() {

  const [currentPath, setCurrentPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'image'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading, error, refetch } = useQuery<FilesResponse>({
    queryKey: ['files', currentPath],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/files`, {
        params: { dir: currentPath }
      });
      return response.data;
    },
    enabled: !isSearching
  });

  const { data: searchData, isLoading: searchLoading, error: searchError, refetch: refetchSearch } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, currentPath],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/search`, {
        params: { query: searchQuery, dir: currentPath }
      });
      return response.data;
    },
    enabled: isSearching && searchQuery.length > 0
  });

  const handleFileClick = (path: string, isDirectory: boolean) => {
    if (isDirectory) {
      setCurrentPath(path);
      setIsSearching(false);
      setSearchQuery('');
    } else {
      window.open(`${API_URL}/api/download?path=${encodeURIComponent(path)}`, '_blank');
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(!!searchQuery);
  }

  const goBack = () => {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
      return;
    }

    const pathParts = currentPath.split('/');
    pathParts.pop();
    const newPath = pathParts.join('/');
    setCurrentPath(newPath);
  }

  const goHome = () => {
    setCurrentPath('');
    setIsSearching(false);
    setSearchQuery('');
  }

  const canGoBack = currentPath !== '' || isSearching;

  const filesToDisplay = isSearching
    ? searchData?.results || []
    : data?.files || [];

  const sortedFiles = [...filesToDisplay].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
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

  return (
    <main className="container mx-auto min-h-screen flex flex-col p-4 pb-8 bg-[#211d1d] text-white">
      <header className="flex justify-between mb-4 gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goBack}
            disabled={!canGoBack}
          >
            <ArrowLeft size={18} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goHome}
          >
            <Home size={18} />
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-[200px] text-white selection:bg-white selection:text-black"
          />
          <Button type="submit" variant="secondary" size="icon">
            <Search size={18} />
          </Button>
        </form>

        <div className="flex gap-2">
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
      <nav>
        {isSearching ? (
          <div className="bg-muted px-3 py-2 rounded-md text-sm">
            Searching: "{searchQuery}" in {currentPath || 'root'}
          </div>
        ) : (
          <div className="bg-muted px-3 py-2 rounded-md text-sm flex items-center">
            <span
              className="cursor-pointer hover:text-primary"
              onClick={() => setCurrentPath('')}
            >
              /
            </span>
            {currentPath.split('/').filter(Boolean).map((segment, index, array) => {
              const pathToSegment = array.slice(0, index + 1).join('/');

              return (
                <React.Fragment key={index}>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <span
                    className="cursor-pointer hover:text-primary"
                    onClick={() => setCurrentPath(pathToSegment)}
                  >
                    {segment}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </nav>


      {(isLoading || searchLoading) && (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      {(error || searchError) && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Error loading files. Please try again.
        </div>
      )}
      {(!isLoading && !searchLoading && sortedFiles.length === 0) && (
        <div className="text-center p-8 text-muted-foreground">
          {isSearching ? 'No search results found.' : 'This folder is empty.'}
        </div>
      )}

      {/* File list */}
      {viewMode === 'list' && (
        <div className="border rounded-md">
          <div className="flex items-center p-2 bg-muted text-muted-foreground text-sm font-medium">
            <div className="w-8"></div>
            <div className="flex-1">Name</div>
            <div className="hidden md:block w-24 text-right">Size</div>
            <div className="hidden md:block w-32 text-right">Modified</div>
          </div>
          <div className="divide-y">
            {sortedFiles.map((file) => (
              <FileItem
                key={file.path}
                {...file}
                onClick={handleFileClick}
                viewMode="list"
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {sortedFiles.map((file) => (
            <FileItem
              key={file.path}
              {...file}
              onClick={handleFileClick}
              viewMode="grid"
            />
          ))}
        </div>
      )}

      {/* Image view */}
      {viewMode === 'image' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedFiles.map((file) => (
            <FileItem
              key={file.path}
              {...file}
              onClick={handleFileClick}
              viewMode="image"
            />
          ))}
        </div>
      )}

      <footer>
      </footer>
    </main>
  );
}
