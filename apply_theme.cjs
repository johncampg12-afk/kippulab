const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let newContent = content
    // Backgrounds
    .replace(/bg-white dark:bg-\[#121214\]/g, 'bg-paper')
    .replace(/bg-zinc-50 dark:bg-zinc-900\/40/g, 'bg-default')
    .replace(/bg-zinc-50\/70 dark:bg-zinc-900\/10/g, 'bg-default')
    .replace(/bg-zinc-100 dark:bg-zinc-800/g, 'bg-divider text-content')
    .replace(/bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white/g, 'bg-paper text-content')
    .replace(/bg-white dark:bg-zinc-950/g, 'bg-paper')
    .replace(/bg-white dark:bg-slate-900/g, 'bg-paper')
    .replace(/bg-white dark:bg-zinc-900/g, 'bg-paper')
    .replace(/bg-zinc-50 dark:bg-zinc-900/g, 'bg-default')
    .replace(/bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900/g, 'bg-primary text-default')
    .replace(/bg-zinc-900 dark:bg-zinc-100/g, 'bg-primary text-default')
    .replace(/bg-zinc-800 dark:bg-zinc-200/g, 'bg-primary text-default')
    // Remove complex dark modes that conflict
    .replace(/text-white dark:text-zinc-900/g, 'text-default') // "default" background color is usually the contrasting color for primary
    .replace(/bg-zinc-100/g, 'bg-default')
    .replace(/bg-transparent/g, 'bg-transparent')
    
    // Text colors
    .replace(/text-zinc-900 dark:text-zinc-100/g, 'text-content')
    .replace(/text-zinc-800 dark:text-zinc-300/g, 'text-content')
    .replace(/text-zinc-700 dark:text-zinc-300/g, 'text-content-secondary')
    .replace(/text-zinc-600 dark:text-zinc-400/g, 'text-content-secondary')
    .replace(/text-zinc-500 dark:text-zinc-450/g, 'text-content-secondary')
    .replace(/text-zinc-500/g, 'text-content-secondary')
    .replace(/text-zinc-400 dark:text-zinc-500/g, 'text-content-secondary')
    .replace(/text-zinc-400/g, 'text-content-secondary')
    .replace(/text-zinc-900 dark:text-white/g, 'text-content')
    .replace(/text-white/g, 'text-[var(--bg-default)]') // when on primary
    
    // Borders
    .replace(/border-zinc-200\/80 dark:border-zinc-800\/80/g, 'border-divider')
    .replace(/border-zinc-200\/50 dark:border-zinc-800\/80/g, 'border-divider')
    .replace(/border-zinc-200\/50 dark:border-zinc-800/g, 'border-divider')
    .replace(/border-zinc-200\/60 dark:border-zinc-850/g, 'border-divider')
    .replace(/border-zinc-200\/60 dark:border-zinc-800\/60/g, 'border-divider')
    .replace(/border-zinc-200 dark:border-zinc-800/g, 'border-divider')
    .replace(/border-zinc-200 dark:border-zinc-850/g, 'border-divider')
    .replace(/border-gray-200 dark:border-slate-800/g, 'border-divider')
    .replace(/border-zinc-100 dark:border-zinc-900\/50/g, 'border-divider')
    .replace(/border-zinc-300 dark:border-zinc-805/g, 'border-divider')
    .replace(/border-zinc-300 dark:border-zinc-800/g, 'border-divider')
    .replace(/border-zinc-900 dark:border-white/g, 'border-primary')

    // System colors overrides (e.g. #1E50FF -> Primary / Info)
    .replace(/#1E50FF/g, 'var(--accent-info)')
    .replace(/#1243EC/g, 'var(--accent-info)') // hover state basically
    
    // Some buttons that had bg-zinc-900 text-white etc
    .replace(/bg-zinc-900/g, 'bg-primary')
    .replace(/hover:bg-zinc-800/g, 'hover:brightness-110')
    .replace(/hover:bg-zinc-100/g, 'hover:brightness-95 dark:hover:brightness-110')
    
    // Border radiuses 
    .replace(/rounded-xl/g, 'rounded-[10px]')
    .replace(/rounded-lg/g, 'rounded-[10px]')
    .replace(/rounded-2xl/g, 'rounded-[10px]');
    
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated theme classes in ${filePath}`);
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
      replaceInFile(fullPath);
    }
  }
}

traverse(path.join(__dirname, 'src'));
console.log("Theme class swap applied.");
