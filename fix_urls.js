const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const files = [];

function findFiles(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
}
findFiles(srcDir);

for (const file of files) {
  if (file.includes('config\\\\api.js') || file.includes('config/api.js')) continue;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace the old pattern
  const oldPattern1 = /const API_URL = import\.meta\.env\.PROD\s*\?\s*\'\/api\/pedidos\'\s*:\s*\'http:\/\/localhost:3001\/api\/pedidos\';/g;
  if (oldPattern1.test(content)) {
    content = content.replace(oldPattern1, "import { API_URL } from '../config/api';");
    changed = true;
  }
  
  // Try to replace one level up imports if the file is in root of src
  // actually just use a simple relative path logic
  const isRootSrc = path.dirname(file) === srcDir;
  if (changed && isRootSrc) {
    content = content.replace(/import \{ API_URL \} from '\.\.\/config\/api';/g, "import { API_URL } from './config/api';");
  }

  // App.jsx and neonService.js special case
  const oldPatternApp = /const API_URL = import\.meta\.env\.VITE_API_URL \|\| \(import\.meta\.env\.PROD \s*\?\s*\'\/api\/pedidos\' \s*:\s*\'http:\/\/localhost:3001\/api\/pedidos\'\);/g;
  if (oldPatternApp.test(content)) {
    content = content.replace(oldPatternApp, "import { API_URL } from './config/api';");
    changed = true;
  }

  // Fix API routes that were missing /api/pedidos because API_URL used to include it
  if (content.includes('\`${API_URL}/init\`')) {
      content = content.replace(/\`\$\{API_URL\}\/init\`/g, '\`${API_URL}/api/pedidos/init\`');
      changed = true;
  }
  if (content.includes('\`${API_URL}/rate\`')) {
      content = content.replace(/\`\$\{API_URL\}\/rate\`/g, '\`${API_URL}/api/pedidos/rate\`');
      changed = true;
  }
  if (content.includes('\`${API_URL}/push/subscribe\`')) {
      content = content.replace(/\`\$\{API_URL\}\/push\/subscribe\`/g, '\`${API_URL}/api/pedidos/push/subscribe\`');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  }
}
