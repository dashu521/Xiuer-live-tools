# 账号列表任务状态可视化实现文档

## 概述

在账号列表中为每个账号添加实时任务运行状态显示，支持自动发言任务状态、自动回复监听状态和中控台连接状态的可视化。

## 实现方案

采用**方案A：紧凑标签式**，在账号选择器的每个账号项右侧显示状态图标。

## 文件结构

```
src/
├── types/
│   └── account-status.ts          # 状态类型定义
├── components/
│   └── account/
│       └── AccountStatusBadge.tsx # 状态徽章组件
├── hooks/
│   └── useAccountStatus.ts        # 状态管理 Hook
└── components/
    └── common/
        └── AccountSwitcher.tsx    # 集成状态显示（已修改）
```

## 状态类型

### 状态定义

| 状态类型 | 颜色 | 图标 | 说明 |
|---------|------|------|------|
| running | 🟢 绿色 | Loader2 (旋转) | 任务正在执行 |
| connected | 🔵 蓝色 | Wifi | 中控台已连接 |
| connecting | 🟡 黄色 | Loader2 (旋转) | 正在连接中控台 |
| error | 🔴 红色 | AlertCircle | 任务执行失败 |
| idle | ⚪ 灰色 | Circle | 任务未运行 |

### 状态优先级

当多个状态同时存在时，按以下优先级显示：
1. error (最高)
2. running
3. connecting
4. connected
5. idle (最低)

## 组件使用

### AccountStatusBadge

```tsx
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge'

// 基础使用
<AccountStatusBadge state={accountStatus} />

// 仅显示图标
<AccountStatusBadge state={accountStatus} showLabel={false} />

// 不同尺寸
<AccountStatusBadge state={accountStatus} size="sm" />  // 小
<AccountStatusBadge state={accountStatus} size="md" />  // 中
<AccountStatusBadge state={accountStatus} size="lg" />  // 大
```

### useAccountStatus

```tsx
import { useAccountStatus, useAccountStatusSelector } from '@/hooks/useAccountStatus'

// 获取所有状态管理功能
const { statusMap, refreshAccountStatus, startPolling, stopPolling } = useAccountStatus()

// 启动自动轮询（每2秒刷新）
useEffect(() => {
  const cleanup = startPolling(2000)
  return () => cleanup()
}, [startPolling])

// 获取指定账号状态
const accountStatus = useAccountStatusSelector('account-id')
```

## 集成效果

在账号切换器中，每个账号项现在显示：

```
┌──────────────────────────────────────────────────────┐
│ 👤 账号A                    [🟢] [默认]              │
├──────────────────────────────────────────────────────┤
│ 👤 账号B                    [🔵] [⭐]                │
├──────────────────────────────────────────────────────┤
│ 👤 账号C                    [⚪] [⭐]                │
└──────────────────────────────────────────────────────┘
```

- `[🟢]` - 状态徽章（运行中）
- `[🔵]` - 状态徽章（已连接）
- `[⚪]` - 状态徽章（未启动）
- `[默认]` - 默认账号标记
- `[⭐]` - 设为默认按钮（悬停显示）

## 悬停提示

鼠标悬停在状态徽章上显示详细信息：

```
连接: 中控台已连接

任务状态:
  • 自动发言: 运行中
    已执行: 23 次
    运行时长: 15分32秒
```

## 技术实现

### 状态更新机制

采用 **定时轮询** 方案：
- 每 2 秒刷新一次所有账号状态
- 使用 Zustand 管理全局状态
- 状态变化自动触发 UI 更新

### 状态计算逻辑

```typescript
function getDisplayStatus(state: AccountTaskState): StatusDisplayConfig {
  // 1. 检查错误状态（最高优先级）
  if (hasErrorTask) return { type: 'error', ... }

  // 2. 检查运行中状态
  if (hasRunningTask) return { type: 'running', ... }

  // 3. 检查连接状态
  if (connecting) return { type: 'connecting', ... }
  if (connected) return { type: 'connected', ... }

  // 4. 默认空闲状态
  return { type: 'idle', ... }
}
```

## 性能优化

1. **Selector 优化**：使用 Zustand selector 只订阅需要的状态
2. **Memo 优化**：组件使用 React.memo 避免不必要的重渲染
3. **轮询控制**：组件卸载时自动停止轮询
4. **状态缓存**：状态存储在全局 Store，避免重复计算

## 扩展建议

### 添加更多任务类型

在 `useAccountStatus.ts` 中扩展任务列表：

```typescript
const tasks = [
  getTaskInfo('autoSpeak', accountId),
  getTaskInfo('autoReply', accountId),  // 新增
  getTaskInfo('autoPopup', accountId),  // 新增
].filter(task => task.status !== 'idle')
```

### 添加 WebSocket 实时推送

在 `useAccountStatus.ts` 中添加 WebSocket 支持：

```typescript
const connectWebSocket = () => {
  const ws = new WebSocket('ws://localhost:ws/account-status')
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data)
    updateAccountStatus(update.accountId, update)
  }
}
```

### 自定义状态显示

修改 `AccountStatusBadge` 组件支持更多自定义：

```tsx
interface AccountStatusBadgeProps {
  // ... 现有属性
  variant?: 'badge' | 'dot' | 'pulse'
  customColors?: Record<string, string>
}
```

## 测试验证

构建成功，无 TypeScript 错误。

### 功能验证清单

- [x] 状态徽章正确显示
- [x] 状态颜色随任务状态变化
- [x] 悬停提示显示详细信息
- [x] 多账号状态独立显示
- [x] 状态轮询正常工作
- [x] 组件卸载时停止轮询

## 交付物

1. ✅ `src/types/account-status.ts` - 类型定义
2. ✅ `src/components/account/AccountStatusBadge.tsx` - UI 组件
3. ✅ `src/hooks/useAccountStatus.ts` - 状态管理
4. ✅ `src/components/common/AccountSwitcher.tsx` - 集成（已修改）
5. ✅ 构建验证通过

## 后续优化方向

1. **WebSocket 实时推送** - 替代轮询，降低服务器压力
2. **状态历史记录** - 记录任务执行历史
3. **批量操作** - 支持一键停止所有账号任务
4. **状态筛选** - 按状态筛选账号列表
