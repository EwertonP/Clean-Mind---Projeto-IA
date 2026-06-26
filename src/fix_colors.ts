import fs from 'fs/promises';
import path from 'path';

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function fixColors() {
  const files = await getFiles('./src');
  const tsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
  
  for (const file of tsxFiles) {
    const content = await fs.readFile(file, 'utf8');
    let newContent = content;
    
    // Replace blue, purple, indigo
    newContent = newContent.replace(/blue-([0-9]+)/g, 'emerald-$1');
    newContent = newContent.replace(/purple-([0-9]+)/g, 'emerald-$1');
    newContent = newContent.replace(/indigo-([0-9]+)/g, 'emerald-$1');
    
    if (newContent !== content) {
      await fs.writeFile(file, newContent, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
}

fixColors().catch(console.error);
