const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const config = require('./config');
const indexer = require(`./indexer`);

let watchers = [];
let isWatching = false;
let watchedDirs = new Set();
let debounceTimers = {};

const retryQueue = new Map();


function initialize() {
  if (!config.useFileWatcher) {
    console.log('File watcher is disabled in config');
    return false;
  }

  console.log('Initializing file watcher');
  return true;
}

function startWatching(baseDir) {
  if (!config.useFileWatcher || isWatching) return;
  
  const basePath = path.resolve(baseDir);
  console.log(`Starting file watcher for ${basePath}`);
  
  try {
    // Start with the base directory
    watchDirectory(basePath, 0);
    isWatching = true;
    
    console.log(`File watcher started with depth ${config.watchDepth}`);
    return true;
  } catch (error) {
    console.error('Error starting file watcher:', error);
    return false;
  }
}

function stopWatching() {
  if (!isWatching) return;
  
  console.log('Stopping file watchers');
  
  // Close all watchers
  watchers.forEach(watcher => {
    try {
      watcher.close();
    } catch (error) {
      console.error('Error closing watcher:', error);
    }
  });

  // Clear retry queue
  retryQueue.forEach((timeoutId, dirPath) => {
    clearTimeout(timeoutId);
  });
  retryQueue.clear();
  
  // Clear state
  watchers = [];
  watchedDirs.clear();
  pendingChanges = {};
  Object.keys(debounceTimers).forEach(key => {
    clearTimeout(debounceTimers[key]);
  });
  debounceTimers = {};
  
  isWatching = false;
  console.log('File watchers stopped');
}

function retryWatch(dirPath, currentDepth = 0, retryCount = 0) {
  if (retryCount >= config.watchMaxRetries) {
    console.error(`Failed to watch ${dirPath} after ${config.watchMaxRetries} retries`);
    return;
  }

  console.log(`Retrying watch for ${dirPath} in ${config.watchRetryDelay}ms`);
  const timeoutId = setTimeout(() => {
    watchDirectory(dirPath, currentDepth, retryCount + 1);
  }, config.watchRetryDelay || 1000);

  retryQueue.set(dirPath, timeoutId);
}

function watchDirectory(dirPath, currentDepth = 0, retryCount = 0) {
  // First check if directory exists - avoid watching non-existent directories
  if (!fs.existsSync(dirPath)) {
    console.log(`Skipping watch for non-existent directory: ${dirPath}`);
    return false;
  }

  // Check if this directory is already being watched
  if (watchedDirs.has(dirPath)) {
    return true; // Already watching this directory
  }

  // Check if we should ignore this directory
  if (shouldIgnore(dirPath)) {
    return false;
  }

  try {
    // Add to watched directories set first
    watchedDirs.add(dirPath);

    const watcher = fs.watch(dirPath, { persistent: true }, (eventType, filename) => {
      if (filename === null) {
        console.log(`Received null filename for event ${eventType} in ${dirPath}`);
        return;
      }
      processFileEvent(eventType, path.join(dirPath, filename));
    });

    // Keep track of watcher instance for cleanup
    watchers.push(watcher);

    // Handle watcher errors
    watcher.on('error', (error) => {
      console.error(`Watcher error in ${dirPath}:`, error);
      
      // If directory no longer exists, clean up
      if (error.code === 'ENOENT') {
        console.log(`Directory no longer exists: ${dirPath}`);
        watchedDirs.delete(dirPath);
        return;
      }
      
      // Otherwise retry watching
      retryWatch(dirPath, currentDepth, retryCount);
    });

    // If we successfully added this directory, see if we need to add subdirectories
    if (config.watchDepth === -1 || currentDepth < config.watchDepth) {
      try {
        // Only attempt to read subdirectories if directory still exists
        if (fs.existsSync(dirPath)) {
          const subDirs = utils.getSubdirectories(dirPath);
          for (const subDir of subDirs) {
            // Watch each subdirectory with increased depth
            watchDirectory(subDir, currentDepth + 1);
          }
        }
      } catch (error) {
        console.error(`Error processing subdirectories in ${dirPath}:`, error);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error watching directory ${dirPath}:`, error);
    
    // If directory doesn't exist, remove it from watched dirs
    if (error.code === 'ENOENT') {
      watchedDirs.delete(dirPath);
      return false;
    }
    
    // Only retry if it's not an ENOENT error
    retryWatch(dirPath, currentDepth, retryCount);
    return false;
  }
}

function shouldIgnore(filePath) {
  if (!config.watchIgnorePatterns || !config.watchIgnorePatterns.length) {
    return false;
  }
  
  const normalizedPath = utils.normalizePath(filePath);
  
  // Simple pattern matching (could be enhanced with a glob library)
  for (const pattern of config.watchIgnorePatterns) {
    if (normalizedPath.includes(pattern.replace(/\*/g, ''))) {
      return true;
    }
  }
  
  return false;
}

function processFileEvent(eventType, filePath) {
  // Don't process ignored files
  if (shouldIgnore(filePath)) {
    return;
  }

  try {
    // Check if it exists (could be a delete event)
    const exists = fs.existsSync(filePath);

    if (exists) {
      try {
        const stats = fs.statSync(filePath);
        
        // Handle new directory creation if it exists
        if (stats.isDirectory()) {
          handleDirectoryChange(filePath);
        } else {
          // Handle file changes (create, modify)
          if (eventType === 'change') {
            handleFileModification(filePath);
          } else if (eventType === 'rename') {
            handleFileCreation(filePath);
          }
        }
      } catch (statsError) {
        // File might have been deleted between existsSync and statSync
        console.error(`Error getting stats for ${filePath}:`, statsError);
      }
    } else {
      // Handle file/directory deletion
      handleFileDeletion(filePath);
    }
  } catch (error) {
    console.error(`Error processing file change for ${filePath}:`, error);
  }
}

function handleFileCreation(filePath) {
  if (!config.useFileIndex || !indexer.isIndexBuilt()) {
    return;
  }
  
  try {
    const stats = fs.statSync(filePath);
    const basePath = path.resolve(config.baseDirectory);
    const relativePath = path.relative(basePath, filePath);
    
    // Skip if out of base directory
    if (!filePath.startsWith(basePath)) {
      return;
    }
    
    const normalizedPath = utils.normalizePath(relativePath);
    
    const fileData = {
      name: path.basename(filePath),
      path: normalizedPath,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      isDirectory: stats.isDirectory(),
      mimeType: stats.isDirectory() ? 'directory' : utils.getFileTypeSync(filePath)
    };
    
    console.log(`Adding file to index: ${normalizedPath}`);
    indexer.saveFileBatch([fileData]);
  } catch (error) {
    console.error(`Error handling file creation for ${filePath}:`, error);
  }
}

function handleFileModification(filePath) {
  // Simply treat modifications as creations (will update the existing index entry)
  handleFileCreation(filePath);
}

function handleFileDeletion(filePath) {
  if (!config.useFileIndex || !indexer.isIndexBuilt()) {
    return;
  }
  
  const basePath = path.resolve(config.baseDirectory);
  if (!filePath.startsWith(basePath)) {
    return;
  }
  
  const relativePath = path.relative(basePath, filePath);
  const normalizedPath = utils.normalizePath(relativePath);
  
  // Delete from index
  if (indexer.deleteFromIndex) {
    indexer.deleteFromIndex(normalizedPath);
  }

  // If a directory was deleted, clean up watcher state
  try {
    // Check if directory was being watched
    if (watchedDirs.has(filePath)) {
      console.log(`Removing deleted directory from watchers: ${filePath}`);
      
      // Remove from watched directories set
      watchedDirs.delete(filePath);
      
      // Find and close any associated watchers
      const watchersToRemove = [];
      watchers.forEach((watcher, index) => {
        try {
          // We can't directly identify which watcher is for which path,
          // but we can attempt to close them all and track which ones to remove
          try {
            watcher.close();
          } catch (closeError) {
            // Ignore close errors, the watcher might already be invalid
          }
          watchersToRemove.push(index);
        } catch (error) {
          console.error(`Error closing watcher for deleted directory: ${error.message}`);
        }
      });
      
      // Remove closed watchers from the watchers array (in reverse to avoid index issues)
      for (let i = watchersToRemove.length - 1; i >= 0; i--) {
        watchers.splice(watchersToRemove[i], 1);
      }
      
      // Cancel any retry attempts for this directory
      if (retryQueue.has(filePath)) {
        clearTimeout(retryQueue.get(filePath));
        retryQueue.delete(filePath);
        console.log(`Cancelled retry for deleted directory: ${filePath}`);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up after directory deletion: ${error.message}`);
  }
}

function handleDirectoryChange(dirPath) {
  // If this is a new directory, start watching it
  if (!watchedDirs.has(dirPath)) {
    // Calculate the current depth
    const basePath = path.resolve(config.baseDirectory);
    const relativePath = path.relative(basePath, dirPath);
    const depth = relativePath.split(path.sep).length;
    
    // Watch this new directory if within depth limit
    if (config.watchDepth === -1 || depth <= config.watchDepth) {
      console.log(`New directory detected: ${dirPath}`);
      
      // Try to add the directory to watched directories
      watchDirectory(dirPath, depth);
      
      // Add the directory to the index if the index is enabled
      if (config.useFileIndex && indexer.isIndexBuilt()) {
        try {
          const stats = fs.statSync(dirPath);
          const normalizedPath = utils.normalizePath(relativePath);
          
          // Create directory record
          const dirRecord = {
            name: path.basename(dirPath),
            path: normalizedPath,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            mimeType: 'directory',
            isDirectory: true
          };
          
          // Save to index
          indexer.saveFileBatch([dirRecord]);
        } catch (error) {
          console.error(`Error adding directory to index: ${dirPath}`, error);
        }
      }
    }
  }
}

function getStatus() {
  return {
    enabled: config.useFileWatcher,
    active: isWatching,
    watchedDirectories: Array.from(watchedDirs),
    watchDepth: config.watchDepth
  };
}

module.exports = {
  initialize,
  startWatching,
  stopWatching,
  getStatus
}; 