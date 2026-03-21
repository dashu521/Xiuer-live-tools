# 秀儿直播助手 - 订阅与会员规则

> **文档版本**: v1.0  
> **最后更新**: 2026-03-18  
> **状态**: 正式规范  
> **适用范围**: 所有涉及订阅/会员/权限的前后端开发

---

## 一、套餐定义

### 1.1 套餐体系

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        订阅套餐体系                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Trial     │  │     Pro      │  │   ProMax     │  │    Ultra     │ │
│  │   免费试用    │  │   基础版     │  │   高级版     │  │   旗舰版     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │         │
│         ▼                 ▼                 ▼                 ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ • 3 天试用    │  │ • 1 个账号    │  │ • 3 个账号    │  │ • 无限账号   │ │
│  │ • 核心功能可用 │  │ • 基础功能   │  │ • 全部功能   │  │ • 全部功能   │ │
│  │ • 无需付费   │  │ • 标准配额   │  │ • 高配额     │  │ • 无限配额   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 套餐详细定义

| 属性 | Trial | Pro | ProMax | Ultra |
|------|-------|-----|--------|-------|
| **套餐编码** | `trial` | `pro` | `pro_max` | `ultra` |
| **中文名称** | 免费试用 | 基础版 | 高级版 | 旗舰版 |
| **英文名称** | Free Trial | Pro | ProMax | Ultra |
| **付费状态** | 免费 | 付费 | 付费 | 付费 |
| **订阅周期** | 3 天 | 月付/年付 | 月付/年付 | 月付/年付 |

---

## 二、直播账号上限规则

### 2.1 账号数量限制

| 套餐 | 直播账号上限 | 说明 |
|------|-------------|------|
| **Trial** | 1 | 试用期间仅限单账号 |
| **Pro** | **1** | 基础版仅支持1个直播账号 |
| **ProMax** | **3** | 高级版支持最多3个直播账号 |
| **Ultra** | **不限** | 旗舰版不限制账号数量 |

### 2.2 账号管理规则

- **同时在线**: 同一账号同一时间仅可在1台设备登录
- **设备切换**: 新设备登录会自动踢出旧设备
- **账号隔离**: 不同直播账号的数据和任务状态完全隔离
- **账号切换**: 支持在应用内快速切换已绑定的直播账号

---

## 三、功能权限口径

### 3.1 核心功能权限矩阵

| 功能模块 | Trial | Pro | ProMax | Ultra |
|----------|-------|-----|--------|-------|
| **中控台连接** | ✅ | ✅ | ✅ | ✅ |
| **自动回复** | ✅ | ✅ | ✅ | ✅ |
| **自动发言** | ✅ | ✅ | ✅ | ✅ |
| **自动弹窗** | ✅ | ✅ | ✅ | ✅ |
| **数据监控** | ⚠️ 3天 | ✅ 30天 | ✅ 90天 | ✅ 180天 |
| **多账号管理** | ❌ 1个 | ❌ 1个 | ✅ 3个 | ✅ 无限 |
| **高级AI模型** | ❌ | ❌ | ✅ | ✅ |
| **API接口** | ❌ | ❌ | ❌ | ✅ |
| **优先客服** | ❌ | ❌ | ✅ | ✅ |

### 3.2 功能限制说明

#### Trial（试用）限制
- 数据保留仅 3 天
- AI 助手不可用（需 Pro）
- 试用期结束后功能受限

#### Pro（基础版）限制
- 仅支持1个直播账号
- 数据保留30天
- 高级AI模型不可用
- API接口不可用

#### ProMax（高级版）限制
- API接口不可用
- 其他功能无限制

#### Ultra（旗舰版）
- 全部功能无限制
- 包含所有未来新增高级功能

---

## 四、UI 显示映射规则

### 4.1 前端显示规范

| 套餐 | 界面显示 | 颜色标识 | 图标 |
|------|----------|----------|------|
| **Trial** | "免费试用" / "试用中" | 🟡 黄色 | ⭐ |
| **Pro** | "基础版" / "Pro" | 🔵 蓝色 | 💎 |
| **ProMax** | "高级版" / "ProMax" | 🟣 紫色 | 👑 |
| **Ultra** | "旗舰版" / "Ultra" | 🟠 橙色 | 🚀 |

### 4.2 状态显示规则

```typescript
// 套餐显示映射
const planDisplayMap = {
  trial: { name: '免费试用', shortName: '试用', color: '#F59E0B', icon: 'star' },
  pro: { name: '基础版', shortName: 'Pro', color: '#3B82F6', icon: 'diamond' },
  pro_max: { name: '高级版', shortName: 'ProMax', color: '#8B5CF6', icon: 'crown' },
  ultra: { name: '旗舰版', shortName: 'Ultra', color: '#F97316', icon: 'rocket' }
};

// 状态显示
const statusDisplayMap = {
  active: { text: '生效中', color: '#10B981' },
  expired: { text: '已过期', color: '#EF4444' },
  trial_ended: { text: '试用结束', color: '#6B7280' }
};
```

### 4.3 升级提示规则

| 当前套餐 | 触发升级提示的场景 | 提示文案 |
|----------|-------------------|----------|
| Trial | 试用到期前3天 | "试用即将结束，升级 Pro 解锁更多功能" |
| Pro | 尝试添加第2个账号 | "Pro 版仅支持1个账号，升级 ProMax 支持3个账号" |
| ProMax | 尝试添加第4个账号 | "ProMax 版支持3个账号，升级 Ultra 享受无限账号" |
| 任何付费套餐 | 到期前7天 | "会员即将到期，及时续费避免服务中断" |

---

## 五、前后端一致性要求

### 5.1 数据库字段规范

```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    plan VARCHAR(20) NOT NULL DEFAULT 'trial', -- trial/pro/pro_max/ultra
    plan_expires_at TIMESTAMP, -- 套餐到期时间
    trial_started_at TIMESTAMP, -- 试用开始时间
    trial_ended_at TIMESTAMP, -- 试用结束时间
    max_accounts INT NOT NULL DEFAULT 1, -- 根据套餐自动设置
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 套餐定义表（只读配置）
CREATE TABLE plan_definitions (
    plan_code VARCHAR(20) PRIMARY KEY, -- trial/pro/pro_max/ultra
    plan_name VARCHAR(50) NOT NULL,
    max_accounts INT NOT NULL,
    data_retention_days INT NOT NULL,
    has_advanced_ai BOOLEAN DEFAULT FALSE,
    has_api_access BOOLEAN DEFAULT FALSE,
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2)
);
```

### 5.2 后端 API 返回规范

```typescript
// /api/user/status 返回结构
interface UserStatusResponse {
  userId: string;
  plan: 'trial' | 'pro' | 'pro_max' | 'ultra';
  planName: string; // 中文名称
  planDisplay: {
    name: string;
    shortName: string;
    color: string;
    icon: string;
  };
  planStatus: 'active' | 'expired' | 'trial_ended';
  planExpiresAt: string | null; // ISO 8601
  maxAccounts: number;
  currentAccountCount: number;
  features: {
    autoReply: boolean;
    autoSpeak: boolean;
    autoPopup: boolean;
    dataMonitoring: boolean;
    advancedAI: boolean;
    apiAccess: boolean;
  };
  limits: {
    dataRetentionDays: number;
    maxDailyReplies: number;
    maxDailySpeaks: number;
  };
}
```

### 5.3 前端状态管理规范

```typescript
// AccessContext 中的订阅相关字段
interface AccessContext {
  // ... 其他字段
  
  // 套餐信息
  plan: 'trial' | 'pro' | 'pro_max' | 'ultra';
  planStatus: 'active' | 'expired' | 'trial_ended';
  planExpiresAt: number | null;
  
  // 账号限制
  maxLiveAccounts: number;
  currentAccountCount: number;
  canAddMoreAccounts: boolean;
  
  // 功能权限
  features: {
    autoReply: boolean;
    autoSpeak: boolean;
    autoPopup: boolean;
    dataMonitoring: boolean;
    advancedAI: boolean;
    apiAccess: boolean;
  };
}

// 权限检查
function checkPlanFeature(plan: PlanType, feature: FeatureType): boolean {
  const featureMatrix = {
    trial: ['autoReply', 'autoSpeak', 'autoPopup'],
    pro: ['autoReply', 'autoSpeak', 'autoPopup', 'dataMonitoring'],
    pro_max: ['autoReply', 'autoSpeak', 'autoPopup', 'dataMonitoring', 'advancedAI'],
    ultra: ['autoReply', 'autoSpeak', 'autoPopup', 'dataMonitoring', 'advancedAI', 'apiAccess']
  };
  return featureMatrix[plan]?.includes(feature) ?? false;
}
```

### 5.4 一致性检查清单

- [ ] 前端显示的套餐名称与后端返回一致
- [ ] 前端权限判断与后端鉴权逻辑一致
- [ ] 数据库中的 `max_accounts` 与套餐定义一致
- [ ] API 返回的 `features` 与功能权限矩阵一致
- [ ] 升级提示的阈值与套餐限制一致

---

## 六、旧规则处理原则

### 6.1 已废弃的旧命名

以下旧命名不再使用，代码中应逐步替换：

| 旧命名 | 新命名 | 状态 |
|--------|--------|------|
| `basic` / `Basic` | `pro` / `Pro` | 已废弃 |
| `premium` / `Premium` | `pro_max` / `ProMax` | 已废弃 |
| `free` / `Free` | `trial` / `Trial` | 已废弃 |

### 6.2 历史兼容逻辑

- **数据库层面**: 保留旧数据，但新用户统一使用新命名
- **API 层面**: 返回统一使用新命名，前端做映射展示
- **前端层面**: 统一使用新命名，不再兼容旧命名

### 6.3 不再作为当前规范的内容

- ❌ 不再支持 `basic` / `premium` 套餐编码
- ❌ 不再支持按功能模块单独订阅
- ❌ 不再支持永久买断制（仅支持订阅制）
- ❌ 不再支持 `free` 套餐（统一为 `trial`）

---

## 七、与其他文档关系

### 7.1 本文档定位

- **本文档**: 订阅规则主规范，定义套餐、权限、限制
- **不管**: 支付实现细节、支付渠道对接、退款流程
- **互补**: access-control-architecture.md（权限架构实现）

### 7.2 文档依赖关系

```
SUBSCRIPTION_RULES.md（本规范）
    │
    ├── 被依赖 ──→ access-control-architecture.md（权限架构）
    │                └── AccessContext.plan 字段定义
    │
    ├── 被依赖 ──→ 前端 UI 组件（套餐展示、升级提示）
    │                └── planDisplayMap 映射
    │
    ├── 被依赖 ──→ 后端 API（用户状态接口）
    │                └── /api/user/status 返回结构
    │
    └── 互补 ─────→ 支付相关文档（待补充）
                     └── 支付流程、退款规则
```

### 7.3 相关文档

- [access-control-architecture.md](./access-control-architecture.md) - 权限控制架构（实现本规范定义的规则）
- [AUTH_REGRESSION_CHECKLIST.md](./AUTH_REGRESSION_CHECKLIST.md) - 认证回归检查（包含套餐权限验证）

---

## 八、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-18 | v1.0 | 初始版本，定义 Trial/Pro/ProMax/Ultra 四级套餐体系 |

---

**文档维护**: 产品团队 + 技术团队  
**下次评审**: 2026-04-18
