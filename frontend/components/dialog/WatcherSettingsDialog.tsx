import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";

interface WatcherSettingsDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  className?: string;
}

export function WatcherSettingsDialog({ open, setOpen, className }: WatcherSettingsDialogProps) {
  const [watcherStatus, setWatcherStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch watcher status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/watcher-status');
      setWatcherStatus(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch watcher status');
    } finally {
      setLoading(false);
    }
  };

  // Toggle watcher state
  const handleToggleWatcher = async () => {
    try {
      setError(null);
      await axios.post('/api/toggle-watcher');
      // Fetch status again to get the updated state
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to toggle watcher state');
    }
  };

  // Fetch status on open
  useEffect(() => {
    if (open) {
      fetchStatus();
      
      // Poll for updates every 5 seconds when dialog is open
      const intervalId = setInterval(() => {
        fetchStatus();
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={cn(
        "bg-black/80 border-white/10",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-bottom-1/2 data-[state=open]:slide-in-from-bottom-1/2",
        className
      )}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Eye size={18} />
            File Watcher Settings
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Configure and manage the file monitoring system
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* {loading ? ( */}
          {false ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="animate-spin h-8 w-8 text-white/80" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-red-400 gap-2">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : !watcherStatus?.enabled ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/60 gap-2">
              <AlertCircle size={32} />
              <p>File watching is not enabled on the server</p>
            </div>
          ) : (
            <div className="space-y-4 text-white/80">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="font-medium">
                  {watcherStatus.active ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      Active
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <EyeOff className="h-4 w-4" />
                      Inactive
                    </span>
                  )}
                </span>
              </div>
              
              {watcherStatus.watchedDirectories && (
                <div className="flex flex-col gap-1">
                  <span>Watched Directories:</span>
                  <div className="bg-black/40 p-2 rounded text-xs border border-white/10">
                    {watcherStatus.watchedDirectories.map((dir: string, index: number) => (
                      <div key={index} className="break-all">{dir}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {watcherStatus.lastEvent && (
                <div className="flex justify-between items-center">
                  <span>Last Event:</span>
                  <span className="font-medium">
                    {new Date(watcherStatus.lastEvent.time).toLocaleString()}
                  </span>
                </div>
              )}
              
              {watcherStatus.stats && (
                <div className="space-y-2">
                  <h4 className="font-medium">Statistics:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Added Files:</div>
                    <div className="font-medium">{watcherStatus.stats.added || 0}</div>
                    <div>Changed Files:</div>
                    <div className="font-medium">{watcherStatus.stats.changed || 0}</div>
                    <div>Deleted Files:</div>
                    <div className="font-medium">{watcherStatus.stats.deleted || 0}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            className="text-white/60 hover:text-red-500 bg-transparent border-white/20"
          >
            Close
          </Button>
          
          {watcherStatus?.enabled && (
            <Button 
              onClick={handleToggleWatcher}
              disabled={loading}
              variant="outline"
              className={cn(
                "bg-transparent border-white/20",
                watcherStatus?.active 
                  ? "text-white hover:text-red-500" 
                  : "text-white hover:text-white/80"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : watcherStatus?.active ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Stop Watcher
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Start Watcher
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 