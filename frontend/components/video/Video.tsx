"use client"

import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from 'react';
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
  // Core video refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core video state
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // UI controls state and refs
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  // Video adjustments state
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [brightness, setBrightness] = useState(1);

  // Progress bar refs and state
  const progressRef = useRef<HTMLDivElement>(null);
  const progressDraggingRef = useRef(false);
  const previewPositionRef = useRef<number | null>(null);
  const seekingRef = useRef(false);

  // Visual indicators state and refs
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
  const [skipIndicator, setSkipIndicator] = useState<{ direction: 'forward' | 'backward', seconds: number } | null>(null);
  const skipIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cumulativeSkipRef = useRef<{ direction: 'forward' | 'backward', seconds: number } | null>(null);
  const skipResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brightnessIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Touch gesture refs
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number, y: number } | null>(null);
  const touchingProgressRef = useRef(false);

  // Settings menu state and refs
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Container width state for responsive layout
  const [containerWidth, setContainerWidth] = useState(0);
  const controlsContainerRef = useRef<HTMLDivElement>(null);

  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;

      const direction = seconds > 0 ? 'forward' : 'backward';
      const absSeconds = Math.abs(seconds);

      // Update cumulative skip
      if (cumulativeSkipRef.current && cumulativeSkipRef.current.direction === direction) {
        // Same direction, add to existing cumulative value
        cumulativeSkipRef.current.seconds += absSeconds;
      } else {
        // Different direction or first skip, set new value
        cumulativeSkipRef.current = {
          direction,
          seconds: absSeconds
        };
      }

      // Show skip indicator with cumulative value
      setSkipIndicator({
        direction: cumulativeSkipRef.current.direction,
        seconds: Math.round(cumulativeSkipRef.current.seconds)
      });

      // Clear previous timeouts
      if (skipIndicatorTimeoutRef.current) {
        clearTimeout(skipIndicatorTimeoutRef.current);
      }
      if (skipResetTimeoutRef.current) {
        clearTimeout(skipResetTimeoutRef.current);
      }

      // Hide indicator after 1 second
      skipIndicatorTimeoutRef.current = setTimeout(() => {
        setSkipIndicator(null);
      }, 1000);

      // Reset cumulative value after 2 seconds of inactivity
      skipResetTimeoutRef.current = setTimeout(() => {
        cumulativeSkipRef.current = null;
      }, 2000);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
      setShowSettings(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMutedState = !isMuted;
      videoRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);

      // Show volume indicator and hide brightness indicator
      setShowVolumeIndicator(true);
      setShowBrightnessIndicator(false);
      if (volumeIndicatorTimeoutRef.current) {
        clearTimeout(volumeIndicatorTimeoutRef.current);
      }
      volumeIndicatorTimeoutRef.current = setTimeout(() => {
        setShowVolumeIndicator(false);
      }, 2000);
    }
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBrightness = parseFloat(e.target.value);
    setBrightness(newBrightness);

    // Show brightness indicator and hide volume indicator
    setShowBrightnessIndicator(true);
    setShowVolumeIndicator(false);
    if (brightnessIndicatorTimeoutRef.current) {
      clearTimeout(brightnessIndicatorTimeoutRef.current);
    }
    brightnessIndicatorTimeoutRef.current = setTimeout(() => {
      setShowBrightnessIndicator(false);
    }, 2000);
  };

  // Handle progress bar events
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && videoRef.current && duration > 0) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      videoRef.current.currentTime = pos * duration;
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration > 0) {
      progressDraggingRef.current = true;
      handleProgressDrag(e);

      // NOTE: Well, I want to prevent text selection of the whole component by using "select-none".
      // If you don't like this way, you can uncomment the following line and remove the "select-none" class from the component.

      // Prevent text selection during drag
      // document.body.style.userSelect = 'none';
    }
  };

  const handleProgressDrag = (e: React.MouseEvent | MouseEvent) => {
    if (progressDraggingRef.current && progressRef.current) {
      const rect = progressRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

      // Store preview position but don't update video time yet
      previewPositionRef.current = pos;

      // Temporarily update current time display without seeking the video
      setCurrentTime(pos * duration);
    }
  };

  const handleProgressMouseUp = () => {
    if (progressDraggingRef.current && videoRef.current && previewPositionRef.current !== null) {
      // Mark that we're seeking to prevent progress bar jumps
      seekingRef.current = true;

      // Only update video current time on mouse up
      videoRef.current.currentTime = previewPositionRef.current * duration;

      // Don't reset previewPosition until seeking is complete
      // previewPositionRef.current will be reset when the seeking event completes
      progressDraggingRef.current = false;

      // NOTE: Same as above.
      // document.body.style.userSelect = '';
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

  // Handle wheel events for brightness and volume control
  const handleWheel = (e: React.WheelEvent) => {
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX;
      const containerWidth = containerRect.width;
      const mousePosition = (mouseX - containerRect.left) / containerWidth;

      // Left half of the container, adjust brightness
      if (mousePosition < 0.5) {
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        setBrightness(prev => Math.max(0.1, Math.min(2, prev + delta)));

        // Show brightness indicator and hide volume indicator
        setShowBrightnessIndicator(true);
        setShowVolumeIndicator(false);
        if (brightnessIndicatorTimeoutRef.current) {
          clearTimeout(brightnessIndicatorTimeoutRef.current);
        }
        brightnessIndicatorTimeoutRef.current = setTimeout(() => {
          setShowBrightnessIndicator(false);
        }, 2000);
      }
      // Right half of the container, adjust volume
      else {
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        if (videoRef.current) {
          const newVolume = Math.max(0, Math.min(1, volume + delta));
          setVolume(newVolume);
          videoRef.current.volume = newVolume;
          setIsMuted(newVolume === 0);

          // Show volume indicator and hide brightness indicator
          setShowVolumeIndicator(true);
          setShowBrightnessIndicator(false);
          if (volumeIndicatorTimeoutRef.current) {
            clearTimeout(volumeIndicatorTimeoutRef.current);
          }
          volumeIndicatorTimeoutRef.current = setTimeout(() => {
            setShowVolumeIndicator(false);
          }, 2000);
        }
      }

      // Show controls when adjusting
      resetControlsTimeout();
    }
  };

  // Handle double click for skipping forward/backward
  const handleDoubleClick = (e: React.MouseEvent) => {
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      // Check if click is in the controls area (bottom 20% of the container)
      const clickY = e.clientY;
      const containerHeight = containerRect.height;
      const controlsAreaThreshold = containerRect.bottom - (containerHeight * 0.2);

      // If click is in the bottom 20% area, don't process double click
      // NOTE: This is to prevent double click on the controls area.
      if (clickY > controlsAreaThreshold) {
        return;
      }

      // Process valid double click
      const mouseX = e.clientX;
      const containerWidth = containerRect.width;
      const position = (mouseX - containerRect.left) / containerWidth;

      // Prevent default behavior and stop propagation
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
  };

  // Handle touch events for gestures.
  // This is to handle the touch events for the progress bar and the volume/brightness controls on mobile devices.
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
          // Calculate scrub amount - how many seconds to skip
          const scrubAmount = (deltaX / containerRef.current!.clientWidth) * duration * 0.5;
          const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + scrubAmount));
          videoRef.current.currentTime = newTime;

          // Show skip indicator if the movement is significant
          if (Math.abs(scrubAmount) > 0.5) {
            const direction = scrubAmount > 0 ? 'forward' : 'backward';
            const absSeconds = Math.abs(scrubAmount);

            // Update cumulative skip
            if (cumulativeSkipRef.current && cumulativeSkipRef.current.direction === direction) {
              // Same direction, add to existing cumulative value
              cumulativeSkipRef.current.seconds += absSeconds;
            } else {
              // Different direction or first skip, set new value
              cumulativeSkipRef.current = {
                direction,
                seconds: absSeconds
              };
            }

            // Show skip indicator with cumulative value
            setSkipIndicator({
              direction: cumulativeSkipRef.current.direction,
              seconds: Math.round(cumulativeSkipRef.current.seconds)
            });

            // Clear previous timeouts
            if (skipIndicatorTimeoutRef.current) {
              clearTimeout(skipIndicatorTimeoutRef.current);
            }
            if (skipResetTimeoutRef.current) {
              clearTimeout(skipResetTimeoutRef.current);
            }

            // Hide indicator after 1 second
            skipIndicatorTimeoutRef.current = setTimeout(() => {
              setSkipIndicator(null);
            }, 1000);

            // Reset cumulative value after 2 seconds of inactivity
            skipResetTimeoutRef.current = setTimeout(() => {
              cumulativeSkipRef.current = null;
            }, 2000);
          }
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

            // Show brightness indicator and hide volume indicator
            setShowBrightnessIndicator(true);
            setShowVolumeIndicator(false);
            if (brightnessIndicatorTimeoutRef.current) {
              clearTimeout(brightnessIndicatorTimeoutRef.current);
            }
            brightnessIndicatorTimeoutRef.current = setTimeout(() => {
              setShowBrightnessIndicator(false);
            }, 2000);
          } else {
            // Right side - adjust volume
            const volumeDelta = -deltaY * 0.01;
            if (videoRef.current) {
              const newVolume = Math.max(0, Math.min(1, volume + volumeDelta));
              setVolume(newVolume);
              videoRef.current.volume = newVolume;
              setIsMuted(newVolume === 0);

              // Show volume indicator and hide brightness indicator
              setShowVolumeIndicator(true);
              setShowBrightnessIndicator(false);
              if (volumeIndicatorTimeoutRef.current) {
                clearTimeout(volumeIndicatorTimeoutRef.current);
              }
              volumeIndicatorTimeoutRef.current = setTimeout(() => {
                setShowVolumeIndicator(false);
              }, 2000);
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

  // Event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      // Only update current time from video if we're not in a seeking operation
      if (!seekingRef.current) {
        setCurrentTime(video.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (onLoad) onLoad();
    };

    const onError = () => {
      if (onError) onError();
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

    const onSeeking = () => {
      // Video is seeking - keep using preview position for the progress bar
      seekingRef.current = true;
    };

    const onSeeked = () => {
      // Video has finished seeking - update current time and clear preview
      seekingRef.current = false;
      setCurrentTime(video.currentTime);
      previewPositionRef.current = null;
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('enterpictureinpicture', onEnterpictureinpicture);
    video.addEventListener('leavepictureinpicture', onLeavepictureinpicture);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('enterpictureinpicture', onEnterpictureinpicture);
      video.removeEventListener('leavepictureinpicture', onLeavepictureinpicture);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      document.removeEventListener('fullscreenchange', onFullscreenChange);

      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, playbackRate, onLoad, isFullscreen]);

  // Keyboard shortcuts
  useEffect(() => {
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
  }, [isPlaying, playbackRate, isFullscreen, duration, volume, brightness]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (volumeIndicatorTimeoutRef.current) {
        clearTimeout(volumeIndicatorTimeoutRef.current);
      }
      if (brightnessIndicatorTimeoutRef.current) {
        clearTimeout(brightnessIndicatorTimeoutRef.current);
      }
      if (skipIndicatorTimeoutRef.current) {
        clearTimeout(skipIndicatorTimeoutRef.current);
      }
      if (skipResetTimeoutRef.current) {
        clearTimeout(skipResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutsideSettings = (e: MouseEvent) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideSettings);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSettings);
    };
  }, [showSettings]);

  // Setup ResizeObserver to track container width
  useEffect(() => {
    if (!controlsContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    resizeObserver.observe(controlsContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Return appropriate layout class based on container width
  const getLayoutClass = () => {
    // Use 768px as breakpoint for layout change (can be adjusted)
    return containerWidth > 768 ? "grid-cols-3" : "grid-cols-1";
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "select-none",
        "relative group",
        "flex flex-col items-center justify-center",
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
        className={isFullscreen ? "max-w-screen max-h-screen" : "max-w-[90vw] max-h-[90vh]"}
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

      {/* Skip indicators */}
      {skipIndicator && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 bg-black/70 rounded-full h-20 w-20 flex flex-col items-center justify-center text-white pointer-events-none transition-opacity duration-300 opacity-90",
          skipIndicator.direction === 'forward' ? "right-8" : "left-8"
        )}>
          {skipIndicator.direction === 'forward' ? (
            <SkipForward size={32} />
          ) : (
            <SkipBack size={32} />
          )}
          <span className="text-lg font-semibold mt-1">{skipIndicator.seconds}s</span>
        </div>
      )}

      {/* Volume indicator at top */}
      {showVolumeIndicator && (
        <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 rounded-full px-4 py-2 flex items-center gap-2">
            {isMuted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
            <div className="w-40 h-2 bg-gray-600 rounded-full">
              <div
                className="h-full bg-white rounded-full"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              ></div>
            </div>
            <span className="text-white text-xs">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}

      {/* Brightness indicator at top */}
      {showBrightnessIndicator && (
        <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 rounded-full px-4 py-2 flex items-center gap-2">
            <Sun size={20} className="text-white" />
            <div className="w-40 h-2 bg-gray-600 rounded-full">
              <div
                className="h-full bg-yellow-500 rounded-full"
                style={{ width: `${Math.min(brightness * 50, 100)}%` }}
              ></div>
            </div>
            <span className="text-white text-xs">{Math.round(brightness * 50)}%</span>
          </div>
        </div>
      )}

      {/* Play/Pause button in center when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="bg-black/40 rounded-full p-5 cursor-pointer hover:bg-black/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            <Play size={60} className="text-white" />
          </div>
        </div>
      )}

      {/* Custom controls - positioned absolutely at the bottom */}
      <div
        ref={controlsContainerRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-16 pb-4 transition-opacity duration-300 controls",
          "flex flex-col",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
          isFullscreen ? "pb-8" : ""
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className={cn(
            "w-full h-2 bg-gray-600/60 rounded-full mb-4 cursor-pointer relative group/progress",
            progressDraggingRef.current ? "h-4 transition-height duration-150" : ""
          )}
          onClick={handleProgressClick}
          onMouseDown={handleProgressMouseDown}
        >
          {/* Background bar */}
          <div
            className={cn(
              "h-full bg-red-500 rounded-full relative",
              progressDraggingRef.current ? "bg-red-400" : ""
            )}
            style={{
              width: `${duration > 0 ?
                (seekingRef.current || (progressDraggingRef.current && previewPositionRef.current !== null)
                  ? (previewPositionRef.current ?? (currentTime / duration)) * 100
                  : (currentTime / duration) * 100)
                : 0}%`
            }}
          >
            {/* Drag handle thumb */}
            <div className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 bg-white border-2 border-red-500 rounded-full shadow-md transition-all",
              progressDraggingRef.current
                ? "w-5 h-5 scale-100"
                : "w-3 h-3 scale-0 group-hover/progress:scale-100"
            )} />
          </div>

          {/* Time indicator tooltip */}
          {progressDraggingRef.current && previewPositionRef.current !== null && (
            <div
              className="absolute top-0 transform -translate-y-full -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
              style={{ left: `${previewPositionRef.current * 100}%` }}
            >
              {formatTime(previewPositionRef.current * duration)}
            </div>
          )}

          {/* Hover time indicator (only shown when not dragging) */}
          {!progressDraggingRef.current && (
            <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover/progress:opacity-100">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/80 px-2 py-1 rounded text-xs text-white whitespace-nowrap">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          )}
        </div>

        {/* Controls grid layout */}
        <div className={`grid ${getLayoutClass()} gap-y-4 items-center w-full`}>
          {/* Time display - Left section */}
          <div className={`flex ${containerWidth > 768 ? "justify-start" : "justify-center"} items-center`}>
            <div className="text-white text-sm">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback controls - Center section */}
          <div className="flex justify-center items-center gap-4">
            {/* Skip backward button */}
            <button
              onClick={() => skip(-10)}
              className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
              aria-label="Skip backward 10 seconds"
            >
              <SkipBack size={18} />
            </button>

            {/* Previous video button */}
            {onPrev && (
              <button
                onClick={onPrev}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Previous video"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Play/Pause button */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Next video button */}
            {onNext && (
              <button
                onClick={onNext}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Next video"
              >
                <ChevronRight size={18} />
              </button>
            )}

            {/* Skip forward button */}
            <button
              onClick={() => skip(10)}
              className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
              aria-label="Skip forward 10 seconds"
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Settings controls - Right section */}
          <div className={`flex ${containerWidth > 768 ? "justify-end" : "justify-center"} items-center gap-4`}>
            {/* Volume control */}
            <div className="flex items-center group/volume">
              <button
                onClick={toggleMute}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
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

            {/* Brightness control */}
            <div className="flex items-center group/brightness">
              <button
                onClick={() => setBrightness(brightness === 1 ? 1.5 : 1)}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Adjust brightness"
              >
                <Sun size={18} />
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

            {/* Fullscreen button */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            {/* Picture-in-picture button */}
            <button
              onClick={togglePictureInPicture}
              className={cn(
                "text-white hover:text-gray-300 transition-colors rounded-full p-1",
                isPictureInPicture ? "text-blue-400 hover:text-blue-300" : "",
                isFullscreen ? "hidden" : ""
              )}
              aria-label={isPictureInPicture ? "Exit picture-in-picture" : "Enter picture-in-picture"}
            >
              <Monitor size={18} />
            </button>

            {/* Download button */}
            {onDownload && (
              <button
                onClick={onDownload}
                className="text-white hover:text-gray-300 transition-colors rounded-full p-1"
                aria-label="Download video"
              >
                <Download size={18} />
              </button>
            )}

            {/* Settings */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-white hover:text-gray-300 transition-colors hidden sm:inline-block rounded-full p-1"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>

              {showSettings && (
                <div
                  className="absolute bottom-full right-0 mb-2 bg-black/90 border-0 text-white min-w-[150px] p-2 rounded-md shadow-lg z-10"
                >
                  <div className="text-sm mb-2 font-medium px-2">Playback Speed</div>
                  <div className="flex flex-col gap-1">
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(rate => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={cn(
                          "text-left px-2 py-1 rounded hover:bg-gray-700 text-sm transition-colors cursor-pointer",
                          playbackRate === rate ? "bg-gray-700" : ""
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
          <div className="flex flex-col gap-2">
            <div className="text-white text-xs">Space: Play/Pause</div>
            <div className="text-white text-xs">←→: Skip 10s</div>
            <div className="text-white text-xs">F: Fullscreen</div>
            <div className="text-white text-xs">M: Mute</div>
            <div className="text-white text-xs">P: PiP</div>
            <div className="text-white text-xs">&lt;&gt;: Speed</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Video;
