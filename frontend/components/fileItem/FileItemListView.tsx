import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Folder, File, FileText, FileArchive, Image, Music, Video, FileCode } from "lucide-react";

interface FileItemProps {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: string;
  isSearching: boolean;
  onClick: () => void;
  className?: string;
}

export function FileItemListView(
  { name, path, size, mtime, type, isSearching, onClick, className }: FileItemProps
) {
  const date = new Date(mtime).toLocaleDateString();

  const getIconComponent = () => {
    switch (type) {
      case 'directory': return Folder;
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'document': return FileText;
      case 'archive': return FileArchive;
      case 'code': return FileCode;
      default: return File;
    }
  };

  const Icon = getIconComponent();

  return (
    <div
      className={cn("flex items-center p-2 rounded-md cursor-pointer select-none", className)}
      onClick={onClick}
    >
      <div className="mr-2">
        <Icon size={24} />
      </div>
      <div className="flex-1 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-sm sm:text-base font-medium truncate">{name}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isSearching && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs sm:text-sm text-muted-foreground w-80 text-right truncate">
                {path}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{path}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="hidden md:block text-xs sm:text-sm text-muted-foreground w-24 text-right">
        {type !== 'directory' && formatFileSize(size)}
      </div>
      <div className="hidden md:block text-xs sm:text-sm text-muted-foreground w-32 text-right">
        {date}
      </div>
    </div>
  )
}
