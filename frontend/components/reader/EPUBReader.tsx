"use client";

import React, { useState, useEffect } from 'react';
import { ReactReader, ReactReaderStyle, type IReactReaderStyle } from 'react-reader';
import { cn } from "@/lib/utils";
import { Settings, ArrowRightToLine, ArrowLeftToLine } from 'lucide-react';

interface EPUBReaderProps {
  src: string;
  className?: string;
}

export const EPUBReader = ({
  src,
  className,
}: EPUBReaderProps) => {
  const [location, setLocation] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRTL, setIsRTL] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const handleLocationChanged = (loc: string) => {
    setLocation(loc);
    localStorage.setItem(`epub-${src}`, loc);
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
  }, [src]);

  const toggleReadingDirection = () => {
    const newDirection = !isRTL;
    setIsRTL(newDirection);
    localStorage.setItem(`epub-direction-${src}`, newDirection ? 'rtl' : 'ltr');
    setShowSettings(false);
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
          loadingView={<div>Loading...</div>}
          readerStyles={ darkMode ? darkReaderTheme : lightReaderTheme}
          getRendition={rendition => {
            if (darkMode) {
              rendition.themes.override('color', '#fff')
              rendition.themes.override('background', '#000')
            } else {
              rendition.themes.override('color', '#000')
              rendition.themes.override('background', '#fff')
            }
          }}
          tocChanged={() => {}}
        />
      </div>
      
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="bg-black text-white p-2 rounded-full hover:bg-gray-800"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
        
        {showSettings && (
          <div className="absolute bottom-full right-0 mb-2 bg-black text-white p-3 rounded-md min-w-[180px] shadow-lg">
            <div className="mb-2 font-medium">Reading Direction</div>
            <button
              onClick={toggleReadingDirection}
              className="w-full text-left py-2 px-3 hover:bg-gray-700 rounded flex items-center justify-between"
            >
              {isRTL ? 'RTL' : 'LTR'}
              {isRTL ? <ArrowRightToLine size={16} /> : <ArrowLeftToLine size={16} />}
            </button>
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
