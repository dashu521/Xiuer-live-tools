import { useAccounts } from '@/hooks/useAccounts'
import { useAuthStore } from '@/stores/authStore'

const GLOBAL_CLEANUP_KEY = '__accounts_auth_sync_cleanup__' as const

export function ensureAccountsAuthSync(): () => void {
  const globalState = globalThis as typeof globalThis & {
    [GLOBAL_CLEANUP_KEY]?: (() => void) | undefined
  }

  if (globalState[GLOBAL_CLEANUP_KEY]) {
    return globalState[GLOBAL_CLEANUP_KEY]!
  }

  const unsubscribe = useAuthStore.subscribe((state, prevState) => {
    const currentUserId = state.user?.id
    const prevUserId = prevState.user?.id

    if (currentUserId && currentUserId !== prevUserId) {
      useAccounts.getState().loadUserAccounts(currentUserId)
    }

    if (!currentUserId && prevUserId) {
      useAccounts.getState().reset()
    }
  })

  globalState[GLOBAL_CLEANUP_KEY] = unsubscribe
  return unsubscribe
}
