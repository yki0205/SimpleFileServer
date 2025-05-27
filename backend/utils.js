const fs = require('fs');
const path = require('path');

/**
 * Normalize file path for consistent handling across platforms
 */
function normalizePath(filepath) {
  return filepath.replace(/\\/g, '/');
}

/**
 * Get file type based on extension
 */
function getFileType(extension) {
  // Image file extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico', '.raw', '.psd'];

  // Video file extensions
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];

  // Audio file extensions
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.aiff', '.alac', '.mid', '.midi'];

  // Document file extensions
  const documentExtensions = [
    // '.pdf', // pdf now supported, read the code below
    // '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // not supported yet
    '.txt', '.md', '.rtf', '.odt', '.ods', '.odp', '.csv', '.log', '.tex'];

  // Archive and executable file extensions
  const archiveExtensions = ['.zip', '.rar', '.tar', '.gz', '.bz2', '.7z', '.iso', '.dmg', '.pkg', '.deb', '.rpm', '.exe', '.msi', '.app',
    '.apk', '.xz', '.tgz', '.jar', '.war', '.ear'];

  // Code and programming file extensions
  const codeExtensions = [
    // C/C++ family
    '.c', '.cpp', '.h', '.hpp', '.cc', '.cxx', '.hxx', '.cu', '.cuh',

    // Web development
    '.jsx', '.tsx', '.js', '.ts', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',

    // Scripting languages
    '.py', '.rb', '.php', '.lua', '.pl', '.pm', '.perl', '.tcl', '.awk',

    // JVM languages
    '.java', '.kt', '.groovy', '.scala', '.clj', '.gradle',

    // Data formats
    '.json', '.xml', '.yaml', '.yml', '.toml', '.proto', '.graphql', '.gql',

    // Configuration files
    '.ini', '.conf', '.properties', '.env', '.config',

    // Shell scripts
    '.sh', '.bash', '.zsh', '.fish', '.ksh',

    // PowerShell
    '.powershell', '.ps1', '.psm1', '.psd1', '.ps1xml',

    // Other languages
    '.go', '.rs', '.swift', '.cs', '.fs', '.vb', '.sql', '.r', '.dart', '.elm', '.ex', '.exs',
    '.f', '.f90', '.f95', '.hs', '.lhs', '.lisp', '.cl', '.nim', '.ml', '.mli', '.d', '.erl', '.hrl',
    '.lua', '.sql', '.r', '.dart', '.elm', '.ex', '.exs',
  ];

  const comicExtensions = ['.cbz', '.cbr', '.cb7', '.cbt', '.cbl', '.cbrz', '.cbr7', '.cbrt', '.cblz', '.cblt'];

  const pdfExtensions = ['.pdf'];
  const epubExtensions = ['.epub'];

  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  if (archiveExtensions.includes(extension)) return 'archive';
  if (codeExtensions.includes(extension)) return 'code';
  if (comicExtensions.includes(extension)) return 'comic';
  if (pdfExtensions.includes(extension)) return 'pdf';
  if (epubExtensions.includes(extension)) return 'epub';
  return 'other';
}

/**
 * Get content type based on file extension
 */
function getContentType(extension) {
  const contentTypes = {
    // Plain text
    '.txt': 'text/plain',
    '.ini': 'text/plain',
    '.cfg': 'text/plain',
    '.conf': 'text/plain',
    '.log': 'text/plain',
    '.env': 'text/plain',

    // Markup and styling
    '.html': 'text/html',
    '.css': 'text/css',
    '.md': 'text/markdown',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.rtf': 'application/rtf',

    // Data formats
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.toml': 'text/toml',
    '.proto': 'text/plain',
    '.graphql': 'text/plain',
    '.gql': 'text/plain',

    // Programming languages
    '.js': 'text/javascript',
    '.jsx': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.cs': 'text/x-csharp',
    '.go': 'text/x-go',
    '.rb': 'text/x-ruby',
    '.php': 'text/x-php',
    '.sh': 'text/x-sh',
    '.bash': 'text/x-sh',
    '.zsh': 'text/x-sh',
    '.fish': 'text/x-sh',
    '.powershell': 'text/x-sh',
    '.ps1': 'text/x-sh',
    '.psm1': 'text/x-sh',
    '.vue': 'text/plain',
    '.svelte': 'text/plain',
    '.rs': 'text/plain',
    '.swift': 'text/plain',
    '.kt': 'text/plain',
    '.dart': 'text/plain',
    '.lua': 'text/plain',
    '.sql': 'text/plain',
    '.r': 'text/plain',
    '.dart': 'text/plain',
    '.elm': 'text/plain',
    '.ex': 'text/plain',
    '.exs': 'text/plain',

    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.ico': 'image/x-icon',
    '.raw': 'image/x-raw',
    '.psd': 'image/vnd.adobe.photoshop',

    // Videos
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/x-m4v',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.3gp': 'video/3gpp',
    '.ts': 'video/mp2t',

    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.m4a': 'audio/x-m4a',
    '.wma': 'audio/x-ms-wma',
    '.aiff': 'audio/aiff',
    '.alac': 'audio/alac',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',

    // Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',
    '.tex': 'application/x-tex',
    '.epub': 'application/epub+zip',

    // Archives
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.bz2': 'application/x-bzip2',
    '.7z': 'application/x-7z-compressed',
    '.iso': 'application/x-iso9660-image',
    '.dmg': 'application/x-apple-diskimage',
    '.pkg': 'application/vnd.apple.installer+xml',
    '.deb': 'application/x-debian-package',
    '.rpm': 'application/x-redhat-package-manager',
    '.exe': 'application/x-msdownload',
    '.msi': 'application/x-msdownload',
    '.app': 'application/x-apple-application',
    '.apk': 'application/vnd.android.package-archive',
    '.xz': 'application/x-xz',
    '.tgz': 'application/gzip',
    '.jar': 'application/java-archive',
    '.war': 'application/java-archive',
    '.ear': 'application/java-archive',

    // Comic
    '.cbz': 'application/x-cbz',
    '.cbr': 'application/x-cbr',
    '.cb7': 'application/x-cb7',
    '.cbt': 'application/x-cbt',
    '.cbl': 'application/x-cbl',
    '.cbrz': 'application/x-cbrz',
    '.cbr7': 'application/x-cbr7',
    '.cbrt': 'application/x-cbrt',
    '.cblz': 'application/x-cblz',
    '.cblt': 'application/x-cblt',
  };

  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Get all subdirectories in a directory
 */
function getSubdirectories(dir) {
  try {
    return fs.readdirSync(dir)
      .map(file => path.join(dir, file))
      .filter(filePath => fs.statSync(filePath).isDirectory());
  } catch (error) {
    console.error('Error getting subdirectories:', error);
    return [];
  }
}

module.exports = {
  normalizePath,
  getFileType,
  getContentType,
  getSubdirectories,
}; 