const fs = require('fs')

const src = 'electron/main/runtime/load-playwright.cjs'
const outDir = 'dist-electron/main/runtime'
const dest = `${outDir}/load-playwright.cjs`

fs.mkdirSync(outDir, { recursive: true })
fs.copyFileSync(src, dest)

if (!fs.existsSync(dest)) {
  console.error('FATAL: dist-electron/main/runtime/load-playwright.cjs not found after build')
  process.exit(1)
}

console.log('Runtime file copied:', dest)
