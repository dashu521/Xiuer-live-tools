import { useEffect } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentLiveControl } from '@/hooks/useLiveControl'
import { syncDirectTaskRuntimeFromMain } from '@/utils/taskRuntimeSync'

export function useTaskRuntimeSync() {
  const currentAccountId = useAccounts(state => state.currentAccountId)
  const connectionStatus = useCurrentLiveControl(context => context.connectState.status)

  useEffect(() => {
    if (!currentAccountId) {
      return
    }

    void syncDirectTaskRuntimeFromMain(currentAccountId, 'account-switch')
  }, [currentAccountId])

  useEffect(() => {
    if (!currentAccountId) {
      return
    }

    void syncDirectTaskRuntimeFromMain(currentAccountId, `connection-${connectionStatus}`)
  }, [currentAccountId, connectionStatus])
}
