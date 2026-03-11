/**
 * 下载与更新配置
 * 统一配置国内高速下载源
 */

export const DOWNLOAD_CONFIG = {
  // 主下载域名（国内 CDN）
  baseUrl: 'https://xiuer.work',

  // OSS 直连地址（备用）
  ossBaseUrl: 'https://xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com',

  // GitHub Release（海外备用）
  githubBaseUrl: 'https://github.com/Xiuer-Chinese/Xiuer-live-tools/releases',

  // 发布路径
  paths: {
    releases: '/releases',
    latest: '/releases/latest',
  },

  // 自动更新配置
  updater: {
    provider: 'generic' as const,
    url: 'https://xiuer.work/releases/latest',
    channel: 'latest',
  },

  // 文件命名规则
  artifactName: {
    win: 'Xiuer-Live-Assistant_${version}_win-x64.${ext}',
    mac: '秀儿直播助手_${version}_macos_${arch}.${ext}',
  },
}

/**
 * 获取版本下载地址
 */
export function getVersionDownloadUrl(version: string, file?: string): string {
  if (file) {
    return `${DOWNLOAD_CONFIG.baseUrl}/releases/${version}/${file}`
  }
  return `${DOWNLOAD_CONFIG.baseUrl}/releases/${version}/`
}

/**
 * 获取最新版本下载地址
 */
export function getLatestDownloadUrl(file?: string): string {
  if (file) {
    return `${DOWNLOAD_CONFIG.baseUrl}/releases/latest/${file}`
  }
  return `${DOWNLOAD_CONFIG.baseUrl}/releases/latest/`
}

/**
 * 获取自动更新地址
 */
export function getUpdateUrl(): string {
  return DOWNLOAD_CONFIG.updater.url
}
