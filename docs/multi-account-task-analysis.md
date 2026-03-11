# 多账号任务管理系统 - 问题分析报告

## 执行摘要

经过全面代码审查，发现了**一个关键问题**可能导致账号间任务相互影响。问题主要涉及**任务停止事件传播机制**和**IPC事件监听器的生命周期管理**。

---

## 1. 系统架构分析

### 1.1 任务管理架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        渲染进程 (Renderer)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  AutoSpeak  │    │  AutoReply  │    │   useTaskManager    │  │
│  │    Task     │    │    Task     │    │                     │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                       │             │
│         └──────────────────┼───────────────────────┘             │
│                            ▼                                     │
│                   ┌─────────────────┐                            │
│                   │  TaskManager    │                            │
│                   │  (账号隔离)      │                            │
│                   └────────┬────────┘                            │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │ IPC
┌────────────────────────────┼─────────────────────────────────────┐
│                        主进程 (Main)                             │
│                            ▼                                     │
│                   ┌─────────────────┐                            │
│                   │ AccountManager  │                            │
│                   │  (Map<accountId, │                            │
│                   │   AccountSession>)│                           │
│                   └────────┬────────┘                            │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                  │
│         ▼                  ▼                  ▼                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │AccountSession│   │AccountSession│   │AccountSession│            │
│  │  (账号A)     │   │  (账号B)     │   │  (账号C)     │            │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘            │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ activeTasks │   │ activeTasks │   │ activeTasks │            │
│  │ Map<type,   │   │ Map<type,   │   │ Map<type,   │            │
│  │   ITask>    │   │   ITask>    │   │   ITask>    │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 任务启动流程

```
用户点击启动
    │
    ▼
useTaskManager.startTask(taskId)
    │
    ▼
taskManager.start(taskId, ctx) ──► 检查账号隔离状态
    │
    ▼
ctx.ipcInvoke(IPC_CHANNELS.tasks.autoMessage.start, accountId, config)
    │
    ▼
主进程: accountManager.getSession(accountId)
    │
    ▼
accountSession.startTask({ type: 'auto-comment', config })
    │
    ▼
createAutoCommentTask(platform, config, account, logger)
    │
    ▼
创建 IntervalTask ──► 启动定时器
```

### 1.3 任务停止流程

```
用户点击停止 (账号A)
    │
    ▼
useTaskManager.stopTask(taskId, 'manual')
    │
    ▼
taskManager.stop(taskId, 'manual', accountId_A) ──► 【正确】只停止账号A
    │
    ▼
AutoSpeakTask.stop('manual')
    │
    ▼
ipcInvoke(IPC_CHANNELS.tasks.autoMessage.stop, accountId_A)
    │
    ▼
主进程: accountSession.stopTask('auto-comment')
    │
    ▼
ITask.stop() ──► intervalTask.stop()
    │
    ▼
触发 stopListeners ──► 发送 stoppedEvent
    │
    ▼
windowManager.send(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, account.id)
    │
    ▼
【⚠️ 问题点】渲染进程所有监听该事件的处理器都会收到通知
```

---

## 2. 发现的问题

### 问题1：IPC事件监听器未正确隔离（严重）

**位置**: `src/tasks/autoSpeakTask.ts` 第 63-75 行

**问题代码**:
```typescript
// 注册 IPC 事件监听器（用于后端主动停止时同步状态）
const handleStopped = (accountId: string) => {
  if (accountId === ctx.accountId && this.status === 'running') {
    console.log(`[AutoSpeakTask] Task stopped by backend for account ${accountId}`)
    this.stop('error')
  }
}

if (window.ipcRenderer) {
  const unsubscribe = window.ipcRenderer.on(
    IPC_CHANNELS.tasks.autoMessage.stoppedEvent,
    handleStopped,
  )
  this.registerDisposable(() => unsubscribe())
}
```

**问题分析**:
1. 每个 `AutoSpeakTask` 实例都会注册一个 `stoppedEvent` 监听器
2. 当主进程发送 `stoppedEvent` 时，**所有**监听器都会收到通知
3. 虽然代码中有 `if (accountId === ctx.accountId)` 检查，但问题在于：
   - 如果账号A的任务停止，发送 `stoppedEvent(accountA)`
   - 账号B的任务实例也会收到这个事件
   - 检查 `accountId === ctx.accountId` 会失败（B !== A），所以不会停止
   - **但是**，如果存在**多个任务实例**或**状态同步问题**，可能导致误判

**实际风险**:
- 如果 `ctx.accountId` 在任务生命周期中被意外修改
- 如果存在僵尸任务实例（未正确清理）
- 如果 `stoppedEvent` 的 payload 格式不一致

### 问题2：TaskManager全局状态Store（中等）

**位置**: `src/tasks/TaskManager.ts` 第 29 行

**问题代码**:
```typescript
export class TaskManagerImpl {
  // ...
  // 全局状态存储（向后兼容）
  private statusStore: Map<TaskId, TaskStatus> = new Map()
```

**问题分析**:
1. `statusStore` 是全局单例状态，不区分账号
2. 在 `start` 和 `stop` 方法中都会更新这个全局状态
3. 虽然主要逻辑已改为账号隔离，但全局状态可能被旧代码依赖

**潜在影响**:
- 如果有代码通过 `getStatus(taskId)`（不传accountId）获取状态
- 可能获取到错误的全局状态而非特定账号状态

### 问题3：AutoSpeakTask的reset逻辑（轻微）

**位置**: `src/tasks/TaskManager.ts` 第 118-122 行

**问题代码**:
```typescript
// 【修复】重置任务状态（如果之前停止过）
if (taskState.status === 'stopped' && task instanceof BaseTask) {
  ;(task as BaseTask & { reset: () => void }).reset()
}
```

**问题分析**:
1. `reset()` 方法会重置 `accountId` 为 `null`
2. 如果重置后立即发生错误，可能导致 `accountId` 丢失
3. 在 `stop()` 方法中依赖 `this.accountId` 来调用 IPC

### 问题4：IntervalTask的AbortController（轻微）

**位置**: `electron/main/tasks/IntervalTask.ts` 第 50-54 行

**问题代码**:
```typescript
const clearTimer = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}
```

**问题分析**:
1. `timer` 和 `abortController` 是模块级变量
2. 虽然每个任务有自己的闭包，但如果任务创建/销毁逻辑有bug
3. 可能导致定时器或信号器泄漏

---

## 3. 根本原因分析

### 场景还原：账号B任务被意外停止

假设以下执行时序：

```
时间线:
─────────────────────────────────────────────────────────►

T1: 账号A启动自动发言
    └─► AutoSpeakTask_A 创建，注册 stoppedEvent 监听器

T2: 账号B启动自动发言
    └─► AutoSpeakTask_B 创建，注册 stoppedEvent 监听器

T3: 用户停止账号A的任务
    │
    ├─► useTaskManager.stopTask('autoSpeak', 'manual', 'accountA')
    │
    ├─► taskManager.stop('autoSpeak', 'manual', 'accountA')
    │   └─► 只停止账号A的任务（正确）
    │
    ├─► AutoSpeakTask_A.stop('manual')
    │   └─► ipcInvoke('autoMessage.stop', 'accountA')
    │
    ├─► 主进程: accountSession_A.stopTask('auto-comment')
    │   └─► ITask.stop() 发送 stoppedEvent('accountA')
    │
    └─► 【问题】AutoSpeakTask_A 和 AutoSpeakTask_B 都收到 stoppedEvent
        │
        ├─► AutoSpeakTask_A: accountId === 'accountA' ✓ 停止自己（正确）
        │
        └─► AutoSpeakTask_B: accountId === 'accountA' ✗ 不应该停止
            │
            └─► 但如果有bug导致检查失败...
                └─► AutoSpeakTask_B 也会停止！
```

### 可能的触发条件

1. **事件处理器未正确清理**：
   - 如果 AutoSpeakTask_A 停止后，其事件监听器未被正确移除
   - 后续 stoppedEvent 可能触发已停止任务的处理器

2. **this 绑定问题**：
   - `handleStopped` 是箭头函数，但如果在某些情况下 `this` 上下文丢失
   - 可能导致 `this.stop` 调用错误

3. **并发停止操作**：
   - 如果账号A和B几乎同时停止
   - 可能存在竞态条件

---

## 4. 解决方案

### 方案1：修复IPC事件监听器生命周期（推荐）

**修改 `autoSpeakTask.ts`**:

```typescript
async start(ctx: TaskContext): Promise<void> {
  this.accountId = ctx.accountId
  // ... 其他代码 ...

  // 【修复】使用更严格的事件监听和清理机制
  if (window.ipcRenderer) {
    // 创建强引用检查的事件处理器
    const handleStopped = (eventAccountId: string) => {
      // 多重检查确保安全
      if (eventAccountId !== this.accountId) {
        console.log(`[AutoSpeakTask] Ignoring stopped event for ${eventAccountId}, current account: ${this.accountId}`)
        return
      }
      
      if (this.status !== 'running') {
        console.log(`[AutoSpeakTask] Task already not running, status: ${this.status}`)
        return
      }
      
      console.log(`[AutoSpeakTask] Task stopped by backend for account ${eventAccountId}`)
      this.stop('error')
    }

    const unsubscribe = window.ipcRenderer.on(
      IPC_CHANNELS.tasks.autoMessage.stoppedEvent,
      handleStopped,
    )
    
    // 【关键】确保在任务停止时立即清理监听器
    this.registerDisposable(() => {
      console.log(`[AutoSpeakTask] Cleaning up event listener for account ${this.accountId}`)
      unsubscribe()
    })
  }
  
  // ... 其他代码 ...
}

async stop(reason: StopReason): Promise<void> {
  if (this.status === 'stopped' || this.status === 'idle') {
    return
  }

  console.log(`[AutoSpeakTask] Stopping, reason: ${reason}`)
  this.status = 'stopping'

  // 【关键】先执行清理器，移除所有事件监听器
  // 这样即使后续发送 stoppedEvent，也不会被处理
  this.executeDisposers()

  // 调用 IPC 停止任务
  if (this.accountId) {
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke(
          IPC_CHANNELS.tasks.autoMessage.stop, 
          this.accountId
        )
      }
    } catch (error) {
      console.error('[AutoSpeakTask] Error stopping IPC task:', error)
    }

    // 更新状态
    useAutoMessageStore.getState().setIsRunning(this.accountId, false)
  }

  this.status = 'stopped'
  this.isStopped = true
  console.log(`[AutoSpeakTask] Stopped successfully`)
}
```

### 方案2：主进程发送定向事件

**修改 `AutoCommentTask.ts`**:

```typescript
// 当前代码：发送全局事件
intervalTask.addStopListener(() => {
  windowManager.send(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, account.id)
})

// 【改进】发送定向事件，只通知特定账号的渲染进程
intervalTask.addStopListener(() => {
  // 使用 account.id 作为标识，让渲染进程只处理属于自己的事件
  windowManager.sendToAccount(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, account.id, {
    accountId: account.id,
    taskType: 'auto-comment',
    timestamp: Date.now()
  })
})
```

### 方案3：移除不必要的IPC事件监听

**分析**：如果 `stoppedEvent` 主要用于后端主动停止时同步状态，可以考虑：

1. **方案3A**：前端主动轮询状态（当前已实现）
2. **方案3B**：使用请求-响应模式替代事件通知
3. **方案3C**：只在需要时注册监听器，用完立即清理

**推荐实现**:

```typescript
// 【方案3C】延迟注册监听器，只在任务运行期间有效
async start(ctx: TaskContext): Promise<void> {
  // ... 启动任务 ...
  
  // 延迟注册：在确认任务启动成功后才注册监听器
  if (window.ipcRenderer && this.status === 'running') {
    const handleStopped = (accountId: string) => {
      if (accountId !== this.accountId || this.status !== 'running') return
      this.stop('error')
    }
    
    const unsubscribe = window.ipcRenderer.on(
      IPC_CHANNELS.tasks.autoMessage.stoppedEvent,
      handleStopped
    )
    
    // 注册清理函数
    this.registerDisposable(unsubscribe)
  }
}
```

### 方案4：增强TaskManager的停止逻辑

**修改 `TaskManager.ts`**:

```typescript
async stop(taskId: TaskId, reason: StopReason, accountId?: string): Promise<void> {
  // 如果提供了 accountId，只停止该账号的任务
  if (accountId) {
    const accountMap = this.accountTasks.get(accountId)
    if (!accountMap) {
      console.warn(`[TaskManager] No tasks found for account ${accountId}`)
      return
    }

    const taskState = accountMap.get(taskId)
    if (!taskState) {
      console.warn(`[TaskManager] Task ${taskId} not found for account ${accountId}`)
      return
    }

    // 【增强】添加更多状态检查
    if (taskState.status === 'idle' || taskState.status === 'stopped') {
      console.log(`[TaskManager] Task ${taskId} for account ${accountId} is already ${taskState.status}`)
      return
    }
    
    // 【增强】防止重复停止
    if (taskState.status === 'stopping') {
      console.log(`[TaskManager] Task ${taskId} for account ${accountId} is already being stopped`)
      return
    }

    try {
      console.log(`[TaskManager] Stopping task ${taskId} for account ${accountId}, reason: ${reason}`)
      
      // 【关键】先更新状态为 stopping，防止并发操作
      taskState.status = 'stopping'
      taskState.taskInstance.status = 'stopping'
      
      await taskState.taskInstance.stop(reason)
      
      // 同步最终状态
      taskState.status = taskState.taskInstance.status
      
      console.log(`[TaskManager] Task ${taskId} stopped for account ${accountId}, final status: ${taskState.status}`)
    } catch (error) {
      console.error(`[TaskManager] Error stopping task ${taskId} for account ${accountId}:`, error)
      taskState.status = 'error'
      taskState.taskInstance.status = 'error'
    }
    return
  }

  // 向后兼容：停止所有账号的任务
  // ...
}
```

---

## 5. 推荐的修复优先级

| 优先级 | 问题 | 修复方案 | 预计工作量 |
|-------|------|---------|-----------|
| P0 | IPC事件监听器生命周期 | 方案1 + 方案3C | 2小时 |
| P1 | TaskManager停止逻辑增强 | 方案4 | 1小时 |
| P2 | 移除全局statusStore | 重构 | 4小时 |
| P3 | 主进程定向事件 | 方案2 | 3小时 |

---

## 6. 验证测试方案

### 测试用例1：基本隔离测试
```
1. 账号A启动自动发言
2. 账号B启动自动发言
3. 停止账号A的任务
4. 验证账号B的任务仍在运行
```

### 测试用例2：快速切换测试
```
1. 账号A启动自动发言
2. 快速切换到账号B
3. 启动账号B的自动发言
4. 快速切换回账号A
5. 停止账号A的任务
6. 验证账号B的任务仍在运行
```

### 测试用例3：并发停止测试
```
1. 账号A和B同时启动自动发言
2. 同时停止两个账号的任务
3. 验证两个任务都正确停止，无错误日志
```

### 测试用例4：事件监听器泄漏测试
```
1. 重复启动/停止账号A的任务10次
2. 检查内存中是否存在多个事件监听器
3. 验证无内存泄漏
```

---

## 7. 结论

### 核心问题
账号B任务被意外停止的**最可能原因**是：
1. `stoppedEvent` 事件监听器未正确隔离
2. 事件处理器在任务停止后未被立即清理
3. 可能存在竞态条件导致状态检查失败

### 立即行动项
1. **实施方案1**：修复 `autoSpeakTask.ts` 的事件监听器生命周期
2. **实施方案4**：增强 `TaskManager.ts` 的停止逻辑
3. **执行测试用例1-4**：验证修复效果

### 长期改进
1. 重构全局 `statusStore`，完全移除向后兼容代码
2. 实现主进程定向事件机制
3. 添加更完善的日志记录，便于问题排查
