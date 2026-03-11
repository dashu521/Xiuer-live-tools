# 统一数据存储管理系统

## 概述

本项目实现了集中式的数据存储管理架构，解决了原有系统中存储逻辑分散、不一致的问题。

## 架构设计

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Manager                          │
│              (统一存储管理入口)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼───────┐
│   Adapters   │ │ Services │ │    Hooks     │
│   (适配器)    │ │ (服务层)  │ │  (React Hooks)│
└──────────────┘ └──────────┘ └──────────────┘
```

### 存储层级

- **Global**: 全局数据，不绑定用户
- **User**: 用户级数据，绑定到特定用户
- **Account**: 账号级数据，绑定到特定账号

### 数据类型

- `accounts`: 账号列表
- `chrome-config`: Chrome 配置
- `auto-reply`: 自动回复配置
- `auto-message`: 自动发言配置
- `auto-popup`: 自动弹窗配置
- `live-control`: 直播控制配置
- `sub-account`: 小号互动配置
- `platform-pref`: 平台偏好
- `user-pref`: 用户偏好

## 使用方法

### 1. 初始化存储系统

在应用启动时初始化：

```typescript
import { initializeStorage, initializeUserStorage, cleanupUserStorage } from '@/utils/storage/init'

// 应用启动时
initializeStorage()

// 用户登录时
initializeUserStorage(userId)

// 用户登出时
cleanupUserStorage(userId, true) // true = 保留账号列表
```

### 2. 使用存储管理器

```typescript
import { storageManager } from '@/utils/storage'

// 存储数据
storageManager.set('accounts', accountsData, {
  level: 'user',
  userId: 'user-123'
})

// 读取数据
const data = storageManager.get('accounts', {
  level: 'user',
  userId: 'user-123'
})

// 删除数据
storageManager.remove('accounts', {
  level: 'user',
  userId: 'user-123'
})
```

### 3. 使用存储服务

```typescript
import { createAccountStorageService, createChromeConfigStorage } from '@/utils/storage'

// 账号存储服务
const accountService = createAccountStorageService('user-123')
accountService.saveAccounts([{ id: '1', name: '账号1' }])

// 配置存储服务
const chromeConfig = createChromeConfigStorage('user-123', 'account-1')
chromeConfig.set('path', '/path/to/chrome')
```

### 4. 使用 React Hooks

```typescript
import { useStorage, useAccountStorage } from '@/utils/storage'

// 通用存储 Hook
function MyComponent() {
  const { value, setValue, remove } = useStorage('user-pref', {
    level: 'user',
    userId: 'user-123',
    defaultValue: {}
  })

  return <div>{JSON.stringify(value)}</div>
}

// 账号存储 Hook
function AccountComponent() {
  const {
    accounts,
    currentAccountId,
    addAccount,
    removeAccount
  } = useAccountStorage('user-123')

  return (
    <div>
      {accounts.map(acc => <div key={acc.id}>{acc.name}</div>)}
    </div>
  )
}
```

## 数据迁移

系统会自动检测并迁移旧格式的数据：

```typescript
import { dataMigrator } from '@/utils/storage'

// 手动触发迁移
dataMigrator.migrateLegacyAccounts('user-123')
dataMigrator.migrateLegacyPreferences('user-123')

// 查看迁移记录
const records = dataMigrator.getMigrationRecords()
```

## 监控和告警

```typescript
import { storageMonitor, getStorageHealth } from '@/utils/storage'

// 添加告警监听器
const unsubscribe = storageMonitor.addAlertListener((alert) => {
  console.warn('Storage alert:', alert)
})

// 获取存储健康状态
const health = getStorageHealth()
console.log('Storage healthy:', health.healthy)
console.log('Storage stats:', health.stats)
console.log('Storage report:', health.report)
```

## 最佳实践

### 1. 数据存储

- 始终指定正确的存储层级
- 使用类型安全的服务层而不是直接操作存储管理器
- 为敏感数据启用加密

### 2. 数据读取

- 提供合理的默认值
- 处理数据不存在的情况
- 使用 React Hooks 自动处理数据同步

### 3. 数据清理

- 登出时清理用户数据，但保留账号列表
- 定期清理过期数据
- 使用监控工具跟踪存储使用情况

### 4. 错误处理

- 存储操作可能失败，始终使用 try-catch
- 监听存储事件进行错误处理
- 使用监控工具跟踪错误率

## API 参考

### StorageManager

- `set<T>(dataType, data, options)`: 存储数据
- `get<T>(dataType, options)`: 读取数据
- `remove(dataType, options)`: 删除数据
- `has(dataType, options)`: 检查数据是否存在
- `getStats()`: 获取存储统计
- `clearUserData(userId, preserveAccounts)`: 清理用户数据
- `addEventListener(listener)`: 添加事件监听器

### AccountStorageService

- `getUserData()`: 获取用户完整数据
- `saveAccounts(accounts)`: 保存账号列表
- `addAccount(account)`: 添加账号
- `updateAccount(accountId, updates)`: 更新账号
- `removeAccount(accountId)`: 删除账号
- `setCurrentAccountId(accountId)`: 设置当前账号
- `setDefaultAccountId(accountId)`: 设置默认账号

### ConfigStorageService

- `getConfig()`: 获取配置
- `saveConfig(config)`: 保存配置
- `updateConfig(updates)`: 更新配置（部分更新）
- `get(key)`: 获取指定配置项
- `set(key, value)`: 设置指定配置项
- `reset()`: 重置为默认配置

## 存储键格式

```
{prefix}-{dataType}-{userId}-{accountId?}-{suffix?}

示例：
- tasi-accounts-user-123
- tasi-chrome-config-user-123-account-1
- tasi-auto-reply-user-123-account-1
```

## 版本历史

### v1.0.0
- 初始版本
- 实现统一存储管理架构
- 支持 LocalStorage 和加密存储适配器
- 提供账号、配置、偏好设置服务
- 实现数据迁移工具
- 添加监控和告警功能
