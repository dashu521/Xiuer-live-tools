/**
 * TaskManager 多账号隔离单元测试
 * 验证任务状态按账号正确隔离
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskManagerImpl } from '../TaskManager'
import type { StopReason, TaskContext, TaskId } from '../types'
import { BaseTask } from '../types'

// 模拟任务类
class MockTask extends BaseTask {
  public startCalled = false
  public stopCalled = false
  public lastContext: TaskContext | null = null

  constructor(id: TaskId = 'autoSpeak') {
    super(id)
  }

  async start(ctx: TaskContext): Promise<void> {
    this.startCalled = true
    this.lastContext = ctx
    this.status = 'running'
  }

  async stop(reason: StopReason): Promise<void> {
    this.stopCalled = true
    super.stop(reason)
  }
}

class MockAutoReplyTask extends MockTask {
  constructor() {
    super('autoReply')
  }
}

class MockAutoPopupTask extends MockTask {
  constructor() {
    super('autoPopup')
  }
}

class SlowStartTask extends BaseTask {
  static startCalls = 0
  static releaseStart: (() => void) | null = null
  static waitForStart: Promise<void> = Promise.resolve()

  static prepare() {
    SlowStartTask.startCalls = 0
    SlowStartTask.waitForStart = new Promise<void>(resolve => {
      SlowStartTask.releaseStart = resolve
    })
  }

  constructor() {
    super('autoSpeak')
  }

  async start(_ctx: TaskContext): Promise<void> {
    SlowStartTask.startCalls += 1
    await SlowStartTask.waitForStart
    this.status = 'running'
  }
}

// 模拟 TaskContext
const createMockContext = (accountId: string): TaskContext => ({
  accountId,
  gateState: {
    connectionState: 'connected',
    streamState: 'live',
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  ipcInvoke: vi.fn(),
})

describe('TaskManager 多账号隔离测试', () => {
  let taskManager: TaskManagerImpl

  beforeEach(() => {
    taskManager = new TaskManagerImpl()
    // 注册模拟任务
    taskManager.register(MockAutoReplyTask as any)
    taskManager.register(MockAutoPopupTask as any)
    taskManager.register(MockTask as any)
  })

  describe('账号隔离 - 基本功能', () => {
    it('应该为不同账号创建独立的任务实例', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      // 启动账号A的任务
      await taskManager.start('autoSpeak', ctxA)

      // 启动账号B的任务
      await taskManager.start('autoSpeak', ctxB)

      // 验证两个任务都在运行
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('running')
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('running')
    })

    it('账号A的任务状态不应影响账号B', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      // 启动账号A的任务
      await taskManager.start('autoSpeak', ctxA)

      // 验证账号B可以正常启动（不会被A的运行状态阻止）
      const result = await taskManager.start('autoSpeak', ctxB)
      expect(result.success).toBe(true)
    })

    it('停止一个账号的任务不应影响其他账号', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      // 启动两个账号的任务
      await taskManager.start('autoSpeak', ctxA)
      await taskManager.start('autoSpeak', ctxB)

      // 停止账号A的任务
      await taskManager.stop('autoSpeak', 'manual', 'account-a')

      // 验证账号A停止，账号B仍在运行
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('stopped')
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('running')
    })
  })

  describe('账号隔离 - 状态管理', () => {
    it('每个账号应该有独立的任务状态', async () => {
      const ctxA = createMockContext('account-a')
      const _ctxB = createMockContext('account-b')
      const ctxC = createMockContext('account-c')

      // 启动A和C，B不启动
      await taskManager.start('autoSpeak', ctxA)
      await taskManager.start('autoSpeak', ctxC)

      // 验证各账号状态
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('running')
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('idle')
      expect(taskManager.getStatus('autoSpeak', 'account-c')).toBe('running')
    })

    it('获取所有账号状态应该正确', async () => {
      const ctxA = createMockContext('account-a')
      const _ctxB = createMockContext('account-b')

      await taskManager.start('autoSpeak', ctxA)

      const statusA = taskManager.getAllStatusForAccount('account-a')
      const statusB = taskManager.getAllStatusForAccount('account-b')

      expect(statusA.autoSpeak).toBe('running')
      expect(statusB.autoSpeak).toBe('idle')
    })

    it('应为 autoReply 和 autoPopup 维护独立状态', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      await taskManager.start('autoReply', ctxA)
      await taskManager.start('autoPopup', ctxB)

      expect(taskManager.getStatus('autoReply', 'account-a')).toBe('running')
      expect(taskManager.getStatus('autoReply', 'account-b')).toBe('idle')
      expect(taskManager.getStatus('autoPopup', 'account-a')).toBe('idle')
      expect(taskManager.getStatus('autoPopup', 'account-b')).toBe('running')
    })
  })

  describe('账号隔离 - 并发场景', () => {
    it('应该支持并发启动多个账号的任务', async () => {
      const accounts = ['acc-1', 'acc-2', 'acc-3', 'acc-4', 'acc-5']
      const contexts = accounts.map(id => createMockContext(id))

      // 并发启动所有任务
      const results = await Promise.all(contexts.map(ctx => taskManager.start('autoSpeak', ctx)))

      // 所有任务都应该启动成功
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // 验证所有任务都在运行
      accounts.forEach(accountId => {
        expect(taskManager.getStatus('autoSpeak', accountId)).toBe('running')
      })
    })

    it('应该支持并发停止多个账号的任务', async () => {
      const accounts = ['acc-1', 'acc-2', 'acc-3']

      // 先启动所有任务
      for (const accountId of accounts) {
        await taskManager.start('autoSpeak', createMockContext(accountId))
      }

      // 并发停止
      await Promise.all(
        accounts.map(accountId => taskManager.stop('autoSpeak', 'manual', accountId)),
      )

      // 验证所有任务都已停止
      accounts.forEach(accountId => {
        expect(taskManager.getStatus('autoSpeak', accountId)).toBe('stopped')
      })
    })
  })

  describe('账号隔离 - 清理功能', () => {
    it('清理账号应该停止该账号的所有任务', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      await taskManager.start('autoSpeak', ctxA)
      await taskManager.start('autoSpeak', ctxB)

      // 清理账号A
      taskManager.cleanupAccount('account-a')

      // 账号A的任务数据应该被清理
      expect(taskManager.getAllStatusForAccount('account-a')).toEqual({})
      // 账号B的任务应该不受影响
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('running')
    })

    it('stopAllForAccount 应停止该账号下的多个任务', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      await taskManager.start('autoReply', ctxA)
      await taskManager.start('autoPopup', ctxA)
      await taskManager.start('autoSpeak', ctxB)

      await taskManager.stopAllForAccount('account-a', 'manual')

      expect(taskManager.getStatus('autoReply', 'account-a')).toBe('stopped')
      expect(taskManager.getStatus('autoPopup', 'account-a')).toBe('stopped')
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('running')
    })
  })

  describe('错误处理', () => {
    it('重复启动同一账号的任务应该失败', async () => {
      const ctxA = createMockContext('account-a')

      // 第一次启动
      const result1 = await taskManager.start('autoSpeak', ctxA)
      expect(result1.success).toBe(true)

      // 重复启动
      const result2 = await taskManager.start('autoSpeak', ctxA)
      expect(result2.success).toBe(false)
      expect(result2.reason).toBe('ALREADY_RUNNING')
    })

    it('停止未启动的任务应该安全处理', async () => {
      // 不应该抛出错误
      await expect(
        taskManager.stop('autoSpeak', 'manual', 'non-existent-account'),
      ).resolves.not.toThrow()
    })

    it('任务实例已停止但管理器状态残留为 running 时应允许重新启动', async () => {
      const ctxA = createMockContext('account-a')

      const firstStart = await taskManager.start('autoReply', ctxA)
      expect(firstStart.success).toBe(true)

      const accountTasks = (
        taskManager as unknown as {
          accountTasks: Map<string, Map<TaskId, { status: string; taskInstance: MockTask }>>
        }
      ).accountTasks
      const taskState = accountTasks.get('account-a')?.get('autoReply')
      expect(taskState).toBeDefined()

      taskState!.status = 'running'
      taskState!.taskInstance.status = 'stopped'

      const secondStart = await taskManager.start('autoReply', ctxA)
      expect(secondStart.success).toBe(true)
      expect(taskManager.getStatus('autoReply', 'account-a')).toBe('running')
    })

    it('任务启动中的窗口内也应拦截重复启动', async () => {
      taskManager = new TaskManagerImpl()
      SlowStartTask.prepare()
      taskManager.register(SlowStartTask as any)

      const ctxA = createMockContext('account-a')

      const firstStartPromise = taskManager.start('autoSpeak', ctxA)
      const secondStart = await taskManager.start('autoSpeak', ctxA)

      expect(secondStart.success).toBe(false)
      expect(secondStart.reason).toBe('ALREADY_RUNNING')
      expect(SlowStartTask.startCalls).toBe(1)

      SlowStartTask.releaseStart?.()
      const firstStart = await firstStartPromise
      expect(firstStart.success).toBe(true)
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('running')
    })

    it('任务启动中的窗口内收到 stop 应在启动完成后立即停下', async () => {
      taskManager = new TaskManagerImpl()
      SlowStartTask.prepare()
      taskManager.register(SlowStartTask as any)

      const ctxA = createMockContext('account-a')

      const startPromise = taskManager.start('autoSpeak', ctxA)
      await taskManager.stop('autoSpeak', 'manual', 'account-a')

      SlowStartTask.releaseStart?.()
      const startResult = await startPromise

      expect(startResult.success).toBe(true)
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('stopped')
    })

    it('stopAllForAccount 应覆盖启动中的任务', async () => {
      taskManager = new TaskManagerImpl()
      SlowStartTask.prepare()
      taskManager.register(SlowStartTask as any)

      const ctxA = createMockContext('account-a')

      const startPromise = taskManager.start('autoSpeak', ctxA)
      await taskManager.stopAllForAccount('account-a', 'disconnected')

      SlowStartTask.releaseStart?.()
      const startResult = await startPromise

      expect(startResult.success).toBe(true)
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('stopped')
    })
  })

  describe('向后兼容性', () => {
    it('不传accountId时应该返回全局状态', async () => {
      const ctxA = createMockContext('account-a')
      await taskManager.start('autoSpeak', ctxA)

      // 不传accountId应该返回全局状态
      const globalStatus = taskManager.getStatus('autoSpeak')
      expect(['running', 'idle']).toContain(globalStatus)
    })

    it('stop方法应该支持不传accountId（停止所有账号）', async () => {
      const ctxA = createMockContext('account-a')
      const ctxB = createMockContext('account-b')

      await taskManager.start('autoSpeak', ctxA)
      await taskManager.start('autoSpeak', ctxB)

      // 不传accountId应该停止所有账号
      await taskManager.stop('autoSpeak', 'manual')

      // 两个账号的任务都应该停止
      expect(taskManager.getStatus('autoSpeak', 'account-a')).toBe('stopped')
      expect(taskManager.getStatus('autoSpeak', 'account-b')).toBe('stopped')
    })

    it('syncStatus 应支持 autoReply 和 autoPopup 的后端事件校准', async () => {
      const ctxA = createMockContext('account-a')

      await taskManager.start('autoReply', ctxA)
      await taskManager.start('autoPopup', ctxA)

      taskManager.syncStatus('autoReply', 'stopped', 'account-a')
      taskManager.syncStatus('autoPopup', 'error', 'account-a')

      expect(taskManager.getStatus('autoReply', 'account-a')).toBe('stopped')
      expect(taskManager.getStatus('autoPopup', 'account-a')).toBe('error')
    })
  })
})
