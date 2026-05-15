// State
let selectedElement = null;

// Initialize - load config and tree automatically
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get configured path from server
    const configResponse = await fetch('/api/config');
    const config = await configResponse.json();

    document.getElementById('currentPath').textContent = config.basePath;

    // Load tree automatically
    loadTree();
  } catch (error) {
    document.getElementById('fileTree').innerHTML =
      `<div class="error-message">加载配置失败: ${error.message}</div>`;
  }
});

// Load directory tree
async function loadTree() {
  const treeContainer = document.getElementById('fileTree');
  treeContainer.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const response = await fetch('/api/tree');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '加载失败');
    }

    renderTree(data, treeContainer);
  } catch (error) {
    treeContainer.innerHTML = `<div class="error-message">错误: ${error.message}</div>`;
  }
}

// Render file tree
function renderTree(node, container) {
  container.innerHTML = '';

  if (node.type === 'directory' && (!node.children || node.children.length === 0)) {
    container.innerHTML = '<div class="placeholder">目录为空</div>';
    return;
  }

  const items = node.children || [node];
  items.forEach(child => {
    const item = document.createElement('div');
    item.className = 'tree-item';

    const header = document.createElement('div');
    header.className = 'tree-item-header';

    if (child.type === 'directory') {
      // Directory item
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = '▶';

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '📁';

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = child.name;

      header.appendChild(arrow);
      header.appendChild(icon);
      header.appendChild(name);

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';

      // Click handler for directory
      header.addEventListener('click', () => {
        arrow.classList.toggle('expanded');
        childrenContainer.classList.toggle('expanded');
      });

      item.appendChild(header);
      item.appendChild(childrenContainer);

      // Recursively render children
      if (child.children && child.children.length > 0) {
        renderTree({ children: child.children }, childrenContainer);
      }
    } else {
      // File item
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow hidden';
      arrow.textContent = '▶';

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = child.ext === '.json' ? '📋' : '📝';

      const name = document.createElement('span');
      name.className = `tree-name ${child.ext.replace('.', '')}`;
      name.textContent = child.name;

      header.appendChild(arrow);
      header.appendChild(icon);
      header.appendChild(name);

      // Click handler for file
      header.addEventListener('click', () => {
        selectElement(header);
        loadFile(child.path);
      });

      item.appendChild(header);
    }

    container.appendChild(item);
  });
}

// Select element in tree
function selectElement(element) {
  if (selectedElement) {
    selectedElement.classList.remove('selected');
  }
  element.classList.add('selected');
  selectedElement = element;
}

// Load file content
async function loadFile(relativePath) {
  const contentDisplay = document.getElementById('contentDisplay');
  contentDisplay.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const response = await fetch(`/api/file?path=${encodeURIComponent(relativePath)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '加载文件失败');
    }

    if (data.type === 'json') {
      renderJson(data.content, contentDisplay);
    } else {
      renderMarkdown(data.content, contentDisplay);
    }
  } catch (error) {
    contentDisplay.innerHTML = `<div class="error-message">错误: ${error.message}</div>`;
  }
}

// Render JSON content
function renderJson(data, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'json-display';

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(data, null, 2);

  wrapper.appendChild(pre);
  container.innerHTML = '';
  container.appendChild(wrapper);
}

// Render Markdown content
function renderMarkdown(content, container) {
  const wrapper = document.createElement('div');
  wrapper.className = 'markdown-body';

  // Configure marked
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
  });

  wrapper.innerHTML = marked.parse(content);
  container.innerHTML = '';
  container.appendChild(wrapper);
}

// Collapse all directories
function collapseAll() {
  document.querySelectorAll('.tree-arrow.expanded').forEach(arrow => {
    arrow.classList.remove('expanded');
  });
  document.querySelectorAll('.tree-children.expanded').forEach(children => {
    children.classList.remove('expanded');
  });
}