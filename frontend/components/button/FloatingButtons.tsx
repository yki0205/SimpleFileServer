import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type GravityDirection = 'up' | 'down' | 'left' | 'right';

interface FloatingButtonsProps {
  children: React.ReactNode;
  direction?: GravityDirection;
  spacing?: number;
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  initialOffset?: number;
}

// Define interface for tracked buttons with exit state
interface TrackedButton {
  id: string; // Unique ID for comparison
  content: React.ReactNode;
  isExiting?: boolean;
}

/**
 * A component that manages floating buttons
 * Automatically positions them based on visibility
 * Uses pure CSS transitions for animations
 */
export function FloatingButtons({
  children,
  direction = 'up',
  spacing = 12,
  className,
  position = 'bottom-right',
  initialOffset = 0,
}: FloatingButtonsProps) {
  // Get all valid children elements and create unique IDs
  const allButtonsArray = React.Children.toArray(children).filter(Boolean);
  const [visibleButtons, setVisibleButtons] = useState<TrackedButton[]>([]);
  const [mounted, setMounted] = useState(false);
  
  // Ensure component is mounted before showing for animation
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Update visible buttons when children change
  useEffect(() => {
    // Create stable identifiers for comparison
    const allButtons = allButtonsArray.map((btn, idx) => ({
      id: React.isValidElement(btn) && btn.key ? String(btn.key) : `btn-${idx}`,
      content: btn
    }));
    
    // Add new buttons that don't exist yet
    const existingIds = visibleButtons.map(btn => btn.id);
    const newButtons = allButtons.filter(btn => !existingIds.includes(btn.id));
    
    if (newButtons.length > 0) {
      setVisibleButtons(prev => [...prev, ...newButtons]);
    }
    
    // Mark buttons for removal if they're no longer in the children
    const currentIds = allButtons.map(btn => btn.id);
    const buttonsToRemove = visibleButtons.filter(btn => 
      !currentIds.includes(btn.id) && !btn.isExiting
    );
    
    if (buttonsToRemove.length > 0) {
      // Mark buttons as exiting
      setVisibleButtons(prev => 
        prev.map(btn => 
          buttonsToRemove.some(removeBtn => removeBtn.id === btn.id)
            ? { ...btn, isExiting: true }
            : btn
        )
      );
      
      // Remove exiting buttons after transition completes
      setTimeout(() => {
        setVisibleButtons(prev => 
          prev.filter(btn => !buttonsToRemove.some(removeBtn => removeBtn.id === btn.id))
        );
      }, 300);
    }
  }, [allButtonsArray]);
  
  // Position classes for the container
  const positionClasses = {
    'bottom-right': 'bottom-8 right-8',
    'bottom-left': 'bottom-8 left-8',
    'top-right': 'top-8 right-8',
    'top-left': 'top-8 left-8',
  };

  // Calculate position style based on direction and index
  const getPositionStyle = (index: number) => {
    const offset = initialOffset + index * (spacing + 40); // 40px is approx button height
    
    switch (direction) {
      case 'up':
        return { bottom: `${offset}px`, right: '0px' };
      case 'down':
        return { top: `${offset}px`, right: '0px' };
      case 'left':
        return { bottom: '0px', right: `${offset}px` };
      case 'right':
        return { bottom: '0px', left: `${offset}px` };
    }
  };

  return (
    <div className={cn("fixed z-50", positionClasses[position])}>
      {visibleButtons.map((buttonObj, index) => {
        const positionStyle = getPositionStyle(index);
        
        return (
          <div
            key={buttonObj.id}
            className={cn(
              "absolute transition-all duration-300",
              mounted && !buttonObj.isExiting ? "opacity-100 scale-100" : "opacity-0 scale-50",
              className
            )}
            style={{
              ...positionStyle,
              transitionProperty: "transform, opacity, top, right, bottom, left",
              transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" // Spring-like curve
            }}
          >
            {buttonObj.content}
          </div>
        );
      })}
    </div>
  );
} 