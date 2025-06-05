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

  GET_LAST_BUILT: "SELECT value FROM metadata WHERE key = 'last_built'",
  UPDATE_METADATA: 'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',

  COUNT_FILES: 'SELECT COUNT(*) as count FROM files',
  INSERT_FILE: `
  INSERT OR REPLACE INTO files (name, path, size, mtime, mimeType, isDirectory) 
  VALUES (?, ?, ?, ?, ?, ?)
  `,
  SEARCH_FILES: `
  SELECT name, path, size, mtime, mimeType, isDirectory 
  FROM files 
  WHERE (name LIKE ? OR path LIKE ?) 
  AND (? = '%' OR path LIKE ?)
  `,
  SEARCH_FILES_COUNT: `
  SELECT COUNT(*) as count 
  FROM files 
  WHERE (name LIKE ? OR path LIKE ?) 
  AND (? = '%' OR path LIKE ?)
  `,
  FIND_IMAGES: `
  SELECT name, path, size, mtime, mimeType, isDirectory 
  FROM files 
  WHERE mimeType LIKE 'image/%'
  AND (? = '%' OR path LIKE ?)
  `,
  FIND_IMAGES_COUNT: `
  SELECT COUNT(*) as count 
  FROM files 
  WHERE mimeType LIKE 'image/%'
  AND (? = '%' OR path LIKE ?)
  `,
  DELETE_FILE: 'DELETE FROM files WHERE path = ?',
  DELETE_ALL_FILES: 'DELETE FROM files',
};

let db = null;
let isIndexBuilding = false;
let indexProgress = {
  total: 0,
  processed: 0,
  errors: 0,
  startTime: null,
  lastUpdated: null,
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

/**
 * Search files in the index with optional pagination
 * @param {string} query - The search query
 * @param {string} directory - Optional directory to limit search to
 * @param {number} page - Page number (1-based) for pagination (optional)
 * @param {number} limit - Number of results per page (optional)
 * @returns {Object} Search results with pagination info
 */
function searchIndex(query, directory = '', page, limit) {
  if (!db) return { results: [], total: 0, hasMore: false };
  
  try {
    const searchTerm = `%${query}%`;
    const dirPath = directory ? `${directory}%` : '%';
    
    // Get total count for pagination info
    const totalCount = db.prepare(SQL.SEARCH_FILES_COUNT)
      .get(searchTerm, searchTerm, dirPath, dirPath).count;
    
    let results;
    let hasMore = false;
    
    // Handle pagination if specified
    if (page !== undefined && limit !== undefined) {
      // Convert to numbers and validate
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 100;
      
      // Calculate offset
      const offset = (pageNum - 1) * limitNum;
      
      // Paginated query
      const paginatedQuery = `${SQL.SEARCH_FILES} LIMIT ? OFFSET ?`;
      results = db.prepare(paginatedQuery)
        .all(searchTerm, searchTerm, dirPath, dirPath, limitNum, offset);
      
      // Check if there are more results
      hasMore = offset + results.length < totalCount;
    } else {
      // Backward compatibility: return all results if no pagination specified
      results = db.prepare(SQL.SEARCH_FILES)
        .all(searchTerm, searchTerm, dirPath, dirPath);
    }
    
    return {
      results: results.map(file => ({
        ...file,
        isDirectory: !!file.isDirectory
      })),
      total: totalCount,
      hasMore
    };
  } catch (error) {
    console.error('Error searching index:', error);
    return { results: [], total: 0, hasMore: false };
  }
}

/**
 * Find images in the index with optional pagination
 * @param {string} directory - Optional directory to limit search to
 * @param {number} page - Page number (1-based) for pagination (optional)
 * @param {number} limit - Number of results per page (optional)
 * @returns {Object} Images results with pagination info
 */
function findImagesInIndex(directory = '', page, limit) {
  if (!db) return { images: [], total: 0, hasMore: false };
  
  try {
    const dirPath = directory ? `${directory}%` : '%';
    
    // Get total count for pagination info
    const totalCount = db.prepare(SQL.FIND_IMAGES_COUNT)
      .get(dirPath, dirPath).count;
    
    let results;
    let hasMore = false;
    
    // Handle pagination if specified
    if (page !== undefined && limit !== undefined) {
      // Convert to numbers and validate
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 100;
      
      // Calculate offset
      const offset = (pageNum - 1) * limitNum;
      
      // Paginated query
      const paginatedQuery = `${SQL.FIND_IMAGES} LIMIT ? OFFSET ?`;
      results = db.prepare(paginatedQuery)
        .all(dirPath, dirPath, limitNum, offset);
      
      // Check if there are more results
      hasMore = offset + results.length < totalCount;
    } else {
      // Backward compatibility: return all results if no pagination specified
      results = db.prepare(SQL.FIND_IMAGES)
        .all(dirPath, dirPath);
    }
    
    return {
      images: results.map(file => ({
        ...file,
        isDirectory: !!file.isDirectory
      })),
      total: totalCount,
      hasMore
    };
  } catch (error) {
    console.error('Error finding images in index:', error);
    return { images: [], total: 0, hasMore: false };
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
    
    indexProgress.lastUpdated = new Date().toISOString();
    
    return count;
  } catch (error) {
    console.error('Error saving file batch:', error);
    return 0;
  }
}



async function countFiles(directory) {
  let count = 0;
  
  try {
    const files = await fs.promises.readdir(directory);
    
    const batchSize = config.countFilesBatchSize || 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const counts = await Promise.all(batch.map(async (file) => {
        const fullPath = path.join(directory, file);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isDirectory()) {
            return await countFiles(fullPath);
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

async function createCountWorker(directory) {
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



const mimeTypeCache = new Map();

async function indexFiles(directory, basePath, results, batchSize, workerIndex = 0, workerCount = 1) {
  try {
    const files = await fs.promises.readdir(directory);
    
    const processBatch = async (batch) => {
      return Promise.all(batch.map(async (file) => {
        const fullPath = path.join(directory, file);
        
        try {
          const stats = await fs.promises.stat(fullPath);
          const isDir = stats.isDirectory();
          
          if (isDir) {
            await indexFiles(fullPath, basePath, results, batchSize, workerIndex, workerCount);
          } else {
            // Partition files among workers using a simple hash to ensure each file is processed by only one worker
            const fileHash = Math.abs(fullPath.split('').reduce((hash, char) => {
              return ((hash << 5) - hash) + char.charCodeAt(0);
            }, 0));
            
            // Only process this file if its hash modulo workerCount equals this worker's index
            if (fileHash % workerCount === workerIndex) {
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

function createIndexWorker(directories, basePath, workerIndex, workerCount) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { 
        task: 'indexFiles', 
        directories, 
        basePath,
        batchSize: config.indexBatchSize || 100,
        workerIndex,
        workerCount
      }
    });
    
    let allFiles = [];
    
    worker.on('message', (message) => {
      if (message.type === 'batch') {
        allFiles = allFiles.concat(message.files);
        indexProgress.processed += message.files.length;
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



if (!isMainThread) {
  const { task, directories, basePath, directory, batchSize = 1000, workerIndex = 0, workerCount = 1 } = workerData;
  
  if (task === 'indexFiles') {
    const taskQueue = [...directories];
    let currentFiles = [];
    
    (async () => {
      while (taskQueue.length > 0) {
        const dir = taskQueue.shift();
        try {
          await indexFiles(dir, basePath, currentFiles, batchSize, workerIndex, workerCount);
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
        count = await countFiles(directory);
      } catch (error) {
        console.error(`Error counting files in ${directory}:`, error);
      }
      
      parentPort.postMessage(count);
    })();
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
    errors: 0,
    lastUpdated: now,
    startTime: now,
  };
  
  try {
    clearIndex();
    
    console.log('Counting files in', basePath);
    const fileCount = await createCountWorker(basePath);
    indexProgress.total = fileCount;
    console.log(`Found ${fileCount} files to index`);
    
    const cpuCount = os.cpus().length;
    const workerCount = Math.max(2, cpuCount * 2); 
    
    console.log(`Starting indexing with ${workerCount} workers`);
    
    const workerPromises = [];
    
    for (let i = 0; i < workerCount; i++) {
      // Assign each worker a range of files to process
      workerPromises.push(
        createIndexWorker([basePath], basePath, i, workerCount)
      );
    }
    
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
    indexProgress.processed = totalIndexed;
    indexProgress.errors = fileCount - totalIndexed;
    indexProgress.lastUpdated = new Date().toISOString();
    
    return { 
      success: true, 
      stats: { ...indexProgress } 
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



module.exports = {
  initializeDatabase,
  isIndexBuilt,
  getIndexStats,
  clearIndex,
  deleteFromIndex,
  searchIndex,
  findImagesInIndex,
  saveFileBatch,
  buildIndex,
}; 