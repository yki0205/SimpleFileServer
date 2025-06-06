const express = require('express');
const os = require('os');
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const utils = require('./utils');
const config = require('./config')
// handle zip and rar files
const AdmZip = require('adm-zip')
const unrar = require('node-unrar-js');
// handle file uploads
const multer = require('multer')
// indexer
const indexer = require('./indexer');
// watcher
const watcher = require('./watcher');
// auth
const { authMiddleware, writePermissionMiddleware } = require('./auth');
// worker threads
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
// For PSD file processing
const { execSync } = require('child_process');
const crypto = require('crypto');
const PSD = require('psd');

const pLimit = require('p-limit').default;
const fileReadLimit = pLimit(100);

// Create logs directory if it doesn't exist
if (!fs.existsSync(config.logsDirectory)) {
  fs.mkdirSync(config.logsDirectory, { recursive: true });
}

// Create thumbnail cache directory if it doesn't exist
if (config.generateThumbnail && !fs.existsSync(config.thumbnailCacheDir)) {
  fs.mkdirSync(config.thumbnailCacheDir, { recursive: true });
}

// Create PSD cache directory if it doesn't exist
if (config.processPsd && !fs.existsSync(config.psdCacheDir)) {
  fs.mkdirSync(config.psdCacheDir, { recursive: true });
}

process.env.NO_CONFIG_WARNING = 'true';
process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';

const originalStdoutWrite = process.stdout.write;
process.stdout.write = (chunk, encoding, callback) => {
  const date = new Date().toISOString();
  return originalStdoutWrite.call(process.stdout, `[${date}] ${chunk}`, encoding, callback);
};

const originalStderrWrite = process.stderr.write;
process.stderr.write = (chunk, encoding, callback) => {
  const date = new Date().toISOString();
  return originalStderrWrite.call(process.stderr, `[${date}] ${chunk}`, encoding, callback);
};

process
  .on('uncaughtException', (error, origin) => {
    const errorTime = new Date().toISOString();
    const errorLog = `
    ====== Uncaught Exception at ${errorTime} ======
    Origin: ${origin}
    Error: ${error}
    Stack: ${error.stack}
    ================================================
    `;

    fs.appendFileSync(path.join(config.logsDirectory, 'crash.log'), errorLog);
    console.error(`[${errorTime}] Uncaught Exception:`, error);
    // exit if the error is not recoverable
    if (!utils.isRecoverableError(error)) {
      process.exit(1);
    }
  })
  .on('unhandledRejection', (reason, promise) => {
    const errorTime = new Date().toISOString();
    const errorLog = `
    ====== Unhandled Rejection at ${errorTime} ======
    Promise: ${promise}
    Reason: ${reason}
    ${reason.stack ? `Stack: ${reason.stack}` : ''}
    ================================================
    `;

    fs.appendFileSync(path.join(config.logsDirectory, 'rejections.log'), errorLog);
    console.error(`[${errorTime}] Unhandled Rejection:`, reason);
  });



const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());

app.get('/api/bg', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const config = require('./config');
  
  try {
    // Get the background image path from config
    const bgImagePath = config.backgroundImagePath;
    
    // Check if file exists
    if (!fs.existsSync(bgImagePath)) {
      console.error(`Background image not found at path: ${bgImagePath}`);
      return res.status(404).send('Background image not found');
    }
    
    // Determine content type based on file extension
    const ext = path.extname(bgImagePath).toLowerCase();
    const contentType = utils.getFileTypeByExt(ext);

    if (!contentType.startsWith('image/')) {
      console.error(`Unsupported file extension: ${ext}`);
      return res.status(400).send('Unsupported file extension');
    }

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Stream the file to response
    const stream = fs.createReadStream(bgImagePath);
    stream.pipe(res);
  } catch (error) {
    console.error('Error serving background image:', error);
    res.status(500).send('Error serving background image');
  }
})

// Apply authentication middleware to all other routes
app.use(authMiddleware);

if (config.useFileIndex) {
  console.log('Initializing file indexer...');
  indexer.initializeDatabase();

  if (config.rebuildIndexOnStartup || !indexer.isIndexBuilt()) {
    console.log('Building file index...');
    indexer.buildIndex(config.baseDirectory)
      .then(result => {
        if (result.success) {
          console.log('File index built successfully');
          console.log(`Total files count: ${result.stats.total}`);
          console.log(`Files processed: ${result.stats.processed}`);
          console.log(`Errors: ${result.stats.errors}`);
          console.log(`Start time: ${result.stats.startTime}`);
          console.log(`Duration: ${new Date(result.stats.lastUpdated).getTime() - new Date(result.stats.startTime).getTime()}ms`);
        } else {
          console.error('Failed to build file index:', result.message);
        }
      })
      .catch(error => {
        console.error('Error building file index:', error);
      });
  } else {
    const stats = indexer.getIndexStats();
    console.log(`Using existing file index with ${stats.fileCount} files, last built on ${stats.lastBuilt}`);
  }
}

if (config.useFileWatcher) {
  console.log('Initializing file watcher...');
  try {
    watcher.initialize() && watcher.startWatching(config.baseDirectory);
  } catch (error) {
    console.error('Error initializing file watcher:', error);
  } finally {
    console.log('File watcher initialized');
  }
}


app.get('/api/version', (req, res) => {
  res.json({
    version: '1.0.0',
    username: req.user?.username,
    permissions: req.user?.permissions || 'none'
  });
});

app.get('/api/validate-token', (req, res) => {
  res.json({
    isAuthenticated: true,
    username: req.user?.username,
    permissions: req.user?.permissions || 'none'
  });
});

app.get('/api/files', async (req, res) => {
  const { dir = '', cover = 'false', page, limit = 100, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, dir);

  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    if (config.parallelFileProcessing) {
      const stats = await fs.promises.stat(fullPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Not a directory" });
      }

      const files = await fs.promises.readdir(fullPath);

      const processFile = async (file) => {
        const filePath = path.join(fullPath, file);

        // limit the concurrency of file read
        return fileReadLimit(async () => {
          try {
            const [fileStats, mimeType] = await Promise.all([
              fs.promises.stat(filePath),
              utils.getFileType(filePath).catch(() => 'unknown')
            ]);

            const result = {
              name: file,
              path: utils.normalizePath(path.join(dir, file)),
              size: fileStats.size,
              mtime: fileStats.mtime,
              isDirectory: fileStats.isDirectory(),
              mimeType: fileStats.isDirectory() ? undefined : mimeType
            };

            if (cover === 'true' && result.isDirectory) {
              await processFolderCover(result, filePath, dir);
            }

            return result;
          } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
            return {
              name: file,
              error: 'Failed to get file info'
            };
          }
        });
      };

      // handle partial failures
      const results = await Promise.allSettled(files.map(processFile));

      // filter valid results
      let fileDetails = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      
      // Sort files before pagination
      fileDetails = sortFiles(fileDetails, sortBy, sortOrder);
      
      // Handle pagination if specified
      const total = fileDetails.length;
      let hasMore = false;
      
      if (page !== undefined) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        
        hasMore = endIndex < total;
        fileDetails = fileDetails.slice(startIndex, endIndex);
      }

      res.json({ 
        files: fileDetails,
        total: total,
        hasMore: hasMore
      });

    } else {
      const stats = fs.statSync(fullPath);

      if (!stats.isDirectory()) {
        return res.status(400).json({ error: "Not a directory" })
      }

      const files = fs.readdirSync(fullPath);
      const fileDetailsPromises = files.map(async file => {
        const filePath = path.join(fullPath, file);
        const fileStats = fs.statSync(filePath);
        const isDirectory = fileStats.isDirectory();

        const fileDetail = {
          name: file,
          path: utils.normalizePath(path.join(dir, file)),
          size: fileStats.size,
          mtime: fileStats.mtime,
          isDirectory,
        };

        if (!isDirectory) {
          fileDetail.mimeType = await utils.getFileType(filePath);
        }

        if (cover === 'true' && isDirectory) {
          try {
            const subFiles = fs.readdirSync(filePath);
            const imageFilesPromises = await Promise.all(
              subFiles.map(async subFile => {
                const subFilePath = path.join(filePath, subFile);
                const mimeType = await utils.getFileType(subFilePath);
                return { subFile, mimeType };
              })
            );

            const imageFiles = imageFilesPromises
              .filter(({ mimeType }) => mimeType.startsWith('image/'))
              .map(({ subFile }) => subFile)
              .sort();

            if (imageFiles.length > 0) {
              const coverImage = imageFiles[0];
              fileDetail.cover = utils.normalizePath(path.join(dir, file, coverImage));
            }
          } catch (err) {
            // Silently fail if can't read subdirectory
          }
        }

        return fileDetail;
      });

      let fileDetails = await Promise.all(fileDetailsPromises);
      
      // Sort files before pagination
      fileDetails = sortFiles(fileDetails, sortBy, sortOrder);
      
      // Handle pagination if specified
      const total = fileDetails.length;
      let hasMore = false;
      
      if (page !== undefined) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 100;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        
        hasMore = endIndex < total;
        fileDetails = fileDetails.slice(startIndex, endIndex);
      }

      res.json({
        files: fileDetails,
        total: total,
        hasMore: hasMore
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search', (req, res) => {
  const { query, dir = '', page, limit = 100, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const searchPath = path.join(basePath, dir);

  if (!query) {
    return res.status(400).json({ error: "Search query is required" });
  }

  try {
    // Use file index if enabled
    if (config.useFileIndex && indexer.isIndexBuilt()) {
      // Call searchIndex with pagination and sorting parameters
      const searchResult = indexer.searchIndex(query, dir, page, limit, sortBy, sortOrder);
      return res.json(searchResult);
    }

    // Otherwise, use real-time search
    parallelSearch(searchPath, query, basePath)
      .then(results => {
        // Sort results before pagination
        results = sortFiles(results, sortBy, sortOrder);
        
        // Apply pagination if specified
        let hasMore = false;
        let total = results.length;
        let paginatedResults = results;
        
        if (page !== undefined) {
          const pageNum = parseInt(page) || 1;
          const limitNum = parseInt(limit) || 100;
          const startIndex = (pageNum - 1) * limitNum;
          const endIndex = startIndex + limitNum;
          
          hasMore = endIndex < total;
          paginatedResults = results.slice(startIndex, endIndex);
        }
        
        // Format response to match the structure of paginated results
        res.json({ 
          results: paginatedResults, 
          total: total,
          hasMore: hasMore
        });
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
});

app.get('/api/images', (req, res) => {
  const { dir = '', page, limit = 100, sortBy = 'name', sortOrder = 'asc' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const searchPath = path.join(basePath, dir);

  if (!searchPath.startsWith(basePath)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    // Use file index if enabled
    if (config.useFileIndex && indexer.isIndexBuilt()) {
      // Call findImagesInIndex with pagination and sorting parameters
      const imagesResult = indexer.findImagesInIndex(dir, page, limit, sortBy, sortOrder);
      return res.json(imagesResult);
    }

    // Otherwise, use real-time search
    parallelFindImages(searchPath, basePath)
      .then(images => {
        // Sort images before pagination
        images = sortFiles(images, sortBy, sortOrder);
        
        // Apply pagination if specified
        let hasMore = false;
        let total = images.length;
        let paginatedImages = images;
        
        if (page !== undefined) {
          const pageNum = parseInt(page) || 1;
          const limitNum = parseInt(limit) || 100;
          const startIndex = (pageNum - 1) * limitNum;
          const endIndex = startIndex + limitNum;
          
          hasMore = endIndex < total;
          paginatedImages = images.slice(startIndex, endIndex);
        }
        
        // Format response to match the structure of paginated results
        res.json({ 
          images: paginatedImages, 
          total: total,
          hasMore: hasMore
        });
      })
      .catch(error => {
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download', (req, res) => {
  const { path: requestedPath, paths: requestedPaths } = req.query;
  const basePath = path.resolve(config.baseDirectory);

  if (!requestedPath && !requestedPaths) {
    return res.status(400).json({ error: 'No path or paths provided' });
  }

  let pathList = [];
  if (requestedPath) {
    pathList.push(path.join(basePath, requestedPath));
  }
  if (requestedPaths) {
    pathList = requestedPaths.split('|').map(p => path.join(basePath, p.trim()));
  }

  try {
    const zip = new AdmZip();

    for (const filePath of pathList) {

      if (!fullPath.startsWith(basePath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        zip.addLocalFolder(filePath);
      } else {
        zip.addLocalFile(filePath);
      }
    }

    const zipBuffer = zip.toBuffer();
    // const fileName = path.basename(pathList[0]);
    const fileName = new Date().toISOString().replace(/[-:Z]/g, '');
    const encodedFileName = encodeURIComponent(fileName).replace(/%20/g, ' ');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.zip`);
    res.send(zipBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/raw', async (req, res) => {
  const { path: requestedPath } = req.query;
  const basePath = path.resolve(config.baseDirectory);

  // Detect if this is an absolute path (temp file) or relative path
  let fullPath;
  const tempDirPrefix = 'comic-extract-';

  // Check if it's a temp comic file path
  const isTempComicFile = requestedPath.includes(tempDirPrefix);

  if (isTempComicFile) {
    // For temp files, use the path directly
    fullPath = requestedPath;
  } else {
    // Regular case - relative path from base directory
    fullPath = path.join(basePath, requestedPath);
  }

  // Only prevent access to non-temp files outside the base directory
  if (!fullPath.startsWith(basePath) && !isTempComicFile) {
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
      
      // Get file mime type
      const mimeType = await utils.getFileType(fullPath);
      
      // Check if this is a PSD file that needs processing
      if (mimeType === 'image/vnd.adobe.photoshop' && config.processPsd) {
        // Process PSD file
        const processedFilePath = await processPsdFile(fullPath);
        
        if (processedFilePath) {
          // If processing was successful, serve the processed file
          const processedMimeType = config.psdFormat === 'png' ? 'image/png' : 'image/jpeg';
          res.setHeader('Content-Type', processedMimeType);
          res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}.${config.psdFormat}`);
          return fs.createReadStream(processedFilePath).pipe(res);
        }
        // If processing failed, fall back to original behavior
      }
      
      // Normal file handling
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
      res.sendFile(fullPath);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/content', async (req, res) => {
  const { path: requestedPath } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, requestedPath);

  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot show content of a directory' });
    }

    if (stats.size > config.contentMaxSize) {
      return res.status(413).json({ error: 'File too large to display' });
    }

    const contentType = await utils.getFileType(fullPath);
    if (!contentType.startsWith('text/')) {
      return res.status(400).json({ error: 'Cannot show content of a non-text file' });
    }
    const content = fs.readFileSync(fullPath, 'utf8');

    res.setHeader('Content-Type', contentType);
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/thumbnail', async (req, res) => {
  const { path: requestedPath, width = 300, height, quality = 80 } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, requestedPath);

  // Security check to ensure we don't access files outside base directory
  if (!fullPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!config.generateThumbnail) {
    const mimeType = await utils.getFileType(fullPath);
    if (mimeType.startsWith('image/')) {
      res.setHeader('Content-Type', mimeType);
      return fs.createReadStream(fullPath).pipe(res);
    }
    return res.status(400).json({ error: 'Thumbnail generation is disabled' });
  }

  try {
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found', fullPath });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: 'Cannot generate thumbnail for directory' });
    }

    const mimeType = await utils.getFileType(fullPath);
    if (mimeType.startsWith('image/')) {
      if (mimeType === 'image/bmp') {
        // Cause sharp cannot handle bmp files, I return the original file directly
        res.setHeader('Content-Type', 'image/bmp');
        return fs.createReadStream(fullPath).pipe(res);
      }
      if (mimeType === 'image/x-icon') {
        // Cause sharp cannot handle ico files, I return the original file directly
        res.setHeader('Content-Type', 'image/x-icon');
        return fs.createReadStream(fullPath).pipe(res);
      }
      if (mimeType === 'image/vnd.adobe.photoshop') {
        // If PSD processing is enabled, try to use the processed version for thumbnail
        if (config.processPsd) {
          const processedFilePath = await processPsdFile(fullPath);
          
          if (processedFilePath) {
            // Use the processed file to generate thumbnail with Sharp
            const sharp = require('sharp');
            
            // Cache mechanism: generate cache path
            const cacheDir = config.thumbnailCacheDir || path.join(os.tmpdir(), 'thumbnails');
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
            }
            
            // Create cache filename for the processed PSD
            const cacheKey = `psd_${Buffer.from(fullPath).toString('base64').replace(/[=]/g, '').replace(/[\\/]/g, '_')}_w${width}_${height || 'auto'}_q${quality}`;
            const cachePath = path.join(cacheDir, `${cacheKey}.jpg`);
            
            // If cache exists, return cached thumbnail directly
            if (fs.existsSync(cachePath)) {
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for one year
              return fs.createReadStream(cachePath).pipe(res);
            }
            
            // Process with Sharp
            let transformer = sharp(processedFilePath)
              .rotate() // Auto-rotate based on EXIF data
              .resize({
                width: parseInt(width),
                height: height ? parseInt(height) : null,
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: parseInt(quality) });
              
            // Save to cache
            transformer
              .clone()
              .toFile(cachePath)
              .catch(err => {
                console.error('Error caching thumbnail:', err);
                if (fs.existsSync(cachePath)) {
                  fs.unlinkSync(cachePath);
                }
              });
              
            // Send to client
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return transformer.pipe(res);
          }
        }
        
        // If processing is disabled or failed, return the original file
        res.setHeader('Content-Type', 'image/vnd.adobe.photoshop');
        return fs.createReadStream(fullPath).pipe(res);
      }

      // Cache mechanism: generate cache path
      const cacheDir = config.thumbnailCacheDir || path.join(os.tmpdir(), 'thumbnails');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Create cache filename (based on original path, width, height and quality)
      const cacheKey = `${Buffer.from(fullPath).toString('base64').replace(/[=]/g, '').replace(/[\\/]/g, '_')}_w${width}_${height || 'auto'}_q${quality}`;
      const cachePath = path.join(cacheDir, `${cacheKey}.jpg`);

      // If cache exists, return cached thumbnail directly
      if (fs.existsSync(cachePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for one year
        return fs.createReadStream(cachePath).pipe(res);
      }

      // Process image with Sharp library
      const sharp = require('sharp');

      let transformer = sharp(fullPath)
        .rotate() // Auto-rotate based on EXIF data
        .resize({
          width: parseInt(width),
          height: height ? parseInt(height) : null,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: parseInt(quality) });

      // Save to cache
      transformer
        .clone()
        .toFile(cachePath)
        .catch(err => {
          console.error('Error caching thumbnail:', err);
          // Delete possibly generated incomplete file
          if (fs.existsSync(cachePath)) {
            fs.unlinkSync(cachePath);
          }
        });

      // Send to client
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      transformer.pipe(res);
    } else if (mimeType.startsWith('video/')) {

      // Cache mechanism: generate cache path
      const cacheDir = config.thumbnailCacheDir || path.join(os.tmpdir(), 'thumbnails');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // Create cache filename (based on original path, width, height and quality)
      const cacheKey = `${Buffer.from(fullPath).toString('base64')}_w${width}_${height || 'auto'}_q${quality}`;
      const cachePath = path.join(cacheDir, `${cacheKey}.jpg`);

      // If cache exists, return cached thumbnail directly
      if (fs.existsSync(cachePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for one year
        return fs.createReadStream(cachePath).pipe(res);
      }

      // Process video with ffmpeg
      const ffmpeg = require('fluent-ffmpeg');

      const outputPath = path.join(cacheDir, `${cacheKey}.jpg`);

      ffmpeg(fullPath)
        .screenshots({
          timestamps: ['10%'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: `${width}x${height || '?'}`
        })
        .on('end', () => {
          // Send to client
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          fs.createReadStream(outputPath).pipe(res);
        })
        .on('error', (err) => {
          console.error('Error generating video thumbnail:', err);
          res.status(500).json({ error: 'Failed to generate thumbnail' });
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        });
    } else {
      res.status(400).json({ error: 'File is not supported' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comic', async (req, res) => {
  try {
    const filePath = req.query.path;
    const token = req.query.token;
    if (!filePath) {
      return res.status(400).json({ error: 'No file path provided' });
    }

    const basePath = path.resolve(config.baseDirectory);
    const fullPath = path.join(basePath, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const extension = path.extname(fullPath).toLowerCase();
    const pages = [];

    // Get normalized temp directory prefix (for Windows path consistency)
    let tempDirBase = os.tmpdir();
    // On Windows, make sure we consistently use forward slashes
    if (process.platform === 'win32') {
      tempDirBase = tempDirBase.replace(/\\/g, '/');
    }

    // Create extraction directory name
    const extractionId = Date.now();
    const tempDirName = `comic-extract-${extractionId}`;

    if (extension === '.cbz') {
      // Handle CBZ files (ZIP format)
      try {
        const zip = new AdmZip(fullPath);
        const entries = zip.getEntries();

        // Filter image files
        const imageEntries = entries.filter(entry => {
          const ext = path.extname(entry.entryName).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });

        // Sort by filename
        imageEntries.sort((a, b) => {
          // Extract numbers from filenames for natural sorting
          const aMatch = a.entryName.match(/(\d+)/g);
          const bMatch = b.entryName.match(/(\d+)/g);

          if (aMatch && bMatch) {
            const aNum = parseInt(aMatch[aMatch.length - 1]);
            const bNum = parseInt(bMatch[bMatch.length - 1]);
            return aNum - bNum;
          }

          return a.entryName.localeCompare(b.entryName);
        });

        // Create a temporary directory for extracted images
        const tempDir = path.join(tempDirBase, tempDirName);
        fs.mkdirSync(tempDir, { recursive: true });

        // Extract and create URLs for each image
        for (let i = 0; i < imageEntries.length; i++) {
          const entry = imageEntries[i];
          const entryPath = path.join(tempDir, entry.entryName);

          // Create directory structure if needed
          const entryDir = path.dirname(entryPath);
          fs.mkdirSync(entryDir, { recursive: true });

          // Extract the file
          zip.extractEntryTo(entry, entryDir, false, true);

          // Check if file exists after extraction
          if (!fs.existsSync(entryPath)) {
            continue;
          }

          // Create a direct raw URL for the image - don't use relative path since it's a temp file
          pages.push(`/api/raw?path=${encodeURIComponent(entryPath)}${token ? `&token=${token}` : ''}`);
        }
      } catch (error) {
        return res.status(500).json({ error: 'Failed to extract CBZ file' });
      }
    } else if (extension === '.cbr') {
      // Handle CBR files (RAR format)
      try {
        // Read RAR file
        const rarData = fs.readFileSync(fullPath);

        // Create extractor
        const extractor = await unrar.createExtractorFromData({ data: rarData });
        const list = extractor.getFileList();

        if (!list.success) {
          throw new Error('Failed to read CBR file list');
        }

        // Filter image files
        const imageEntries = list.fileHeaders.filter(header => {
          const ext = path.extname(header.name).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });

        // Sort by filename
        imageEntries.sort((a, b) => {
          // Extract numbers from filenames for natural sorting
          const aMatch = a.name.match(/(\d+)/g);
          const bMatch = b.name.match(/(\d+)/g);

          if (aMatch && bMatch) {
            const aNum = parseInt(aMatch[aMatch.length - 1]);
            const bNum = parseInt(bMatch[bMatch.length - 1]);
            return aNum - bNum;
          }

          return a.name.localeCompare(b.name);
        });

        // Create a temporary directory for extracted images
        const tempDir = path.join(tempDirBase, tempDirName);
        fs.mkdirSync(tempDir, { recursive: true });

        // Extract files
        const extraction = extractor.extractAll({
          targetPath: tempDir,
          overwrite: true
        });

        if (!extraction.success) {
          throw new Error('Failed to extract CBR file');
        }

        // Create URLs for each image
        for (const entry of imageEntries) {
          const entryPath = path.join(tempDir, entry.name);

          // Check if file exists after extraction
          if (!fs.existsSync(entryPath)) {
            continue;
          }

          // Create a direct raw URL for the image - don't use relative path since it's a temp file
          pages.push(`/api/raw?path=${encodeURIComponent(entryPath)}${token ? `&token=${token}` : ''}`);
        }
      } catch (error) {
        return res.status(500).json({ error: 'Failed to extract CBR file' });
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    return res.json({ pages });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});



app.post('/api/upload', writePermissionMiddleware, (req, res) => {
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
    destination: function (req, file, cb) {
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, decodedName);
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
      fileSize: config.uploadSizeLimit
    }
  }).array('files', config.uploadCountLimit);

  upload(req, res, function (err) {
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

app.post('/api/upload-folder', writePermissionMiddleware, (req, res) => {
  const { dir = '' } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const uploadPath = path.join(basePath, dir);

  if (!uploadPath.startsWith(basePath)) {
    return res.status(403).json({ error: "Access denied" });
  }

  // Ensure base upload directory exists
  if (!fs.existsSync(uploadPath)) {
    try {
      fs.mkdirSync(uploadPath, { recursive: true });
    } catch (error) {
      return res.status(500).json({ error: `Failed to create directory: ${error.message}` });
    }
  }

  // Configure multer storage with directory structure preservation
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Extract directory path from the webkitRelativePath field
      let relativePath = '';
      if (file.originalname.includes('/')) {
        relativePath = file.originalname.substring(0, file.originalname.lastIndexOf('/'));
      } else if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        parts.pop(); // Remove the filename
        relativePath = parts.join('/');
      }

      // Create full directory path
      const fullPath = path.join(uploadPath, relativePath);
      
      // Create nested directories if they don't exist
      try {
        fs.mkdirSync(fullPath, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory structure: ${error.message}`);
        // Continue anyway, multer will handle the error if the directory doesn't exist
      }

      cb(null, fullPath);
    },
    filename: function (req, file, cb) {
      // Extract just the filename without path
      let fileName = file.originalname;
      if (fileName.includes('/')) {
        fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
      } else if (file.webkitRelativePath) {
        fileName = file.webkitRelativePath.split('/').pop();
      }
      
      const decodedName = Buffer.from(fileName, 'latin1').toString('utf8');
      cb(null, decodedName);
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
      fileSize: config.uploadSizeLimit
    }
  }).array('files', config.uploadCountLimit);

  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }

    const uploadedFiles = req.files.map(file => {
      // Calculate the relative path from the base upload directory
      const relativePath = path.relative(uploadPath, file.path);
      return {
        name: file.originalname,
        path: path.join(dir, relativePath).replace(/\\/g, '/'),
        size: file.size,
        mimetype: file.mimetype
      };
    });

    res.status(200).json({
      message: 'Files and folders uploaded successfully',
      files: uploadedFiles
    });
  });
})

app.post('/api/mkdir', writePermissionMiddleware, (req, res) => {
  const { path: dirPath, name: dirName } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, dirPath, dirName);

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

app.post('/api/rename', writePermissionMiddleware, (req, res) => {
  const { path: filePath, newName } = req.query;
  const basePath = path.resolve(config.baseDirectory);
  const fullPath = path.join(basePath, filePath);
  const newPath = path.join(basePath, newName);

  if (!fullPath.startsWith(basePath) || !newPath.startsWith(basePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    fs.renameSync(fullPath, newPath);
    res.status(200).json({ message: 'File renamed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

app.delete('/api/delete', writePermissionMiddleware, (req, res) => {
  const { path: filePath, paths: filePaths } = req.query;

  if (!filePath && !filePaths) {
    return res.status(400).json({ error: 'No file path provided' });
  }

  if (filePath) {
    const basePath = path.resolve(config.baseDirectory);
    const fullPath = path.join(basePath, filePath);

    if (!fullPath.startsWith(basePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (fs.statSync(fullPath).isDirectory()) {
      try {
        const success = utils.safeDeleteDirectory(fullPath);
        if (success) {
          res.status(200).json({ message: 'Directory deleted successfully' });
        } else {
          res.status(500).json({ error: 'Failed to completely delete directory' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
      return;
    }

    try {
      fs.unlinkSync(fullPath);
      res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    const basePath = path.resolve(config.baseDirectory);
    const fullPaths = filePaths.split('|').map(p => path.join(basePath, p.trim()));

    for (const fullPath of fullPaths) {
      if (!fullPath.startsWith(basePath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (fs.statSync(fullPath).isDirectory()) {
        try {
          const success = utils.safeDeleteDirectory(fullPath);
          if (!success) {
            return res.status(500).json({ error: 'Failed to completely delete directory' });
          }
        } catch (error) {
          return res.status(500).json({ error: error.message });
        }
        continue;
      }

      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }

    res.status(200).json({ message: 'Files deleted successfully' });
  }
})

app.post('/api/clone', writePermissionMiddleware, (req, res) => {
  const { sources, destination } = req.body;
  const basePath = path.resolve(config.baseDirectory);
  
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'No sources provided' });
  }

  const results = [];
  try {
    const destDir = path.join(basePath, destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    for (const source of sources) {
      const sourcePath = path.join(basePath, source);
      const destPath = path.join(destDir, path.basename(source));

      if (!sourcePath.startsWith(basePath) || !destPath.startsWith(basePath)) {
        results.push({ source, status: 'failed', error: 'Access denied' });
        continue;
      }

      try {
        if (!fs.existsSync(sourcePath)) {
          results.push({ source, status: 'failed', error: 'Source not found' });
          continue;
        }

        const stats = fs.statSync(sourcePath);
        if (stats.isDirectory()) {
          copyFolderRecursiveSync(sourcePath, destPath);
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }
        results.push({ source, status: 'success', destination: path.relative(basePath, destPath) });
      } catch (error) {
        results.push({ source, status: 'failed', error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/move', writePermissionMiddleware, (req, res) => {
  const { sources, destination } = req.body;
  const basePath = path.resolve(config.baseDirectory);

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    console
    return res.status(400).json({ error: 'No sources provided' });
  }

  const results = [];
  try {
    const destDir = path.join(basePath, destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    for (const source of sources) {
      const sourcePath = path.join(basePath, source);
      const destPath = path.join(destDir, path.basename(source));

      if (!sourcePath.startsWith(basePath) || !destPath.startsWith(basePath)) {
        results.push({ source, status: 'failed', error: 'Access denied' });
        continue;
      }

      try {
        if (!fs.existsSync(sourcePath)) {
          results.push({ source, status: 'failed', error: 'Source not found' });
          continue;
        }

        fs.renameSync(sourcePath, destPath);
        results.push({ source, status: 'success', destination: path.relative(basePath, destPath) });
      } catch (error) {
        results.push({ source, status: 'failed', error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/index-status', (req, res) => {
  if (!config.useFileIndex) {
    return res.json({ enabled: false });
  }

  const stats = indexer.getIndexStats();
  res.json({
    enabled: true,
    ...stats
  });
});

app.post('/api/rebuild-index', writePermissionMiddleware, (req, res) => {
  if (!config.useFileIndex) {
    return res.status(400).json({ error: "File indexing is not enabled" });
  }

  const stats = indexer.getIndexStats();
  if (stats.isBuilding) {
    return res.status(409).json({ error: "Index is already being built", progress: stats.progress });
  }

  // Start rebuilding index in background
  indexer.buildIndex(config.baseDirectory)
    .then(result => {
      console.log(result.success ? 'Index rebuilt successfully' : 'Failed to rebuild index');
    })
    .catch(error => {
      console.error('Error rebuilding index:', error);
    });

  res.json({ message: "Index rebuild started", progress: indexer.getIndexStats().progress });
});

app.get('/api/watcher-status', (req, res) => {
  if (!config.useFileWatcher) {
    return res.json({ enabled: false });
  }

  const status = watcher.getStatus();
  res.json({
    enabled: true,
    ...status
  });
});

app.post('/api/toggle-watcher', writePermissionMiddleware, (req, res) => {
  if (!config.useFileWatcher) {
    return res.status(400).json({ error: "File watching is not enabled in config" });
  }

  const status = watcher.getStatus();

  if (status.active) {
    watcher.stopWatching();
    return res.json({ message: "File watcher stopped", active: false });
  } else {
    const started = watcher.startWatching(config.baseDirectory);
    return res.json({
      message: started ? "File watcher started" : "Failed to start file watcher",
      active: started
    });
  }
});


async function searchFiles(dir, query, basePath) {
  let results = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);

      if (file.toLowerCase().includes(query.toLowerCase())) {
        const fileDetail = {
          name: file,
          path: utils.normalizePath(path.relative(basePath, fullPath)),
          size: stats.size,
          mtime: stats.mtime,
          isDirectory: stats.isDirectory(),
        }

        if (!stats.isDirectory()) {
          fileDetail.mimeType = await utils.getFileType(fullPath);
        }

        results.push(fileDetail);
      }

      if (stats.isDirectory()) {
        results = results.concat(await searchFiles(fullPath, query, basePath));
      }
    }
  } catch (error) {
    console.error('Error searching files:', error);
  }

  return results;
}

async function findAllImages(dir, basePath) {
  let results = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        results = results.concat(await findAllImages(fullPath, basePath));
      } else {
        const mimeType = await utils.getFileType(fullPath);
        if (mimeType.startsWith('image/')) {
          results.push({
            name: file,
            path: utils.normalizePath(path.relative(basePath, fullPath)),
            size: stats.size,
            mtime: stats.mtime,
            mimeType: mimeType,
            isDirectory: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error finding images:', error);
  }

  return results;
}

async function searchFilesInDirectory(dir, query, basePath) {
  let results = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);

      if (!stats.isDirectory() && file.toLowerCase().includes(query.toLowerCase())) {
        const mimeType = await utils.getFileType(fullPath);
        results.push({
          name: file,
          path: utils.normalizePath(path.relative(basePath, fullPath)),
          size: stats.size,
          mtime: stats.mtime,
          mimeType: mimeType,
          isDirectory: false
        });
      }
    }
  } catch (error) {
    console.error('Error searching files in directory:', error);
  }

  return results;
}

async function findImagesInDirectory(dir, basePath) {
  let results = [];

  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stats = fs.statSync(fullPath);

      if (!stats.isDirectory()) {
        const mimeType = await utils.getFileType(fullPath);
        if (mimeType.startsWith('image/')) {
          results.push({
            name: file,
            path: utils.normalizePath(path.relative(basePath, fullPath)),
            size: stats.size,
            mtime: stats.mtime,
            mimeType: mimeType,
            isDirectory: false
          });
        }
      }
    }
  } catch (error) {
    console.error('Error finding images in directory:', error);
  }

  return results;
}

async function parallelSearch(dir, query, basePath) {
  if (isMainThread) {
    try {
      const subdirs = utils.getSubdirectories(dir);

      if (subdirs.length === 0) {
        return await searchFiles(dir, query, basePath);
      }

      const numCores = os.cpus().length;
      const numWorkers = Math.min(subdirs.length, numCores);
      const tasksPerWorker = Math.ceil(subdirs.length / numWorkers);
      const workers = [];

      for (let i = 0; i < numWorkers; i++) {
        const start = i * tasksPerWorker;
        const end = Math.min(start + tasksPerWorker, subdirs.length);
        const workerSubdirs = subdirs.slice(start, end);

        workers.push(createSearchWorker(workerSubdirs, query, basePath));
      }

      const rootResults = await searchFilesInDirectory(dir, query, basePath);
      const workerResults = await Promise.all(workers);

      return rootResults.concat(...workerResults);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

async function parallelFindImages(dir, basePath) {
  if (isMainThread) {
    try {
      const subdirs = utils.getSubdirectories(dir);

      if (subdirs.length === 0) {
        return await findAllImages(dir, basePath);
      }

      const numCores = os.cpus().length;
      const numWorkers = Math.min(subdirs.length, numCores);
      const tasksPerWorker = Math.ceil(subdirs.length / numWorkers);
      const workers = [];

      for (let i = 0; i < numWorkers; i++) {
        const start = i * tasksPerWorker;
        const end = Math.min(start + tasksPerWorker, subdirs.length);
        const workerSubdirs = subdirs.slice(start, end);

        workers.push(createImageWorker(workerSubdirs, basePath));
      }

      const rootResults = await findImagesInDirectory(dir, basePath);
      const workerResults = await Promise.all(workers);

      return rootResults.concat(...workerResults);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

function createSearchWorker(directories, query, basePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { task: 'search', directories, query, basePath }
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

function createImageWorker(directories, basePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { task: 'findImages', directories, basePath }
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

if (!isMainThread) {
  const { task, directories, query, basePath } = workerData;

  if (task === 'search') {
    (async () => {
      let results = [];

      for (const dir of directories) {
        try {
          const searchResults = await searchFiles(dir, query, basePath);
          results = results.concat(searchResults);
        } catch (error) {
          console.error(`Error searching in directory ${dir}:`, error);
        }
      }

      parentPort.postMessage(results);
    })();
  } else if (task === 'findImages') {
    (async () => {
      let results = [];

      for (const dir of directories) {
        try {
          const imageResults = await findAllImages(dir, basePath);
          results = results.concat(imageResults);
        } catch (error) {
          console.error(`Error finding images in directory ${dir}:`, error);
        }
      }

      parentPort.postMessage(results);
    })();
  }
}

function copyFolderRecursiveSync(source, destination) {
  // Create destination folder if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read all files and directories in the source folder
  const files = fs.readdirSync(source);

  // Process each file/directory
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);

    // Get file stats
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      copyFolderRecursiveSync(sourcePath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

async function processFolderCover(fileDetail, filePath, baseDir) {
  try {
    const subFiles = await fs.promises.readdir(filePath);

    // parallel check file type
    const imageCheckPromises = subFiles.map(async subFile => {
      const subFilePath = path.join(filePath, subFile);
      try {
        const mimeType = await utils.getFileType(subFilePath);
        return { subFile, mimeType };
      } catch {
        return { subFile, mimeType: 'unknown' };
      }
    });

    const imageFiles = (await Promise.all(imageCheckPromises))
      .filter(({ mimeType }) => mimeType.startsWith('image/'))
      .map(({ subFile }) => subFile)
      .sort();

    if (imageFiles.length > 0) {
      fileDetail.cover = utils.normalizePath(
        path.join(baseDir, fileDetail.name, imageFiles[0])
      );
    }
  } catch (error) {
    console.error(`Error processing cover for ${filePath}:`, error);
  }
}

async function processPsdFile(psdPath) {
  if (!config.processPsd) {
    return null;
  }
  
  try {
    // Generate a hash of the file path and last modified time to create a unique cache key
    const stats = fs.statSync(psdPath);
    const hashInput = `${psdPath}-${stats.mtimeMs}`;
    const cacheKey = crypto.createHash('md5').update(hashInput).digest('hex');
    
    const outputPath = path.join(config.psdCacheDir, `${cacheKey}.png`);
    
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    
    if (config.psdProcessor === 'imagemagick') {
      return await processWithImageMagick(psdPath, outputPath);
    } else {
      return await processWithPsdLibrary(psdPath, outputPath);
    }
  } catch (error) {
    console.error(`Error processing PSD file ${psdPath}: ${error.message}`);
    return null;
  }
}

// Process PSD file using ImageMagick
async function processWithImageMagick(psdPath, outputPath) {
  try {
    // Process the PSD file using ImageMagick (convert command) to PNG
    // Note: This requires ImageMagick to be installed on the system
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pngOutputPath = outputPath.replace(/\.[^.]+$/, '.png');
    // execSync(`magick "${psdPath}" "${pngOutputPath}"`);
    execSync(`magick "${psdPath}"[0] "${pngOutputPath}"`);
    
    if (fs.existsSync(pngOutputPath)) {
      return pngOutputPath;
    } else {
      console.error(`Failed to process PSD file with ImageMagick: ${psdPath} - Output file not created`);
      return null;
    }
  } catch (error) {
    console.error(`Error executing ImageMagick for PSD processing: ${error.message}`);
    return null;
  }
}

// Process PSD file using the psd library
async function processWithPsdLibrary(psdPath, outputPath) {
  try {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const pngOutputPath = outputPath.replace(/\.[^.]+$/, '.png');
    
    await PSD.open(psdPath).then(psd => {
      return psd.image.saveAsPng(pngOutputPath);
    });
    
    if (fs.existsSync(pngOutputPath)) {
      return pngOutputPath;
    } else {
      console.error(`Failed to process PSD file with psd library: ${psdPath} - Output file not created`);
      return null;
    }
  } catch (error) {
    console.error(`Error processing PSD with psd library: ${error.message}`);
    return null;
  }
}

// Helper function to sort files
function sortFiles(files, sortBy = 'name', sortOrder = 'asc') {
  return [...files].sort((a, b) => {
    // Always put directories first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    
    if (sortBy === 'name') {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc'
        ? collator.compare(a.name, b.name)
        : collator.compare(b.name, a.name);
    } else if (sortBy === 'size') {
      return sortOrder === 'asc'
        ? a.size - b.size
        : b.size - a.size;
    } else if (sortBy === 'date') {
      const dateA = new Date(a.mtime).getTime();
      const dateB = new Date(b.mtime).getTime();
      return sortOrder === 'asc'
        ? dateA - dateB
        : dateB - dateA;
    }
    return 0;
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 