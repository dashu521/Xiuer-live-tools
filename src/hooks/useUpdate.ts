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

interface UpdateState {
  status: UpdateStatus
  versionInfo: VersionState | null
  progress: ProgressState
  error: ErrorType | null
  source: string
  backups: BackupInfo[]
}

interface UpdateAction {
  checkUpdateManually: () => Promise<{ upToDate: boolean } | undefined>
  startDownload: (source?: string) => Promise<void>
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

  checkUpdateManually: async () => {
    set({ status: 'checking', error: null })
    try {
      const result = (await window.ipcRenderer.invoke(IPC_CHANNELS.updater.checkUpdate)) as any
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
        set({ status: 'idle' })
        return { upToDate: true }
      }
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '检查更新失败' } })
    }
  },

  startDownload: async (source?: string) => {
    set({ status: 'preparing', progress: initialProgress, error: null })
    try {
      await window.ipcRenderer.invoke(IPC_CHANNELS.updater.startDownload, source || '')
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '开始下载失败' } })
    }
  },

  // 以下功能暂未实现，保留接口但使用空实现
  pauseDownload: async () => {
    console.warn('pauseDownload not implemented')
    set({ status: 'paused' })
  },

  resumeDownload: async () => {
    console.warn('resumeDownload not implemented')
    set({ status: 'downloading' })
  },

  cancelDownload: async () => {
    console.warn('cancelDownload not implemented')
    set({ status: 'idle', progress: initialProgress })
  },

  installUpdate: async () => {
    set({ status: 'restarting' })
    try {
      await window.ipcRenderer.invoke(IPC_CHANNELS.updater.quitAndInstall)
    } catch (e) {
      set({ status: 'error', error: { message: (e as Error).message || '安装更新失败' } })
    }
  },

  rollback: async (_targetVersion?: string) => {
    console.warn('rollback not implemented')
    return false
  },

  listBackups: async () => {
    console.warn('listBackups not implemented')
    return []
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
  enableAutoDownload: boolean
  enableAutoInstall: boolean
  installOnQuit: boolean
  source: string
  customSource: string
  autoCheckInterval: number
  bandwidthLimit: number
  setEnableAutoCheckUpdate: (enabled: boolean) => void
  setEnableAutoDownload: (enabled: boolean) => void
  setEnableAutoInstall: (enabled: boolean) => void
  setInstallOnQuit: (enabled: boolean) => void
  setSource: (source: string) => void
  setCustomSource: (customSource: string) => void
  setAutoCheckInterval: (interval: number) => void
  setBandwidthLimit: (limit: number) => void
}

export const useUpdateConfigStore = create<UpdateConfigStore>()(
  persist(
    set => ({
      enableAutoCheckUpdate: true,
      enableAutoDownload: false,
      enableAutoInstall: false,
      installOnQuit: true,
      source: 'official',
      customSource: '',
      autoCheckInterval: 3600000,
      bandwidthLimit: 0,
      setEnableAutoCheckUpdate: enabled => set({ enableAutoCheckUpdate: enabled }),
      setEnableAutoDownload: enabled => set({ enableAutoDownload: enabled }),
      setEnableAutoInstall: enabled => set({ enableAutoInstall: enabled }),
      setInstallOnQuit: enabled => set({ installOnQuit: enabled }),
      setSource: source => set({ source }),
      setCustomSource: customSource => set({ customSource }),
      setAutoCheckInterval: interval => set({ autoCheckInterval: interval }),
      setBandwidthLimit: limit => set({ bandwidthLimit: limit }),
    }),
    {
      name: 'update-config-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
