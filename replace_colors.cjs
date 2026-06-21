const fs = require('fs');
const path = require('path');

const replacements = [
  ['bg-emerald-800', 'bg-[#192F28]/90'],
  ['bg-emerald-700', 'bg-[#192F28]'],
  ['bg-emerald-600', 'bg-[#192F28]'],
  ['border-emerald-500/30', 'border-[#C1E2A4]/30'],
  ['bg-emerald-500', 'bg-[#C1E2A4]'],
  ['bg-emerald-400', 'bg-[#C1E2A4]'],
  ['bg-emerald-100', 'bg-[#C1E2A4]/40'],
  ['bg-emerald-50', 'bg-[#C1E2A4]/20'],
  ['text-emerald-950', 'text-[#192F28]'],
  ['text-emerald-900', 'text-[#192F28]'],
  ['text-emerald-800', 'text-[#192F28]'],
  ['hover:text-emerald-700', 'hover:text-[#192F28]/70'],
  ['text-emerald-700', 'text-[#192F28]'],
  ['hover:text-emerald-600', 'hover:text-[#192F28]/70'],
  ['text-emerald-600', 'text-[#192F28]'],
  ['text-emerald-500', 'text-[#192F28]/70'],
  ['text-emerald-400', 'text-[#C1E2A4]'],
  ['border-emerald-100', 'border-[#C1E2A4]/30'],
  ['border-emerald-200', 'border-[#C1E2A4]/50'],
  ['focus:border-emerald-500', 'focus:border-[#C1E2A4]'],
  ['border-emerald-500', 'border-[#C1E2A4]'],
  ['focus:ring-emerald-500', 'focus:ring-[#C1E2A4]'],
  ['accent-emerald-500', 'accent-[#192F28]'],
  ['hover:bg-emerald-800', 'hover:bg-slate-800'],
  ['hover:bg-emerald-50', 'hover:bg-[#C1E2A4]/30'],
  ['group-hover:bg-emerald-100', 'group-hover:bg-[#C1E2A4]/40'],
  ['hover:bg-emerald-100', 'hover:bg-[#C1E2A4]/40'],
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const [oldClass, newClass] of replacements) {
        if (content.includes(oldClass)) {
          const regex = new RegExp(oldClass.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), 'g');
          content = content.replace(regex, newClass);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory('./src');
