import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Database, RefreshCw } from "lucide-react";

interface IndexSettingsDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  className?: string;
}

export function IndexSettingsDialog({ open, setOpen, className }: IndexSettingsDialogProps) {
  const [indexStatus, setIndexStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch index status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/index-status');
      setIndexStatus(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch index status');
    } finally {
      setLoading(false);
    }
  };

  // Rebuild index
  const handleRebuildIndex = async () => {
    try {
      setError(null);
      await axios.post('/api/rebuild-index');
      // Fetch status again to get the updated progress
      fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to rebuild index');
    }
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!indexStatus?.progress?.total) return 0;
    return Math.min(
      100, 
      Math.round((indexStatus.progress.processed / indexStatus.progress.total) * 100)
    );
  };

  // Format large numbers with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Fetch status on open
  useEffect(() => {
    if (open) {
      fetchStatus();
      
      // If index is building, poll for updates more frequently
      const intervalId = setInterval(() => {
        if (indexStatus?.isBuilding) {
          fetchStatus();
        }
      }, 1000); // Poll every second during active building
      
      return () => clearInterval(intervalId);
    }
  }, [open, indexStatus?.isBuilding]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={cn(
        "bg-black/80 border-white/10",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-bottom-1/2 data-[state=open]:slide-in-from-bottom-1/2",
        "sm:max-w-[500px]",
        className
      )}>
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Database size={18} />
            File Indexing Settings
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Configure and manage the file indexing system
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
          ) : !indexStatus?.enabled ? (
            <div className="flex flex-col items-center justify-center h-40 text-white/60 gap-2">
              <AlertCircle size={32} />
              <p>File indexing is not enabled on the server</p>
            </div>
          ) : (
            <div className="space-y-4 text-white/80">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="font-medium">
                  {indexStatus.isBuilding ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <RefreshCw className="animate-spin h-4 w-4" />
                      Building
                    </span>
                  ) : indexStatus.fileCount > 0 ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Ready
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Not Built
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Files Indexed:</span>
                <span className="font-medium">{formatNumber(indexStatus.fileCount || 0)}</span>
              </div>
              
              {indexStatus.lastBuilt && !indexStatus.isBuilding && (
                <div className="flex justify-between items-center">
                  <span>Last Updated:</span>
                  <span className="font-medium">
                    {new Date(indexStatus.lastBuilt).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Show progress during building */}
              {indexStatus.isBuilding && indexStatus.progress && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Indexing Progress:</span>
                    <span>{getProgressPercentage()}%</span>
                  </div>
                  <Progress value={getProgressPercentage()} className="h-2 bg-white/10 [&>*]:bg-white/50" />
                  <div className="flex justify-between text-sm text-white/50 mt-1">
                    <span>Processed: {formatNumber(indexStatus.progress.processed || 0)}</span>
                    <span>Total: {formatNumber(indexStatus.progress.total || 0)}</span>
                  </div>
                  
                  {indexStatus.progress.lastUpdated && (
                    <div className="text-xs text-white/50 text-right mt-1">
                      Last update: {new Date(indexStatus.progress.lastUpdated).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}

              {/* Show speed estimate if we have enough data */}
              {indexStatus.isBuilding && 
               indexStatus.progress && 
               indexStatus.progress.processed > 0 && 
               indexStatus.progress.lastUpdated && (
                <div className="border border-white/10 rounded p-3 bg-black/40 mt-2">
                  <h4 className="text-sm font-medium mb-2">Processing Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-white/50">Estimated time:</span>
                      <span className="ml-2 font-medium">
                        {indexStatus.progress.processed > 0 ? 
                          formatEstimatedTime((indexStatus.progress.total - indexStatus.progress.processed) / 
                            (indexStatus.progress.processed / 
                              ((new Date().getTime() - new Date(indexStatus.progress.startTime || indexStatus.progress.lastUpdated).getTime()) / 1000))) :
                          'Calculating...'}
                      </span>
                    </div>
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
          
          {indexStatus?.enabled && (
            <Button 
              onClick={handleRebuildIndex}
              disabled={indexStatus?.isBuilding || loading}
              variant="outline"
              className="text-white hover:text-white/80 bg-transparent border-white/20"
            >
              {indexStatus?.isBuilding ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Rebuild Index
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to format estimated time
function formatEstimatedTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return 'Calculating...';
  
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
} 