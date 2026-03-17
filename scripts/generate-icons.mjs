import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const SIZES = [16, 32, 48, 64, 128, 256]

async function generateIcons() {
  console.log('🎨 开始生成图标...\n')

  const logoPng = join(publicDir, 'logo.png')
  const logoSvg = join(publicDir, 'logo.svg')

  let sourceImage
  if (existsSync(logoPng)) {
    sourceImage = sharp(logoPng)
    console.log('📷 使用 logo.png 作为源图像')
  } else if (existsSync(logoSvg)) {
    sourceImage = sharp(logoSvg)
    console.log('📐 使用 logo.svg 作为源图像')
  } else {
    console.error('❌ 找不到 logo.png 或 logo.svg')
    process.exit(1)
  }

  const tempDir = join(publicDir, 'temp-icons')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir)
  }

  const pngBuffers = []

  for (const size of SIZES) {
    console.log(`  生成 ${size}x${size} PNG...`)
    const buffer = await sourceImage
      .clone()
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer()
    
    pngBuffers.push(buffer)

    if (size === 16) {
      writeFileSync(join(publicDir, 'favicon-16.png'), buffer)
    } else if (size === 32) {
      writeFileSync(join(publicDir, 'favicon-32.png'), buffer)
    } else if (size === 48) {
      writeFileSync(join(publicDir, 'favicon-48.png'), buffer)
    } else if (size === 64) {
      writeFileSync(join(publicDir, 'favicon-64.png'), buffer)
    } else if (size === 128) {
      writeFileSync(join(publicDir, 'favicon-128.png'), buffer)
    } else if (size === 256) {
      writeFileSync(join(publicDir, 'favicon-256.png'), buffer)
      writeFileSync(join(publicDir, 'favicon.png'), buffer)
    }
  }

  console.log('\n📦 生成 Windows ICO 文件...')
  const icoBuffer = await pngToIco(pngBuffers)
  writeFileSync(join(publicDir, 'icon-win.ico'), icoBuffer)
  writeFileSync(join(publicDir, 'favicon.ico'), icoBuffer)
  console.log('  ✅ icon-win.ico 已生成')
  console.log('  ✅ favicon.ico 已生成')

  console.log('\n🖼️ 生成 1024x1024 icon.png...')
  await sourceImage
    .clone()
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(join(publicDir, 'icon.png'))
  console.log('  ✅ icon.png 已生成')

  console.log('\n✨ 图标生成完成！')
  console.log('\n生成的文件：')
  console.log('  - public/icon-win.ico (Windows 应用图标)')
  console.log('  - public/favicon.ico (浏览器图标)')
  console.log('  - public/icon.png (1024x1024)')
  console.log('  - public/favicon-*.png (多尺寸 PNG)')
}

generateIcons().catch(console.error)
