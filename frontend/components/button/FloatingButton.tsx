import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FloatingButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'default' | 'accent';
  disabled?: boolean;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export function FloatingButton({
  icon,
  onClick,
  label,
  className,
  variant = 'default',
  disabled = false,
  tooltipPosition = 'left',
}: FloatingButtonProps) {
  const baseClasses = "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-md";
  
  const variantClasses = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    default: "bg-black/50 hover:bg-black/70 text-white",
    accent: "bg-yellow-600/20 hover:bg-yellow-400/50 text-white"
  };

  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variantClasses[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {icon}
    </button>
  );

  if (label) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side={tooltipPosition}>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
} 