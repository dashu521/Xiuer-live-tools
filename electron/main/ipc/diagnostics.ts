import { ipcMain } from 'electron'
import { accountManager } from '#/managers/AccountManager'
import { taskRuntimeMonitor } from '../services/TaskRuntimeMonitor'

export function setupDiagnosticsIpcHandlers() {
  ipcMain.handle('diagnostics:getRuntimeStats', async () => {
    return taskRuntimeMonitor.getStatistics()
  })

  ipcMain.handle('diagnostics:getAccountTasks', async (_, accountId: string) => {
    return {
      accountId,
      activeTasks: accountManager.getActiveTaskTypes(accountId),
      monitorTasks: taskRuntimeMonitor.getAccountTasks(accountId),
    }
  })

  ipcMain.handle('diagnostics:getTimeline', async () => {
    return taskRuntimeMonitor.getTimeline()
  })

  ipcMain.handle('diagnostics:printSummary', async () => {
    taskRuntimeMonitor.printSummary()
    return { success: true }
  })

  ipcMain.handle('diagnostics:reset', async () => {
    taskRuntimeMonitor.reset()
    return { success: true, message: 'Runtime monitor reset' }
  })
}
