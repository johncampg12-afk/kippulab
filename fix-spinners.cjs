const fs = require('fs');
const path = require('path');

function fixSpinners(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let newContent = content
    .replace(/border-t-transparent rounded-full animate-pulse/g, 'border-t-transparent rounded-full animate-spin')
    .replace(/<RefreshCw className="h-6 w-6 text-blue-500 animate-pulse/g, '<RefreshCw className="h-6 w-6 text-blue-500 animate-spin')
    .replace(/<RefreshCw className=\{`h-3.5 w-3.5 \$\{loading \? "animate-pulse"/g, '<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin"')
    .replace(/<RefreshCw className=\{`h-3.5 w-3.5 \$\{isDiagnosticRunning \? "animate-pulse"/g, '<RefreshCw className={`h-3.5 w-3.5 ${isDiagnosticRunning ? "animate-spin"');
    
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Fixed spinners in ${filePath}`);
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
      fixSpinners(fullPath);
    }
  }
}

traverse(path.join(__dirname, 'src'));
console.log("Spinners fixed.");
