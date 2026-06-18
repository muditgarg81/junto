const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk('C:/claude/JUNTOFUN');
console.log(`Searching ${files.length} files...`);

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.toLowerCase().includes('google')) {
      // Print lines containing google
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('google') && !line.includes('//') && !line.includes('eslint')) {
          console.log(`${path.relative('C:/claude/JUNTOFUN', file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  } catch (err) {
    // ignore
  }
});
