"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { Contents, Rendition, NavItem } from 'epubjs';
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from 'react-reader';
import { cn } from "@/lib/utils";
import { Settings, ArrowRightToLine, ArrowLeftToLine, Search, Sun, Moon, RotateCcw } from 'lucide-react';

interface EPUBReaderProps {
  src: string;
  className?: string;
}

type SearchResult = { cfi: string; excerpt: string };

export const EPUBReader = ({
  src,
  className,
}: EPUBReaderProps) => {
  const [location, setLocation] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRTL, setIsRTL] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [fontSize, setFontSize] = useState(100);
  const [pageInfo, setPageInfo] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  const renditionRef = useRef<Rendition | null>(null);
  const tocRef = useRef<NavItem[]>([]);
  const prevResultsRef = useRef<SearchResult[]>([]);

  const handleLocationChanged = (loc: string) => {
    setLocation(loc);
    localStorage.setItem(`epub-${src}`, loc);

    if (renditionRef.current && tocRef.current) {
      const { displayed, href } = renditionRef.current.location.start;
      const chapter = tocRef.current.find((item) => item.href === href);
      setPageInfo(
        `Page ${displayed.page} of ${displayed.total}${chapter ? ` in ${chapter.label}` : ''}`
      );
    }
  };

  useEffect(() => {
    const savedLocation = localStorage.getItem(`epub-${src}`);
    if (savedLocation) {
      setLocation(savedLocation);
    }

    const savedDirection = localStorage.getItem(`epub-direction-${src}`);
    if (savedDirection) {
      setIsRTL(savedDirection === 'rtl');
    }

    const savedFontSize = localStorage.getItem(`epub-fontsize-${src}`);
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }

    const savedTheme = localStorage.getItem(`epub-theme-${src}`);
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }
  }, [src]);

  useEffect(() => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
      localStorage.setItem(`epub-fontsize-${src}`, fontSize.toString());
    }
  }, [fontSize, src]);

  useEffect(() => {
    if (renditionRef.current) {
      if (darkMode) {
        renditionRef.current.themes.override('color', '#fff');
        renditionRef.current.themes.override('background', '#000');
      } else {
        renditionRef.current.themes.override('color', '#000');
        renditionRef.current.themes.override('background', '#fff');
      }
      localStorage.setItem(`epub-theme-${src}`, darkMode ? 'dark' : 'light');
    }
  }, [darkMode, src]);

  useEffect(() => {
    if (searchResults.length && renditionRef.current) {
      setLocation(searchResults[0].cfi);
      clearHighlights();
      highlightSearchResults(searchResults);
      setCurrentResultIndex(0);
      prevResultsRef.current = searchResults;
    }
  }, [searchResults]);

  const clearHighlights = () => {
    if (!renditionRef.current) return;
    prevResultsRef.current.forEach((result) => {
      renditionRef.current?.annotations.remove(result.cfi, 'highlight');
    });
  };

  const highlightSearchResults = (results: SearchResult[]) => {
    if (!renditionRef.current) return;
    results.forEach((result) => {
      renditionRef.current?.annotations.add('highlight', result.cfi);
    });
  };

  const goToNextResult = () => {
    if (!searchResults.length) return;
    const nextIndex = (currentResultIndex + 1) % searchResults.length;
    setCurrentResultIndex(nextIndex);
    setLocation(searchResults[nextIndex].cfi);
  };

  const goToPreviousResult = () => {
    if (!searchResults.length) return;
    const previousIndex = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentResultIndex(previousIndex);
    setLocation(searchResults[previousIndex].cfi);
  }

  const toggleReadingDirection = () => {
    const newDirection = !isRTL;
    setIsRTL(newDirection);
    localStorage.setItem(`epub-direction-${src}`, newDirection ? 'rtl' : 'ltr');
    setShowSettings(false);
  };

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 10, 200));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 10, 80));
  };

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <div className={cn("h-full w-full relative", className)}>
      <div className="h-full">
        <ReactReader
          url={src}
          location={location}
          locationChanged={handleLocationChanged}
          epubOptions={{
            flow: "paginated",
            manager: "default"
          }}
          epubInitOptions={{
            openAs: 'epub',
          }}
          isRTL={isRTL}
          loadingView={<div className="flex flex-col items-center justify-center h-full">
            <RotateCcw className="animate-spin" />
            <p>Loading...</p>
          </div>}
          readerStyles={darkMode ? darkReaderTheme : lightReaderTheme}
          getRendition={(rendition) => {
            renditionRef.current = rendition;
            rendition.themes.fontSize(`${fontSize}%`);

            if (darkMode) {
              rendition.themes.override('color', '#fff');
              rendition.themes.override('background', '#000');
            } else {
              rendition.themes.override('color', '#000');
              rendition.themes.override('background', '#fff');
            }

            rendition.hooks.content.register((contents: Contents) => {
              const document = contents.window.document;
              if (document) {
                // Enable smooth scrolling
                // @ts-ignore - manager type is missing in epubjs Rendition
                rendition.manager.container.style['scroll-behavior'] = 'smooth';
              }
            });
          }}
          tocChanged={(toc) => {
            tocRef.current = toc;
          }}
          searchQuery={searchQuery}
          onSearchResults={setSearchResults}
          contextLength={30}
        />
      </div>

      {/* Page info display */}
      {/* <div className="absolute top-0 left-0 right-0 p-2 text-center text-sm bg-black/70 text-white">
        {pageInfo}
      </div> */}

      {/* Search panel */}
      {showSearch && (
        <div className="absolute top-12 z-20 right-4 w-64 p-3 rounded-md bg-black/70 text-white">
          <div className="flex items-center justify-center gap-2 mb-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 rounded bg-black text-white"
            />
            <button
              onClick={() => setShowSearch(false)}
              className="text-white hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-1">
                Result {currentResultIndex + 1} of {searchResults.length}
              </div>
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={goToNextResult}
                  className="w-full py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Next
                </button>
                <button
                  onClick={goToPreviousResult}
                  className="w-full py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Prev
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings button */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 items-end">
        <button
          onClick={() => {
            setShowSearch(!showSearch);
            setShowSettings(false);
          }}
          className="bg-black text-white p-2 rounded-full hover:bg-gray-800"
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        <button
          onClick={() => {
            setShowSettings(!showSettings);
            setShowSearch(false);
          }}
          className="bg-black text-white p-2 rounded-full hover:bg-gray-800"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>

        {showSettings && (
          <div className="absolute bottom-full right-0 mb-2 bg-black text-white p-3 rounded-md min-w-[220px] shadow-lg">
            <div className="space-y-4">
              <div>
                <div className="mb-2 font-medium">Font Size</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={decreaseFontSize}
                    className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center">{fontSize}%</div>
                  <button
                    onClick={increaseFontSize}
                    className="w-8 h-8 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 font-medium">Reading Direction</div>
                <button
                  onClick={toggleReadingDirection}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {isRTL ? 'RTL' : 'LTR'}
                  {isRTL ? <ArrowRightToLine size={16} /> : <ArrowLeftToLine size={16} />}
                </button>
              </div>

              <div>
                <div className="mb-2 font-medium">Theme</div>
                <button
                  onClick={toggleTheme}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {darkMode ? 'Dark' : 'Light'}
                  {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const lightReaderTheme: IReactReaderStyle = {
  ...ReactReaderStyle,
  readerArea: {
    ...ReactReaderStyle.readerArea,
    transition: undefined,
  },
}

const darkReaderTheme: IReactReaderStyle = {
  ...ReactReaderStyle,
  arrow: {
    ...ReactReaderStyle.arrow,
    color: 'white',
  },
  arrowHover: {
    ...ReactReaderStyle.arrowHover,
    color: '#ccc',
  },
  readerArea: {
    ...ReactReaderStyle.readerArea,
    backgroundColor: '#000',
    transition: undefined,
  },
  titleArea: {
    ...ReactReaderStyle.titleArea,
    color: '#ccc',
  },
  tocArea: {
    ...ReactReaderStyle.tocArea,
    background: '#111',
  },
  tocButtonExpanded: {
    ...ReactReaderStyle.tocButtonExpanded,
    background: '#222',
  },
  tocButtonBar: {
    ...ReactReaderStyle.tocButtonBar,
    background: '#fff',
  },
  tocButton: {
    ...ReactReaderStyle.tocButton,
    color: 'white',
  },
}

export default EPUBReader;
