import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Folder, File, FileText, FileArchive, Image, Music, Video, FileCode } from "lucide-react";

interface FileItemProps {
  name: string;
  path: string;
  size: number;
  mtime: string;
  type: string;
  onClick: () => void;
  className?: string;
}

export function FileItemGridView(
  { name, path, size, mtime, type, onClick, className }: FileItemProps
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
    <Card
      className={cn(
        "w-full h-full",
        "min-w-[150px] min-h-[150px]",
        "max-w-[250px] max-h-[250px]",
        "flex flex-col items-center justify-center",
        "p-3 cursor-pointer hover:bg-accent transition-colors",
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 flex items-center justify-center">
        <Icon size={48} />
      </div>
      <div className="w-full mt-2">
        <div className="text-center truncate text-sm">{name}</div>
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
