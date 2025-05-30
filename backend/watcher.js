const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const config = require('./config');
const indexer = require('./indexer');

let watchers = [];
let isWatching = false;
let watchedDirs = new Set();
let debounceTimers = {};


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


function watchDirectory(dirPath, currentDepth) {
  if (watchedDirs.has(dirPath)) return;
  
  // Check if we should ignore this directory
  if (shouldIgnore(dirPath)) {
    return;
  }
  
  try {
    // Add the directory to watched set
    watchedDirs.add(dirPath);
    
    // Start watching this directory
    const watcher = fs.watch(dirPath, { persistent: true }, (eventType, filename) => {
      handleFileChange(eventType, path.join(dirPath, filename));
    });
    
    watchers.push(watcher);
    
    // Watch subdirectories if within depth limit
    if (config.watchDepth === -1 || currentDepth < config.watchDepth) {
      const subdirs = utils.getSubdirectories(dirPath);
      
      for (const subdir of subdirs) {
        watchDirectory(subdir, currentDepth + 1);
      }
    }
  } catch (error) {
    console.error(`Error watching directory ${dirPath}:`, error);
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


function handleFileChange(eventType, filePath) {
  if (shouldIgnore(filePath)) return;
  
  const resolvedPath = path.resolve(filePath);
  
  // Debounce changes to avoid processing the same file multiple times
  const debounceKey = `${eventType}-${resolvedPath}`;
  
  if (debounceTimers[debounceKey]) {
    clearTimeout(debounceTimers[debounceKey]);
  }
  
  debounceTimers[debounceKey] = setTimeout(() => {
    processFileChange(eventType, resolvedPath);
    delete debounceTimers[debounceKey];
  }, config.watchDebounceInterval);
}

function processFileChange(eventType, filePath) {
  try {
    // Check if the file/directory still exists
    if (!fs.existsSync(filePath)) {
      // File was deleted
      console.log(`File deleted: ${filePath}`);
      handleFileDeletion(filePath);
      return;
    }
    
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Directory created or renamed
      handleDirectoryChange(filePath);
    } else {
      // File created or modified
      handleFileAddOrModify(filePath, stats);
    }
  } catch (error) {
    console.error(`Error processing file change for ${filePath}:`, error);
  }
}

async function handleFileAddOrModify(filePath, stats) {
  if (!config.useFileIndex || !indexer.isIndexBuilt()) {
    return;
  }
  
  const basePath = path.resolve(config.baseDirectory);
  if (!filePath.startsWith(basePath)) {
    return;
  }
  
  const relativePath = path.relative(basePath, filePath);
  const normalizedPath = utils.normalizePath(relativePath);
  const fileName = path.basename(filePath);
  
  console.log(`File changed: ${normalizedPath}`);
  
  try {
    // Create file record
    const fileRecord = {
      name: fileName,
      path: normalizedPath,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      mimeType: await utils.getFileType(filePath),
      isDirectory: stats.isDirectory()
    };
    
    // Update the index
    indexer.saveFileBatch([fileRecord]);
  } catch (error) {
    console.error(`Error updating index for ${filePath}:`, error);
  }
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
      watchDirectory(dirPath, depth);
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