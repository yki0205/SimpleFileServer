const express = require('express');
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const config = require('./config')

const app = express();
const PORT = process.env.PORT || 3002;

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
        isDirectory,
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
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.zip"`);
      res.send(zipBuffer);
    } else {
      const fileName = path.basename(fullPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(fullPath);
    }
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
          isDirectory: stats.isDirectory(),
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
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac'];
  const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'];
  
  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (documentExtensions.includes(extension)) return 'document';
  
  return 'other';
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 