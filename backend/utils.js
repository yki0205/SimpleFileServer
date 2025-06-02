const fs = require('fs');
const path = require('path');
const config = require('./config');
const mimeMagic = require('mime-magic');

function isRecoverableError(error) {
  const fatalErrors = ['EACCES', 'EADDRINUSE', 'ECONNREFUSED'];
  return !fatalErrors.includes(error.code);
}

function normalizePath(filepath) {
  return filepath.replace(/\\/g, '/');
}

function getFileTypeByMime(filePath) {
  return new Promise((resolve) => {
    mimeMagic(filePath, (err, type) => {
      if (err) {
        console.debug(`Content-based MIME detection failed for ${filePath}:`, err.message);
        const ext = path.extname(filePath).toLowerCase();
        resolve(getFileTypeByExt(ext));
      } else {
        resolve(type || 'application/octet-stream');
      }
    });
  });
}

function getFileTypeByExt(extension) {
  const contentTypes = {
    // Text
    '.txt': 'text/plain',
    '.md': 'text/markdown',

    // Image
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.psd': 'image/vnd.adobe.photoshop',

    // Video
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',

    // Audio
    '.mp3': 'audio/mpeg',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',

    // Application
    '.cbz': 'application/cbz',
    '.cbr': 'application/cbr',
    '.epub': 'application/epub',
    '.pdf': 'application/pdf',
    ...config.customContentTypes
  };

  return contentTypes[extension] || 'application/octet-stream';
}

async function getFileType(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const extension = path.extname(filePath).toLowerCase();
  if (config.useMimeMagic) {
    if (extension === '.cbz') return 'application/cbz';
    if (extension === '.cbr') return 'application/cbr';
    if (extension === '.epub') return 'application/epub';
    try {
      return await getFileTypeByMime(filePath);
    } catch (error) {
      console.error('Error detecting MIME type:', error);
      const ext = path.extname(filePath).toLowerCase();
      return getFileTypeByExt(ext);
    }
  } else {
    return getFileTypeByExt(extension);
  }
}

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
  isRecoverableError,
  normalizePath,
  getFileType,
  getFileTypeByMime,
  getFileTypeByExt,
  getSubdirectories,
}; 