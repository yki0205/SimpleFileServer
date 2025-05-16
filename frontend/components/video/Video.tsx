import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward, Settings, X
} from 'lucide-react';

interface VideoProps {
  src: string;
  autoPlay?: boolean;
  className?: string;
  onClose?: () => void;
  onError?: () => void;
  onLoad?: () => void;
}

export const Video = ({
  src,
  autoPlay = false,
  className,
  onClose,
  onError,
  onLoad
}: VideoProps) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
  const [isFocused, setIsFocused] = useState(false);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
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

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pos * duration;
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  // Toggle fullscreen
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

  // Skip forward/backward
  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
    }
  };

  // Change playback rate
  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSettings(false);
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

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
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
      // 修改判断条件，允许键盘事件在组件聚焦或全屏时生效
      if (!isFullscreen && !isFocused && !containerRef.current?.contains(document.activeElement)) {
        return;
      }
      
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
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
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
  }, [isPlaying, playbackRate, isFullscreen, isFocused, duration]);

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
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      tabIndex={0} // 添加tabIndex使div可聚焦
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        autoPlay={autoPlay}
        onClick={(e) => e.stopPropagation()}
        onError={onError}
        tabIndex={-1} // 防止视频元素获取焦点
      />

      {/* Buffering indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
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
              tabIndex={0}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            {/* Skip buttons */}
            <button 
              onClick={() => skip(-10)}
              className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label="Skip backward 10 seconds"
              tabIndex={0}
            >
              <SkipBack size={20} />
            </button>
            <button 
              onClick={() => skip(10)}
              className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label="Skip forward 10 seconds"
              tabIndex={0}
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
            {/* Playback rate */}
            <div className="relative settings-container">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-gray-300 transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label="Settings"
                tabIndex={0}
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
                        tabIndex={0}
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
                tabIndex={0}
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
                  tabIndex={0}
                />
              </div>
            </div>

            {/* Fullscreen button */}
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              tabIndex={0}
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
          tabIndex={0}
        >
          <X size={24} />
        </button>
      )}

      {/* Keyboard shortcuts info - only shown in fullscreen */}
      {isFullscreen && showControls && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs p-2 rounded">
          Space: Play/Pause | ←→: Skip 10s | F: Fullscreen | M: Mute | &lt;&gt;: Speed
        </div>
      )}
    </div>
  );
};

export default Video;
