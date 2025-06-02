"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

interface BreadcrumbNavProps {
  /** Current path to display as breadcrumb */
  currentPath: string;
  /** Function to handle navigation when a breadcrumb segment is clicked */
  onNavigate: (path: string, query?: string) => void;
  /** Whether to show the root/home icon button */
  showRootIcon?: boolean;
  /** Handler for root/home icon click */
  onRootClick?: () => void;
}

/**
 * Breadcrumb navigation component that displays the current path
 * with smart text truncation based on available container space
 */
const BreadcrumbNav: React.FC<BreadcrumbNavProps> = ({
  currentPath,
  onNavigate,
  showRootIcon = false,
  onRootClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  const [containerWidth, setContainerWidth] = useState(0);
  const [segmentWidths, setSegmentWidths] = useState<number[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(true);
  
  const segments = currentPath.split('/').filter(Boolean);
  
  const handleClick = (pathToSegment: string) => {
    onNavigate(pathToSegment, '');
  };

  const handleRootClick = () => {
    if (onRootClick) {
      onRootClick();
    }
  };
  
  // Reset measurements when segments change
  useEffect(() => {
    // Force complete reset of measurements when path changes
    segmentRefs.current = segments.map(() => null);
    setSegmentWidths([]);
    setContainerWidth(0);
    setIsMeasuring(true);
  }, [currentPath]);
  
  // Measure all segment widths
  useEffect(() => {
    if (!isMeasuring) return;
    
    const measureSegments = () => {
      if (!containerRef.current) {
        requestAnimationFrame(measureSegments);
        return;
      }
      
      // Update container width first
      setContainerWidth(containerRef.current.offsetWidth);
      
      const widths = segmentRefs.current
        .filter(Boolean)
        .map(ref => ref?.getBoundingClientRect().width || 0);
      
      if (widths.length === segments.length && widths.every(w => w > 0)) {
        setSegmentWidths(widths);
        setIsMeasuring(false);
      } else {
        requestAnimationFrame(measureSegments);
      }
    };
    
    requestAnimationFrame(measureSegments);
  }, [segments, isMeasuring]);
  
  // Track container width changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateContainerWidth(); // Initial measurement
    
    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Calculate visible segments based on current container width
  const { visibleSegments, hiddenSegments } = useMemo(() => {
    if (segments.length === 0) {
      return { 
        visibleSegments: [],
        hiddenSegments: []
      };
    }
    
    // During initial render or measurement, show all segments instead of hiding them
    if (segmentWidths.length === 0 || containerWidth === 0) {
      return { 
        visibleSegments: segments.map((segment, i) => ({
          segment,
          index: i,
          path: segments.slice(0, i + 1).join('/')
        })),
        hiddenSegments: []
      };
    }
    
    // Fixed size elements
    const separatorWidth = 20;
    const ellipsisWidth = 40;
    const rootIconWidth = showRootIcon ? 40 : 0;
    
    // Try to fit all segments
    const totalSeparatorsWidth = (segments.length - 1) * separatorWidth;
    const totalSegmentsWidth = segmentWidths.reduce((sum, w) => sum + w, 0);
    
    if (totalSegmentsWidth + totalSeparatorsWidth + rootIconWidth <= containerWidth) {
      // All segments fit
      return {
        visibleSegments: segments.map((segment, i) => ({
          segment,
          index: i,
          path: segments.slice(0, i + 1).join('/')
        })),
        hiddenSegments: []
      };
    }
    
    // Not all segments fit, first ensure we show the last segment
    const result = {
      visibleSegments: [] as { segment: string, index: number, path: string }[],
      hiddenSegments: [] as { segment: string, index: number, path: string }[]
    };
    
    // Always include the last segment first (current directory)
    const lastIndex = segments.length - 1;
    const lastSegment = segments[lastIndex];
    
    // Start with essentials - ellipsis if needed and last segment
    const essentialWidth = rootIconWidth + (segments.length > 1 ? ellipsisWidth + separatorWidth : 0);
    
    // Reserve space for last segment - always show it completely
    const lastSegmentWidth = segmentWidths[lastIndex];
    
    // Available width for other segments
    let remainingWidth = containerWidth - essentialWidth - lastSegmentWidth;
    
    // Add last segment first
    result.visibleSegments.push({
      segment: lastSegment,
      index: lastIndex,
      path: segments.join('/')
    });
    
    // Then try to add segments from right to left (excluding the last one)
    for (let i = lastIndex - 1; i >= 0; i--) {
      const segWidth = segmentWidths[i];
      const sepWidth = separatorWidth; // Each visible segment needs a separator
      
      if (remainingWidth >= segWidth + sepWidth) {
        remainingWidth -= (segWidth + sepWidth);
        
        result.visibleSegments.unshift({
          segment: segments[i],
          index: i,
          path: segments.slice(0, i + 1).join('/')
        });
      } else {
        // Not enough space for this segment, add it and all previous to hidden
        for (let j = 0; j <= i; j++) {
          result.hiddenSegments.push({
            segment: segments[j],
            index: j,
            path: segments.slice(0, j + 1).join('/')
          });
        }
        break;
      }
    }
    
    return result;
  }, [segments, segmentWidths, containerWidth, showRootIcon]);

  if (segments.length === 0) {
    return showRootIcon ? (
      <div className="flex items-center">
        <button
          onClick={handleRootClick}
          className="cursor-pointer hover:bg-gray-300 rounded-md p-1 flex-shrink-0"
        >
          <Home size={18} />
        </button>
      </div>
    ) : null;
  }

  return (
    <div 
      ref={containerRef} 
      className="flex items-center text-sm overflow-hidden flex-grow"
    >
      {isMeasuring && (
        <div className="absolute left-[-9999px] top-[-9999px] whitespace-nowrap">
          {segments.map((segment, idx) => (
            <span 
              key={`measure-${idx}`}
              ref={el => {
                segmentRefs.current[idx] = el;
              }}
              className="px-1"
            >
              {segment}
            </span>
          ))}
        </div>
      )}
      
      {showRootIcon && (
        <button
          onClick={handleRootClick}
          className="cursor-pointer hover:bg-gray-300 rounded-md p-1 flex-shrink-0 mr-1"
        >
          <Home size={18} />
        </button>
      )}
      
      {hiddenSegments.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="cursor-pointer hover:bg-gray-300 rounded-md px-1 mr-1 flex-shrink-0"
            >
              ...
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 max-h-60 overflow-auto">
            <div className="flex flex-col gap-1">
              {hiddenSegments.map(({ segment, index, path }) => (
                <button
                  key={index}
                  onClick={() => handleClick(path)}
                  className="text-left hover:bg-gray-100 p-1 rounded whitespace-nowrap flex items-center gap-1"
                  title={path}
                >
                  <span className="text-muted-foreground text-xs">
                    {index > 0 ? '···/' : '/'}
                  </span>
                  <span>{segment}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      
      {visibleSegments.map(({ segment, index, path }, arrayIndex) => {
        const isFirst = arrayIndex === 0 && hiddenSegments.length > 0;
        const isLast = index === segments.length - 1;
        
        return (
          <React.Fragment key={index}>
            {arrayIndex > 0 && (
              <span className="mx-1 text-muted-foreground">/</span>
            )}
            
            <SegmentItem
              segment={segment}
              path={path}
              isFirst={isFirst}
              isLast={isLast}
              onClick={handleClick}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface SegmentItemProps {
  segment: string;
  path: string;
  isFirst?: boolean;
  isLast?: boolean;
  onClick: (path: string) => void;
}

const SegmentItem: React.FC<SegmentItemProps> = ({ 
  segment, 
  path, 
  isFirst = false,
  isLast = false,
  onClick
}) => {
  return (
    <button 
      onClick={() => onClick(path)}
      className={cn(
        "cursor-pointer rounded-md p-1",
        "hover:bg-gray-300",
        isFirst && "min-w-[40px]",
        isLast ? "font-semibold min-w-[40px]" : "truncate max-w-[120px]"
      )}
      title={path}
    >
      {segment}
    </button>
  );
};

export { BreadcrumbNav }; 