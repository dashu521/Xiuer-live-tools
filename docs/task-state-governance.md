# 任务状态治理文档

## 一、问题背景

### 1.1 问题现象
- 自动回复在开播自动一键启动任务时偶发未真正启动
- 再次手动点击提示"任务已开启"，但左侧绿点不亮
- 多账号运行时自动发言意外中断
- 任务状态在多账号间出现串扰

### 1.2 根本原因
这不是单一功能 bug，而是**任务状态管理体系存在设计缺陷**：
1. **状态先写后执行**：TaskManager 先更新状态再执行任务
2. **异常被静默吞掉**：BaseTask.catch 后不向上抛出
3. **activeTasks 误登记**：启动失败仍登记到 activeTasks
4. **前后端多真源分叉**：前端 Store、TaskManager、后端 activeTasks 状态不一致

---

## 二、修复内容

### 2.1 P0 紧急修复（已验收）

#### 修复 1：BaseTask.start() 异常上抛
**文件**：`electron/main/tasks/BaseTask.ts`
```typescript
catch (err) {
  stop(TaskStopReason.ERROR, err)
  throw err  // 新增：向上抛出异常
}
```

#### 修复 2：CommentListenerTask 移除重复 stop
**文件**：`electron/main/tasks/CommentListenerTask.ts`
```typescript
catch (err) {
  windowManager.send(...)
  // task.stop()  // 删除：避免与 BaseTask 重复
  throw err      // 新增：向上抛出
}
```

#### 修复 3：AccountSession 确认后登记
**文件**：`electron/main/services/AccountSession.ts`
```typescript
await newTask.value.start()
if (!newTask.value.isRunning()) {
  return Result.fail(new Error('任务启动失败'))
}
this.activeTasks.set(task.type, newTask.value)  // 确认后才登记
```

### 2.2 Phase 2 状态一致性修复（已验收）

#### Phase 2A：绿点与状态映射统一

**修复 1：useAutoReply 统一状态映射**
**文件**：`src/hooks/useAutoReply.ts`
```typescript
const isEffectivelyRunning = isListening === 'listening'
return { isRunning: isEffectivelyRunning }  // 绿点只基于 listening
```

**修复 2：TaskStateManager 统一判定**
**文件**：`src/utils/TaskStateManager.ts`
```typescript
private _isAutoReplyRunning(store: any, accountId: string): boolean {
  return context?.isListening === 'listening'  // 只检查 listening
}
```

#### Phase 2B-1：ALREADY_RUNNING 提示统一

**修复：TaskManager 基于真实状态**
**文件**：`src/tasks/TaskManager.ts`
```typescript
const isActuallyRunning = task.status === 'running' || task.status === 'stopping'
if (isActuallyRunning) {
  return { success: false, reason: 'ALREADY_RUNNING' }
}
```

#### Phase 2B-2：stopAll 幂等性

**修复 1：TaskStateManager 严格幂等**
**文件**：`src/utils/TaskStateManager.ts`
```typescript
const isActuallyRunning = context?.isListening === 'listening'
if (!isActuallyRunning) {
  return { alreadyStopped: true, stopped: false }  // 不调用 IPC
}
```

**修复 2：AccountSession.stopTask 幂等**
**文件**：`electron/main/services/AccountSession.ts`
```typescript
if (!task.isRunning()) {
  this.activeTasks.delete(taskType)  // 清理残留
  return  // 不重复调用 stop
}
```

---

## 三、当前统一规则

### 3.1 绿点只表示真实运行中
- **判定来源**：`useAutoReply()` 返回的 `isRunning`
- **真实状态**：`isListening === 'listening'`
- **不包含**：`waiting`、`stopped`、`error` 状态

### 3.2 "已运行中/已开启"提示只基于真实运行态
- **判定来源**：`task.status === 'running' || task.status === 'stopping'`
- **不依赖**：前端 `taskState.status`
- **状态自愈**：调度器状态与任务实例不一致时自动修复

### 3.3 activeTasks 只登记真实运行任务
- **登记时机**：`start()` 成功后且 `isRunning() === true`
- **失败处理**：启动失败时不登记
- **清理机制**：`stop()` 时从 activeTasks 中删除

### 3.4 异常必须上抛
- **BaseTask**：`catch` 后必须 `throw err`
- **CommentListenerTask**：不吞异常，统一由上层处理
- **AccountSession**：接收异常并返回 `Result.fail()`

### 3.5 stopAll 必须幂等
- **第一次**：正常停止，返回 `stopped: true`
- **第二次**：返回 `alreadyStopped: true`，不重复触发副作用
- **残留处理**：发现残留任务时自动清理

### 3.6 状态必须按 accountId 隔离
- **前端 Store**：`contexts[accountId]` 隔离
- **后端 activeTasks**：每个 AccountSession 独立
- **TaskManager**：`accountTasks[accountId]` 隔离

---

## 四、验收结果

### 4.1 已完成验收

| 验收项 | 状态 | 备注 |
|-------|------|------|
| P0: 异常抛出 | ✅ 通过 | 日志显示异常被正确抛出 |
| P0: 确认后登记 | ✅ 通过 | activeTasks 只登记成功任务 |
| 2A: 绿点统一 | ✅ 通过 | 绿点只基于 listening |
| 2B-1: ALREADY_RUNNING | ✅ 通过 | 基于真实状态 |
| 2B-2: stopAll 幂等 | ✅ 通过 | 重复调用无异常 |
| 多账号隔离 | ✅ 通过 | 各账号状态独立 |

### 4.2 Phase 3 暂不实施

**原因**：当前修复已解决核心问题，不阻断主线开发。

**Phase 3 预留内容**（未来需要时实施）：
1. 统一所有任务基类（BaseTask / IntervalTask）
2. 引入 `starting` 中间状态
3. 完善审计日志体系
4. 状态持久化与恢复

---

## 五、关键文件清单

### 5.1 核心修复文件

| 文件 | 修复内容 | 重要性 |
|------|---------|-------|
| `electron/main/tasks/BaseTask.ts` | 异常上抛 | ⭐⭐⭐⭐⭐ |
| `electron/main/tasks/CommentListenerTask.ts` | 移除重复 stop | ⭐⭐⭐⭐⭐ |
| `electron/main/services/AccountSession.ts` | 确认后登记、stopTask 幂等 | ⭐⭐⭐⭐⭐ |
| `src/hooks/useAutoReply.ts` | 绿点统一 | ⭐⭐⭐⭐ |
| `src/utils/TaskStateManager.ts` | 状态判定统一、stopAll 幂等 | ⭐⭐⭐⭐ |
| `src/tasks/TaskManager.ts` | ALREADY_RUNNING 统一 | ⭐⭐⭐⭐ |

### 5.2 若再出现状态问题，优先检查

1. **异常是否被吞**：检查 `BaseTask.ts`、`CommentListenerTask.ts`
2. **activeTasks 是否误登记**：检查 `AccountSession.ts` 的 `startTask`
3. **绿点状态不一致**：检查 `useAutoReply.ts`、`TaskStateManager.ts`
4. **ALREADY_RUNNING 误报**：检查 `TaskManager.ts`
5. **stopAll 非幂等**：检查 `TaskStateManager.ts`、`AccountSession.ts`

---

## 六、版本信息

- **治理完成时间**：2026-03-18
- **相关提交**：
  - P0: `d5834cc` 等
  - Phase 2A: `f701f80`
  - Phase 2B-1: `470e51f`
  - Phase 2B-2: `a34140e`
