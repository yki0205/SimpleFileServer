import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, X, Download,
  Sun, ChevronLeft, ChevronRight, Monitor
} from 'lucide-react';

interface VideoProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
  onError?: () => void;
  onLoad?: () => void;
  onClose?: () => void;
  onDownload?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const Video = ({
  src,
  autoPlay = false,
  className,
  onError,
  onLoad,
  onClose,
  onDownload,
  onNext,
  onPrev,
}: VideoProps) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressDraggingRef = useRef(false);
  
  // State
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  
  // Touch gestures
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number, y: number } | null>(null);
  const touchingProgressRef = useRef(false);
  
  // Double click
  const lastClickTimeRef = useRef(0);
  const clickPositionRef = useRef<number | null>(null);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
    }
  };

  // Toggle picture-in-picture mode
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPictureInPicture(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPictureInPicture(true);
      } else {
        console.error("Picture-in-Picture is not supported in this browser");
      }
    } catch (error) {
      console.error("Error toggling Picture-in-Picture mode:", error);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Progress bar dragging
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration > 0) {
      progressDraggingRef.current = true;
      handleProgressDrag(e);
      // Prevent text selection during drag
      document.body.style.userSelect = 'none';
    }
  };

  const handleProgressDrag = (e: React.MouseEvent | MouseEvent) => {
    if (progressDraggingRef.current && progressRef.current && videoRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleProgressMouseUp = () => {
    if (progressDraggingRef.current) {
      progressDraggingRef.current = false;
      document.body.style.userSelect = '';
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleProgressDrag(e);
    const handleMouseUp = () => handleProgressMouseUp();

    if (progressDraggingRef.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [progressDraggingRef.current]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBrightness = parseFloat(e.target.value);
    setBrightness(newBrightness);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettings(false);
  };

  // Handle wheel events for brightness and volume control
  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX;
      const containerWidth = containerRect.width;
      const mousePosition = (mouseX - containerRect.left) / containerWidth;
      
      // Left half of the container
      if (mousePosition < 0.5) {
        // Adjust brightness
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setBrightness(prev => Math.max(0.1, Math.min(2, prev + delta)));
      } 
      // Right half of the container
      else {
        // Adjust volume
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        if (videoRef.current) {
          const newVolume = Math.max(0, Math.min(1, volume + delta));
          setVolume(newVolume);
          videoRef.current.volume = newVolume;
          setIsMuted(newVolume === 0);
        }
      }
      
      // Show controls when adjusting
      resetControlsTimeout();
    }
  };

  // Handle double click for skipping forward/backward
  const handleDoubleClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (containerRect) {
      const mouseX = e.clientX;
      const containerWidth = containerRect.width;
      const position = (mouseX - containerRect.left) / containerWidth;
      
      if (now - lastClickTimeRef.current < 300) {
        // It's a double click
        e.preventDefault();
        e.stopPropagation();
        
        if (position < 0.3) {
          // Left area - skip backward
          skip(-10);
        } else if (position > 0.7) {
          // Right area - skip forward
          skip(10);
        } else {
          // Center area - toggle play
          togglePlay();
        }
      }
      
      lastClickTimeRef.current = now;
    }
  };

  // Handle touch events for gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      // Check if touch started on progress bar
      if (progressRef.current) {
        const progressRect = progressRef.current.getBoundingClientRect();
        touchingProgressRef.current = (
          touch.clientY >= progressRect.top &&
          touch.clientY <= progressRect.bottom &&
          touch.clientX >= progressRect.left &&
          touch.clientX <= progressRect.right
        );
      }
      
      resetControlsTimeout();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current && lastTouchRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      const deltaY = touch.clientY - lastTouchRef.current.y;
      const totalDeltaX = touch.clientX - touchStartRef.current.x;
      const totalDeltaY = touch.clientY - touchStartRef.current.y;
      
      // Update last touch position
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      
      // If touch started on progress bar, scrub through video
      if (touchingProgressRef.current && progressRef.current && videoRef.current) {
        const rect = progressRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        videoRef.current.currentTime = pos * duration;
        return;
      }
      
      // Determine if this is primarily a horizontal or vertical gesture
      if (Math.abs(totalDeltaX) > 20 && Math.abs(totalDeltaX) > Math.abs(totalDeltaY) * 2) {
        // Horizontal gesture - scrubbing
        if (duration > 0 && videoRef.current) {
          const scrubAmount = (deltaX / containerRef.current!.clientWidth) * duration * 0.5;
          videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + scrubAmount));
        }
        
        e.preventDefault();
        return;
      }
      
      if (Math.abs(totalDeltaY) > 20 && Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * 2) {
        // Vertical gesture
        const containerRect = containerRef.current?.getBoundingClientRect();
        
        if (containerRect) {
          const touchX = touch.clientX;
          const containerWidth = containerRect.width;
          const position = (touchX - containerRect.left) / containerWidth;
          
          if (position < 0.5) {
            // Left side - adjust brightness
            const brightnessDelta = -deltaY * 0.01;
            setBrightness(prev => Math.max(0.1, Math.min(2, prev + brightnessDelta)));
          } else {
            // Right side - adjust volume
            const volumeDelta = -deltaY * 0.01;
            if (videoRef.current) {
              const newVolume = Math.max(0, Math.min(1, volume + volumeDelta));
              setVolume(newVolume);
              videoRef.current.volume = newVolume;
              setIsMuted(newVolume === 0);
            }
          }
        }
        
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    lastTouchRef.current = null;
    touchingProgressRef.current = false;
  };

  // Auto-hide controls after inactivity
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Close settings if clicked outside
  const handleClickOutside = (e: MouseEvent) => {
    if (showSettings && !e.composedPath().some(el => 
      el instanceof HTMLElement && el.classList.contains('settings-container'))) {
      setShowSettings(false);
    }
  };

  // Event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (onLoad) onLoad();
    };

    const onEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    const onPlay = () => {
      setIsPlaying(true);
      resetControlsTimeout();
    };

    const onPause = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    const onWaiting = () => {
      setIsBuffering(true);
    };
    
    const onPlaying = () => {
      setIsBuffering(false);
    };

    const onEnterpictureinpicture = () => {
      setIsPictureInPicture(true);
    };

    const onLeavepictureinpicture = () => {
      setIsPictureInPicture(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('enterpictureinpicture', onEnterpictureinpicture);
    video.addEventListener('leavepictureinpicture', onLeavepictureinpicture);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('click', handleClickOutside);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('enterpictureinpicture', onEnterpictureinpicture);
      video.removeEventListener('leavepictureinpicture', onLeavepictureinpicture);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('click', handleClickOutside);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, playbackRate, onLoad, isFullscreen, showSettings]);

  // Keyboard shortcuts - Separate useEffect for keyboard events
  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (e.ctrlKey) {
            // Ctrl+Up for brightness
            setBrightness(prev => Math.min(2, prev + 0.1));
          } else {
            // Up for volume
            if (videoRef.current) {
              const newVolume = Math.min(1, videoRef.current.volume + 0.1);
              videoRef.current.volume = newVolume;
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.ctrlKey) {
            // Ctrl+Down for brightness
            setBrightness(prev => Math.max(0.1, prev - 0.1));
          } else {
            // Down for volume
            if (videoRef.current) {
              const newVolume = Math.max(0, videoRef.current.volume - 0.1);
              videoRef.current.volume = newVolume;
            }
          }
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
          if (e.ctrlKey) {
            e.preventDefault();
            togglePictureInPicture();
          } else if (onPrev) {
            e.preventDefault();
            onPrev();
          }
          break;
        case 'i':
          if (e.altKey) {
            e.preventDefault();
            togglePictureInPicture();
          }
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'n':
          e.preventDefault();
          if (onNext) onNext();
          break;
        case 'd':
          e.preventDefault();
          if (onDownload) onDownload();
          break;
        case '>':
        case '.':
          e.preventDefault();
          changePlaybackRate(Math.min(playbackRate + 0.25, 2));
          break;
        case '<':
        case ',':
          e.preventDefault();
          changePlaybackRate(Math.max(playbackRate - 0.25, 0.25));
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            document.exitFullscreen().catch(console.error);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, playbackRate, isFullscreen, duration, volume, brightness, onNext, onPrev, onDownload]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative group w-full h-full overflow-hidden",
        isFullscreen ? "fixed inset-0 z-50 bg-black" : "",
        className
      )}
      onMouseMove={resetControlsTimeout}
      onClick={(e) => {
        // Only toggle play when clicking directly on the video, not on controls
        if (e.target === containerRef.current || e.target === videoRef.current) {
          togglePlay();
        }
      }}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        style={{ filter: `brightness(${brightness})` }}
        autoPlay={autoPlay}
        onClick={(e) => e.stopPropagation()}
        onError={onError}
      />

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Large play/pause button in center when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-5">
            <Play size={60} className="text-white" />
          </div>
        </div>
      )}

      {/* Custom controls - positioned absolutely at the bottom */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-16 pb-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
          isFullscreen ? "pb-8" : ""
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div 
          ref={progressRef}
          className="w-full h-2 bg-gray-600/60 rounded-full mb-4 cursor-pointer relative group/progress"
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          <div 
            className="h-full bg-red-500 rounded-full"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full transform scale-0 group-hover/progress:scale-100 transition-transform"></div>
          </div>
          
          {/* Hover time indicator */}
          <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover/progress:opacity-100">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/80 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause button */}
            <button 
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Previous/Next buttons */}
            {onPrev && (
              <button 
                onClick={onPrev}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Previous video"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            
            {onNext && (
              <button 
                onClick={onNext}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Next video"
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Skip buttons */}
            <button 
              onClick={() => skip(-10)}
              className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label="Skip backward 10 seconds"
            >
              <SkipBack size={20} />
            </button>
            <button 
              onClick={() => skip(10)}
              className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label="Skip forward 10 seconds"
            >
              <SkipForward size={20} />
            </button>

            {/* Time display */}
            <div className="text-white text-sm">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Brightness control */}
            <div className="flex items-center gap-2 group/brightness">
              <button 
                onClick={() => setBrightness(brightness === 1 ? 1.5 : 1)}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Adjust brightness"
              >
                <Sun size={20} />
              </button>
              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/brightness:w-20">
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={brightness}
                  onChange={handleBrightnessChange}
                  className="w-20 accent-yellow-500"
                  aria-label="Brightness"
                />
              </div>
            </div>

            {/* Picture-in-picture button */}
            <button
              onClick={togglePictureInPicture}
              className={cn(
                "text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1",
                isPictureInPicture ? "text-blue-400 hover:text-blue-300" : ""
              )}
              aria-label={isPictureInPicture ? "Exit picture-in-picture" : "Enter picture-in-picture"}
            >
              <Monitor size={20} />
            </button>

            {/* Download button */}
            {onDownload && (
              <button 
                onClick={onDownload}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Download video"
              >
                <Download size={20} />
              </button>
            )}

            {/* Playback rate */}
            <div className="relative settings-container">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Settings"
              >
                <Settings size={20} />
              </button>
              
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 rounded-md p-2 min-w-[150px] shadow-lg z-10 settings-container">
                  <div className="text-white text-sm mb-2 font-medium">Playback Speed</div>
                  <div className="flex flex-col gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={cn(
                          "text-left px-2 py-1 rounded hover:bg-gray-700 text-sm transition-colors",
                          playbackRate === rate ? "bg-gray-700 text-white" : "text-gray-300"
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-2 group/volume">
              <button 
                onClick={toggleMute}
                className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/volume:w-20">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-red-500"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Fullscreen button */}
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Close button (only shown when onClose is provided) */}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full hover:bg-black/70 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-label="Close video"
        >
          <X size={24} />
        </button>
      )}

      {/* Keyboard shortcuts info - only shown in fullscreen */}
      {isFullscreen && showControls && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs p-2 rounded">
          Space: Play/Pause | ←→: Skip 10s | F: Fullscreen | M: Mute | P: PiP | &lt;&gt;: Speed
        </div>
      )}
    </div>
  );
};

export default Video;
