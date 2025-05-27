import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Database, RefreshCw } from "lucide-react";

interface IndexSettingsDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function IndexSettingsDialog({ open, setOpen }: IndexSettingsDialogProps) {
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

  // Fetch status on open
  useEffect(() => {
    if (open) {
      fetchStatus();
      
      // If index is building, poll for updates
      const intervalId = setInterval(() => {
        if (indexStatus?.isBuilding) {
          fetchStatus();
        }
      }, 2000);
      
      return () => clearInterval(intervalId);
    }
  }, [open, indexStatus?.isBuilding]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database size={18} />
            File Indexing Settings
          </DialogTitle>
          <DialogDescription>
            Configure and manage the file indexing system
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 text-red-500 gap-2">
              <AlertCircle size={32} />
              <p>{error}</p>
            </div>
          ) : !indexStatus?.enabled ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <AlertCircle size={32} />
              <p>File indexing is not enabled on the server</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="font-medium">
                  {indexStatus.isBuilding ? (
                    <span className="text-amber-500 flex items-center gap-1">
                      <RefreshCw className="animate-spin h-4 w-4" />
                      Building
                    </span>
                  ) : indexStatus.fileCount > 0 ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Ready
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Not Built
                    </span>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Files Indexed:</span>
                <span className="font-medium">{indexStatus.fileCount || 0}</span>
              </div>
              
              {indexStatus.lastBuilt && (
                <div className="flex justify-between items-center">
                  <span>Last Updated:</span>
                  <span className="font-medium">
                    {new Date(indexStatus.lastBuilt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          
          {indexStatus?.enabled && (
            <Button 
              onClick={handleRebuildIndex}
              disabled={indexStatus?.isBuilding || loading}
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