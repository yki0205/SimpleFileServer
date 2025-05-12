import { formatFileSize } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { 
  Folder, 
  File, 
  FileText, 
  Image, 
  Music, 
  Video 
} from 'lucide-react';

export interface FileItemProps {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  type: string;
  onClick: (path: string, isDirectory: boolean) => void;
  viewMode: 'list' | 'grid' | 'image';
}

export function FileItem({
  name,
  path,
  isDirectory,
  size,
  mtime,
  type,
  onClick,
  viewMode
}: FileItemProps) {
  const isImage = type === 'image';
  const date = new Date(mtime).toLocaleDateString();
  
  // Get the appropriate icon component based on file type
  const getIconComponent = () => {
    if (isDirectory) return Folder;
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      case 'document': return FileText;
      default: return File;
    }
  };
  
  const Icon = getIconComponent();
  
  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center p-2 hover:bg-accent rounded-md cursor-pointer"
        onClick={() => onClick(path, isDirectory)}
      >
        <div className="mr-2">
          <Icon size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium">{name}</div>
        </div>
        <div className="hidden md:block text-sm text-muted-foreground w-24 text-right">
          {!isDirectory && formatFileSize(size)}
        </div>
        <div className="hidden md:block text-sm text-muted-foreground w-32 text-right">
          {date}
        </div>
      </div>
    );
  }
  
  if (viewMode === 'grid') {
    return (
      <Card
        className="w-[150px] h-[150px] flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => onClick(path, isDirectory)}
      >
        <div className="flex-1 flex items-center justify-center">
          <Icon size={48} />
        </div>
        <div className="w-full mt-2">
          <div className="text-center truncate text-sm">{name}</div>
          {!isDirectory && (
            <div className="text-center text-xs text-muted-foreground">
              {formatFileSize(size)}
            </div>
          )}
        </div>
      </Card>
    );
  }
  
  // Image view mode
  if (viewMode === 'image' && isImage) {
    return (
      <Card
        className="w-[200px] h-[200px] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onClick(path, isDirectory)}
      >
        <div className="w-full h-[160px] overflow-hidden bg-muted">
          <img
            src={`/api/download?path=${encodeURIComponent(path)}`}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="p-2">
          <div className="truncate text-sm">{name}</div>
        </div>
      </Card>
    );
  }
  
  // Fallback for non-images in image view
  if (viewMode === 'image') {
    return (
      <Card
        className="w-[200px] h-[200px] flex flex-col items-center justify-center p-3 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => onClick(path, isDirectory)}
      >
        <div className="flex-1 flex items-center justify-center">
          <Icon size={64} />
        </div>
        <div className="w-full mt-2">
          <div className="text-center truncate text-sm">{name}</div>
          {!isDirectory && (
            <div className="text-center text-xs text-muted-foreground">
              {formatFileSize(size)}
            </div>
          )}
        </div>
      </Card>
    );
  }
  
  return null;
} 