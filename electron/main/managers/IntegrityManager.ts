import { createHash, createVerify } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import * as path from 'node:path'
import { app, net } from 'electron'
import { createLogger } from '../logger'

const logger = createLogger('integrity-manager')

export type HashAlgorithm = 'sha256' | 'sha512' | 'md5'

export interface ChecksumInfo {
  algorithm: HashAlgorithm
  value: string
}

export interface SignedChecksum {
  checksums: ChecksumInfo[]
  signature?: string
  publicKeyUrl?: string
}

class IntegrityManager {
  async computeHash(filePath: string, algorithm: HashAlgorithm = 'sha256'): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash(algorithm)
      const stream = createReadStream(filePath)

      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => {
        const digest = hash.digest('hex')
        logger.debug(
          `Computed ${algorithm} hash for ${path.basename(filePath)}: ${digest.substring(0, 16)}...`,
        )
        resolve(digest)
      })
      stream.on('error', error => {
        logger.error(`Failed to compute hash for ${filePath}:`, error)
        reject(error)
      })
    })
  }

  async verifyChecksum(filePath: string, expected: ChecksumInfo): Promise<boolean> {
    if (!existsSync(filePath)) {
      logger.error(`File not found for verification: ${filePath}`)
      return false
    }

    try {
      const actualHash = await this.computeHash(filePath, expected.algorithm)
      const isValid = actualHash.toLowerCase() === expected.value.toLowerCase()

      if (isValid) {
        logger.info(`Checksum verified successfully for ${path.basename(filePath)}`)
      } else {
        logger.error(
          `Checksum mismatch for ${path.basename(filePath)}: expected ${expected.value.substring(0, 16)}..., got ${actualHash.substring(0, 16)}...`,
        )
      }

      return isValid
    } catch (error) {
      logger.error(`Checksum verification failed for ${filePath}:`, error)
      return false
    }
  }

  async verifyWithMultipleAlgorithms(
    filePath: string,
    checksums: ChecksumInfo[],
  ): Promise<{ verified: boolean; failed: string[] }> {
    const failed: string[] = []

    for (const checksum of checksums) {
      const isValid = await this.verifyChecksum(filePath, checksum)
      if (!isValid) {
        failed.push(checksum.algorithm)
      }
    }

    return {
      verified: failed.length === 0,
      failed,
    }
  }

  async verifySignature(filePath: string, signedChecksum: SignedChecksum): Promise<boolean> {
    if (!signedChecksum.signature || !signedChecksum.publicKeyUrl) {
      logger.warn('No signature or public key URL provided, skipping signature verification')
      return true
    }

    try {
      const publicKey = await this.fetchPublicKey(signedChecksum.publicKeyUrl)

      const fileHash = await this.computeHash(filePath, 'sha256')

      const signatureBuffer = Buffer.from(signedChecksum.signature, 'base64')

      const verifier = createVerify('RSA-SHA256')
      verifier.update(fileHash)
      verifier.end()

      const isValid = verifier.verify(publicKey, signatureBuffer)

      if (isValid) {
        logger.info('Signature verified successfully')
      } else {
        logger.error('Signature verification failed')
      }

      return isValid
    } catch (error) {
      logger.error('Signature verification error:', error)
      return false
    }
  }

  async fetchPublicKey(url: string): Promise<string> {
    try {
      logger.debug(`Fetching public key from: ${url}`)
      const response = await net.fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch public key: ${response.status}`)
      }

      const publicKey = await response.text()
      logger.debug('Public key fetched successfully')
      return publicKey
    } catch (error) {
      logger.error('Failed to fetch public key:', error)
      throw error
    }
  }

  async verifyGpgSignature(_dataPath: string, _signaturePath: string): Promise<boolean> {
    logger.warn('GPG signature verification is not yet implemented')
    return true
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  async checkDiskSpace(requiredBytes: number): Promise<{ sufficient: boolean; available: number }> {
    try {
      const { statfsSync } = await import('node:fs')
      const appPath = app.getPath('exe')
      const dir = path.dirname(appPath)

      const stats = statfsSync(dir)
      const available = stats.bsize * stats.bfree

      return {
        sufficient: available >= requiredBytes,
        available,
      }
    } catch (error) {
      logger.error('Failed to check disk space:', error)
      return {
        sufficient: true,
        available: 0,
      }
    }
  }
}

export const integrityManager = new IntegrityManager()
