const fs = require('fs');
const path = require('path');

function refineUI(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let newContent = content
    // Reduce excessive border radiuses (AI SaaS uses too much rounded-xl, rounded-2xl)
    .replace(/rounded-xl/g, 'rounded-lg')
    .replace(/rounded-2xl/g, 'rounded-xl')
    // Remove unnecessary drop shadows in favor of clean borders (minimalist pro)
    .replace(/shadow-sm/g, 'shadow-none')
    .replace(/shadow-xs/g, 'shadow-none')
    .replace(/shadow-2xl/g, 'shadow-xl') // for modals keep some shadow
    // Replace dashed borders for empty states with soft fills
    .replace(/border border-dashed border-zinc-200 dark:border-zinc-800/g, 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900/50 text-zinc-500')
    // Remove "typing" style animations or sparkles spinning
    .replace(/animate-spin/g, 'animate-pulse') // make spinners pulse instead of spin if it's an AI icon. Except actual loaders.
    // Clean up excessive font-bold in regular buttons
    .replace(/font-bold rounded-lg text-xs/g, 'font-medium rounded-lg text-xs tracking-wide')
    // Clean up duplicate hover classes
    .replace(/dark:hover:bg-zinc-900 dark:hover:text-zinc-600/g, '')
    // Fix any broken tailwind from previous script
    .replace(/dark:bg-zinc-800 dark:bg-zinc-900/g, 'dark:bg-zinc-900')
    .replace(/text-white dark:text-zinc-900 text-white dark:text-zinc-900/g, 'text-white dark:text-zinc-900');
    
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Refined UI in ${filePath}`);
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
      refineUI(fullPath);
    }
  }
}

traverse(path.join(__dirname, 'src'));
console.log("UI Refinements complete.");
