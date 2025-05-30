import { cn } from "@/lib/utils"
import { formatFileSize, getPreviewType } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Folder, File, FileText, FileArchive, Image, Music, Video, BookOpen } from "lucide-react"

interface FileData {
  name: string;
  path: string;
  size: number;
  mtime: string;
  isDirectory: boolean;
  mimeType?: string;
  cover?: string;
}

interface DetailsDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  file: FileData
  className?: string
}

export function DetailsDialog({ open, setOpen, file, className }: DetailsDialogProps) {
  const date = new Date(file.mtime).toLocaleString();
  const type = file.isDirectory ? 'directory' : getPreviewType(file.mimeType || 'application/octet-stream');

  const getIconComponent = () => {
    switch (type) {
      case 'directory': return Folder;
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'text': case 'pdf': case 'epub': return FileText;
      case 'archive': return FileArchive;
      case 'comic': return BookOpen;
      default: return File;
    }
  };

  const Icon = getIconComponent();

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
          <div className="flex items-start gap-2">
            <Icon size={24} className="text-white"/>
            <DialogTitle className="leading-6 text-white break-all hyphens-auto">
              {file.name}
            </DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm mt-4">
          <div className="text-white/60">Type:</div>
          <div className="text-white font-medium text-ellipsis">{type}</div>
          
          <div className="text-white/60">Location:</div>
          <div className="text-white font-medium break-all hyphens-auto">{file.path}</div>
          
          {!file.isDirectory && (
            <>
              <div className="text-white/60">Size:</div>
              <div className="text-white font-medium text-ellipsis">{formatFileSize(file.size)}</div>
            </>
          )}
          
          <div className="text-white/60">Modified:</div>
          <div className="text-white font-medium text-ellipsis">{date}</div>
          
          {file.cover && (
            <>
              <div className="text-white/60">Cover:</div>
              <div className="text-white font-medium break-all hyphens-auto">{file.cover}</div>
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline"
            onClick={() => setOpen(false)}
            className="text-black hover:text-black"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 