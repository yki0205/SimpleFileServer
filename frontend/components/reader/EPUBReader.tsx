"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { Contents, Rendition, NavItem } from 'epubjs';
import { ReactReader, ReactReaderStyle, EpubViewStyle, 
  type IReactReaderStyle, type IEpubViewStyle } from 'react-reader';
import { cn } from "@/lib/utils";
import { Settings, ArrowRightToLine, ArrowLeftToLine, Search, Sun, Moon, RotateCcw, MousePointer, MoreHorizontal, MousePointer2 } from 'lucide-react';

interface EPUBReaderProps {
  src: string;
  className?: string;
}

type SearchResult = { cfi: string; excerpt: string };

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

const pageTransitionStyles: Partial<IReactReaderStyle> = {
  readerArea: {
    ...ReactReaderStyle.readerArea,
    transition: 'transform 0.5s ease',
  },
  prev: {
    ...ReactReaderStyle.prev,
    transition: 'transform 0.3s ease-out',
  },
  next: {
    ...ReactReaderStyle.next,
    transition: 'transform 0.3s ease-out',
  },
}

const testEpubViewStyle: IEpubViewStyle = {
  ...EpubViewStyle,
  view: {
    ...EpubViewStyle.view,
    display: 'flex',
    justifyContent: 'center',
  },
}

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
  const [pageTurnOnScroll, setPageTurnOnScroll] = useState(true);
  const [smoothScrolling, setSmoothScrolling] = useState(false);
  const [pageTransition, setPageTransition] = useState(true);
  const [disableContextMenu, setDisableContextMenu] = useState(false);
  const [isFixedLayout, setIsFixedLayout] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  const renditionRef = useRef<Rendition | null>(null);
  const tocRef = useRef<NavItem[]>([]);
  const prevResultsRef = useRef<SearchResult[]>([]);

  const handleTocChanged = (toc: NavItem[]) => {
    tocRef.current = toc;
  };

  const handleLocationChanged = (loc: string) => {
    setLocation(loc);
    localStorage.setItem(`epub-${src}`, loc);

    if (renditionRef.current && tocRef.current) {
      const { displayed, href } = renditionRef.current.location.start;
      const chapter = tocRef.current.find((item) => {
        let itemHref = item.href;
        while (itemHref.startsWith("../")) {
          itemHref = itemHref.substring(3);
        }
        let hrefHref = href;
        while (hrefHref.startsWith("../")) {
          hrefHref = hrefHref.substring(3);
        }
        return itemHref === hrefHref;
      });
      console.log({displayed, href, chapter});
      setPageInfo(
        `${displayed.page} / ${displayed.total}${chapter ? ` - ${chapter.label}` : ''}`
      );
    }
  };

  useEffect(() => {
    const loadSetting = <T,>(key: string, defaultValue: T, parser?: (value: string) => T): T => {
      const saved = localStorage.getItem(`epub-${key}-${src}`);
      if (saved === null) return defaultValue;
      return parser ? parser(saved) : (saved as unknown as T);
    };

    setLocation(loadSetting('', null));
    setIsRTL(loadSetting('direction', false, value => value === 'rtl'));
    setFontSize(loadSetting('fontsize', 100, value => parseInt(value, 10)));
    setDarkMode(loadSetting('theme', true, value => value === 'dark'));
    setPageTurnOnScroll(loadSetting('pageturn', true, value => value === 'true'));
    setSmoothScrolling(loadSetting('smoothscroll', false, value => value === 'true'));
    setPageTransition(loadSetting('pagetransition', true, value => value === 'true'));
    setDisableContextMenu(loadSetting('disablecontextmenu', false, value => value === 'true'));
    setIsFixedLayout(loadSetting('fixedlayout', false, value => value === 'true'));
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

  const togglePageTurnOnScroll = () => {
    const newValue = !pageTurnOnScroll;
    setPageTurnOnScroll(newValue);
    localStorage.setItem(`epub-pageturn-${src}`, newValue.toString());
  };

  const toggleSmoothScrolling = () => {
    const newValue = !smoothScrolling;
    setSmoothScrolling(newValue);
    localStorage.setItem(`epub-smoothscroll-${src}`, newValue.toString());
  };

  const togglePageTransition = () => {
    const newValue = !pageTransition;
    setPageTransition(newValue);
    localStorage.setItem(`epub-pagetransition-${src}`, newValue.toString());
  };

  const toggleDisableContextMenu = () => {
    const newValue = !disableContextMenu;
    setDisableContextMenu(newValue);
    localStorage.setItem(`epub-disablecontextmenu-${src}`, newValue.toString());
  };

  const setupRendition = (rendition: Rendition) => {
    renditionRef.current = rendition;

    const spine_get = rendition.book.spine.get.bind(rendition.book.spine);
    rendition.book.spine.get = (target: string) => {
      let t = spine_get(target);

      if (!t && target.startsWith("../")) {
        t = spine_get(target.substring(3));
      }

      if (!t) {
        t = spine_get(undefined);
      }

      return t;
    }

    // Check if this is a fixed layout EPUB
    const book = rendition.book as any;
    const fixedLayout = book.package?.metadata?.layout === "pre-paginated";
    setIsFixedLayout(fixedLayout);
    
    if (fixedLayout) {
      console.log("Detected fixed layout EPUB - using single page mode");
      localStorage.setItem(`epub-fixedlayout-${src}`, 'true');
      
      const originalNext = rendition.next.bind(rendition);
      const originalPrev = rendition.prev.bind(rendition);
      
      rendition.next = () => {
        try {
          console.log("Custom next method for fixed layout");
          const currentLoc = (rendition as any).currentLocation();
          if (currentLoc?.start) {
            const currentIndex = currentLoc.start.index;
            const nextIndex = currentIndex + 1;
            
            const nextSpineItem = rendition.book.spine.get(nextIndex);
            if (nextSpineItem) {
              return rendition.display(nextSpineItem.href);
            }
          }
          return originalNext();
        } catch (e) {
          console.error("Error in custom next:", e);
          return Promise.resolve();
        }
      };
      
      rendition.prev = () => {
        try {
          console.log("Custom prev method for fixed layout");
          const currentLoc = (rendition as any).currentLocation();
          if (currentLoc?.start) {
            const currentIndex = currentLoc.start.index;
            if (currentIndex > 0) {
              const prevIndex = currentIndex - 1;
              const prevSpineItem = rendition.book.spine.get(prevIndex);
              if (prevSpineItem) {
                return rendition.display(prevSpineItem.href);
              }
            }
          }
          return originalPrev();
        } catch (e) {
          console.error("Error in custom prev:", e);
          return Promise.resolve();
        }
      };
    } else {
      localStorage.setItem(`epub-fixedlayout-${src}`, 'false');
    }

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
        // Set scroll behavior based on user preference
        // @ts-ignore - manager type is missing in epubjs Rendition
        rendition.manager.container.style['scroll-behavior'] = smoothScrolling ? 'smooth' : 'auto';

        if (disableContextMenu) {
          const body = document.querySelector('body');
          if (body) {
            body.oncontextmenu = () => false;
          }
        }
      }
    });
  };

  const currentReaderStyles = pageTransition
    ? darkMode
      ? { ...pageTransitionStyles, ...darkReaderTheme }
      : { ...pageTransitionStyles, ...lightReaderTheme }
    : darkMode
      ? darkReaderTheme
      : lightReaderTheme;

  const loadingView = (
    <div className={cn("flex flex-col items-center justify-center h-full",
      darkMode ? "text-white" : "text-black")}>
      <RotateCcw className="animate-spin" />
      <p>Loading...</p>
    </div>
  );

  const goToNextPage = () => {
    if (!renditionRef.current) return;
    
    console.log("Custom next navigation");
    renditionRef.current.next();
  };
  
  const goToPrevPage = () => {
    if (!renditionRef.current) return;
    
    console.log("Custom prev navigation");
    renditionRef.current.prev();
  };

  return (
    <div className={cn("h-full w-full relative", className)}>
      <div className="h-full">
        <ReactReader
          url={src}
          loadingView={loadingView}
          readerStyles={{
            ...currentReaderStyles,
            arrow: { display: 'none' },
            prev: { display: 'none' },
            next: { display: 'none' },
          }}
          epubViewStyles={testEpubViewStyle}
          tocChanged={handleTocChanged}
          getRendition={setupRendition}
          location={location}
          locationChanged={handleLocationChanged}
          epubInitOptions={{
            openAs: 'epub',
          }}
          epubOptions={{
            flow: "paginated",
            manager: "default",
            allowScriptedContent: true,
            // spread: isFixedLayout ? "none" : "auto",
          }}
          searchQuery={searchQuery}
          onSearchResults={setSearchResults}
          isRTL={isRTL}
          pageTurnOnScroll={pageTurnOnScroll}
          contextLength={30}
        />
      </div>

      <div className="absolute bottom-4 left-4 p-2 text-sm bg-black/70 text-white rounded-md z-10">
        {pageInfo}
      </div>

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
                  onClick={goToPreviousResult}
                  className="w-full py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Prev
                </button>
                <button
                  onClick={goToNextResult}
                  className="w-full py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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

              <div>
                <div className="mb-2 font-medium">Page Turn On Scroll</div>
                <button
                  onClick={togglePageTurnOnScroll}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {pageTurnOnScroll ? 'Enabled' : 'Disabled'}
                  <MousePointer size={16} />
                </button>
              </div>

              <div>
                <div className="mb-2 font-medium">Smooth Scrolling</div>
                <button
                  onClick={toggleSmoothScrolling}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {smoothScrolling ? 'Enabled' : 'Disabled'}
                  <MoreHorizontal size={16} />
                </button>
              </div>

              <div>
                <div className="mb-2 font-medium">Page Transition Animation</div>
                <button
                  onClick={togglePageTransition}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {pageTransition ? 'Enabled' : 'Disabled'}
                  <ArrowRightToLine size={16} />
                </button>
              </div>

              <div>
                <div className="mb-2 font-medium">Disable Right-Click Menu</div>
                <button
                  onClick={toggleDisableContextMenu}
                  className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
                >
                  {disableContextMenu ? 'Enabled' : 'Disabled'}
                  <MousePointer2 size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10">
        <button 
          onClick={isRTL ? goToNextPage : goToPrevPage}
          className="bg-black/50 text-white p-3 rounded-r-lg hover:bg-black/70 transition-colors"
          aria-label="Previous Page"
        >
          <ArrowLeftToLine size={24} />
        </button>
      </div>

      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10">
        <button 
          onClick={isRTL ? goToPrevPage : goToNextPage}
          className="bg-black/50 text-white p-3 rounded-l-lg hover:bg-black/70 transition-colors"
          aria-label="Next Page"
        >
          <ArrowRightToLine size={24} />
        </button>
      </div>
    </div>
  );
};

export default EPUBReader;
