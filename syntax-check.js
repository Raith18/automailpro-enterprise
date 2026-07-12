const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const files = fs.readdirSync(srcDir);

let hasError = false;

for (const file of files) {
  const filePath = path.join(srcDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (file.endsWith('.gs')) {
    const syntaxStr = content.replace(/\bconst\b/g, 'var');
    try {
      new Function(syntaxStr);
      console.log(`[OK] ${file}`);
    } catch (e) {
      console.error(`[ERROR] ${file}: ${e.message}`);
      hasError = true;
    }
  } else if (file.endsWith('.html')) {
    const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
    let match;
    let index = 1;
    let checked = false;
    while ((match = scriptRegex.exec(content)) !== null) {
      const scriptContent = match[1].replace(/\bconst\b/g, 'var');
      try {
        new Function(scriptContent);
      } catch (e) {
        console.error(`[ERROR] ${file} (script block ${index}): ${e.message}`);
        hasError = true;
      }
      index++;
      checked = true;
    }
    console.log(`[OK] ${file}`);
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('All syntax checks passed.');
}
