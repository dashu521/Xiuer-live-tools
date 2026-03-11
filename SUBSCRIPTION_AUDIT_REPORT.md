# 订阅/会员/礼品卡/权限系统全链路审计报告

## 执行摘要

**审计时间**: 2026-03-09  
**审计范围**: 全仓库数据库、后端API、前端Store、UI组件  
**发现问题**: 12个高风险问题，8个中风险问题  
**核心风险**: 兑换 Ultra 礼品卡后前端显示为免费版，权限未生效

---

## A. 问题总览

### 高风险问题 (P0)

| # | 问题描述 | 影响 | 文件位置 |
|---|---------|------|---------|
| 1 | 前端 `licenseType` 类型不支持 `pro_max`/`ultra` | 兑换后显示为免费版 | `types/auth.ts:10` |
| 2 | UserCenter 组件无 `pro_max`/`ultra` 显示映射 | UI显示错误 | `UserCenter.tsx:134-143` |
| 3 | AuthService 权限检查不支持新档位 | 权限判断错误 | `AuthService.ts:13,244-249` |
| 4 | 后端返回 `plan`，前端消费 `licenseType` | 字段不匹配 | 全链路 |
| 5 | 兑换链路只更新 `users.plan`，未同步更新前端 `licenseType` | 状态不一致 | `gift_card.py:213-214` |
| 6 | `userStatus` 和 `user` 两个状态源可能不一致 | 显示混乱 | `authStore.ts` |
| 7 | 时间格式不统一 (Unix vs ISO) | 到期时间解析错误 | 多处接口 |
| 8 | Electron 本地数据库使用 `license_type`，后端使用 `plan` | 本地/云端不一致 | `AuthDatabase.ts` |
| 9 | 礼品卡兑换后只刷新 `userStatus`，未更新 `user` | Store状态不完整 | `UserCenter.tsx:95` |
| 10 | 默认兜底逻辑强制返回 'free' | 真实状态被覆盖 | 多处 |
| 11 | 权限矩阵缺少 `pro_max`/`ultra` 定义 | 权限计算错误 | `AuthService.ts:244-249` |
| 12 | 前端组件映射表不完整 | 新档位无法显示 | `UserCenter.tsx` |

### 中风险问题 (P1)

| # | 问题描述 | 影响 |
|---|---------|------|
| 1 | 试用状态和订阅状态可能冲突 | trial 和 pro 同时存在时优先级不明确 |
| 2 | 礼品卡兑换响应字段命名不一致 | `membershipType` vs `newMembershipType` |
| 3 | 管理员接口和普通接口返回格式不一致 | 集成困难 |
| 4 | 本地存储和云端状态可能不同步 | 离线/在线状态不一致 |
| 5 | 兑换历史记录只记录 `plan`，不记录 `tier` | 审计信息不完整 |
| 6 | 前端默认值设置过多 | 真实状态可能被覆盖 |
| 7 | 类型定义分散在多个文件 | 维护困难 |
| 8 | 缺少订阅状态变更的监听机制 | 无法实时同步 |

---

## B. 订阅字段清单

### 数据库字段

| 表名 | 字段名 | 数据类型 | 说明 |
|-----|-------|---------|------|
| `users` | `plan` | String(32) | 主档位字段 (free/trial/pro/pro_max/ultra) |
| `users` | `max_accounts` | Integer | 最大账号数 |
| `users` | `trial_start_at` | DateTime | 试用开始时间 |
| `users` | `trial_end_at` | DateTime | 试用结束时间 |
| `subscriptions` | `plan` | String(32) | 订阅档位 |
| `subscriptions` | `current_period_end` | DateTime | 当前周期结束 |
| `gift_cards` | `tier` | String(20) | 礼品卡档位 (pro/pro_max/ultra) |
| `gift_cards` | `membership_type` | String(20) | 兼容旧字段 |
| `gift_cards` | `benefits_json` | JSON | 权益配置 |
| `gift_card_redemptions` | `previous_plan` | String(32) | 兑换前档位 |
| `gift_card_redemptions` | `new_plan` | String(32) | 兑换后档位 |
| `trials` | `start_ts` | Integer | 试用开始时间戳 |
| `trials` | `end_ts` | Integer | 试用结束时间戳 |

### 后端返回字段

| 接口 | 字段名 | 类型 | 说明 |
|-----|-------|------|------|
| `/auth/status` | `plan` | string | 当前档位 |
| `/auth/status` | `trial.end_at` | ISO string | 试用结束时间 |
| `/subscription/status` | `plan` | string | 当前档位 |
| `/subscription/status` | `expires_at` | Unix timestamp | 过期时间 |
| `/gift-card/redeem` | `membershipType` | string | 新档位 |
| `/gift-card/redeem` | `newMembershipType` | string | 重复字段 |
| `/gift-card/redeem` | `tier` | string | 礼品卡档位 |
| `/gift-card/redeem` | `newExpiryDate` | ISO string | 新过期时间 |

### 前端消费字段

| 位置 | 字段名 | 类型 | 说明 |
|-----|-------|------|------|
| `User` | `licenseType` | 'free'\|'trial'\|'premium'\|'enterprise' | **不支持 pro_max/ultra** |
| `User` | `expiryDate` | string | 过期时间 |
| `UserStatus` | `plan` | 'free'\|'trial'\|'pro'\|'pro_max'\|'ultra' | 支持新档位 |
| `UserStatus` | `trial.end_at` | ISO string | 试用结束时间 |
| `UserStatus` | `max_accounts` | number | 最大账号数 |

### 本地缓存字段

| 存储键 | 字段 | 说明 |
|-------|------|------|
| `auth-storage` | `user.licenseType` | 用户档位 |
| `auth-storage` | `user.expiryDate` | 过期时间 |
| `trial-storage` | `trialEndsAt` | 试用结束时间戳 |

---

## C. 枚举值清单

### 系统实际使用的档位值

| 值 | 出现位置 | 说明 |
|---|---------|------|
| `free` | 全链路 | 免费版 |
| `trial` | 全链路 | 试用版 |
| `pro` | 后端/礼品卡 | 专业版 |
| `pro_max` | 后端/礼品卡 | 专业增强版 |
| `ultra` | 后端/礼品卡 | 旗舰版 |
| `premium` | 前端/Electron | 高级版 (等同于 pro) |
| `enterprise` | 前端/Electron | 企业版 |

### 同义但不统一的值

| 含义 | 后端值 | 前端值 | 问题 |
|-----|-------|-------|------|
| 专业版 | `pro` | `premium` | 不一致 |
| 专业增强版 | `pro_max` | **不支持** | 前端无法显示 |
| 旗舰版 | `ultra` | **不支持** | 前端无法显示 |

### 前端不支持的值

- `pro_max` - 映射到 "免费版"
- `ultra` - 映射到 "免费版"

---

## D. 兑换链路审计

### 兑换流程

```
用户输入礼品卡
      ↓
POST /gift-card/redeem
      ↓
验证礼品卡 (tier: pro/pro_max/ultra)
      ↓
查询当前用户状态 (users.plan)
      ↓
计算新档位 (TIER_BENEFITS[tier].plan)
      ↓
检查升级规则 (tier_order)
      ↓
更新数据库:
  - users.plan = new_plan ✓
  - users.max_accounts = new_max_accounts ✓
  - trials.end_ts = new_expiry_ts ✓
  - gift_cards.status = 'redeemed' ✓
  - gift_card_redemptions 记录 ✓
      ↓
返回响应:
  - membershipType: new_plan ✓
  - tier: tier ✓
  - newExpiryDate: expiry_iso ✓
      ↓
前端调用 refreshUserStatus()
      ↓
GET /auth/status
      ↓
更新 authStore.userStatus ✓
      ↓
**问题: 未更新 authStore.user.licenseType ✗**
      ↓
UI 渲染使用 user.licenseType (旧值)
      ↓
**显示为免费版**
```

### 断点定位

| 层级 | 是否传递 Ultra | 问题 |
|-----|---------------|------|
| 礼品卡表 | ✓ | tier 字段正确存储 |
| 兑换接口 | ✓ | 返回 new_plan = 'ultra' |
| 数据库更新 | ✓ | users.plan 已更新 |
| 状态查询接口 | ✓ | /auth/status 返回 plan='ultra' |
| userStatus Store | ✓ | 已更新 |
| user Store | ✗ | **未同步更新** |
| UI 组件 | ✗ | 使用 user.licenseType，不支持 ultra |

---

## E. 多状态源冲突图

```
                    ┌─────────────────┐
                    │   数据库 users   │
                    │   .plan = ultra  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ /auth/status    │ │ /subscription/  │ │ /gift-card/     │
│   plan='ultra'  │ │   status        │ │   redeem        │
└────────┬────────┘ └─────────────────┘ └─────────────────┘
         │
         ▼
┌─────────────────┐
│ userStatus Store│◄── 权威来源 (支持 ultra)
│ .plan='ultra'   │
└─────────────────┘
         │
         │ (未同步)
         ▼
┌─────────────────┐
│   user Store    │◄── UI 主要使用 (不支持 ultra)
│ .licenseType='free'│    (默认值)
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   UI 组件        │
│ 显示: 免费版     │
└─────────────────┘
```

### 状态源优先级

| 优先级 | 状态源 | 是否支持 Ultra | 使用情况 |
|-------|-------|---------------|---------|
| 1 | 数据库 users.plan | ✓ | 权威来源 |
| 2 | userStatus.plan | ✓ | 权威来源，但UI不优先使用 |
| 3 | user.licenseType | ✗ | **UI主要使用，但不支持新档位** |
| 4 | trialStore | ✗ | 仅试用状态 |

---

## F. 危险默认值清单

### 高风险兜底逻辑

| 文件 | 代码 | 风险 |
|-----|------|------|
| `types/auth.ts:10` | `licenseType: 'free' \| 'trial' \| 'premium' \| 'enterprise'` | **类型限制，pro_max/ultra 无法存储** |
| `UserCenter.tsx:223` | `user?.licenseType \|\| 'free'` | 未知档位显示为免费版 |
| `AuthService.ts:289` | `featureLicenses[feature] \|\| 'free'` | 未知功能默认免费 |
| `authStore.ts:63` | `licenseType: 'free'` | 创建用户默认免费版 |
| `models.py:22` | `plan = Column(String(32), default="free")` | 数据库默认值 |
| `UserCenter.tsx:143` | `default: return '免费版'` | switch 默认免费版 |
| `AuthGuard.tsx` | 类似逻辑 | 权限提示不支持新档位 |

### 危险模式

```typescript
// 模式1: 类型限制
licenseType: 'free' | 'trial' | 'premium' | 'enterprise'  // 缺少 pro_max/ultra

// 模式2: switch 默认兜底
switch (licenseType) {
  case 'premium': return '高级版'
  case 'enterprise': return '企业版'
  default: return '免费版'  // pro_max/ultra 落入此处
}

// 模式3: 逻辑或兜底
const type = user?.licenseType || 'free'  // undefined 时返回 free

// 模式4: 对象查找兜底
const map = { free: 0, trial: 1, premium: 2, enterprise: 3 }
const level = map[licenseType] || 0  // pro_max/ultra 返回 0 (free级别)
```

---

## G. 权限矩阵审计

### 当前代码实际权限

| 功能 | free | trial | premium | enterprise | pro_max | ultra |
|-----|------|-------|---------|------------|---------|-------|
| 直播控制 | ✓ | ✓ | ✓ | ✓ | ? | ? |
| 自动回复 | ✗ | ✓ | ✓ | ✓ | ? | ? |
| 自动发言 | ✗ | ✓ | ✓ | ✓ | ? | ? |
| 自动弹窗 | ✗ | ✓ | ✓ | ✓ | ? | ? |
| AI 助手 | ✗ | ✗ | ✓ | ✓ | ? | ? |
| 高级设置 | ✗ | ✗ | ✓ | ✓ | ? | ? |
| 多设备支持 | ✗ | ✗ | ✗ | ✓ | ? | ? |

**注**: pro_max 和 ultra 在前端权限检查中会被识别为 free (level 0)

### 后端 TIER_BENEFITS 定义

```python
TIER_BENEFITS = {
    "pro": { "max_accounts": 1, "plan": "pro" },
    "pro_max": { "max_accounts": 3, "plan": "pro_max" },
    "ultra": { "max_accounts": -1, "plan": "ultra" }
}
```

### 前端权限层级 (有问题)

```typescript
const licenseHierarchy: Record<string, number> = {
  free: 0,
  trial: 1,
  premium: 2,      // 对应 pro
  enterprise: 3,   // 没有 pro_max/ultra
}
// pro_max/ultra 无法识别，权限检查失败
```

---

## H. 登录与持久化一致性

### 登录流程

```
用户登录
    ↓
POST /login
    ↓
返回: user (无 plan 字段) + token
    ↓
前端创建 SafeUser
    ↓
licenseType 默认为 'free'  // 问题!
    ↓
调用 getUserStatus()
    ↓
GET /auth/status
    ↓
返回: plan='ultra' (正确)
    ↓
更新 userStatus Store
    ↓
**user Store 未更新**  // 问题!
    ↓
UI 使用 user.licenseType='free' 渲染
```

### 持久化问题

| 场景 | 问题 |
|-----|------|
| 登录后 | user.licenseType 默认为 free，未同步 userStatus.plan |
| 刷新页面 | 从 localStorage 读取 user，可能为旧值 |
| 重新登录 | 可能覆盖正确的云端状态 |
| 兑换后 | 只刷新 userStatus，未同步更新 user |
| 多标签页 | 状态可能不一致 |

---

## I. 修复建议

### P0: 必须立即修

#### 1. 统一类型定义
```typescript
// types/auth.ts
// 修改前
licenseType: 'free' | 'trial' | 'premium' | 'enterprise'

// 修改后
licenseType: 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra' | 'enterprise'
// 或统一使用 plan 字段
```

#### 2. 同步 user 和 userStatus
```typescript
// authStore.ts
// 刷新 userStatus 后同步更新 user
refreshUserStatus: async () => {
  const status = await getUserStatus()
  if (status) {
    set({ userStatus: status })
    // 新增: 同步更新 user.licenseType
    const currentUser = get().user
    if (currentUser && status.plan) {
      set({
        user: {
          ...currentUser,
          licenseType: mapPlanToLicenseType(status.plan)
        }
      })
    }
  }
  return status
}
```

#### 3. 更新 UI 组件映射
```typescript
// UserCenter.tsx
const getLicenseText = (licenseType: string) => {
  switch (licenseType) {
    case 'pro': return '专业版'
    case 'pro_max': return '专业增强版'
    case 'ultra': return '旗舰版'
    case 'premium': return '高级版'
    case 'enterprise': return '企业版'
    case 'trial': return '试用版'
    default: return '免费版'
  }
}
```

#### 4. 更新后端权限服务
```typescript
// AuthService.ts
const licenseHierarchy: Record<string, number> = {
  free: 0,
  trial: 1,
  pro: 2,
  premium: 2,      // 兼容旧值
  pro_max: 3,
  ultra: 4,
  enterprise: 5,
}
```

### P1: 建议尽快修

1. 统一时间格式 (全部使用 Unix 时间戳)
2. 统一字段命名 (全部使用 `plan`)
3. 添加订阅状态变更监听
4. 完善兑换历史记录
5. 添加状态一致性检查

### P2: 后续重构

1. 合并 user 和 userStatus
2. 移除历史遗留字段
3. 完善类型定义
4. 添加单元测试

---

## J. 统一方案

### 推荐字段标准

```typescript
// 唯一标准字段
interface UserSubscription {
  plan: 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra' | 'enterprise'
  expires_at: number | null  // Unix 时间戳
  max_accounts: number
  features: string[]
}
```

### 后端标准返回

```json
{
  "username": "...",
  "plan": "ultra",
  "expires_at": 1735689600,
  "max_accounts": -1,
  "features": ["all"],
  "trial": {
    "is_active": false,
    "is_expired": false
  }
}
```

### 前端唯一映射表

```typescript
const PLAN_CONFIG = {
  free: { name: '免费版', color: 'gray', level: 0, features: [...] },
  trial: { name: '试用版', color: 'blue', level: 1, features: [...] },
  pro: { name: '专业版', color: 'green', level: 2, features: [...] },
  pro_max: { name: '专业增强版', color: 'orange', level: 3, features: [...] },
  ultra: { name: '旗舰版', color: 'purple', level: 4, features: [...] },
  enterprise: { name: '企业版', color: 'gold', level: 5, features: [...] },
}
```

### 兑换后标准动作

```typescript
async function redeemGiftCard(code: string) {
  // 1. 调用兑换接口
  const result = await api.redeem(code)
  
  // 2. 刷新用户状态
  await refreshUserStatus()
  
  // 3. 同步更新 user Store
  await syncUserFromStatus()
  
  // 4. 持久化到本地存储
  persistUserState()
  
  // 5. 触发状态变更事件
  emitSubscriptionChanged()
}
```

### 历史遗留字段处理

| 字段 | 处理方式 | 说明 |
|-----|---------|------|
| `licenseType` | 映射到 `plan` | 保持兼容 |
| `premium` | 映射到 `pro` | 保持兼容 |
| `membership_type` | 逐步废弃 | 使用 `tier` |
| `expiryDate` | 映射到 `expires_at` | 统一格式 |

---

## K. 最小修复方案

### 立即执行 (5分钟修复)

```typescript
// 1. 修改 types/auth.ts
export interface User {
  // ...
  licenseType: 'free' | 'trial' | 'pro' | 'pro_max' | 'ultra' | 'premium' | 'enterprise'
  // ...
}

// 2. 修改 UserCenter.tsx
const getLicenseText = (licenseType: string) => {
  const map: Record<string, string> = {
    'pro': '专业版',
    'pro_max': '专业增强版',
    'ultra': '旗舰版',
    'premium': '高级版',
    'enterprise': '企业版',
    'trial': '试用版',
    'free': '免费版',
  }
  return map[licenseType] || '免费版'
}

// 3. 修改 authStore.ts
refreshUserStatus: async () => {
  const status = await getUserStatus()
  if (status && status.plan) {
    set({ userStatus: status })
    // 同步更新 user
    const user = get().user
    if (user) {
      set({
        user: { ...user, licenseType: status.plan as SafeUser['licenseType'] }
      })
    }
  }
  return status
}
```

---

## 附录: 关键文件清单

### 必须修改的文件

1. `src/types/auth.ts` - 类型定义
2. `src/stores/authStore.ts` - 状态同步
3. `src/components/auth/UserCenter.tsx` - UI映射
4. `electron/main/services/AuthService.ts` - 权限检查
5. `src/components/auth/AuthGuard.tsx` - 权限提示

### 建议修改的文件

6. `src/services/apiClient.ts` - 接口类型
7. `src/hooks/useAuth.ts` - 认证逻辑
8. `auth-api/schemas.py` - 后端schema
9. `auth-api/models.py` - 后端模型

---

*报告生成时间: 2026-03-09*  
*审计人员: AI Assistant*  
*版本: v1.0*
