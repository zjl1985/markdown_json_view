require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 44444;

// Configured base path from .env
const VIEWER_PATH = process.env.VIEWER_PATH || '/Users/zero/Downloads';

console.log(`Configured viewer path: ${VIEWER_PATH}`);

// Serve static files
app.use(express.static('public'));

// Recursively get directory tree, only including .json and .md files
function getDirectoryTree(dirPath, basePath) {
  const result = {
    name: path.basename(dirPath),
    type: 'directory',
    path: path.relative(basePath, dirPath) || '.',
    children: []
  };

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      // Skip hidden files/folders
      if (item.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        const childTree = getDirectoryTree(itemPath, basePath);
        // Only include directories that have files
        if (childTree.children.length > 0) {
          result.children.push(childTree);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (ext === '.json' || ext === '.md') {
          result.children.push({
            name: item,
            type: 'file',
            ext: ext,
            path: path.relative(basePath, itemPath)
          });
        }
      }
    }

    // Sort: directories first, then files, both alphabetically
    result.children.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err.message);
  }

  return result;
}

// API: Get configured path info
app.get('/api/config', (req, res) => {
  res.json({
    basePath: VIEWER_PATH,
    baseName: path.basename(VIEWER_PATH)
  });
});

// API: Get directory tree (uses configured path)
app.get('/api/tree', (req, res) => {
  const targetPath = path.resolve(VIEWER_PATH);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: `Path ${VIEWER_PATH} does not exist` });
  }

  if (!fs.statSync(targetPath).isDirectory()) {
    return res.status(400).json({ error: 'Path is not a directory' });
  }

  try {
    const tree = getDirectoryTree(targetPath, targetPath);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read directory: ' + err.message });
  }
});

// API: Get file content (relative path under VIEWER_PATH)
app.get('/api/file', (req, res) => {
  let relativePath = req.query.path;

  if (!relativePath) {
    return res.status(400).json({ error: 'Path parameter is required' });
  }

  // Resolve full path under the configured base path
  const filePath = path.resolve(VIEWER_PATH, relativePath);

  // Security check: ensure path is within VIEWER_PATH
  if (!filePath.startsWith(path.resolve(VIEWER_PATH))) {
    return res.status(403).json({ error: 'Access denied: path outside configured directory' });
  }

  // Security check: only allow .json and .md files
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json' && ext !== '.md') {
    return res.status(403).json({ error: 'Only .json and .md files are allowed' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File does not exist' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (ext === '.json') {
      // Parse and format JSON
      const parsed = JSON.parse(content);
      res.json({
        type: 'json',
        content: parsed
      });
    } else {
      res.json({
        type: 'markdown',
        content: content
      });
    }
  } catch (err) {
    if (ext === '.json') {
      res.status(400).json({ error: 'Invalid JSON file: ' + err.message });
    } else {
      res.status(500).json({ error: 'Failed to read file: ' + err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});