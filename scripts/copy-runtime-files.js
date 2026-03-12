/**
 * Copy runtime files after build
 * Ensures load-playwright.cjs is available in dist-electron/main/runtime
 */
const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../electron/main/runtime/load-playwright.cjs');
const targetDir = path.join(__dirname, '../dist-electron/main/runtime');
const targetFile = path.join(targetDir, 'load-playwright.cjs');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy file
if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, targetFile);
  console.log('✓ Runtime file copied:', targetFile);
} else {
  console.error('✗ Source file not found:', sourceFile);
  process.exit(1);
}

// Verify
if (!fs.existsSync(targetFile)) {
  console.error('✗ Target file not found after copy:', targetFile);
  process.exit(1);
}

console.log('✓ Build verification passed');
