# 中控台与直播状态管理总规范

> **版本**: v2.1  
> **最后更新**: 2024-03-13  
> **状态**: 已固化

---

## 1. 文档目标

本规范用于统一中控台连接、直播状态、任务状态、UI 状态展示、按钮行为、日志与验收标准，防止后续开发再次出现：

- 主状态与左侧状态点不一致
- 按钮文案与真实任务状态不一致
- toast 提示与实际执行结果不一致
- "停止所有任务 / 结束直播 / 断开中控台连接 / 关闭浏览器"边界混乱
- 多账号状态串扰
- 修复后被后续改动回退

---

## 2. 第一层：产品行为规范（最高优先级）

> 本层定义"系统应该如何表现"，后续代码实现必须严格服从本层规则。

### 2.1 中控台连接

1. 用户连接中控台后，表示软件已与浏览器/会话建立控制关系。
2. 中控台连接存在时，**不代表**一定正在直播。
3. 中控台连接存在时，**不代表**所有任务都在运行。

### 2.2 直播状态

1. 直播状态至少区分：
   - 未开播 (offline)
   - 直播中 (live)

2. 在浏览器内点击"结束直播"后：
   - 应回到"未开播"状态
   - **不应**自动断开中控台连接
   - **不应**自动关闭浏览器
   - **必须**保持直播状态检测器活跃，以支持再次开播识别

3. 浏览器内再次开播后，前端应能重新正确识别为"直播中"。

### 2.3 停止所有任务

1. "停止所有任务"只负责停止当前账号下的所有直播相关任务。
2. **停止所有任务 ≠ 断开中控台连接**。
3. **停止所有任务 ≠ 关闭浏览器**。
4. 点击后必须满足：
   - 所有任务真实停止
   - UI 中所有运行中标记同步消失
   - 左侧绿色点同步消失
   - 主面板、按钮、toast 与真实状态一致
5. 若当前已无任何运行任务：
   - **不应**重复提示"已停止所有任务"
   - 应提示"当前无运行中的任务"或按钮禁用
6. stopAll **必须幂等**：第一次点击真正停止，第二次点击正确识别无任务可停。

### 2.4 结束直播

1. **结束直播 ≠ 断开中控台连接**。
2. "结束直播"后：
   - 当前直播任务应全部停止
   - 所有依赖直播中的功能应不可继续运行
   - 状态回到"未开播"
   - 浏览器保持打开
   - 中控台连接保持存在
   - 直播状态检测器保持活跃（支持再次开播识别）

### 2.5 断开中控台连接

1. **断开中控台连接 ≠ 关闭浏览器**。
2. "断开中控台连接"时：
   - 所有任务应停止
   - UI 状态应清空并同步
   - 浏览器**不应**被直接关闭
3. 只有单独的"关闭浏览器 / 结束会话 / 关闭页面"动作，才允许关闭浏览器。

### 2.6 左侧绿色状态点

1. **左侧绿色点只表示"该功能当前真实运行中"**。
2. 左侧绿色点**绝不能**表示：
   - 已连接
   - 已配置
   - 曾经运行过
   - 默认启用
   - 本地缓存残留
3. 任何情况下，绿点显示都必须能对应到真实运行态。

---

## 3. 第二层：状态模型规范

> 本层定义系统内部必须区分的状态，禁止混用。

### 3.1 状态类别必须分离

系统至少要明确区分以下三类状态：

#### A. 中控台连接状态 (controlState)

```
- connected    // 已连接中控台
- disconnected // 已断开中控台
```

#### B. 直播状态 (streamState)

```
- offline / not_live / idle  // 未开播
- live                        // 直播中
```

#### C. 任务状态 (taskState)

```
- autoMessageRunning   // 自动发言运行中
- autoReplyRunning     // 自动回复运行中
- autoPopupRunning     // 自动弹窗运行中
- monitorRunning       // 数据监控运行中
- assistantRunning     // AI助手运行中
- altAccountRunning    // 小号互动运行中
```

### 3.2 禁止混用

| 错误理解 | 正确理解 |
|---------|---------|
| 已连接 = 正在直播 | ❌ 已连接 ≠ 正在直播 |
| 正在直播 = 所有任务都在运行 | ❌ 正在直播 ≠ 所有任务都在运行 |
| 任务运行中 = 中控台仍连接 | ❌ 任务运行中 ≠ 中控台仍连接 |
| 已配置 = 正在运行 | ❌ 已配置 ≠ 正在运行 |

### 3.3 当前账号隔离

**状态必须严格按 accountId 隔离**。

**禁止**：
- 切账号后读到上一个账号的状态
- stopAll 停错账号
- 绿点显示来自其他账号

---

## 4. 第三层：技术实现约束

> 本层定义代码实现必须遵守的约束，用于防回退。

### 4.1 单一真相源

1. UI 显示必须尽可能从统一状态源读取。
2. 禁止多个组件各自维护一套"推测状态"。
3. 主面板、左侧状态点、按钮状态、toast 文案应共享统一的派生逻辑。

**已实现**：
- `src/utils/TaskStateManager.ts` - 统一任务状态管理器（单一真相源）
- `src/utils/stopAllLiveTasks.ts` - 统一停止入口

### 4.2 停止所有任务必须收口

1. 必须存在统一入口：
   ```typescript
   stopAllTasksForAccount(accountId: string, reason: StopReason): Promise<TaskStopResult>
   ```

2. 所有"总停"操作必须走统一入口。
3. 禁止某些模块单独 stop、某些模块漏 stop。
4. stopAll 必须幂等：
   - 第一次点击：真正停止
   - 第二次点击：识别为无任务可停，不可重复伪成功

**已实现**：`TaskStateManager.stopAllTasksForAccount()`

### 4.3 disconnect 与 close 必须解耦

1. disconnect handler 禁止直接调用：
   - `browser.close`
   - `page.close`
   - `context.close`
   - `session destroy with close side effect`

2. "断开连接"与"关闭浏览器"必须是两条独立链路。
3. 关闭浏览器只能由专门的关闭动作触发。

**已实现**：
```typescript
// AccountSession.ts
disconnect(reason?: string, options?: { closeBrowser?: boolean }) {
  // 默认不关闭浏览器
  const shouldCloseBrowser = options?.closeBrowser ?? false
  // ...
}
```

### 4.4 关播不停止直播状态检测器

1. 关播时只停止依赖开播的任务执行器。
2. **禁止**停止 StreamStateDetector。
3. **禁止**停止轮询检测循环。
4. **必须**保持 session.page 绑定。
5. **必须**支持同一连接会话内多次 `live ↔ offline` 状态往返。

**已实现**：
```typescript
// AccountSession.ts
stopForStreamEnded(reason: string) {
  // 关播时保持 detector 活跃
  this.stopTasksAndUpdateState(reason, false, false, false) // stopDetector = false
}
```

### 4.5 左侧状态点必须只绑定真实任务态

1. 每个绿色点都必须能追溯到明确的任务运行字段。
2. 禁止绑定：
   - `isConnected`
   - `hasConfig`
   - `selectedPlatform`
   - `local temp state`
   - `lastActive / history state`

**当前实现**：

| 菜单项 | 文件 | 状态来源 |
|--------|------|---------|
| 自动发言 | `Sidebar.tsx` | `useCurrentAutoMessage(context => context.isRunning)` |
| 自动弹窗 | `Sidebar.tsx` | `useCurrentAutoPopUp(context => context.isRunning)` |
| 自动回复 | `Sidebar.tsx` | `useAutoReply().isRunning` |
| 小号互动 | `Sidebar.tsx` | `useCurrentSubAccount(context => context.isRunning)` |
| 数据监控 | `Sidebar.tsx` | `useLiveStatsStore(contexts[id]?.isListening)` |

### 4.6 UI 条件统一

"停止所有任务"按钮的：
- 显示
- 禁用
- 文案
- toast

必须由统一条件控制，不能分散判断。

**已实现**：
```typescript
// useOneClickStart.ts
const isAnyTaskRunning = taskStateManager.hasAnyRunningTask(currentAccountId)

const stopAllTasks = async () => {
  const result = await taskStateManager.stopAllTasksForAccount(currentAccountId, 'manual')
  if (result.alreadyStopped.length > 0 && result.stoppedTasks.length === 0) {
    toast.info('当前无运行中的任务')
  } else if (result.stoppedTasks.length > 0) {
    toast.success(`已停止: ${result.stoppedTasks.map(t => TASK_DISPLAY_NAMES[t]).join('、')}`)
  }
}
```

### 4.7 状态变化必须触发对账

以下动作后必须执行一次状态对账/reconcile：
- stopAll
- endLive
- disconnect
- 直播状态变化
- 连接状态变化
- 切换账号

如果发现 UI 与真实任务状态不一致，必须自动纠正并记录日志。

---

## 5. 第四层：防回退规则

> 本层用于防止以后修着修着又改坏。

### 5.1 禁止事项

后续开发中，**禁止**：

1. ❌ 在 disconnect 逻辑里顺手关闭浏览器
2. ❌ 在 endLive 逻辑里顺手断开中控台
3. ❌ 在 stopAll 逻辑里修改连接态
4. ❌ 用"已配置"冒充"运行中"
5. ❌ 在组件本地 state 中缓存任务运行态作为真实来源
6. ❌ 跳过 accountId 直接读全局运行态
7. ❌ 关播时停止 StreamStateDetector

### 5.2 任何涉及以下模块的改动，都必须重新验收

- 中控台连接
- 直播状态识别
- 自动发言
- 自动回复
- 自动弹窗
- 数据监控
- 小号互动
- AI助手
- stopAll
- endLive
- disconnect
- 账号切换

### 5.3 合并代码前必须做最小检查

每次修改上述模块前后，至少确认：
- 当前 accountId 是否正确贯穿
- 绿点来源是否仍然只读真实运行态
- disconnect 是否仍未夹带 close 浏览器逻辑
- stopAll 是否仍然幂等
- 关播是否仍未停止 StreamStateDetector

---

## 6. 第五层：日志与可观测性要求

> 本层用于后续快速排障。

### 6.1 必须记录的关键日志

至少记录以下动作的关键日志：
- 连接中控台
- 断开中控台
- 开播识别
- 结束直播识别
- 启动任务
- 停止任务
- stopAll
- 切换账号
- reconcile 执行结果

### 6.2 日志最少字段

每条关键日志建议包含：
- action
- accountId
- connectionState
- liveState
- task snapshot
- result
- error（如有）

### 6.3 日志目标

日志必须足以回答：
- 点了什么按钮
- 停了哪些任务
- 为什么显示绿点
- 为什么 toast 这样提示
- 当前是不是切错账号
- 为什么浏览器被关/没被关

**日志示例**：
```
[TaskStateManager] ==============================================
[TaskStateManager] stopAllTasksForAccount START
[TaskStateManager] Account: account-123, Reason: manual
[TaskStateManager] Before stop: ['auto-message=true', 'auto-popup=true']
[TaskStateManager] After stop: ['auto-message=false', 'auto-popup=false']
[TaskStateManager] Result: stopped=2, alreadyStopped=3, errors=0
[TaskStateManager] ==============================================
```

---

## 7. 第六层：核心验收场景

> 本层是以后每次修改后的最低回归标准。

### 场景1：连接 -> 开播 -> 启动任务 -> stopAll

**步骤**：
1. 连接中控台
2. 浏览器开播
3. 启动自动弹窗（或其他任一任务）
4. 点击"停止所有任务"

**预期**：
- ✅ 任务真实停止
- ✅ 左侧绿点消失
- ✅ toast 正确
- ✅ 主面板状态正确
- ✅ 中控台连接仍保留
- ✅ 浏览器不关闭

---

### 场景2：重复点击 stopAll

**步骤**：
1. 在无任务运行状态下再次点击"停止所有任务"

**预期**：
- ✅ 不重复提示"已停止所有任务"
- ✅ 提示"当前无运行中的任务"或按钮禁用

---

### 场景3：结束直播

**步骤**：
1. 连接中控台
2. 开播
3. 启动若干任务
4. 浏览器内结束直播

**预期**：
- ✅ 直播状态变为未开播
- ✅ 任务全部停止
- ✅ 中控台连接保留
- ✅ 浏览器不关闭
- ✅ UI 一致
- ✅ StreamStateDetector 保持活跃

---

### 场景4：断开中控台连接

**步骤**：
1. 连接中控台
2. 可选：开播 / 启动任务
3. 点击"断开中控台连接"

**预期**：
- ✅ 中控台连接断开
- ✅ 任务清空
- ✅ UI 同步更新
- ✅ 浏览器不关闭

---

### 场景5：再次开播识别

**步骤**：
1. 已连接中控台
2. 开播
3. 结束直播
4. 再次开播

**预期**：
- ✅ 前端能再次正确识别直播中
- ✅ 相关能力可恢复可用
- ✅ 状态不残留不丢失

---

### 场景6：切换账号

**步骤**：
1. 账号A连接/运行任务
2. 切到账号B
3. 观察状态并执行 stopAll / disconnect

**预期**：
- ✅ 状态严格按 accountId 隔离
- ✅ 不串号
- ✅ 不误停其他账号

---

### 场景7：应用重启/刷新

**步骤**：
1. 在不同状态下关闭并重新进入页面/应用

**预期**：
- ✅ 不出现错误绿点
- ✅ 不出现错误按钮状态
- ✅ 不出现伪运行中状态

---

## 8. 第七层：变更管理要求

1. 以后凡是改动本规范相关逻辑，必须在提交说明中写明：
   - 改了哪个行为
   - 是否影响 stopAll / endLive / disconnect
   - 是否影响 accountId 隔离
   - 是否影响左侧绿点显示逻辑

2. 若行为发生变化，必须同步更新本规范。
3. 未更新规范的行为改动，视为不完整改动。

---

## 9. 核心规则摘要

| 规则 | 说明 |
|------|------|
| **停止所有任务 ≠ 断开中控台连接** | 只停任务，不断连接 |
| **结束直播 ≠ 断开中控台连接** | 只结束直播，不断连接 |
| **断开中控台连接 ≠ 关闭浏览器** | 只断控制，不关浏览器 |
| **左侧绿色点 = 真实运行中** | 绝不表示已配置/已连接 |
| **结束直播 → 未开播** | 但保持中控台连接 |
| **关闭浏览器 = 专门动作** | 只有主动关闭才关闭 |
| **状态按 accountId 隔离** | 禁止串号 |
| **stopAll 幂等** | 重复点击正确提示 |
| **关播不停止检测器** | 保持再次开播识别能力 |

---

## 10. 已实现的关键文件

| 文件 | 用途 |
|------|------|
| `src/utils/TaskStateManager.ts` | 统一任务状态管理器（单一真相源） |
| `src/utils/stopAllLiveTasks.ts` | 统一停止入口 |
| `src/hooks/useOneClickStart.ts` | 一键启动/停止（使用 TaskStateManager） |
| `electron/main/services/AccountSession.ts` | 账号会话管理（disconnect 与 close 解耦） |
| `electron/main/services/StreamStateDetector.ts` | 直播状态检测（支持多次 live ↔ offline） |
| `electron/main/managers/AccountManager.ts` | 账号管理（closeSession 参数化） |

---

## 11. 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| v1.0 | 2024-03-12 | 初始版本 |
| v2.0 | 2024-03-13 | 完整七层规范固化 |
| v2.1 | 2024-03-13 | 补充实现结论、关播不停止检测器规则 |
