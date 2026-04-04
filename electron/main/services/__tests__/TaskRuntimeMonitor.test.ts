import { beforeEach, describe, expect, it } from 'vitest'
import { taskRuntimeMonitor } from '#/services/TaskRuntimeMonitor'

describe('TaskRuntimeMonitor', () => {
  beforeEach(() => {
    taskRuntimeMonitor.reset()
  })

  it('unregisters task using the runtime task id returned by registerTask', () => {
    const taskId = taskRuntimeMonitor.registerTask('acc-1', 'auto-comment')

    expect(taskRuntimeMonitor.getStatistics().runningTasks).toBe(1)

    taskRuntimeMonitor.unregisterTask(taskId)

    const accountTasks = taskRuntimeMonitor.getAccountTasks('acc-1')
    expect(taskRuntimeMonitor.getStatistics().runningTasks).toBe(0)
    expect(accountTasks).toHaveLength(1)
    expect(accountTasks[0]?.status).toBe('stopped')
  })
})
