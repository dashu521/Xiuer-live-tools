/**
 * 将SVG Logo转换为PNG和ICO格式
 * 使用方法: node scripts/convert-logo.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const publicDir = path.join(__dirname, '..', 'public');

// 读取SVG文件
const faviconSvg = fs.readFileSync(path.join(publicDir, 'favicon.svg'));

console.log('开始转换Logo...');

// 转换为不同尺寸的PNG
const sizes = [16, 32, 48, 64, 128, 256];

for (const size of sizes) {
  const outputPath = path.join(publicDir, `favicon-${size}.png`);
  
  await sharp(faviconSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  
  console.log(`✓ 生成 favicon-${size}.png`);
}

// 生成主要使用的favicon.png
await sharp(faviconSvg)
  .resize(256, 256)
  .png()
  .toFile(path.join(publicDir, 'favicon.png'));

console.log('✓ 生成 favicon.png (256x256)');

// 生成logo.png
const logoSvg = fs.readFileSync(path.join(publicDir, 'logo.svg'));
await sharp(logoSvg)
  .resize(512, 512)
  .png()
  .toFile(path.join(publicDir, 'logo.png'));

console.log('✓ 生成 logo.png (512x512)');

console.log('\n转换完成!');
console.log('\n生成的文件:');
console.log('- public/favicon.png (256x256)');
console.log('- public/logo.png (512x512)');
console.log('- public/favicon-{16,32,48,64,128,256}.png');
console.log('\n注意: ICO格式需要额外的工具转换');
console.log('建议: 使用 favicon.png 替代 favicon.ico 在应用中使用');
