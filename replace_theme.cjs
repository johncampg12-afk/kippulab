const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Custom replacements for a sleek minimal pro theme
  const replacements = [
    { from: /#1E50FF/g, to: 'currentColor' }, // Let's try replacing with specific tailwind classes where applicable
    // But direct hex replacements might be easier. Let's use a very dark slate.
    { from: /#1E50FF/g, to: '#0F172A' }, // Slate 900
    { from: /#1243EC/g, to: '#1E293B' }, // Slate 800
    { from: /#EFF2FF/g, to: '#F8FAFC' }, // Slate 50
    { from: /#5E83FF/g, to: '#94A3B8' }, // Slate 400
    { from: /#DCE4FF/g, to: '#E2E8F0' }, // Slate 200
  ];

  let newContent = content;
  for (const r of replacements) {
    newContent = newContent.replace(r.from, r.to);
  }

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated ${filePath}`);
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
console.log("Done.");
