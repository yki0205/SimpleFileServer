const express = require('express');
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const AdmZip = require('adm-zip')
const multer = require('multer')
const config = require('./config')

const app = express();
const PORT = process.env.PORT || 11073;

app.use(cors());
app.use(express.json());

app.get('/api/files', (req, res) => {
  const { dir = '' } = req.query;
  const basePath = path.resolve(config.baseDirectory)
  const fullPath = path.join(basePath, dir)

  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: "Access denied" })
  }

  try {
    const stats = fs.statSync(fullPath);

    if (!stats.isDirectory()) {
      return res.status(400).json({ error: "Not a directory" })
    }

    const files = fs.readdirSync(fullPath)
    const fileDetails = files.map(file => {
      const filePath = path.join(fullPath, file);
      const fileStats = fs.statSync(filePath);
      const isDirectory = fileStats.isDirectory();
      const extension = path.extname(file).toLowerCase();

      return {
        name: file,
        path: path.join(dir, file).replace(/\\/g, '/'),
        size: fileStats.size,
        mtime: fileStats.mtime,
        type: isDirectory ? 'directory' : getFileType(extension)
      }
    })

    res.json({ files: fileDetails })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
});

app.get('/api/search', (req, res) => {
  const { query, dir = '' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const searchPath = path.join(basePath, dir);

  if (!query) {
    return res.status(400).json({ error: "Search query is required" })
  }

  try {
    const results = searchFiles(searchPath, query, basePath);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
});

app.get('/api/download', (req, res) => {
  const { path: filePath } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, filePath);
  
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      const zip = new AdmZip();
      zip.addLocalFolder(fullPath);
      const zipBuffer = zip.toBuffer();
      const fileName = path.basename(fullPath);
      const encodedFileName = encodeURIComponent(fileName).replace(/%20/g, ' ');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.zip`);
      res.send(zipBuffer);
    } else {
      const fileName = path.basename(fullPath);
      const encodedFileName = encodeURIComponent(fileName).replace(/%20/g, ' ');
      
      const extension = path.extname(fullPath).toLowerCase();
      const contentType = getContentType(extension);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.sendFile(fullPath);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', (req, res) => {
  const { dir = '' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const uploadPath = path.join(basePath, dir);
  
  if (!uploadPath.startsWith(basePath)) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!fs.existsSync(uploadPath)) {
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (error) {
      return res.status(500).json({ error: `Failed to create directory: ${error.message}` });
    }
  }
  
  // Configure multer storage
  const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
      // Keep original filename
      cb(null, file.originalname);
    }
  });
  
  // File filter to reject unwanted files
  const fileFilter = (req, file, cb) => {
    // You can add file type restrictions here if needed
    cb(null, true);
  };
  
  const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 1024 * 1024 * 100 // 100MB limit
    }
  }).array('files', 10); // Accept up to 10 files with field name 'files'
  
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }
    
    const uploadedFiles = req.files.map(file => ({
      name: file.originalname,
      path: path.join(dir, file.originalname).replace(/\\/g, '/'),
      size: file.size,
      mimetype: file.mimetype
    }));
    
    res.status(200).json({ 
      message: 'Files uploaded successfully', 
      files: uploadedFiles 
    });
  });
})

app.post('/api/mkdir', (req, res) => {
  const { path: dirPath } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, dirPath);
  
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    fs.mkdirSync(fullPath, { recursive: true });
    res.status(200).json({ message: 'Directory created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.post('/api/rename', (req, res) => {
  const { path: filePath, newName } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, filePath);
  
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    fs.renameSync(fullPath, newPath);
    res.status(200).json({ message: 'File renamed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.delete('/api/delete', (req, res) => {
  const { path: filePath } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, filePath);
  
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    fs.unlinkSync(fullPath);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.post('/api/copy_paste', (req, res) => {
  // TODO: Implement copy
})

app.post('/api/move', (req, res) => {
  // TODO: Implement move
})

app.get('/api/content', (req, res) => {
  const { path: filePath } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, filePath);
  
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read content of a directory' });
    }
    
    // Check file size to prevent loading very large files
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (stats.size > MAX_SIZE) {
      return res.status(413).json({ error: 'File too large to preview' });
    }
    
    // Set appropriate content type for text files
    const extension = path.extname(fullPath).toLowerCase();
    const contentType = getContentType(extension);
    const fileName = path.basename(fullPath);
    const encodedFileName = encodeURIComponent(fileName).replace(/%20/g, ' ');
    
    // res.setHeader('Content-Type', contentType);
    // Always set content type as text/plain to ensure content is treated as string
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);

    // Read and send file content
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading file' });
      }
      res.send(data);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function searchFiles(dir, query, basePath) {
  let results = [];
  
  try {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);
      
      if (file.toLowerCase().includes(query)) {
        results.push({
          name: file,
          path: path.relative(basePath, fullPath).replace(/\\/g, '/'),
          size: stats.size,
          mtime: stats.mtime,
          type: stats.isDirectory() ? 'directory' : getFileType(path.extname(file).toLowerCase())
        });
      }
      
      if (stats.isDirectory()) {
        results = results.concat(searchFiles(fullPath, query, basePath));
      }
    }
  } catch (error) {
    console.error(`Error searching in ${dir}:`, error);
  }
  
  return results;
}

function getFileType(extension) {
  // Image file extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.ico', '.raw', '.psd'];
  
  // Video file extensions
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v', '.mpg', '.mpeg', '.3gp', '.ts'];
  
  // Audio file extensions
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.aiff', '.alac', '.mid', '.midi'];
  
  // Document file extensions
  const documentExtensions = [
    // '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // not supported yet
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
    '.f', '.f90', '.f95', '.hs', '.lhs', '.lisp', '.cl', '.nim', '.ml', '.mli', '.d', '.erl', '.hrl'
  ];
  
  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  if (archiveExtensions.includes(extension)) return 'archive';
  if (codeExtensions.includes(extension)) return 'code';

  return 'other';
}

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
  };
  
  return contentTypes[extension] || 'application/octet-stream';
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 