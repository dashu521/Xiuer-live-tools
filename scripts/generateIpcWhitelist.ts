/**
 * IPC 通道白名单自动生成工具
 * 
 * 此文件从 shared/ipcChannels.ts 自动提取所有 IPC 通道字符串，
 * 用于 Preload 白名单。
 * 
 * 运行方式：
 * - npx tsx scripts/generateIpcWhitelist.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 动态通道前缀（手动定义，因为正则难以准确匹配）
const DYNAMIC_PREFIXES = [
  'tasks:autoMessage:stopped:',    // tasks:autoMessage:stopped:accountId
  'tasks:autoPopUp:stopped:',      // tasks:autoPopUp:stopped:accountId
  'tasks:commentListener:stopped:', // tasks:commentListener:stopped:accountId
  'tasks:autoReply:listenerStopped:', // tasks:autoReply:listenerStopped:accountId
  'tasks:subAccount:stopped:',     // tasks:subAccount:stopped:accountId
]

// 需要包含的前缀（所有这些前缀下的通道都允许）
const REQUIRED_PREFIXES = [
  'tasks:',
  'config:',
  'chrome:',
  'updater:',
  'account:',
  'log',
  'app:',
  'liveStats:',
  'auth:',
  'diagnostics:',
]

function extractChannelsFromSource(content: string): { statik: string[], dynamic: string[] } {
  // 使用正则匹配所有 'xxx:yyy:zzz' 形式的通道字符串
  // 匹配单引号或双引号包裹的字符串字面量
  const channelRegex = /['"]([a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[a-z0-9-]+)*)['"]/gi
  
  const foundChannels = new Set<string>()
  let match
  
  while ((match = channelRegex.exec(content)) !== null) {
    const channel = match[1]
    // 过滤掉明显不是通道的字符串
    if (channel && !channel.includes('http') && !channel.includes('://')) {
      foundChannels.add(channel)
    }
  }
  
  // 分离静态和动态通道
  const statik: string[] = []
  const dynamic: string[] = [...DYNAMIC_PREFIXES]  // 预设动态前缀
  
  for (const channel of foundChannels) {
    // 检查是否是动态通道（匹配动态模式）
    const isDynamic = DYNAMIC_PREFIXES.some(p => channel.startsWith(p))
    
    if (!isDynamic) {
      statik.push(channel)
    }
  }
  
  // 过滤：只保留指定前缀的通道
  const filteredStatik = statik.filter(ch => 
    REQUIRED_PREFIXES.some(p => ch.startsWith(p))
  )
  
  // 去重并排序
  const uniqueStatik = [...new Set(filteredStatik)].sort()
  const uniqueDynamic = [...new Set(dynamic)].sort()
  
  return { statik: uniqueStatik, dynamic: uniqueDynamic }
}

function generatePreloadFile(): string {
  const ipcChannelsPath = join(process.cwd(), 'shared/ipcChannels.ts')
  
  if (!existsSync(ipcChannelsPath)) {
    throw new Error(`文件不存在: ${ipcChannelsPath}`)
  }
  
  const content = readFileSync(ipcChannelsPath, 'utf-8')
  const { statik, dynamic } = extractChannelsFromSource(content)
  
  return `// =====================================================
// Auto-generated IPC Channel Whitelist
// DO NOT EDIT MANUALLY - This file is auto-generated from shared/ipcChannels.ts
// Run 'npx tsx scripts/generateIpcWhitelist.ts' to regenerate
// =====================================================

// 静态通道白名单
const ALLOWED_STATIC_CHANNELS: string[] = [
${statik.map(c => "  '" + c + "',").join('\n')}
]

// 动态通道前缀（用于账号隔离事件，如 tasks:autoMessage:stopped:{accountId}）
const ALLOWED_DYNAMIC_PREFIXES: string[] = [
${dynamic.map(p => "  '" + p + "',").join('\n')}
]

/**
 * 检查通道是否允许
 * 支持静态通道精确匹配和动态通道前缀匹配
 */
export function isChannelAllowed(channel: string): boolean {
  // 先检查静态通道
  if (ALLOWED_STATIC_CHANNELS.includes(channel)) {
    return true
  }
  
  // 再检查动态通道前缀
  for (const prefix of ALLOWED_DYNAMIC_PREFIXES) {
    if (channel.startsWith(prefix)) {
      return true
    }
  }
  
  return false
}

/**
 * 获取所有允许的通道（用于调试和校验）
 */
export function getAllAllowedChannels(): string[] {
  return [...ALLOWED_STATIC_CHANNELS]
}

/**
 * 开发环境警告：未允许的通道
 */
export function warnIfNotAllowed(channel: string): void {
  if (!isChannelAllowed(channel)) {
    console.warn(\`[Preload] Channel not in whitelist: \${channel}\`)
  }
}
`
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('Generating IPC whitelist from shared/ipcChannels.ts...\n')
  
  try {
    const output = generatePreloadFile()
    
    // 写入文件
    const outputPath = join(process.cwd(), 'electron/preload/ipcWhitelist.gen.ts')
    writeFileSync(outputPath, output)
    
    console.log('✅ Generated whitelist successfully!')
    console.log('Output:', outputPath)
    
    // 显示统计
    const { statik, dynamic } = extractChannelsFromSource(
      readFileSync(join(process.cwd(), 'shared/ipcChannels.ts'), 'utf-8')
    )
    console.log('\n📊 Statistics:')
    console.log('   - Static channels:', statik.length)
    console.log('   - Dynamic prefixes:', dynamic.length)
    console.log('   - Dynamic:', dynamic.join(', '))
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

export { generatePreloadFile, extractChannelsFromSource }
