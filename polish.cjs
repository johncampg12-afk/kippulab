const fs = require('fs');
const path = require('path');

function finalPolish(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let newContent = content
    // Clean up duplicate text/bg tails
    .replace(/bg-primary text-default text-default/g, 'bg-primary text-[var(--bg-default)]')
    .replace(/bg-divider text-content text-content/g, 'bg-divider text-content')
    .replace(/text-content-secondary dark:text-content-secondary/g, 'text-content-secondary')
    .replace(/dark:bg-default dark:text-zinc-950/g, 'dark:bg-paper dark:text-primary')
    .replace(/bg-primary text-\[var\(--bg-default\)\] dark:bg-white dark:text-zinc-950/g, 'bg-primary text-[var(--bg-default)]')
    // Remove lingering shadows completely
    .replace(/shadow-none/g, '') // remove the class entirely
    // Fix typography weights for standard text requested by user
    .replace(/font-bold/g, 'font-medium')
    // But keep headers bolder
    .replace(/font-display font-medium/g, 'font-display font-semibold');
    
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Polished ${filePath}`);
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
      finalPolish(fullPath);
    }
  }
}

traverse(path.join(__dirname, 'src'));
console.log("Final UI Polish complete.");
