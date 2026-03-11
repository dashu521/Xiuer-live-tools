# 测试代码与 Mock 数据说明

## 概述

本文档说明项目中包含的测试代码和 Mock 数据，这些代码用于功能验证和开发调试，**生产环境不会启用**。

## 环境控制机制

### 前端（渲染进程）

**环境变量检查：**
- `import.meta.env.DEV` - Vite 开发模式标识
- `import.meta.env.MODE` - 构建模式（'development' | 'production'）

**平台检查：**
- `platform === 'dev'` - 测试平台标识

**启用条件（需同时满足）：**
1. 非生产模式：`import.meta.env.MODE !== 'production'`
2. 开发模式或测试平台：`import.meta.env.DEV === true` 或 `platform === 'dev'`

### 后端（Electron 主进程）

**环境变量检查：**
- `process.env.MOCK_TEST === 'true'` - Mock 测试模式标识
- `process.env.NODE_ENV` - Node.js 环境标识

**平台检查：**
- 平台选择为 'dev'（测试平台）

## 测试代码清单

### 1. Mock 商品数据

**文件：** `src/utils/mockGoodsData.ts`

**功能：**
- 提供 5 个测试商品 ID（1, 2, 3, 4, 5）
- 自动注入到商品列表（仅在测试模式）
- 手动注入按钮（仅在测试模式显示）

**启用条件：**
- `shouldUseMockGoods(platform)` 返回 `true`
- 生产环境（`MODE === 'production'`）始终返回 `false`

**使用位置：**
- `src/pages/AutoPopUp/components/GoodsListCard.tsx`

### 2. 测试平台（DevPlatform）

**文件：** `electron/main/platforms/dev/index.ts`

**功能：**
- 模拟真实平台的评论监听、弹窗、发言等功能
- 使用 Mock 数据生成随机消息
- 提供测试页面（`dev.html`）

**启用条件：**
- 用户选择平台为 'dev'（测试平台）
- 生产环境不应在平台选择列表中包含 'dev'

**依赖：**
- `electron/main/utils/mock.ts` - Mock 数据生成

### 3. Mock 消息生成

**文件：** `electron/main/utils/mock.ts`

**功能：**
- 生成随机的抖音直播消息（评论、进入、点赞、下单等）
- 用于测试平台的评论监听功能

**启用条件：**
- 仅在测试平台（DevPlatform）中使用
- 生产环境不会调用此函数

### 4. Mock 测试环境变量

**文件：** `electron/main/utils/common.ts`

**功能：**
- `isMockTest()` 函数检查 `process.env.MOCK_TEST === 'true'`
- 用于后端 Mock 测试控制

**启用条件：**
- 需要显式设置环境变量 `MOCK_TEST=true`
- 生产环境不应设置此变量

## 生产环境安全保证

### 前端检查

1. **严格的环境检查：**
   ```typescript
   // src/utils/mockGoodsData.ts
   const isProduction = import.meta.env.MODE === 'production'
   if (isProduction) {
     return false  // 生产环境始终禁用
   }
   ```

2. **条件渲染：**
   ```tsx
   // 测试按钮仅在 isTestMode 时渲染
   {isTestMode && <TestButton />}
   ```

3. **Vite 构建时：**
   - 生产构建（`npm run build`）会自动设置 `MODE=production`
   - 所有 Mock 数据检查都会返回 `false`

### 后端检查

1. **平台隔离：**
   - 测试平台（DevPlatform）仅在平台选择为 'dev' 时使用
   - 生产环境不应在平台选择列表中包含 'dev'

2. **环境变量：**
   - `MOCK_TEST` 需要显式设置，生产环境不应设置

## 验证步骤

### 验证 Mock 数据在生产环境被禁用

1. **构建生产版本：**
   ```bash
   npm run build
   ```

2. **检查构建产物：**
   - 搜索 `MOCK_GOODS_IDS` 或 `shouldUseMockGoods`
   - 确认条件检查包含 `MODE === 'production'` 的判断

3. **运行生产版本：**
   - 启动生产构建的应用
   - 确认测试按钮不显示
   - 确认控制台无 Mock 相关日志

### 验证测试模式正常工作

1. **开发模式：**
   ```bash
   npm run dev
   ```
   - 选择测试平台（'dev'）
   - 确认测试商品自动注入
   - 确认测试按钮显示

2. **测试平台：**
   - 在平台选择中选择 'dev'
   - 确认 Mock 数据正常工作
   - 确认测试功能可用

## 存档说明

此版本是"可复现的稳定版本"，包含：
- ✅ 完整的测试代码和 Mock 数据
- ✅ 严格的环境/平台条件控制
- ✅ 生产环境安全保证
- ✅ 明确的注释和文档

**重要：** 此版本不是纯生产裁剪版本，而是包含测试代码的完整版本，通过环境控制确保生产环境不会启用测试功能。
