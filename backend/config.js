// Configuration for the file server
// You can customize the base directory to serve files from
const path = require('path');
const os = require('os');

module.exports = {

  port: process.env.PORT || 11073,

  baseDirectory: process.env.BASE_DIRECTORY || 'H:/ACGN',
  // baseDirectory: process.env.BASE_DIRECTORY || 'D:/Program/Code/Computer_Science/',

  uploadCountLimit: process.env.UPLOAD_COUNT_LIMIT || 10,
  uploadSizeLimit: process.env.UPLOAD_SIZE_LIMIT || 1024 * 1024 * 1024 * 100, // 100MB

  contentMaxSize: process.env.CONTENT_MAX_SIZE || 5 * 1024 * 1024, // 5MB

  thumbnailCacheDir: process.env.THUMBNAIL_CACHE_DIR || path.join(os.tmpdir(), 'simple-file-server-thumbnails'),
  
  // User authentication settings
  // Format: 'username|password|rw' where 'rw' indicates read and write permissions
  // Examples: 'admin|admin123|rw' (full access), 'guest|guest123|r' (read-only access)
  // If empty array, authentication is disabled
  userRules: [
    'admin|admin123|rw',
    'guest|guest123|r'
  ],
  
  // File indexing options
  // useFileIndex: process.env.USE_FILE_INDEX === 'true' || false,
  useFileIndex: true,
  fileIndexPath: process.env.FILE_INDEX_PATH || path.join(os.tmpdir(), 'file-index.db'),
  rebuildIndexOnStartup: process.env.REBUILD_INDEX_ON_STARTUP === 'true' || false,
  indexBatchSize: parseInt(process.env.INDEX_BATCH_SIZE) || 1000,
  
  // File watcher options
  // useFileWatcher: process.env.USE_FILE_WATCHER === 'true' || false,
  useFileWatcher: true,
  // Watch depth: 0 = only base directory, 1 = base + one level, etc., -1 = all subdirectories (may impact performance)
  watchDepth: parseInt(process.env.WATCH_DEPTH) || 1, 
  // Ignore patterns (glob patterns) for files/directories to ignore during watching
  watchIgnorePatterns: (process.env.WATCH_IGNORE_PATTERNS || '**/.git/**,**/node_modules/**').split(','),
  // Debounce interval in ms for file change events
  watchDebounceInterval: parseInt(process.env.WATCH_DEBOUNCE_INTERVAL) || 1000
}
