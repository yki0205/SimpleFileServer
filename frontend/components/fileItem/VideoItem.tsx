import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { useState } from "react";

interface VideoItemProps {
  alt: string;
  thumbnail: string;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  loading?: 'lazy' | 'eager';
  onClick?: () => void;
  className?: string;
}

export function VideoItem({ alt, thumbnail, fit = 'contain', loading = 'lazy', onClick, className }: VideoItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setIsError(true);
  };

  return (
    <div 
      className={cn(
        "relative w-full h-full cursor-pointer group",
        "border border-border/30 rounded-sm overflow-hidden",
        className
      )}
      onClick={onClick}
    >
      {/* Blurred background for filling empty space */}
      {/* NOTE: This may cause performance issues when there are many videos */}
      <div className="absolute inset-0 overflow-hidden">
        <NextImage
          src={thumbnail}
          alt=""
          className="w-full h-full object-cover scale-110 blur-md brightness-50"
          loading={loading}
          width={200}
          height={200}
        />
      </div>
      
      {/* Thumbnail */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <NextImage
          src={thumbnail}
          alt={alt}
          className={cn(
            "w-full h-full transition-all duration-300",
            fit === 'contain' && "object-contain",
            fit === 'cover' && "object-cover",
            fit === 'fill' && "object-fill",
            fit === 'none' && "object-none",
            fit === 'scale-down' && "object-scale-down",
            isLoading ? "opacity-0" : "opacity-100",
            "group-hover:scale-105 group-hover:brightness-75 transition-all duration-300"
          )}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          width={200}
          height={200}
        />
      </div>

      {/* Display Icon */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="bg-black/40 rounded-full p-3 transform group-hover:scale-110 transition-transform duration-300">
          <Play className="h-8 w-8 text-white" fill="white" />
        </div>
      </div>

      {/* Video Icon */}
      <div className="absolute bottom-2 right-2 z-20 bg-black/70 text-white text-xs px-2 py-1 rounded-sm">
        Video
      </div>

      {/* Error Display */}
      {isError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-muted/80">
          <div className="text-center p-2">
            <p className="text-sm text-muted-foreground">Unable to load thumbnail</p>
          </div>
        </div>
      )}

      {/* Loading Display */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-muted/50">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
