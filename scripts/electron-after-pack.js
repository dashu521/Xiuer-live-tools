/**
 * electron-builder afterPack：将运行所需的 node_modules 复制到 app.asar.unpacked，
 * 使主进程 require('better-sqlite3')、playwright 等能从 app.asar.unpacked/node_modules 解析。
 *
 * 平台隔离策略 v3.0：
 * 1. 根据 electronPlatformName 判断当前构建平台
 * 2. Windows 构建：保留 Windows 原生模块，删除 Mac/Linux 二进制
 * 3. Mac 构建：保留 Mac 原生模块，删除 Windows/Linux 二进制
 * 4. 绝不跨平台混合
 */
const path = require('path')
const fs = require('fs')

// ============================================================
// 白名单配置：主进程运行时需要的依赖
// ============================================================

// 主进程直接依赖（package.json 中的 dependencies）
const MAIN_PROCESS_DEPS = new Set([
  'bcryptjs',
  'better-sqlite3',
  'electron-updater',
  'jsonwebtoken',
  'playwright',
  'playwright-extra',
  'playwright-extra-plugin-stealth',
  'puppeteer-extra-plugin-stealth',
  'uuid',
  'exceljs',
  // electron-log 用于日志
  'electron-log',
])

// 这些依赖的子依赖也需要保留
const TRANSITIVE_DEPS_WHITELIST = new Set([
  // playwright 相关
  'playwright-core',
  // better-sqlite3 相关
  'bindings',
  'prebuild-install',
  'node-addon-api',
  'file-uri-to-path',
  // electron-updater 相关
  'builder-util-runtime',
  'lazy-val',
  'semver',
  'semver-compare',
  'lodash.isequal',
  'js-yaml',
  'argparse',
  'sax',
  // exceljs 相关
  'archiver',
  'archiver-utils',
  'fast-csv',
  'jszip',
  // jsonwebtoken 相关
  'jws',
  'jwa',
  'safe-buffer',
  'buffer-equal-constant-time',
  'ecdsa-sig-formatter',
  'ms',
  'lodash.includes',
  'lodash.isboolean',
  'lodash.isinteger',
  'lodash.isnumber',
  'lodash.isplainobject',
  'lodash.isstring',
  'lodash.once',
  // puppeteer-extra 相关
  'puppeteer-extra-plugin',
  'puppeteer-extra-plugin-user-data-dir',
  'puppeteer-extra-plugin-user-preferences',
  'deepmerge',
  'debug',
  // 其他常用工具
  'graceful-fs',
  'fs-extra',
  'universalify',
  'jsonfile',
])

// 开发/构建依赖黑名单（绝对不复制）
const DEV_BUILD_BLACKLIST = new Set([
  // === 构建工具 ===
  'electron',
  '@biomejs',
  'app-builder-bin',
  'app-builder-lib',
  'typescript',
  'vite',
  'electron-winstaller',
  '@esbuild',
  'esbuild',
  '@babel',
  'caniuse-lite',
  'jiti',
  'postcss',
  'autoprefixer',
  'tailwindcss',
  '@tailwindcss',
  '@rollup',
  'rollup',
  'terser',
  'cssnano',
  'browserslist',
  'lightningcss',
  '@types',
  'husky',
  'lint-staged',
  'bumpp',
  'changelogen',
  'cross-env',
  'tsx',
  'vitest',
  '.vite',
  'postject',
  'source-map',
  'source-map-js',

  // === 渲染进程依赖（已被 Vite 打包） ===
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  '@vitejs',
  '@radix-ui',
  'lucide-react',
  'framer-motion',
  'motion',
  'motion-dom',
  'motion-utils',
  'zustand',
  'immer',
  'ahooks',
  'clsx',
  'class-variance-authority',
  'tailwind-merge',
  'tw-animate-css',
  'marked',
  'react-markdown',
  'highlight.js',
  'rehype-highlight',
  'remark-gfm',
  'dompurify',
  'openai',
  'vaul',
  '@floating-ui',
  '@welldone-software',
  'lodash',
  'lodash-es',
  'dayjs',

  // === Markdown/AST 处理（已被 Vite 打包） ===
  'unified',
  'unist-util-visit',
  'unist-util-is',
  'unist-util-visit-parents',
  'micromark',
  'mdast-util-from-markdown',
  'mdast-util-to-hast',
  'hast-util-to-jsx-runtime',
  'devlop',
  'property-information',
  'space-separated-tokens',
  'comma-separated-tokens',
  'estree-util-is-identifier-name',
  'vfile',
  'vfile-message',
  'bail',
  'trough',
  'is-plain-obj',
])

// 文件排除模式
const EXCLUDE_FILE_PATTERNS = [
  /\.map$/,
  /\.d\.ts$/,
  /\.d\.mts$/,
  /\.d\.cts$/,
  /__tests__\//,
  /__mocks__\//,
  /\/test\//,
  /\/tests\//,
  /\.test\./,
  /\.spec\./,
]

// ============================================================
// 核心逻辑
// ============================================================

function isAllowedPackage(packageName) {
  // 检查黑名单
  if (DEV_BUILD_BLACKLIST.has(packageName)) return false
  if (packageName.startsWith('lightningcss')) return false
  if (packageName.startsWith('@types/')) return false

  // 检查白名单
  if (MAIN_PROCESS_DEPS.has(packageName)) return true
  if (TRANSITIVE_DEPS_WHITELIST.has(packageName)) return true

  // 对于不在白名单也不在黑名单的包，默认允许（保守策略）
  return true
}

function shouldExclude(source) {
  const normalized = source.replace(/\\/g, '/')

  // 检查文件排除模式
  for (const pattern of EXCLUDE_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true
    }
  }

  // 检查 node_modules 中的包
  const nmIndex = normalized.lastIndexOf('node_modules/')
  if (nmIndex === -1) return false

  const afterNm = normalized.slice(nmIndex + 'node_modules/'.length)
  const segments = afterNm.split('/')
  let packageName = segments[0]

  // 处理 scoped 包
  if (packageName.startsWith('@') && segments.length > 1) {
    packageName = segments[0] + '/' + segments[1]
  }

  return !isAllowedPackage(packageName)
}

/**
 * 清理 Native 模块源码和不需要的文件
 */
function cleanupNativeModules(destNodeModules) {
  console.log('[afterPack] Cleaning up native module source files...')

  // 1. 删除 better-sqlite3 源码（仅需 .node 二进制）
  const sqliteDeps = path.join(destNodeModules, 'better-sqlite3', 'deps')
  if (fs.existsSync(sqliteDeps)) {
    fs.rmSync(sqliteDeps, { recursive: true, force: true })
    console.log('[afterPack]   - Removed better-sqlite3/deps (~9MB)')
  }

  // 2. 删除 better-sqlite3 的 src 目录（C++ 源码）
  const sqliteSrc = path.join(destNodeModules, 'better-sqlite3', 'src')
  if (fs.existsSync(sqliteSrc)) {
    fs.rmSync(sqliteSrc, { recursive: true, force: true })
    console.log('[afterPack]   - Removed better-sqlite3/src')
  }
}

/**
 * 第二轮优化：better-sqlite3 仅保留 .node 与 lib，删除 build 内源码与测试扩展
 */
function cleanupBetterSqlite3Round2(destNodeModules) {
  const sqliteRoot = path.join(destNodeModules, 'better-sqlite3')
  if (!fs.existsSync(sqliteRoot)) return

  const buildRelease = path.join(sqliteRoot, 'build', 'Release')
  if (fs.existsSync(buildRelease)) {
    const objDir = path.join(buildRelease, 'obj')
    if (fs.existsSync(objDir)) {
      fs.rmSync(objDir, { recursive: true, force: true })
      console.log('[afterPack]   - Removed better-sqlite3/build/Release/obj (~9.5MB)')
    }
    const testExt = path.join(buildRelease, 'test_extension.node')
    if (fs.existsSync(testExt)) {
      fs.rmSync(testExt, { force: true })
      console.log('[afterPack]   - Removed better-sqlite3/build/Release/test_extension.node')
    }
  }

  const buildDeps = path.join(sqliteRoot, 'build', 'deps')
  if (fs.existsSync(buildDeps)) {
    fs.rmSync(buildDeps, { recursive: true, force: true })
    console.log('[afterPack]   - Removed better-sqlite3/build/deps')
  }
}

/** 保留的 Electron 语言（仅 zh-CN、en-US） */
const KEEP_LOCALES = new Set(['zh_CN.lproj', 'en.lproj'])

/**
 * 仅 Mac 构建：Electron Framework 仅保留 zh-CN 与 en-US，删除其余 locale
 */
function stripElectronLocales(appOutDir, productFilename) {
  // 处理中文应用名可能导致的编码问题
  const appBundleName = productFilename.endsWith('.app') ? productFilename : `${productFilename}.app`
  const frameworkResources = path.join(
    appOutDir,
    appBundleName,
    'Contents',
    'Frameworks',
    'Electron Framework.framework',
    'Versions',
    'A',
    'Resources',
  )

  if (!fs.existsSync(frameworkResources)) {
    console.log(`[afterPack]   - Electron Framework resources not found at: ${frameworkResources}`)
    return
  }

  try {
    const entries = fs.readdirSync(frameworkResources, { withFileTypes: true })
    let removedCount = 0
    let removedSize = 0
    for (const ent of entries) {
      if (!ent.isDirectory() || !ent.name.endsWith('.lproj')) continue
      if (KEEP_LOCALES.has(ent.name)) continue
      const full = path.join(frameworkResources, ent.name)
      const size = getDirectorySize(full)
      fs.rmSync(full, { recursive: true, force: true })
      removedCount += 1
      removedSize += size
    }
    if (removedCount > 0) {
      console.log(
        `[afterPack]   - Removed ${removedCount} Electron locales (kept zh_CN, en), saved ~${(removedSize / 1024 / 1024).toFixed(1)} MB`,
      )
    }
  } catch (err) {
    console.warn('[afterPack] Warning during locale strip:', err.message)
  }
}

/**
 * 平台特定的多平台二进制文件裁剪
 * @param {string} destNodeModules - node_modules 目录
 * @param {string} electronPlatformName - 构建平台名称 (darwin/win32/linux)
 */
function trimMultiPlatformBinaries(destNodeModules, electronPlatformName) {
  if (!fs.existsSync(destNodeModules)) return

  console.log(`[afterPack] Trimming multi-platform binaries for ${electronPlatformName}...`)

  // 确定当前构建平台
  const isWindows = electronPlatformName === 'win32'
  const isMac = electronPlatformName === 'darwin'
  const isLinux = electronPlatformName === 'linux'

  // 1. 7zip-bin：根据平台保留对应二进制
  const zipBinDir = path.join(destNodeModules, '7zip-bin')
  if (fs.existsSync(zipBinDir)) {
    if (isWindows) {
      // Windows 构建：删除 mac 和 linux
      const platformsToRemove = ['mac', 'linux']
      for (const platform of platformsToRemove) {
        const platformDir = path.join(zipBinDir, platform)
        if (fs.existsSync(platformDir)) {
          fs.rmSync(platformDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed 7zip-bin/${platform}`)
        }
      }
      // Windows 构建：仅保留 win/x64
      const winDir = path.join(zipBinDir, 'win')
      if (fs.existsSync(winDir)) {
        for (const arch of ['ia32', 'arm64']) {
          const archDir = path.join(winDir, arch)
          if (fs.existsSync(archDir)) {
            fs.rmSync(archDir, { recursive: true, force: true })
            console.log(`[afterPack]   - Removed 7zip-bin/win/${arch}`)
          }
        }
      }
    } else if (isMac) {
      // Mac 构建：删除 win 和 linux
      const platformsToRemove = ['win', 'linux']
      for (const platform of platformsToRemove) {
        const platformDir = path.join(zipBinDir, platform)
        if (fs.existsSync(platformDir)) {
          fs.rmSync(platformDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed 7zip-bin/${platform}`)
        }
      }
      // Mac 构建：仅保留 mac/arm64 和 mac/x64
      const macDir = path.join(zipBinDir, 'mac')
      if (fs.existsSync(macDir)) {
        // Mac 目录通常只有 arm64 和 x64，都保留
        console.log('[afterPack]   - Kept 7zip-bin/mac')
      }
    } else if (isLinux) {
      // Linux 构建：删除 win 和 mac
      const platformsToRemove = ['win', 'mac']
      for (const platform of platformsToRemove) {
        const platformDir = path.join(zipBinDir, platform)
        if (fs.existsSync(platformDir)) {
          fs.rmSync(platformDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed 7zip-bin/${platform}`)
        }
      }
    }
  }

  // 2. 删除其他平台的 native 模块
  try {
    const entries = fs.readdirSync(destNodeModules, { withFileTypes: true })
    const scopes = entries.filter(d => d.isDirectory() && d.name.startsWith('@'))

    for (const scope of scopes) {
      const scopeDir = path.join(destNodeModules, scope.name)
      const packages = fs.readdirSync(scopeDir, { withFileTypes: true })

      for (const pkg of packages) {
        if (!pkg.isDirectory()) continue

        const pkgName = pkg.name.toLowerCase()
        const pkgDir = path.join(scopeDir, pkg.name)

        // 根据构建平台决定删除哪些包
        let shouldRemove = false

        if (isWindows) {
          // Windows 构建：删除 darwin 和 linux 相关的包
          shouldRemove = (
            pkgName.includes('darwin') ||
            pkgName.includes('linux') ||
            (pkgName.includes('-arm64') && !pkgName.includes('win32')) ||
            (pkgName.includes('-arm-') && !pkgName.includes('win32'))
          )
        } else if (isMac) {
          // Mac 构建：删除 win32 和 linux 相关的包
          shouldRemove = (
            pkgName.includes('win32') ||
            pkgName.includes('linux') ||
            (pkgName.includes('-ia32') && !pkgName.includes('darwin'))
          )
        } else if (isLinux) {
          // Linux 构建：删除 darwin 和 win32 相关的包
          shouldRemove = (
            pkgName.includes('darwin') ||
            pkgName.includes('win32') ||
            (pkgName.includes('-arm64') && !pkgName.includes('linux'))
          )
        }

        if (shouldRemove) {
          fs.rmSync(pkgDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed ${scope.name}/${pkg.name}`)
        }
      }
    }
  } catch (err) {
    console.warn('[afterPack] Warning during multi-platform cleanup:', err.message)
  }
}

/**
 * 删除 Playwright 调试资源
 */
function cleanupPlaywright(destNodeModules) {
  if (!fs.existsSync(destNodeModules)) return

  console.log('[afterPack] Cleaning up playwright debug resources...')

  const pwCore = path.join(destNodeModules, 'playwright-core')
  if (!fs.existsSync(pwCore)) return

  // 删除 vite 目录（traceViewer、htmlReport、recorder）
  const viteDir = path.join(pwCore, 'lib', 'vite')
  if (fs.existsSync(viteDir)) {
    fs.rmSync(viteDir, { recursive: true, force: true })
    console.log('[afterPack]   - Removed playwright-core/lib/vite (~3MB)')
  }

  // 注意：不要删除 mcpBundleImpl！
  // playwright-core 在加载时会 require('./mcpBundleImpl')，删除会导致运行时错误
  // mcpBundleImpl 只有 ~0.65MB，保留它是值得的

  // 删除 ThirdPartyNotices（~196 KB）
  const thirdParty = path.join(pwCore, 'ThirdPartyNotices.txt')
  if (fs.existsSync(thirdParty)) {
    fs.rmSync(thirdParty, { force: true })
    console.log('[afterPack]   - Removed playwright-core/ThirdPartyNotices.txt')
  }

  // 删除 Playwright 浏览器下载（使用系统 Chrome/Edge 时不需要）
  const pwPackages = ['playwright', 'playwright-core']
  for (const pkg of pwPackages) {
    const browsersDir = path.join(destNodeModules, pkg, '.local-browsers')
    if (fs.existsSync(browsersDir)) {
      fs.rmSync(browsersDir, { recursive: true, force: true })
      console.log(`[afterPack]   - Removed ${pkg}/.local-browsers`)
    }

    const cacheDir = path.join(destNodeModules, pkg, '.cache')
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
      console.log(`[afterPack]   - Removed ${pkg}/.cache`)
    }
  }
}

/**
 * 清理安装时依赖（运行时不需要的包）
 */
function cleanupInstallTimeDeps(destNodeModules) {
  if (!fs.existsSync(destNodeModules)) return

  console.log('[afterPack] Removing install-time-only dependencies...')

  const installTimeOnly = [
    'prebuild-install',
    'detect-libc',
    'expand-template',
    'github-from-package',
    'minimist',
    'mkdirp-classic',
    'napi-build-utils',
    'node-abi',
    'node-addon-api',
    'pump',
    'rc',
    'simple-concat',
    'simple-get',
    'tar-fs',
    'tar-stream',
    'tunnel-agent',
    'ini',
    'strip-json-comments',
    'deep-extend',
    'mimic-response',
    'decompress-response',
    'bl',
    'chownr',
    'fs-constants',
    'rimraf',
  ]

  for (const pkg of installTimeOnly) {
    const pkgDir = path.join(destNodeModules, pkg)
    if (fs.existsSync(pkgDir)) {
      fs.rmSync(pkgDir, { recursive: true, force: true })
      console.log(`[afterPack]   - Removed ${pkg}`)
    }
  }
}

/**
 * 计算目录大小
 */
function getDirectorySize(dir) {
  let size = 0
  if (!fs.existsSync(dir)) return size

  try {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    for (const file of files) {
      const filePath = path.join(dir, file.name)
      if (file.isDirectory()) {
        size += getDirectorySize(filePath)
      } else {
        try {
          size += fs.statSync(filePath).size
        } catch {
          // 忽略无法访问的文件
        }
      }
    }
  } catch {
    // 忽略无法访问的目录
  }
  return size
}

// ============================================================
// 主函数
// ============================================================

module.exports = async function (context) {
  const appOutDir = context.appOutDir
  const electronPlatformName = context.electronPlatformName

  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  [afterPack] Electron Builder After Pack Hook                    ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log(`║  Build Platform: ${electronPlatformName}`)
  console.log(`║  Host Platform: ${process.platform}`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('')

  // 平台隔离检查
  if (!['darwin', 'win32', 'linux'].includes(electronPlatformName)) {
    console.warn(`[afterPack] WARNING: Unknown platform ${electronPlatformName}`)
  }

  let resourcesDir
  if (electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename
    resourcesDir = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources')
  } else {
    resourcesDir = path.join(appOutDir, 'resources')
  }

  const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked')
  const destNodeModules = path.join(unpackedDir, 'node_modules')

  console.log(`[afterPack] Resources dir: ${resourcesDir}`)
  console.log(`[afterPack] Unpacked dir: ${unpackedDir}`)
  console.log('')

  if (!fs.existsSync(destNodeModules)) {
    console.warn('[afterPack] No unpacked node_modules found, skipping cleanup')
    return
  }

  const beforeSize = getDirectorySize(destNodeModules)
  console.log(`[afterPack] Before cleanup: ${(beforeSize / 1024 / 1024).toFixed(2)} MB`)
  console.log('')

  // 执行清理
  cleanupNativeModules(destNodeModules)
  cleanupBetterSqlite3Round2(destNodeModules)
  trimMultiPlatformBinaries(destNodeModules, electronPlatformName) // 传入平台参数
  cleanupPlaywright(destNodeModules)
  cleanupInstallTimeDeps(destNodeModules)

  // 仅在 Mac 构建时清理 Electron 语言包
  if (electronPlatformName === 'darwin') {
    const appName = context.packager.appInfo.productFilename
    stripElectronLocales(appOutDir, appName)
  }

  const afterSize = getDirectorySize(destNodeModules)
  const saved = beforeSize - afterSize

  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  [afterPack] Cleanup Completed                                   ║')
  console.log('╠══════════════════════════════════════════════════════════════════╣')
  console.log(`║  Before: ${(beforeSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`║  After:  ${(afterSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`║  Saved:  ${(saved / 1024 / 1024).toFixed(2)} MB`)
  console.log('╚══════════════════════════════════════════════════════════════════╝')
  console.log('')
}
