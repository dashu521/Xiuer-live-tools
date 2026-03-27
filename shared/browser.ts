export type BrowserSource = 'detected' | 'manual'

export type BrowserEngine = 'chromium' | 'unknown'

export type BrowserVerificationStatus = 'verified' | 'failed' | 'unknown'

export interface BrowserCandidate {
  id: string
  name: string
  path: string
  source: BrowserSource
  engine: BrowserEngine
  status: BrowserVerificationStatus
  lastError?: string | null
}

export interface BrowserTestResult {
  success: boolean
  error?: string
}
