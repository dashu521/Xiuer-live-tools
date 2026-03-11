/**
 * 将SVG Logo转换为PNG和ICO格式
 * 使用方法: node scripts/convert-logo.js
 */

const fs = require('fs');
const path = require('path');

// 读取SVG文件
const svgPath = path.join(__dirname, '..', 'public', 'logo.svg');
const faviconSvgPath = path.join(__dirname, '..', 'public', 'favicon.svg');

console.log('Logo文件已准备:');
console.log('- public/logo.svg (主Logo)');
console.log('- public/favicon.svg (网站图标)');
console.log('');
console.log('注意: 要将SVG转换为ICO格式，请使用以下方法之一:');
console.log('');
console.log('方法1 - 使用在线工具:');
console.log('  1. 访问 https://convertio.co/zh/svg-ico/');
console.log('  2. 上传 public/favicon.svg');
console.log('  3. 下载转换后的 favicon.ico');
console.log('  4. 替换 public/favicon.ico');
console.log('');
console.log('方法2 - 使用ImageMagick (如果已安装):');
console.log('  magick convert public/favicon.svg public/favicon.ico');
console.log('');
console.log('方法3 - 使用Inkscape (如果已安装):');
console.log('  inkscape public/favicon.svg --export-filename=public/favicon.ico');
console.log('');
console.log('应用中使用图标的位置:');
console.log('- 窗口图标: electron/main/app.ts (favicon.ico)');
console.log('- 托盘图标: electron/main/app.ts (favicon.ico)');
console.log('- 通知图标: electron/main/app.ts (favicon.ico)');
console.log('- 网页图标: index.html (/favicon.ico)');
