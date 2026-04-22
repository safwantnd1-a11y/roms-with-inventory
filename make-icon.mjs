import pngToIco from 'png-to-ico';
import { copyFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPng = process.argv[2];
const outIco = path.join(__dirname, 'electron', 'icon.ico');

if (!srcPng) {
  console.error('Usage: node make-icon.mjs <path-to-png>');
  process.exit(1);
}

console.log('🎨 Converting PNG → ICO...');
try {
  const buf = await pngToIco(srcPng);
  writeFileSync(outIco, buf);
  console.log('✅ Icon saved to', outIco);
} catch (e) {
  console.error('Icon conversion failed:', e.message);
  // Fallback: copy the PNG renamed as .ico (electron-builder accepts PNG too)
  copyFileSync(srcPng, outIco);
  console.log('⚠️  Used PNG fallback as icon.ico');
}
