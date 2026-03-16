import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createSelectors } from '@/utils/zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'preparing'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'ready'
  | 'applying'
  | 'restarting'
  | 'rollback'
  | 'error'

export interface VersionState {
  currentVersion: string
  latestVersion: string
  releaseNote?: string
  mandatory?: boolean
}

export interface ProgressState {
  percent: number
  transferred: number
  total: number
  speed: number
  eta: number
}

export interface BackupInfo {
  id: string
  version: string
  timestamp: number
  size: number
}

export interface UpdateCheckResult {
  update: boolean
  version: string
  newVersion: string
  releaseNote?: string
}

const UNSUPPORTED_UPDATE_ACTION_MESSAGE = '当前版本暂不支持该更新控制操作'

export interface UpdateCapabilities {
  checkUpdate: boolean
  startDownload: boolean
  quitAndInstall: boolean
  pauseDownload: boolean
  resumeDownload: boolean
  cancelDownload: boolean
  rollback: boolean
  listBackups: boolean
}

export interface UpdateRuntimeStatus {
  platform: string
  canUpdate: boolean
  capabilities: UpdateCapabilities
}

const defaultCapabilities: UpdateCapabilities = {
  checkUpdate: false,
  startDownload: false,
  quitAndInstall: false,
  pauseDownload: false,
  resumeDownload: false,
  cancelDownload: false,
  rollback: false,
  listBackups: false,
}

const defaultRuntimeStatus: UpdateRuntimeStatus = {
  platform: 'unknown',
  canUpdate: false,
  capabilities: defaultCapabilities,
}

interface UpdateState {
  status: UpdateStatus
  versionInfo: VersionState | null
  progress: ProgressState
  error: ErrorType | null
  source: string
  backups: BackupInfo[]
  runtime: UpdateRuntimeStatus
}

interface UpdateAction {
  refreshRuntimeStatus: () => Promise<UpdateRuntimeStatus>
  checkUpdateManually: () => Promise<{ upToDate: boolean } | undefined>
  startDownload: () => Promise<void>
  pauseDownload: () => Promise<void>
  resumeDownload: () => Promise<void>
  cancelDownload: () => Promise<void>
  installUpdate: () => Promise<void>
  rollback: (targetVersion?: string) => Promise<boolean>
  listBackups: () => Promise<BackupInfo[]>
  setProgress: (progress: Partial<ProgressState>) => void
  setStatus: (status: UpdateStatus) => void
  reset: () => void
  handleError: (error: ErrorType) => void
  handleUpdate: (info: VersionState) => void
  handleCheckResult: (result: UpdateCheckResult) => void
  handleDownloadProgress: (progress: ProgressState) => void
  handleDownloadReady: () => void
  setSource: (source: string) => void
}

type UpdateStore = UpdateState & UpdateAction

const initialProgress: ProgressState = {
  percent: 0,
  transferred: 0,
  total: 0,
  speed: 0,
  eta: 0,
}

const useUpdateStoreBase = create<UpdateStore>()((set, get) => ({
  status: 'idle',
  versionInfo: null,
  progress: initialProgress,
  error: null,
  source: 'official',
  backups: [],
  runtime: defaultRuntimeStatus,

  refreshRuntimeStatus: async () => {
    try {
      const runtime = (await window.ipcRenderer.invoke(
        IPC_CHANNELS.updater.getStatus,
      )) as UpdateRuntimeStatus
      set({ runtime })
      return runtime
    } catch (e) {
      const message = (e as Error).message || '获取更新能力失败'
      set({ error: { message } })
      return defaultRuntimeStatus
    }
  },

  checkUpdateManually: async () => {
    const { source, customSource } = useUpdateConfigStore.getState()
    const actualSource = source === 'custom' ? customSource.trim() : source

    if (!actualSource) {
      set({
        status: 'error',
        error: { message: '请输入有效的自定义更新源' },
      })
      return
    }

    const runtime = await get().refreshRuntimeStatus()
    if (!runtime.capabilities.checkUpdate) {
      set({
        status: 'error',
        error: { message: '当前平台或环境不支持检查更新' },
      })
      return
    }
    set({ status: 'checking', error: null })
    try {
      const result = (await window.ipcRenderer.invoke(
        IPC_CHANNELS.updater.checkUpdate,
        actualSource,
      )) as UpdateCheckResult | null | undefined
      if (result?.update) {
        set({
          status: 'available',
          versionInfo: {
            currentVersion: result.version,
            latestVersion: result.newVersion,
            releaseNote: result.releaseNote,
          },
        })
      } else {
        if (result) {
          set({ status: 'idle' })
          return { upToDate: true }
        }

        // 主进程可能已经通过 updateError 事件返回了更具体的错误；
        // 如果没有结果也没有错误态，至少给用户一个明确反馈，而不是停在“没反应”。
        if (get().status === 'checking') {
          set({
            status: 'error',
            error: { message: '检查更新失败，请稍后重试。' },
          })
        }
      }
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '检查更新失败' } })
    }
  },

  startDownload: async () => {
    const runtime = await get().refreshRuntimeStatus()
    if (!runtime.capabilities.startDownload) {
      set({
        status: 'error',
        error: { message: '当前平台或环境不支持下载更新' },
      })
      return
    }
    set({ status: 'preparing', progress: initialProgress, error: null })
    try {
      await window.ipcRenderer.invoke(IPC_CHANNELS.updater.startDownload)
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '开始下载失败' } })
    }
  },

  pauseDownload: async () => {
    console.warn('pauseDownload not implemented')
    throw new Error(UNSUPPORTED_UPDATE_ACTION_MESSAGE)
  },

  resumeDownload: async () => {
    console.warn('resumeDownload not implemented')
    throw new Error(UNSUPPORTED_UPDATE_ACTION_MESSAGE)
  },

  cancelDownload: async () => {
    console.warn('cancelDownload not implemented')
    throw new Error(UNSUPPORTED_UPDATE_ACTION_MESSAGE)
  },

  installUpdate: async () => {
    const runtime = await get().refreshRuntimeStatus()
    if (!runtime.capabilities.quitAndInstall) {
      set({
        status: 'error',
        error: { message: '当前平台或环境不支持安装更新' },
      })
      return
    }
    set({ status: 'restarting' })
    try {
      await window.ipcRenderer.invoke(IPC_CHANNELS.updater.quitAndInstall)
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '安装更新失败' } })
    }
  },

  rollback: async (_targetVersion?: string) => {
    const runtime = await get().refreshRuntimeStatus()
    if (!runtime.capabilities.rollback) {
      throw new Error(UNSUPPORTED_UPDATE_ACTION_MESSAGE)
    }

    set({ status: 'rollback', error: null })
    try {
      const result = (await window.ipcRenderer.invoke(
        IPC_CHANNELS.updater.rollback,
        _targetVersion,
      )) as { success: boolean; error?: string }

      if (!result.success) {
        throw new Error(result.error || '回滚失败')
      }

      const backups = await get().listBackups()
      set({
        status: 'idle',
        versionInfo: null,
        backups,
      })
      return true
    } catch (e) {
      set({
        status: 'error',
        error: { message: (e as Error).message || '回滚失败' },
      })
      return false
    }
  },

  listBackups: async () => {
    const runtime = await get().refreshRuntimeStatus()
    if (!runtime.capabilities.listBackups) {
      throw new Error(UNSUPPORTED_UPDATE_ACTION_MESSAGE)
    }

    const backups = (await window.ipcRenderer.invoke(
      IPC_CHANNELS.updater.listBackups,
    )) as BackupInfo[]
    set({ backups })
    return backups
  },

  setProgress: (progress: Partial<ProgressState>) => {
    set(state => ({
      progress: { ...state.progress, ...progress },
    }))
  },

  setStatus: (status: UpdateStatus) => set({ status }),

  reset: () => set({ status: 'idle', progress: initialProgress, versionInfo: null, error: null }),

  handleError: (error: ErrorType) => {
    const currentStatus = get().status
    if (
      currentStatus === 'checking' ||
      currentStatus === 'preparing' ||
      currentStatus === 'downloading' ||
      currentStatus === 'verifying'
    ) {
      set({ status: 'error', error })
    }
  },

  handleUpdate: (info: VersionState) => {
    const currentStatus = get().status
    if (currentStatus === 'idle') {
      set({ status: 'available', versionInfo: info })
    }
  },

  handleCheckResult: result => {
    if (result.update) {
      set({
        status: 'available',
        versionInfo: {
          currentVersion: result.version,
          latestVersion: result.newVersion,
          releaseNote: result.releaseNote,
        },
      })
      return
    }

    set({
      status: 'idle',
      versionInfo: null,
      error: null,
    })
  },

  handleDownloadProgress: (progress: ProgressState) => {
    set({ status: 'downloading', progress })
  },

  handleDownloadReady: () => {
    set({ status: 'ready', progress: { ...get().progress, percent: 100 } })
  },

  setSource: (source: string) => set({ source }),
}))

export const useUpdateStore = createSelectors(useUpdateStoreBase)

interface UpdateConfigStore {
  enableAutoCheckUpdate: boolean
  source: string
  customSource: string
  setEnableAutoCheckUpdate: (enabled: boolean) => void
  setSource: (source: string) => void
  setCustomSource: (customSource: string) => void
}

export const useUpdateConfigStore = create<UpdateConfigStore>()(
  persist(
    set => ({
      enableAutoCheckUpdate: true,
      source: 'official',
      customSource: '',
      setEnableAutoCheckUpdate: enabled => set({ enableAutoCheckUpdate: enabled }),
      setSource: source => set({ source }),
      setCustomSource: customSource => set({ customSource }),
    }),
    {
      name: 'update-config-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
