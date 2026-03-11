import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'
import { createLogger } from '../logger'

const logger = createLogger('rollback-manager')

export interface BackupInfo {
  id: string
  version: string
  backupPath: string
  timestamp: number
  files: string[]
  size: number
}

export interface RollbackConfig {
  maxBackups: number
  backupDir: string
  autoBackup: boolean
}

const DEFAULT_CONFIG: RollbackConfig = {
  maxBackups: 5,
  backupDir: '',
  autoBackup: true,
}

const CRITICAL_FILES = ['app.asar', 'app.asar.unpacked', 'resources', 'locales']

class RollbackManager {
  private config: RollbackConfig
  private backups: Map<string, BackupInfo> = new Map()

  constructor(config: Partial<RollbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (!this.config.backupDir) {
      this.config.backupDir = path.join(app.getPath('userData'), 'backups')
    }

    try {
      this.ensureBackupDir()
      this.loadBackupIndex()
    } catch (error) {
      logger.warn('Failed to initialize RollbackManager:', error)
      this.config.backupDir = ''
    }
  }

  private ensureBackupDir(): void {
    if (!existsSync(this.config.backupDir)) {
      mkdirSync(this.config.backupDir, { recursive: true })
      logger.info(`Created backup directory: ${this.config.backupDir}`)
    }
  }

  private loadBackupIndex(): void {
    const indexPath = path.join(this.config.backupDir, 'backup-index.json')

    if (existsSync(indexPath)) {
      try {
        const data = readFileSync(indexPath, 'utf-8')
        const backups = JSON.parse(data) as BackupInfo[]

        for (const backup of backups) {
          this.backups.set(backup.id, backup)
        }

        logger.info(`Loaded ${this.backups.size} backup records`)
      } catch (error) {
        logger.error('Failed to load backup index:', error)
      }
    }
  }

  private saveBackupIndex(): void {
    const indexPath = path.join(this.config.backupDir, 'backup-index.json')

    try {
      const backups = Array.from(this.backups.values())
      writeFileSync(indexPath, JSON.stringify(backups, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to save backup index:', error)
    }
  }

  async createBackup(version: string): Promise<BackupInfo> {
    const backupId = this.generateBackupId(version)
    const backupPath = path.join(this.config.backupDir, backupId)

    logger.info(`Creating backup for version ${version} at ${backupPath}`)

    if (!existsSync(backupPath)) {
      mkdirSync(backupPath, { recursive: true })
    }

    const _appPath = app.getAppPath()
    const packagedAppPath = path.dirname(app.getPath('exe'))

    const files: string[] = []
    let totalSize = 0

    if (existsSync(packagedAppPath)) {
      for (const file of CRITICAL_FILES) {
        const filePath = path.join(packagedAppPath, file)

        if (existsSync(filePath)) {
          try {
            const destPath = path.join(backupPath, file)
            await this.copyPath(filePath, destPath)
            files.push(file)
            totalSize += await this.getPathSize(filePath)
          } catch (error) {
            logger.warn(`Failed to backup ${file}:`, error)
          }
        }
      }
    }

    const backupInfo: BackupInfo = {
      id: backupId,
      version,
      backupPath,
      timestamp: Date.now(),
      files,
      size: totalSize,
    }

    this.backups.set(backupId, backupInfo)
    this.saveBackupIndex()

    await this.cleanupOldBackups()

    logger.info(`Backup created: ${backupId}, size: ${this.formatSize(totalSize)}`)

    return backupInfo
  }

  async restoreBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId)

    if (!backup) {
      logger.error(`Backup not found: ${backupId}`)
      return false
    }

    if (!existsSync(backup.backupPath)) {
      logger.error(`Backup path not found: ${backup.backupPath}`)
      return false
    }

    logger.info(`Restoring backup: ${backupId}`)

    const _appPath = app.getAppPath()
    const packagedAppPath = path.dirname(app.getPath('exe'))

    try {
      for (const file of backup.files) {
        const sourcePath = path.join(backup.backupPath, file)
        const destPath = path.join(packagedAppPath, file)

        if (existsSync(sourcePath)) {
          if (existsSync(destPath)) {
            await this.removePath(destPath)
          }

          await this.copyPath(sourcePath, destPath)
          logger.debug(`Restored file: ${file}`)
        }
      }

      logger.info('Backup restored successfully')
      return true
    } catch (error) {
      logger.error('Failed to restore backup:', error)
      return false
    }
  }

  async rollbackToVersion(version: string): Promise<boolean> {
    const backup = this.findBackupByVersion(version)

    if (!backup) {
      logger.error(`No backup found for version: ${version}`)
      return false
    }

    logger.info(`Rolling back to version: ${version}`)
    return await this.restoreBackup(backup.id)
  }

  async listBackups(): Promise<BackupInfo[]> {
    return Array.from(this.backups.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    const backup = this.backups.get(backupId)

    if (!backup) {
      return false
    }

    try {
      if (existsSync(backup.backupPath)) {
        await this.removePath(backup.backupPath)
      }

      this.backups.delete(backupId)
      this.saveBackupIndex()

      logger.info(`Backup deleted: ${backupId}`)
      return true
    } catch (error) {
      logger.error(`Failed to delete backup ${backupId}:`, error)
      return false
    }
  }

  async cleanupOldBackups(): Promise<void> {
    if (this.backups.size <= this.config.maxBackups) {
      return
    }

    const sortedBackups = Array.from(this.backups.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    )

    const toDelete = sortedBackups.slice(this.config.maxBackups)

    for (const backup of toDelete) {
      await this.deleteBackup(backup.id)
    }

    logger.info(`Cleaned up ${toDelete.length} old backups`)
  }

  findBackupByVersion(version: string): BackupInfo | undefined {
    for (const backup of this.backups.values()) {
      if (backup.version === version) {
        return backup
      }
    }
    return undefined
  }

  getLatestBackup(): BackupInfo | undefined {
    const backups = Array.from(this.backups.values())
    if (backups.length === 0) {
      return undefined
    }
    return backups.reduce((latest, backup) =>
      backup.timestamp > latest.timestamp ? backup : latest,
    )
  }

  private async copyPath(source: string, destination: string): Promise<void> {
    const stats = statSync(source)

    if (stats.isDirectory()) {
      if (!existsSync(destination)) {
        mkdirSync(destination, { recursive: true })
      }

      const entries = readdirSync(source)

      for (const entry of entries) {
        const srcPath = path.join(source, entry)
        const destPath = path.join(destination, entry)
        await this.copyPath(srcPath, destPath)
      }
    } else {
      const destDir = path.dirname(destination)
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }

      const readStream = createReadStream(source)
      const writeStream = createWriteStream(destination)

      await new Promise<void>((resolve, reject) => {
        readStream.on('error', reject)
        writeStream.on('error', reject)
        writeStream.on('finish', resolve)
        readStream.pipe(writeStream)
      })
    }
  }

  private async removePath(targetPath: string): Promise<void> {
    const stats = statSync(targetPath)

    if (stats.isDirectory()) {
      const entries = readdirSync(targetPath)

      for (const entry of entries) {
        await this.removePath(path.join(targetPath, entry))
      }

      unlinkSync(targetPath)
    } else {
      unlinkSync(targetPath)
    }
  }

  private async getPathSize(targetPath: string): Promise<number> {
    const stats = statSync(targetPath)

    if (stats.isDirectory()) {
      let size = 0
      const entries = readdirSync(targetPath)

      for (const entry of entries) {
        size += await this.getPathSize(path.join(targetPath, entry))
      }

      return size
    }

    return stats.size
  }

  private generateBackupId(version: string): string {
    const timestamp = Date.now()
    const hash = createHash('md5').update(`${version}-${timestamp}`).digest('hex').substring(0, 8)
    return `backup-${version}-${hash}`
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}

export const rollbackManager = new RollbackManager()
