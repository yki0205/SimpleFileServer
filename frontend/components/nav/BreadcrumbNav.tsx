"use client";

import React, { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";

interface BreadcrumbNavProps {
  /** Current path to display as breadcrumb */
  currentPath: string;
  /** Function to handle navigation when a breadcrumb segment is clicked */
  onNavigate: (path: string, query?: string) => void;
  /** Optional fixed width for the navigation bar */
  navWidth?: number | string;
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
  navWidth,
  showRootIcon = false,
  onRootClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  
  const [maxVisibleSegments, setMaxVisibleSegments] = useState(1);
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
    segmentRefs.current = segments.map(() => null);
    setIsMeasuring(true);
  }, [segments]);
  
  // Measure all segment widths
  useEffect(() => {
    if (!isMeasuring) return;
    
    const measureSegments = () => {
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
  
  // Calculate visible segments based on available width
  useEffect(() => {
    if (!containerRef.current || segmentWidths.length === 0) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        
        // Fixed size elements
        const separatorWidth = 20;
        const ellipsisWidth = 40;
        const rootIconWidth = showRootIcon ? 40 : 0;
        
        const totalSeparatorsWidth = (segments.length - 1) * separatorWidth;
        const totalSegmentsWidth = segmentWidths.reduce((sum, w) => sum + w, 0);
        
        if (totalSegmentsWidth + totalSeparatorsWidth + rootIconWidth <= width) {
          // All segments fit
          setMaxVisibleSegments(segments.length);
        } else {
          // Prioritize showing essential elements and last segment
          const essentialWidth = 
            (showRootIcon ? rootIconWidth : 0) + 
            (segments.length > 1 ? ellipsisWidth + separatorWidth : 0);
          
          // Start with last segment
          let visibleCount = 1;
          let usedWidth = segments.length > 0 ? segmentWidths[segments.length - 1] : 0;
          
          // Add segments from right to left until we run out of space
          let remainingWidth = width - (usedWidth + essentialWidth);
          
          for (let i = segments.length - 2; i >= 0; i--) {
            const segWidth = segmentWidths[i] + separatorWidth;
            if (remainingWidth >= segWidth) {
              remainingWidth -= segWidth;
              visibleCount++;
            } else {
              break;
            }
          }
          
          setMaxVisibleSegments(Math.max(1, visibleCount));
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [segments, segmentWidths, showRootIcon]);

  // Empty path special case
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

  const shouldShowSegment = (index: number) => {
    if (segments.length <= maxVisibleSegments) {
      return true;
    }
    return index >= segments.length - maxVisibleSegments;
  };
  
  const showEllipsis = segments.length > maxVisibleSegments;
  
  const ellipsisSegments = showEllipsis 
    ? segments.slice(0, segments.length - maxVisibleSegments) 
    : [];

  return (
    <div 
      ref={containerRef} 
      className="flex items-center text-sm overflow-hidden flex-grow"
      style={navWidth ? { width: navWidth } : undefined}
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
      
      {showEllipsis && ellipsisSegments.length > 0 && (
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
              {ellipsisSegments.map((segment, idx) => {
                const segmentPath = segments.slice(0, idx + 1).join('/');
                
                return (
                  <button
                    key={idx}
                    onClick={() => handleClick(segmentPath)}
                    className="text-left hover:bg-gray-100 p-1 rounded whitespace-nowrap flex items-center gap-1"
                    title={segmentPath}
                  >
                    <span className="text-muted-foreground text-xs">
                      {idx > 0 ? '···/' : '/'}
                    </span>
                    <span>{segment}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
      
      {segments.map((segment, index) => {
        const pathToSegment = segments.slice(0, index + 1).join('/');
        const isVisible = shouldShowSegment(index);
        
        if (!isVisible) return null;
        
        const isFirstVisible = index === segments.length - maxVisibleSegments;
        const isLast = index === segments.length - 1;
        
        return (
          <React.Fragment key={index}>
            {!isFirstVisible && (
              <span className="mx-1 text-muted-foreground">/</span>
            )}
            
            <SegmentItem
              segment={segment}
              path={pathToSegment}
              isFirst={isFirstVisible}
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
        "cursor-pointer rounded-md p-1 truncate",
        "hover:bg-gray-300",
        isFirst && "min-w-[40px]",
        isLast && "font-semibold min-w-[40px]"
      )}
      title={path}
    >
      {segment}
    </button>
  );
};

export default BreadcrumbNav; 