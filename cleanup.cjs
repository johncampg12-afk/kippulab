const fs = require('fs');
const path = require('path');

function cleanUp(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let newContent = content
    .replace(/text-zinc-900 dark:text-white dark:text-zinc-600 dark:text-zinc-300/g, 'text-zinc-900 dark:text-zinc-100')
    .replace(/dark:bg-white text-white dark:text-zinc-900/g, 'dark:bg-zinc-100 text-white dark:text-zinc-900')
    .replace(/bg-zinc-900 dark:bg-white text-white dark:text-zinc-900/g, 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900')
    
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Cleaned ${filePath}`);
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('dist')) {
        traverse(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      cleanUp(fullPath);
    }
  }
}

traverse(path.join(__dirname, 'src'));
console.log("Cleanup done.");
