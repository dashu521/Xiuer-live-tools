import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAutoMessageStore } from '@/hooks/useAutoMessage'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import { taskManager } from '@/tasks'

export function deriveDirectTaskRuntimeState(activeTasks: string[]): {
  autoSpeakRunning: boolean
  autoPopupRunning: boolean
} {
  const taskSet = new Set(activeTasks)
  return {
    autoSpeakRunning: taskSet.has('auto-comment'),
    autoPopupRunning: taskSet.has('auto-popup'),
  }
}

export async function syncDirectTaskRuntimeFromMain(
  accountId: string,
  reason = 'unknown',
): Promise<void> {
  if (!accountId || !window.ipcRenderer) {
    return
  }

  const snapshot = await window.ipcRenderer.invoke(
    IPC_CHANNELS.diagnostics.getAccountTasks,
    accountId,
  )
  const { autoSpeakRunning, autoPopupRunning } = deriveDirectTaskRuntimeState(snapshot.activeTasks)

  console.log(
    `[TaskRuntimeSync] account=${accountId}, reason=${reason}, activeTasks=${snapshot.activeTasks.join(',') || 'none'}, autoSpeak=${autoSpeakRunning}, autoPopup=${autoPopupRunning}`,
  )

  useAutoMessageStore.getState().setIsRunning(accountId, autoSpeakRunning)
  useAutoPopUpStore.getState().setIsRunning(accountId, autoPopupRunning)

  taskManager.syncStatus('autoSpeak', autoSpeakRunning ? 'running' : 'stopped', accountId)
  taskManager.syncStatus('autoPopup', autoPopupRunning ? 'running' : 'stopped', accountId)
}
