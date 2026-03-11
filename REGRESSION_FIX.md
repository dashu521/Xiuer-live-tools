# 连接回归问题诊断与修复报告

## 问题根因分析

### 回归定位
通过 git 历史分析，最近提交 `4fb79ec` (feat: add cloud auth api) 主要改动为UI样式和云鉴权功能，**不是直接根因**。

真正的根因是**异步状态机设计问题**：

### 当前流程中的问题

1. **IPC 返回值歧义**
   - `connection.ts` 第57行：立即返回 `{success: true, browserLaunched: true}`
   - 但第58-72行的 catch 块返回 `{success: false, browserLaunched: false, error}`
   - **问题**：`success` 字段未被前端使用，导致逻辑混乱

2. **前端错误处理逻辑错误**
   - `StatusCard.tsx` 第225行：`if (result && !result.browserLaunched)`
   - **问题**：当 IPC 同步部分出错时，弹出 toast.error，但仍保持 connecting 状态
   - 用户看到"连接失败"提示，但实际上浏览器可能启动成功

3. **accountId 一致性问题（潜在风险）**
   - `connection.ts` 使用 `account.id`
   - `App.tsx` 中 `setConnectState(params.accountId, ...)` 
   - 需要确保全链路 accountId 完全一致

4. **缺少重入保护**
   - 用户可以在 connecting 状态下重复点击连接按钮
   - 导致多个连接流程同时运行

5. **超时机制不可靠**
   - 15秒和60秒超时使用 `setTimeout`，但不携带 traceId
   - 无法区分是哪次连接请求的超时

## 修复方案

### 第0步：添加 traceId 全链路追踪
### 第1步：修复 IPC 返回值处理逻辑
### 第2步：添加重入保护
### 第3步：确保 accountId 一致性
### 第4步：优化超时机制

---

## 预期修复效果

1. 点击连接 → 按钮立即显示"连接中"并禁用
2. 浏览器启动失败 → 立即显示错误，恢复到可重试状态
3. 浏览器启动成功 → 弹出登录窗口，等待扫码
4. 扫码成功 → 按钮变为"已连接"，显示账号名
5. 连接失败 → 显示错误，恢复到可重试状态
6. 重复点击 → 提示"正在连接中"，不重启流程

---

## 修复代码

### 1. 添加 traceId 生成工具
