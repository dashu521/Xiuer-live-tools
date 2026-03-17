import { useAccounts } from '@/hooks/useAccounts'
import { getUserConfig, syncUserConfig, type UserConfigData } from '@/services/apiClient'
import { usePlatformPreferenceStore } from '@/stores/platformPreferenceStore'

const DEBUG = import.meta.env.DEV

class ConfigSyncService {
  private syncTimeout: ReturnType<typeof setTimeout> | null = null
  private isSyncing = false
  private lastSyncTime = 0
  private readonly SYNC_DEBOUNCE_MS = 2000
  private readonly MIN_SYNC_INTERVAL_MS = 5000

  collectConfigData(): UserConfigData {
    const accountsState = useAccounts.getState()
    const platformPrefState = usePlatformPreferenceStore.getState()

    const config: UserConfigData = {
      accounts: accountsState.accounts,
      platformPreferences: platformPrefState.preferences,
    }

    if (DEBUG) {
      console.log('[ConfigSync] Collected config data:', {
        accountsCount: config.accounts?.length || 0,
        hasPlatformPrefs: !!config.platformPreferences,
      })
    }

    return config
  }

  async syncToCloud(): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncing) {
      if (DEBUG) console.log('[ConfigSync] Sync already in progress, skipping')
      return { success: true }
    }

    const now = Date.now()
    if (now - this.lastSyncTime < this.MIN_SYNC_INTERVAL_MS) {
      if (DEBUG) console.log('[ConfigSync] Sync too frequent, skipping')
      return { success: true }
    }

    this.isSyncing = true
    this.lastSyncTime = now

    try {
      const config = this.collectConfigData()

      const result = await syncUserConfig(config)

      if (result.ok && result.data?.success) {
        if (DEBUG) console.log('[ConfigSync] Sync to cloud successful')
        return { success: true }
      }

      const errorMsg = result.ok ? result.data?.message : result.error?.message
      console.error('[ConfigSync] Sync failed:', errorMsg)
      return { success: false, error: errorMsg }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ConfigSync] Sync error:', errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      this.isSyncing = false
    }
  }

  async loadFromCloud(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await getUserConfig()

      if (!result.ok) {
        const errorMsg = result.error?.message || 'Failed to fetch config'
        console.error('[ConfigSync] Load from cloud failed:', errorMsg)
        return { success: false, error: errorMsg }
      }

      const { config } = result.data

      if (!config) {
        if (DEBUG) console.log('[ConfigSync] No cloud config found, using local')
        return { success: true }
      }

      this.applyConfig(config)

      if (DEBUG) {
        console.log('[ConfigSync] Load from cloud successful:', {
          accountsCount: config.accounts?.length || 0,
          hasPlatformPrefs: !!config.platformPreferences,
        })
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[ConfigSync] Load error:', errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  private applyConfig(config: UserConfigData): void {
    if (config.accounts && config.accounts.length > 0) {
      const currentUserId = useAccounts.getState().currentUserId
      if (currentUserId) {
        useAccounts.setState({
          accounts: config.accounts,
          currentAccountId: config.accounts[0]?.id || '',
          defaultAccountId: config.accounts[0]?.id || null,
        })
        if (DEBUG) console.log('[ConfigSync] Applied accounts:', config.accounts.length)
      }
    }

    if (config.platformPreferences && Object.keys(config.platformPreferences).length > 0) {
      usePlatformPreferenceStore.setState({
        preferences: config.platformPreferences,
      })
      if (DEBUG) console.log('[ConfigSync] Applied platform preferences')
    }
  }

  scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    this.syncTimeout = setTimeout(() => {
      this.syncToCloud().catch(err => {
        console.error('[ConfigSync] Scheduled sync failed:', err)
      })
    }, this.SYNC_DEBOUNCE_MS)
  }

  setupAutoSync(): () => void {
    const unsubscribers: Array<() => void> = []

    const accountsUnsubscribe = useAccounts.subscribe((state, prevState) => {
      if (
        state.accounts !== prevState.accounts ||
        state.currentAccountId !== prevState.currentAccountId ||
        state.defaultAccountId !== prevState.defaultAccountId
      ) {
        this.scheduleSync()
      }
    })
    unsubscribers.push(accountsUnsubscribe)

    const platformPrefUnsubscribe = usePlatformPreferenceStore.subscribe((state, prevState) => {
      if (state.preferences !== prevState.preferences) {
        this.scheduleSync()
      }
    })
    unsubscribers.push(platformPrefUnsubscribe)

    if (DEBUG) console.log('[ConfigSync] Auto-sync setup complete')

    return () => {
      unsubscribers.forEach(unsub => unsub())
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout)
      }
    }
  }
}

export const configSyncService = new ConfigSyncService()
