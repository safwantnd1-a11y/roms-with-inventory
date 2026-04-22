/**
 * Convert any image (WebP, PNG, JPG) to a proper Windows .ico file
 * Uses sharp for image processing and png-to-ico for ICO generation
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcImage = process.argv[2];
const outIco = path.join(__dirname, 'electron', 'icon.ico');
const outPng = path.join(__dirname, 'electron', 'icon.png');

if (!srcImage) {
  console.error('Usage: node convert-icon.mjs <path-to-image>');
  process.exit(1);
}

console.log('🎨 Converting image → 256x256 PNG → ICO...');

try {
  // Step 1: Convert any format to 256x256 PNG
  const pngBuffer = await sharp(srcImage)
    .resize(256, 256)
    .png()
    .toBuffer();
  
  writeFileSync(outPng, pngBuffer);
  console.log('✅ PNG created:', outPng);

  // Step 2: Convert PNG to ICO
  const icoBuffer = await pngToIco(outPng);
  writeFileSync(outIco, icoBuffer);
  console.log('✅ ICO created:', outIco);
  
} catch (e) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
