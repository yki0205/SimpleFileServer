import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Folder, FolderOpen, File, FileText, FileArchive, Image, Music, Video, FileCode, BookOpen } from "lucide-react";

interface FileItemProps {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: string;
  cover?: string;
  onClick: () => void;
  className?: string;
}

export function FileItemGridView(
  { name, path, size, mtime, type, cover, onClick, className }: FileItemProps
) {
  const date = new Date(mtime).toLocaleDateString();

  const getIconComponent = () => {
    switch (type) {
      case 'directory': return FolderOpen;
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'document': return FileText;
      case 'archive': return FileArchive;
      case 'code': return FileCode;
      case 'comic': return BookOpen;
      default: return File;
    }
  };

  const Icon = getIconComponent();

  return (
    <Card
      className={cn(
        "w-full h-full",
        // "min-w-[150px] min-h-[150px]",
        // "max-w-[250px] max-h-[250px]",
        "flex flex-col items-center justify-center",
        "cursor-pointer hover:bg-accent transition-colors",
        "relative overflow-hidden",
        className
      )}
      onClick={onClick}
    >
      {/* Cover image as background */}
      {cover && (
        <div className="absolute inset-0 w-full h-full">
          <img
            src={`/api/thumbnail?path=${encodeURIComponent(cover)}&width=300&quality=80`}
            alt={`Cover for ${name}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Overlay to ensure content is visible */}
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]"></div>
        </div>
      )}

      <div className={`flex-1 flex items-center justify-center ${cover ? 'z-10' : ''}`}>
        <Icon size={48} className={cover ? "text-foreground/90" : ""} />
      </div>
      <div className={`w-full mt-2 p-2 ${cover ? 'z-10' : ''}`}>
        <div className="text-center truncate text-sm font-medium">{name}</div>
        {type !== 'directory' && (
          <div className="text-center text-xs text-muted-foreground">
            {"size: " + formatFileSize(size)}
            <br />
            {"modified: " + date}
          </div>
        )}
      </div>
    </Card>
  );
}
