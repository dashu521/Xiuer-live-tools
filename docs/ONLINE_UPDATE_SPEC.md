---
name: "online-update-spec"
description: "Designs complete online update functionality for Electron app. Invoke when user asks for update system design or implementation plan."
---

# 在线更新功能实现方案

## 1. 项目架构分析

### 1.1 当前技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Electron 39.8.6 |
| 前端 | React 19.1 + TypeScript 5.9.3 |
| 构建 | Vite 6.0.11 + electron-builder 26.0.12 |
| 更新 | electron-updater 6.6.2 |
| 状态管理 | Zustand 5.0.3 |
| UI组件 | Radix UI + Tailwind CSS 4.0 |
| 平台 | Windows + macOS |

### 1.2 现有更新模块架构

项目已实现了基础的更新功能，核心模块如下：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Renderer Process                          │
├─────────────────────────────────────────────────────────────────┤
│  useUpdate.ts (Zustand Store)                                   │
│    - 状态管理: idle/checking/available/preparing/downloading/   │
│              ready/error                                        │
│    - 版本信息: currentVersion, latestVersion, releaseNote       │
│                                                                │
│  UpdateDialog.tsx                                              │
│    - 更新提示对话框                                             │
│    - 进度展示                                                   │
│    - 错误处理                                                   │
│    - 更新源配置                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────────┐
│                         Main Process                             │
├─────────────────────────────────────────────────────────────────┤
│  UpdateManager.ts                                               │
│    - WindowsUpdater (electron-updater)                          │
│    - MacOSUpdater (手动下载 DMG)                                │
│    - 版本比对 (semver)                                          │
│    - SHA512 校验                                                │
│                                                                │
│  update.ts (IPC Handlers)                                       │
│    - checkUpdate: 检查版本                                      │
│    - startDownload: 开始下载                                    │
│    - quitAndInstall: 退出安装                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 现有功能限制

根据代码分析，当前实现存在以下限制：

1. **商业版更新检查已禁用** - `checkUpdateVersion()` 返回 `undefined`
2. **GitHub 更新已禁用** - 抛出错误
3. **changelog 获取已禁用** - 返回 `undefined`
4. **缺少增量更新支持** - 全量更新包
5. **缺少断点续传** - 下载中断需重新开始
6. **缺少差分更新** - 未实现 delta updates
7. **缺少回滚机制** - 更新失败无自动回滚

---

## 2. 完整在线更新功能方案

### 2.1 系统架构设计

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           Update System Architecture                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Auto       │    │  Manual     │    │  Scheduled  │    │  Background │  │
│  │  Check      │    │  Check      │    │  Check      │    │  Check      │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                   │                   │                   │         │
│         └───────────────────┴─────────┬────────┴───────────────────┘         │
│                                         │                                    │
│                                         ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        Update Service Layer                             │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │  │
│  │  │ Version       │  │ Download      │  │ Integrity    │              │  │
│  │  │ Manager       │  │ Manager       │  │ Manager       │              │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘              │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │  │
│  │  │ Rollback      │  │ Progress      │  │ Notification  │              │  │
│  │  │ Manager       │  │ Manager       │  │ Manager       │              │  │
│  │  └───────────────┘  └───────────────┘  └───────────────┘              │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                    │
│         ┌──────────────────────────────┼──────────────────────────────┐   │
│         │                              │                               │   │
│         ▼                              ▼                               ▼   │
│  ┌─────────────┐              ┌─────────────┐               ┌─────────────┐ │
│  │ electron-   │              │ Custom      │               │ CDN        │ │
│  │ updater     │              │ Download    │               │ Proxy      │ │
│  └─────────────┘              └─────────────┘               └─────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块设计

#### 2.2.1 版本管理模块 (VersionManager)

```typescript
// electron/main/managers/VersionManager.ts

interface VersionInfo {
  currentVersion: string      // 当前版本
  latestVersion: string       // 最新版本
  releaseDate: string          // 发布日期
  releaseNotes: string         // 更新日志 (Markdown)
  minSupportedVersion?: string // 最低支持版本 (强制更新用)
  mandatory: boolean          // 是否强制更新
  assets: AssetInfo[]         // 资源文件列表
}

interface AssetInfo {
  filename: string            // 文件名
  size: number                 // 文件大小 (bytes)
  sha256: string              // SHA256 校验值
  sha512?: string             // SHA512 校验值 (可选)
  platform: 'windows' | 'mac' | 'linux'
  arch: 'x64' | 'arm64' | 'universal'
  downloadUrl: string         // 下载地址
}

interface UpdateChannel {
  name: string                 // 渠道名称: stable/beta/nightly
  priority: number            // 优先级
  checkUrl: string            // 版本检查 URL
}

class VersionManager {
  private channels: UpdateChannel[] = [
    { name: 'stable', priority: 1, checkUrl: '' },
    { name: 'beta', priority: 2, checkUrl: '' },
    { name: 'nightly', priority: 3, checkUrl: '' }
  ]

  async checkForUpdates(channel?: string): Promise<VersionInfo | null>

  async fetchVersionInfo(url: string): Promise<VersionInfo>

  compareVersions(current: string, latest: string): ComparisonResult

  shouldUpdate(current: string, latest: string): boolean

  isMandatoryUpdate(current: string, minSupported: string): boolean
}
```

#### 2.2.2 下载管理模块 (DownloadManager)

```typescript
// electron/main/managers/DownloadManager.ts

interface DownloadTask {
  id: string
  url: string
  destination: string
  totalBytes: number
  downloadedBytes: number
  sha256: string
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed'
  speed: number               // bytes/s
  progress: number            // 0-100
  error?: Error
}

interface DownloadOptions {
  resumeSupport: boolean      // 断点续传支持
  verifyIntegrity: boolean   // 下载后校验
  maxRetries: number          // 最大重试次数
  timeout: number             // 超时时间 (ms)
  concurrentChunks?: number   // 分片下载并发数
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map()
  private options: DownloadOptions

  async download(
    url: string,
    destination: string,
    expectedHash: string,
    options?: Partial<DownloadOptions>,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string>

  async pause(taskId: string): Promise<void>

  async resume(taskId: string): Promise<void>

  async cancel(taskId: string): Promise<void>

  async verifyFile(filePath: string, expectedHash: string): Promise<boolean>

  private async downloadWithChunks(
    url: string,
    destination: string,
    totalBytes: number,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void>

  private async verifyIntegrity(
    filePath: string,
    expectedHash: string
  ): Promise<boolean>
}
```

#### 2.2.3 完整性校验模块 (IntegrityManager)

```typescript
// electron/main/managers/IntegrityManager.ts

type HashAlgorithm = 'sha256' | 'sha512' | 'md5'

interface ChecksumInfo {
  algorithm: HashAlgorithm
  value: string
}

interface SignedChecksum {
  checksums: ChecksumInfo[]
  signature: string           // GPG/PGP 签名
  publicKeyUrl: string        // 公钥下载地址
}

class IntegrityManager {
  async computeHash(
    filePath: string,
    algorithm: HashAlgorithm = 'sha256'
  ): Promise<string>

  async verifyChecksum(
    filePath: string,
    expected: ChecksumInfo
  ): Promise<boolean>

  async verifySignature(
    filePath: string,
    signedChecksum: SignedChecksum
  ): Promise<boolean>

  async fetchPublicKey(url: string): Promise<string>

  async verifyGpgSignature(
    data: Buffer,
    signature: Buffer,
    publicKey: Buffer
  ): Promise<boolean>
}
```

#### 2.2.4 回滚管理模块 (RollbackManager)

```typescript
// electron/main/managers/RollbackManager.ts

interface BackupInfo {
  version: string
  backupPath: string
  timestamp: number
  files: string[]             // 备份的文件列表
  size: number               // 备份大小
}

interface RollbackConfig {
  maxBackups: number          // 最大备份数量
  backupPath: string          // 备份目录
  autoBackup: boolean         // 更新前自动备份
}

class RollbackManager {
  private config: RollbackConfig
  private backups: BackupInfo[] = []

  async createBackup(version: string): Promise<BackupInfo>

  async restoreBackup(backupInfo: BackupInfo): Promise<void>

  async rollbackToVersion(version: string): Promise<boolean>

  async listBackups(): Promise<BackupInfo[]>

  async deleteBackup(backupId: string): Promise<void>

  async cleanupOldBackups(): Promise<void>

  private async backupCriticalFiles(): Promise<string[]>

  private async restoreFiles(files: string[], backupPath: string): Promise<void>
}
```

### 2.3 更新流程设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Update Flow Diagram                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐           │
│   │ App Start    │─────▶│ Auto Check   │─────▶│ Found Update │           │
│   │              │      │ (Background)  │      │              │           │
│   └──────────────┘      └──────────────┘      └──────┬───────┘           │
│                                                       │                     │
│                      ┌────────────────────────────────┘                     │
│                      │                                                      │
│                      ▼                                                      │
│   ┌──────────────────────────────────────────────────────────────┐        │
│   │                    User Notified                               │        │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │        │
│   │  │ Show Dialog │  │ Show Badge  │  │ Send Toast  │          │        │
│   │  └─────────────┘  └─────────────┘  └─────────────┘          │        │
│   └──────────────────────────────────────────────────────────────┘        │
│                      │                                                      │
│                      ▼                                                      │
│   ┌──────────────────────────────────────────────────────────────┐        │
│   │                 User Decision                                 │        │
│   │                                                               │        │
│   │    ┌───────────────┐         ┌───────────────┐              │        │
│   │    │  Install Now  │         │  Later / Skip │              │        │
│   │    └───────┬───────┘         └───────────────┘              │        │
│   │            │                                                  │        │
│   └────────────┼────────────────────────────────────────────────┘        │
│                │                                                        │
│                ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │  1. Create Backup (RollbackManager)                         │        │
│   │  2. Download Update Package (DownloadManager)                │        │
│   │     - Resume from checkpoint if available                   │        │
│   │     - Progress reporting                                     │        │
│   │  3. Verify Integrity (IntegrityManager)                    │        │
│   │     - SHA256/SHA512 verification                             │        │
│   │  4. Apply Update                                             │        │
│   │     - Windows: electron-updater handles                     │        │
│   │     - macOS: Replace app bundle                              │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                │                                                        │
│                ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────┐        │
│   │                 Update Complete                               │        │
│   │                                                               │        │
│   │    ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │        │
│   │    │ Show Success  │  │ Restart Now   │  │ Restart Later │  │        │
│   │    │   Dialog      │  │               │  │               │  │        │
│   │    └───────────────┘  └───────────────┘  └───────────────┘  │        │
│   └─────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 异常处理与回滚机制

```typescript
// electron/main/managers/UpdateErrorHandler.ts

enum UpdateErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  SIGNATURE_INVALID = 'SIGNATURE_INVALID',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  APPLY_FAILED = 'APPLY_FAILED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED'
}

interface UpdateError {
  code: UpdateErrorCode
  message: string
  details?: any
  recoverable: boolean
  canRollback: boolean
}

class UpdateErrorHandler {
  async handleError(error: UpdateError): Promise<ErrorHandlingResult>

  async attemptRecovery(error: UpdateError): Promise<boolean>

  async initiateRollback(backupId: string): Promise<RollbackResult>

  async notifyUser(error: UpdateError): Promise<void>

  async logError(error: UpdateError): Promise<void>

  async collectDiagnosticInfo(): Promise<DiagnosticData>
}

// Error Recovery Strategies
const recoveryStrategies: Record<UpdateErrorCode, RecoveryStrategy> = {
  [UpdateErrorCode.NETWORK_ERROR]: {
    maxRetries: 3,
    backoffMs: 2000,
    strategy: 'retry_with_backoff'
  },
  [UpdateErrorCode.CHECKSUM_MISMATCH]: {
    maxRetries: 2,
    strategy: 'redownload'
  },
  [UpdateErrorCode.DOWNLOAD_FAILED]: {
    maxRetries: 3,
    strategy: 'resume_or_retry'
  }
}
```

### 2.5 用户界面设计

#### 2.5.1 更新提示弹窗

```
┌────────────────────────────────────────────────────────────┐
│                    🎉 发现新版本 v1.2.0                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   当前版本: v1.1.1                          →  最新版本: v1.2.0  │
│                                                            │
│   ┌────────────────────────────────────────────────────┐  │
│   │  📝 更新日志                                        │  │
│   │                                                     │  │
│   │  ✨ 新增功能                                        │  │
│   │  • 支持多账号同时登录                                │  │
│ 优化   │  •直播监控性能                                  │  │
│   │                                                     │  │
│   │  🐛 问题修复                                        │  │
│   │  • 修复自动回复延迟问题                              │  │
│   │  • 修复特定平台兼容性问题                            │  │
│   │                                                     │  │
│   │  🔒 安全更新                                        │  │
│   │  • 更新安全证书                                      │  │
│   └────────────────────────────────────────────────────┘  │
│                                                            │
│   文件大小: 45.2 MB                                        │
│                                                            │
│   更新源: [官方 ▼]                                         │
│                                                            │
│   ⏰ 此更新为重要更新，建议立即更新                          │
│                                                            │
│   ┌────────────────────────────────────────────────────┐  │
│   │ ████████████████████░░░░░░░░░░░  60%                │  │
│   │ 下载速度: 2.5 MB/s  预计剩余: 15秒                  │  │
│   └────────────────────────────────────────────────────┘  │
│                                                            │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   稍后更新   │  │  下载并安装  │  │  手动下载   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 2.5.2 状态管理设计

```typescript
// src/hooks/useUpdate.ts (扩展版本)

export type UpdateFlowStatus =
  | 'idle'                    // 初始状态
  | 'checking'                // 检查更新中
  | 'available'               // 发现新版本
  | 'downloading'             // 下载中
  | 'paused'                  // 暂停
  | 'verifying'               // 校验中
  | 'ready'                   // 准备就绪
  | 'applying'                // 应用更新中
  | 'restarting'              // 重启中
  | 'rollback'                // 回滚中
  | 'error'                   // 错误状态

interface UpdateState {
  status: UpdateFlowStatus
  version: VersionInfo | null
  progress: {
    percent: number
    transferred: number
    total: number
    speed: number
    eta: number
  }
  error: UpdateError | null
  settings: UpdateSettings
}

interface UpdateSettings {
  autoCheck: boolean
  autoDownload: boolean
  autoInstall: boolean
  installOnQuit: boolean
  channel: 'stable' | 'beta' | 'nightly'
  customUrl: string
  bandwidthLimit: number  // KB/s, 0 = 不限制
}
```

### 2.6 网络环境适配策略

```typescript
// electron/main/managers/NetworkAdaptor.ts

interface NetworkConditions {
  type: 'wifi' | 'ethernet' | 'cellular' | 'unknown'
  isMetered: boolean
  downloadSpeed: number  // KB/s
  latency: number        // ms
}

class NetworkAdaptor {
  async getNetworkConditions(): Promise<NetworkConditions>

  async shouldAutoDownload(conditions: NetworkConditions): Promise<boolean>

  getRecommendedStrategy(conditions: NetworkConditions): UpdateStrategy {
    if (conditions.isMetered) {
      return 'manual'  // 移动网络下需要手动确认
    }
    if (conditions.downloadSpeed < 500) {
      return 'background'  // 低速网络后台下载
    }
    return 'eager'  // 高速网络立即下载
  }

  async applyBandwidthLimit(limit: number): Promise<void>

  monitorNetworkChange(callback: (conditions: NetworkConditions) => void): void
}

enum UpdateStrategy {
  MANUAL = 'manual',           // 完全手动
  BACKGROUND = 'background',   // 后台下载
  EAGER = 'eager',             // 立即下载
  SCHEDULED = 'scheduled'     // 定时下载
}
```

### 2.7 更新包优化策略

#### 2.7.1 增量更新 (Delta Updates)

```typescript
// electron/main/managers/DeltaUpdateManager.ts

interface DeltaPatch {
  fromVersion: string
  toVersion: string
  patchUrl: string
  patchSize: number          // 补丁大小
  patchHash: string         // 补丁 SHA256
  compressed: boolean       // 是否压缩
}

class DeltaUpdateManager {
  async checkForDeltaUpdate(
    currentVersion: string,
    targetVersion: string
  ): Promise<DeltaPatch | null>

  async applyDeltaPatch(
    currentVersion: string,
    deltaPatch: DeltaPatch,
    onProgress: (progress: number) => void
  ): Promise<string>  // 返回完整包路径

  async downloadAndPatch(
    deltaPatch: DeltaPatch,
    appPath: string,
    onProgress: (progress: number) => void
  ): Promise<void>

  async verifyPatchedApp(patchedPath: string, expectedHash: string): Promise<boolean>
}
```

#### 2.7.2 包大小优化建议

| 优化策略 | 预期效果 | 实现方式 |
|----------|----------|----------|
| 代码分割 | 减少主包体积 | electron-builder extraResources |
| 资源压缩 | 图片/字体优化 | sharp 压缩 PNG/JPEG |
| 差分更新 | 减少下载量 | bsdiff/bspatch |
| asar 压缩 | 减少安装体积 | electron-builder asar |
| Playwright 优化 | 减少浏览器体积 | playwright-extra 裁剪 |
| 依赖清理 | 移除未用依赖 | depcheck 工具 |

---

## 3. 关键代码模块实现

### 3.1 主进程更新管理器扩展

```typescript
// electron/main/managers/EnhancedUpdateManager.ts

import { app, BrowserWindow } from 'electron'
import { autoUpdater, ProgressInfo } from 'electron-updater'
import { VersionManager } from './VersionManager'
import { DownloadManager } from './DownloadManager'
import { IntegrityManager } from './IntegrityManager'
import { RollbackManager } from './RollbackManager'
import { UpdateErrorHandler } from './UpdateErrorHandler'
import { NetworkAdaptor } from './NetworkAdaptor'
import windowManager from '../windowManager'
import { createLogger } from '../logger'

const logger = createLogger('enhanced-update')

export class EnhancedUpdateManager {
  private versionManager: VersionManager
  private downloadManager: DownloadManager
  private integrityManager: IntegrityManager
  private rollbackManager: RollbackManager
  private errorHandler: UpdateErrorHandler
  private networkAdaptor: NetworkAdaptor

  private isChecking = false
  private isDownloading = false

  constructor() {
    this.versionManager = new VersionManager()
    this.downloadManager = new DownloadManager()
    this.integrityManager = new IntegrityManager()
    this.rollbackManager = new RollbackManager()
    this.errorHandler = new UpdateErrorHandler()
    this.networkAdaptor = new NetworkAdaptor()
    
    this.setupAutoUpdater()
    this.setupIpcHandlers()
    this.startBackgroundChecker()
  }

  private setupAutoUpdater() {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowDowngrade = false
    autoUpdater.allowPrerelease = false
    
    autoUpdater.on('checking-for-update', () => {
      logger.info('检查更新中...')
      this.sendToRenderer('update:checking')
    })

    autoUpdater.on('update-available', async (info) => {
      logger.info(`发现新版本: ${info.version}`)
      const versionInfo = await this.versionManager.fetchVersionInfo(info)
      this.sendToRenderer('update:available', versionInfo)
    })

    autoUpdater.on('update-not-available', () => {
      logger.info('当前已是最新版本')
      this.sendToRenderer('update:not-available')
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.sendToRenderer('update:progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        speed: progress.bytesPerSecond
      })
    })

    autoUpdater.on('update-downloaded', async (info) => {
      logger.info(`更新已下载: ${info.version}`)
      const verified = await this.integrityManager.verifyChecksum(
        info.downloadedFile!,
        await this.getExpectedHash(info.version)
      )
      
      if (verified) {
        this.sendToRenderer('update:ready', { version: info.version })
      } else {
        await this.errorHandler.handleError({
          code: 'CHECKSUM_MISMATCH',
          message: '更新包校验失败',
          recoverable: true,
          canRollback: false
        })
      }
    })

    autoUpdater.on('error', async (error: Error) => {
      logger.error('更新错误:', error)
      await this.errorHandler.handleError({
        code: 'UPDATE_ERROR',
        message: error.message,
        details: error,
        recoverable: true,
        canRollback: true
      })
    })
  }

  async checkForUpdates(force = false): Promise<void> {
    if (this.isChecking) return
    
    try {
      this.isChecking = true
      const network = await this.networkAdaptor.getNetworkConditions()
      const strategy = this.networkAdaptor.getRecommendedStrategy(network)
      
      logger.info(`网络类型: ${network.type}, 策略: ${strategy}`)
      
      if (strategy === 'manual' && !force) {
        this.sendToRenderer('update:requires-manual')
        return
      }
      
      await autoUpdater.checkForUpdates()
    } catch (error) {
      logger.error('检查更新失败:', error)
    } finally {
      this.isChecking = false
    }
  }

  async downloadUpdate(source?: string): Promise<void> {
    if (this.isDownloading) return
    
    try {
      this.isDownloading = true
      
      const backup = await this.rollbackManager.createBackup(app.getVersion())
      logger.info(`已创建备份: ${backup.backupPath}`)
      
      await autoUpdater.downloadUpdate()
    } catch (error) {
      logger.error('下载更新失败:', error)
      await this.rollbackManager.rollbackToVersion(app.getVersion())
    } finally {
      this.isDownloading = false
    }
  }

  async installUpdate(): Promise<void> {
    logger.info('准备安装更新并重启...')
    autoUpdater.quitAndInstall(false, true)
  }

  private startBackgroundChecker() {
    const checkInterval = 1000 * 60 * 60  // 每小时检查一次
    
    setInterval(async () => {
      const settings = await this.getUpdateSettings()
      if (settings.autoCheck) {
        await this.checkForUpdates()
      }
    }, checkInterval)
  }

  private sendToRenderer(channel: string, data?: any) {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.webContents.send(channel, data)
    }
  }
}
```

### 3.2 前端更新 Hook 扩展

```typescript
// src/hooks/useEnhancedUpdate.ts

import { useCallback, useEffect } from 'react'
import { useUpdateStore, UpdateSettings } from './useUpdate'

export function useEnhancedUpdate() {
  const store = useUpdateStore()

  const checkForUpdates = useCallback(async (force = false) => {
    await store.checkUpdateManually()
  }, [])

  const startDownload = useCallback(async () => {
    await store.startDownload()
  }, [])

  const pauseDownload = useCallback(async () => {
    await window.ipcRenderer.invoke('update:pause')
  }, [])

  const resumeDownload = useCallback(async () => {
    await window.ipcRenderer.invoke('update:resume')
  }, [])

  const installUpdate = useCallback(async () => {
    await store.installUpdate()
  }, [])

  const cancelUpdate = useCallback(async () => {
    await window.ipcRenderer.invoke('update:cancel')
    store.reset()
  }, [])

  const rollback = useCallback(async (targetVersion?: string) => {
    await window.ipcRenderer.invoke('update:rollback', targetVersion)
  }, [])

  const updateSettings = useCallback(async (settings: Partial<UpdateSettings>) => {
    await window.ipcRenderer.invoke('update:settings', settings)
  }, [])

  useEffect(() => {
    const unsubscribers = [
      window.ipcRenderer.on('update:progress', (_, progress) => {
        store.setProgress(progress.percent)
      }),
      window.ipcRenderer.on('update:ready', (_, info) => {
        store.setStatus('ready')
      }),
      window.ipcRenderer.on('update:error', (_, error) => {
        store.handleError(error)
      }),
      window.ipcRenderer.on('update:rollback-complete', () => {
        store.setStatus('idle')
      })
    ]

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [])

  return {
    status: store.status,
    versionInfo: store.versionInfo,
    progress: store.progress,
    error: store.error,
    settings: store.settings,
    checkForUpdates,
    startDownload,
    pauseDownload,
    resumeDownload,
    installUpdate,
    cancelUpdate,
    rollback,
    updateSettings
  }
}
```

---

## 4. 测试方案

### 4.1 单元测试

| 测试项 | 测试内容 | 覆盖模块 |
|--------|----------|----------|
| 版本比对 | semver 各种场景 | VersionManager |
| 哈希校验 | SHA256/SHA512 正确性 | IntegrityManager |
| 备份创建 | 文件备份/恢复 | RollbackManager |
| 错误处理 | 各类型错误恢复 | UpdateErrorHandler |

### 4.2 集成测试

| 测试场景 | 测试步骤 | 预期结果 |
|----------|----------|----------|
| 正常更新流程 | 检查→下载→安装 | 更新成功 |
| 断点续传 | 中断下载→恢复 | 继续下载 |
| 校验失败 | 修改安装包 | 提示错误并回滚 |
| 网络切换 | WiFi→移动网络 | 暂停下载 |
| 回滚测试 | 更新后回滚 | 恢复原版本 |

### 4.3 E2E 测试

```typescript
// tests/e2e/update.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Update Flow', () => {
  test('should check for updates successfully', async ({ page }) => {
    await page.click('[data-testid="check-update-btn"]')
    await expect(page.locator('.update-dialog')).toBeVisible()
  })

  test('should download and install update', async ({ page }) => {
    await page.click('[data-testid="check-update-btn"]')
    await page.click('[data-testid="download-btn"]')
    
    const progress = page.locator('[data-testid="progress-bar"]')
    await expect(progress).toBeVisible()
    
    await page.waitForSelector('[data-testid="ready-to-install"]')
    await page.click('[data-testid="install-btn"]')
  })
})
```

---

## 5. 性能优化建议

### 5.1 下载优化

| 优化项 | 实现方式 | 预期收益 |
|--------|----------|----------|
| 多线程下载 | 分片并行下载 | 提升 3-5 倍速度 |
| CDN 加速 | 多个 CDN 源 | 提升下载成功率 |
| 压缩传输 | gzip/brotli | 减少 30% 流量 |
| 缓存策略 | 本地缓存+增量 | 减少重复下载 |

### 5.2 启动优化

| 优化项 | 实现方式 | 预期收益 |
|--------|----------|----------|
| 后台检查 | 启动前检查 | 用户无感知 |
| 延迟加载 | 按需加载 | 减少主进程阻塞 |
| 缓存版本信息 | 本地缓存 | 减少网络请求 |

### 5.3 内存优化

- 流式下载，避免全量加载到内存
- 分块校验，大文件分片处理
- 及时释放下载流和临时文件

---

## 6. 兼容性考虑

### 6.1 系统兼容性

| 操作系统 | 最低版本 | 支持的架构 |
|----------|----------|------------|
| Windows | Windows 10 | x64, arm64 |
| macOS | 10.15 (Catalina) | x64, arm64 (Universal) |
| Linux | Ubuntu 20.04 | x64 |

### 6.2 数据迁移

```typescript
// 处理用户设置和数据的迁移
class DataMigrationManager {
  async migrateIfNeeded(fromVersion: string, toVersion: string) {
    const migrations = this.getMigrations(fromVersion, toVersion)
    
    for (const migration of migrations) {
      await migration.execute()
    }
  }

  private async migrateUserSettings(settings: any): Promise<any> {
    // 处理设置格式变化
    return settings
  }

  private async migrateDatabase(db: Database): Promise<void> {
    // 处理数据库结构变化
  }
}
```

---

## 7. 安全考虑

### 7.1 更新包安全

- **签名验证**: 使用 GPG/PGP 签名验证更新包
- **哈希校验**: SHA256 + SHA512 双重校验
- **HTTPS 传输**: 强制使用 HTTPS
- **证书锁定**: 实现 Certificate Pinning

### 7.2 代码安全

```typescript
// 防止中间人攻击
class SecureUpdateChannel {
  private pinnedCertificates: string[] = []

  async verifyServerCertificate(url: URL): Promise<boolean> {
    const cert = await this.fetchCertificate(url.hostname)
    return this.pinnedCertificates.includes(cert.fingerprint)
  }

  async fetchWithSecurity(url: string): Promise<Response> {
    const verified = await this.verifyServerCertificate(new URL(url))
    if (!verified) {
      throw new SecurityError('服务器证书验证失败')
    }
    return fetch(url)
  }
}
```

---

## 8. 实现优先级

### Phase 1: 核心功能 (MVP)

1. ✅ 现有代码重构
2. 版本检查增强
3. 断点续传下载
4. SHA256 校验
5. 错误恢复机制

### Phase 2: 增强功能

1. 增量更新支持
2. 回滚机制完善
3. 多更新源支持
4. 后台自动检查

### Phase 3: 优化功能

1. CDN 加速
2. 分片下载
3. 智能网络适配
4. 诊断工具

---

本方案基于对项目现有更新模块的深入分析，提供了完整的在线更新功能设计。方案涵盖了从版本管理、下载、安全校验、回滚机制到用户界面的完整实现路径，并考虑了性能优化和兼容性需求。
