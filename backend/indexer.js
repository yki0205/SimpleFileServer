const os = require('os');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const utils = require('./utils');

const Database = require('better-sqlite3');

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const SQL = {
  CREATE_FILES_TABLE: `
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
  `,
  CREATE_METADATA_TABLE: `
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `,
  COUNT_FILES: 'SELECT COUNT(*) as count FROM files',
  GET_LAST_BUILT: "SELECT value FROM metadata WHERE key = 'last_built'",
  DELETE_ALL_FILES: 'DELETE FROM files',
  INSERT_FILE: `
    INSERT OR REPLACE INTO files (name, path, size, mtime, mimeType, isDirectory) 
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  UPDATE_METADATA: 'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
  SEARCH_FILES: `
    SELECT name, path, size, mtime, mimeType, isDirectory 
    FROM files 
    WHERE (name LIKE ? OR path LIKE ?) 
      AND (? = '%' OR path LIKE ?)
    LIMIT 1000
  `,
  FIND_IMAGES: `
    SELECT name, path, size, mtime, mimeType, isDirectory 
    FROM files 
    WHERE mimeType LIKE 'image/%'
      AND (? = '%' OR path LIKE ?)
    LIMIT 5000
  `,
  DELETE_FILE: 'DELETE FROM files WHERE path = ?'
};

let db = null;
let isIndexBuilding = false;
let indexProgress = {
  total: 0,
  processed: 0,
  lastUpdated: null,
  startTime: null,
  filesPerSecond: 0
};

function initializeDatabase() {
  if (db) return;
  
  try {
    db = new Database(config.fileIndexPath);
    db.exec(SQL.CREATE_FILES_TABLE);
    db.exec(SQL.CREATE_METADATA_TABLE);
    
    console.log('Database initialized at', config.fileIndexPath);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

function isIndexBuilt() {
  if (!db) return false;
  
  try {
    const result = db.prepare(SQL.COUNT_FILES).get();
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
    const fileCount = db.prepare(SQL.COUNT_FILES).get().count;
    const lastBuiltRow = db.prepare(SQL.GET_LAST_BUILT).get();
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
    db.prepare(SQL.DELETE_ALL_FILES).run();
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
  const now = new Date().toISOString();
  indexProgress = {
    total: 0,
    processed: 0,
    lastUpdated: now,
    startTime: now,
    filesPerSecond: 0
  };
  
  try {
    clearIndex();
    
    console.log('Counting files in', basePath);
    const fileCount = await countFiles(basePath);
    indexProgress.total = fileCount;
    console.log(`Found ${fileCount} files to index`);
    
    const cpuCount = os.cpus().length;
    const workerCount = Math.max(2, cpuCount * 2); 
    
    console.log(`Starting indexing with ${workerCount} workers`);
    
    const allDirectories = await collectDirectories(basePath);
    
    allDirectories.sort((a, b) => {
      const depthA = a.split(path.sep).length;
      const depthB = b.split(path.sep).length;
      return depthA - depthB;
    });
    
    const workerDirectories = Array(workerCount).fill().map(() => []);
    
    for (let i = 0; i < allDirectories.length; i++) {
      const workerIndex = i % workerCount;
      workerDirectories[workerIndex].push(allDirectories[i]);
    }
    
    const workerPromises = workerDirectories.map(dirs => 
      createIndexWorker(dirs, basePath)
    );
    
    const workerResults = await Promise.all(workerPromises);
    
    let totalIndexed = 0;
    
    if (!db) initializeDatabase();
    
    const finalTransaction = db.transaction(() => {
      for (const filesList of workerResults) {
        const count = saveFileBatch(filesList);
        totalIndexed += count;
        console.log(`Saved batch of ${count} files, total: ${totalIndexed}`);
      }
      
      const completionTime = new Date().toISOString();
      db.prepare(SQL.UPDATE_METADATA).run('last_built', completionTime);
      
      return totalIndexed;
    });
    
    totalIndexed = finalTransaction();
    
    console.log(`Indexing complete. Indexed ${totalIndexed} files.`);
    
    db.pragma('wal_checkpoint(FULL)');
    
    isIndexBuilding = false;
    indexProgress = {
      total: fileCount,
      processed: fileCount,
      lastUpdated: new Date().toISOString()
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
  if (!db) {
    console.error('Database not initialized in saveFileBatch');
    return 0;
  }
  
  const insert = db.prepare(SQL.INSERT_FILE);
  
  const insertMany = db.transaction((filesList) => {
    let count = 0;
    for (const file of filesList) {
      try {
        insert.run(
          file.name,
          file.path,
          file.size,
          file.mtime,
          file.mimeType,
          file.isDirectory ? 1 : 0
        );
        count++;
      } catch (error) {
        console.error(`Error inserting file ${file.path}:`, error.message);
      }
    }
    return count;
  });
  
  try {
    const count = insertMany(files);
    
    indexProgress.processed += count;
    indexProgress.lastUpdated = new Date().toISOString();
    
    if (indexProgress.startTime) {
      const elapsedSeconds = (new Date() - new Date(indexProgress.startTime)) / 1000;
      if (elapsedSeconds > 0) {
        indexProgress.filesPerSecond = Math.round(indexProgress.processed / elapsedSeconds);
      }
    }
    
    return count;
  } catch (error) {
    console.error('Error saving file batch:', error);
    return 0;
  }
}

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

function createIndexWorker(directories, basePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { 
        task: 'indexFiles', 
        directories, 
        basePath,
        batchSize: 1000
      }
    });
    
    let allFiles = [];
    
    worker.on('message', (message) => {
      if (message.type === 'batch') {
        allFiles = allFiles.concat(message.files);
        
        indexProgress.processed += message.files.length;
        indexProgress.lastUpdated = new Date().toISOString();
        
        if (indexProgress.startTime) {
          const elapsedSeconds = (new Date() - new Date(indexProgress.startTime)) / 1000;
          if (elapsedSeconds > 0) {
            indexProgress.filesPerSecond = Math.round(indexProgress.processed / elapsedSeconds);
          }
        }
      } else if (message.type === 'complete') {
        resolve(allFiles);
      }
    });
    
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
    
    const results = db.prepare(SQL.SEARCH_FILES).all(searchTerm, searchTerm, dirPath, dirPath);
    
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
    
    const results = db.prepare(SQL.FIND_IMAGES).all(dirPath, dirPath);
    
    return results.map(file => ({
      ...file,
      isDirectory: !!file.isDirectory
    }));
  } catch (error) {
    console.error('Error finding images in index:', error);
    return [];
  }
}

if (!isMainThread) {
  const { task, directories, basePath, directory, batchSize = 1000 } = workerData;
  
  if (task === 'indexFiles') {
    const taskQueue = [...directories];
    let currentFiles = [];
    
    (async () => {
      while (taskQueue.length > 0) {
        const dir = taskQueue.shift();
        try {
          await indexFilesInDirectory(dir, basePath, currentFiles, batchSize);
        } catch (error) {
          console.error(`Error indexing directory ${dir}:`, error);
        }
      }
      
      if (currentFiles.length > 0) {
        parentPort.postMessage({
          type: 'batch',
          files: currentFiles
        });
      }
      
      parentPort.postMessage({
        type: 'complete'
      });
    })();
  } 
  else if (task === 'countFiles') {
    (async () => {
      let count = 0;
      
      try {
        count = await countFilesInDirectoryAsync(directory);
      } catch (error) {
        console.error(`Error counting files in ${directory}:`, error);
      }
      
      parentPort.postMessage(count);
    })();
  }
}

async function countFilesInDirectoryAsync(directory) {
  let count = 0;
  
  try {
    const files = await fs.promises.readdir(directory);
    
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const counts = await Promise.all(batch.map(async (file) => {
        const fullPath = path.join(directory, file);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isDirectory()) {
            return await countFilesInDirectoryAsync(fullPath);
          } else {
            return 1;
          }
        } catch (error) {
          console.error(`Error accessing ${fullPath}:`, error.message);
          return 0;
        }
      }));
      
      count += counts.reduce((sum, c) => sum + c, 0);
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
  
  return count;
}

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
        console.error(`Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
  
  return count;
}

const mimeTypeCache = new Map();

async function indexFilesInDirectory(directory, basePath, results, batchSize) {
  try {
    const files = await fs.promises.readdir(directory);
    
    const processBatch = async (batch) => {
      return Promise.all(batch.map(async (file) => {
        const fullPath = path.join(directory, file);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          const isDir = stats.isDirectory();
          
          if (isDir) {
            await indexFilesInDirectory(fullPath, basePath, results, batchSize);
          } else {
            const relativePath = path.relative(basePath, fullPath);
            const normalizedPath = utils.normalizePath(relativePath);
            const fileExt = path.extname(file).toLowerCase();
            
            let mimeType;
            if (fileExt && mimeTypeCache.has(fileExt)) {
              mimeType = mimeTypeCache.get(fileExt);
            } else {
              mimeType = await utils.getFileType(fullPath);
              if (fileExt) {
                mimeTypeCache.set(fileExt, mimeType);
              }
            }
            
            results.push({
              name: file,
              path: normalizedPath,
              size: stats.size,
              mtime: stats.mtime.toISOString(),
              mimeType: mimeType,
              isDirectory: false
            });
            
            if (results.length >= batchSize) {
              const batch = [...results];
              results.length = 0;
              
              parentPort.postMessage({
                type: 'batch',
                files: batch
              });
            }
          }
        } catch (error) {
          console.error(`Error accessing ${fullPath}:`, error.message);
        }
      }));
    };
    
    const processingBatchSize = 100;
    for (let i = 0; i < files.length; i += processingBatchSize) {
      const batch = files.slice(i, i + processingBatchSize);
      await processBatch(batch);
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
}

async function collectDirectories(directory) {
  const directories = [directory];
  
  try {
    const files = await fs.promises.readdir(directory);
    
    for (const file of files) {
      const fullPath = path.join(directory, file);
      
      try {
        const stats = await fs.promises.stat(fullPath);
        
        if (stats.isDirectory()) {
          directories.push(fullPath);
          
          const subDirs = await collectDirectories(fullPath);
          directories.push(...subDirs);
        }
      } catch (error) {
        console.error(`Error accessing ${fullPath}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error.message);
  }
  
  return directories.filter((dir, index) => directories.indexOf(dir) === index);
}

function deleteFromIndex(filePath) {
  if (!db) return false;
  
  try {
    const result = db.prepare(SQL.DELETE_FILE).run(filePath);
    
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