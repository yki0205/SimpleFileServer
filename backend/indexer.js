const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const utils = require('./utils');

const Database = require('better-sqlite3');

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

let db = null;
let isIndexBuilding = false;
let indexProgress = {
  total: 0,
  processed: 0,
  lastUpdated: null
};

function initializeDatabase() {
  if (db) return;
  
  try {
    db = new Database(config.fileIndexPath);
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        size INTEGER NOT NULL,
        mtime TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        isDirectory INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
      CREATE INDEX IF NOT EXISTS idx_files_mimeType ON files(mimeType);
      CREATE INDEX IF NOT EXISTS idx_files_isDirectory ON files(isDirectory);
    `);
    
    // Add metadata table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    
    console.log('Database initialized at', config.fileIndexPath);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

function isIndexBuilt() {
  if (!db) return false;
  
  try {
    const result = db.prepare('SELECT COUNT(*) as count FROM files').get();
    return result.count > 0;
  } catch (error) {
    console.error('Error checking if index is built:', error);
    return false;
  }
}

function getIndexStats() {
  if (!db) {
    return {
      fileCount: 0,
      lastBuilt: null,
      isBuilding: isIndexBuilding,
      progress: indexProgress
    };
  }
  
  try {
    const fileCount = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
    const lastBuiltRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_built'").get();
    const lastBuilt = lastBuiltRow ? lastBuiltRow.value : null;
    
    return {
      fileCount,
      lastBuilt,
      isBuilding: isIndexBuilding,
      progress: indexProgress
    };
  } catch (error) {
    console.error('Error getting index stats:', error);
    return {
      fileCount: 0,
      lastBuilt: null,
      isBuilding: isIndexBuilding,
      progress: indexProgress
    };
  }
}

function clearIndex() {
  if (!db) return false;
  
  try {
    db.prepare('DELETE FROM files').run();
    console.log('Index cleared');
    return true;
  } catch (error) {
    console.error('Error clearing index:', error);
    return false;
  }
}

async function buildIndex(basePath) {
  if (isIndexBuilding) {
    return { 
      success: false, 
      message: 'Index build already in progress' 
    };
  }
  
  isIndexBuilding = true;
  indexProgress = {
    total: 0,
    processed: 0,
    lastUpdated: new Date().toISOString()
  };
  
  try {
    // Clear existing index
    clearIndex();
    
    // Count total files first to track progress
    console.log('Counting files in', basePath);
    const fileCount = await countFiles(basePath);
    indexProgress.total = fileCount;
    console.log(`Found ${fileCount} files to index`);
    
    // Use worker threads for indexing
    const cpuCount = os.cpus().length;
    const workerCount = Math.max(1, cpuCount - 1); // Leave one CPU free
    
    console.log(`Starting indexing with ${workerCount} workers`);
    
    // Get all subdirectories to distribute work
    const directories = [basePath];
    const topDirs = utils.getSubdirectories(basePath);
    directories.push(...topDirs);
    
    // If we have more workers than top directories, add more subdirectories
    if (directories.length < workerCount * 2) {
      for (const dir of [...topDirs]) { // Clone to avoid modifying during iteration
        const subDirs = utils.getSubdirectories(dir);
        directories.push(...subDirs);
      }
    }
    
    // Distribute directories among workers
    const directoriesPerWorker = Math.ceil(directories.length / workerCount);
    const workerDirectories = [];
    
    for (let i = 0; i < workerCount; i++) {
      const start = i * directoriesPerWorker;
      const end = Math.min(start + directoriesPerWorker, directories.length);
      workerDirectories.push(directories.slice(start, end));
    }
    
    // Start workers
    const workerPromises = workerDirectories.map(dirs => 
      createIndexWorker(dirs, basePath)
    );
    
    // Collect all worker results
    const workerResults = await Promise.all(workerPromises);
    
    // Save all files to the database
    let totalIndexed = 0;
    
    for (const filesList of workerResults) {
      totalIndexed += await saveFileBatch(filesList);
    }
    
    // Update metadata
    const now = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run('last_built', now);
    
    console.log(`Indexing complete. Indexed ${totalIndexed} files.`);
    
    isIndexBuilding = false;
    indexProgress = {
      total: fileCount,
      processed: fileCount,
      lastUpdated: now
    };
    
    return { 
      success: true, 
      stats: { 
        fileCount: totalIndexed,
        lastBuilt: now 
      } 
    };
  } catch (error) {
    console.error('Error building index:', error);
    isIndexBuilding = false;
    return { 
      success: false, 
      message: error.message 
    };
  }
}

function saveFileBatch(files) {
  if (!db) return 0;
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO files (name, path, size, mtime, mimeType, isDirectory) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((filesList) => {
    let count = 0;
    for (const file of filesList) {
      insert.run(
        file.name,
        file.path,
        file.size,
        file.mtime,
        file.mimeType,
        file.isDirectory ? 1 : 0
      );
      count++;
    }
    return count;
  });
  
  try {
    const count = insertMany(files);
    
    // Update progress
    indexProgress.processed += count;
    indexProgress.lastUpdated = new Date().toISOString();
    
    return count;
  } catch (error) {
    console.error('Error saving file batch:', error);
    return 0;
  }
}

// Count files in a directory recursively
async function countFiles(directory) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { task: 'countFiles', directory }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Create a worker to index files
function createIndexWorker(directories, basePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { task: 'indexFiles', directories, basePath }
    });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

function searchIndex(query, directory = '') {
  if (!db) return [];
  
  try {
    const searchTerm = `%${query}%`;
    const dirPath = directory ? `${directory}%` : '%';
    
    const results = db.prepare(`
      SELECT name, path, size, mtime, mimeType, isDirectory 
      FROM files 
      WHERE (name LIKE ? OR path LIKE ?) 
        AND (? = '%' OR path LIKE ?)
      LIMIT 1000
    `).all(searchTerm, searchTerm, dirPath, dirPath);
    
    // Convert isDirectory from integer to boolean
    return results.map(file => ({
      ...file,
      isDirectory: !!file.isDirectory
    }));
  } catch (error) {
    console.error('Error searching index:', error);
    return [];
  }
}

function findImagesInIndex(directory = '') {
  if (!db) return [];
  
  try {
    const dirPath = directory ? `${directory}%` : '%';
    
    const results = db.prepare(`
      SELECT name, path, size, mtime, mimeType, isDirectory 
      FROM files 
      WHERE mimeType LIKE 'image/%'
        AND (? = '%' OR path LIKE ?)
      LIMIT 5000
    `).all(dirPath, dirPath);
    
    // Convert isDirectory from integer to boolean
    return results.map(file => ({
      ...file,
      isDirectory: !!file.isDirectory
    }));
  } catch (error) {
    console.error('Error finding images in index:', error);
    return [];
  }
}

// Worker thread handling
if (!isMainThread) {
  const { task, directories, basePath, directory } = workerData;
  
  if (task === 'indexFiles') {
    const files = [];
    
    (async () => {
      for (const dir of directories) {
        try {
          await indexFilesInDirectory(dir, basePath, files);
        } catch (error) {
          console.error(`Error indexing directory ${dir}:`, error);
        }
      }
      
      parentPort.postMessage(files);
    })();
  } 
  else if (task === 'countFiles') {
    let count = 0;
    
    try {
      count = countFilesInDirectory(directory);
    } catch (error) {
      console.error(`Error counting files in ${directory}:`, error);
    }
    
    parentPort.postMessage(count);
  }
}

// Count files in a directory recursively
function countFilesInDirectory(directory) {
  let count = 0;
  
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      
      try {
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          count += countFilesInDirectory(fullPath);
        } else {
          count++;
        }
      } catch (error) {
        // Skip files with access issues
        console.error(`Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
  
  return count;
}

// Index files in a directory recursively
async function indexFilesInDirectory(directory, basePath, results) {
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      
      try {
        const stats = fs.statSync(fullPath);
        const isDir = stats.isDirectory();
        
        if (isDir) {
          await indexFilesInDirectory(fullPath, basePath, results);
        } else {
          const relativePath = path.relative(basePath, fullPath);
          const normalizedPath = utils.normalizePath(relativePath);
          
          const mimeType = await utils.getFileType(fullPath);
          
          results.push({
            name: file,
            path: normalizedPath,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
            mimeType: mimeType,
            isDirectory: false
          });
        }
      } catch (error) {
        // Skip files with access issues
        console.error(`Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
}

function deleteFromIndex(filePath) {
  if (!db) return false;
  
  try {
    // Delete the file from the index
    const result = db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
    
    if (result.changes > 0) {
      console.log(`Removed ${filePath} from index`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error deleting file from index:', error);
    return false;
  }
}

module.exports = {
  initializeDatabase,
  buildIndex,
  searchIndex,
  findImagesInIndex,
  isIndexBuilt,
  getIndexStats,
  clearIndex,
  saveFileBatch,
  deleteFromIndex
}; 