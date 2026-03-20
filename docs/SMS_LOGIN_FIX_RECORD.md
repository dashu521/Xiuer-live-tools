# 手机验证码登录链路修复记录

**修复日期**: 2026-03-14  
**验收日期**: 2026-03-14  
**验收状态**: ✅ 已通过真人验收  
**修复范围**: 验证码登录 → 自动注册 → 设置密码 → 免费试用 完整链路

---

## 问题概述

### 原始问题
1. 手机验证码登录后，设置密码时报 401 token_invalid
2. 免费试用点击时报 401 token_invalid
3. 公共认证层仍在使用 deprecated `getTokens()` 接口

### 根因分析
- `PhoneAuthDialog` 直接调用 API 获取 token，未通过主进程统一存储
- `apiClient.ts` 和 `authStore.ts` 仍在调用已废弃的 `authAPI.getTokens()`
- 主进程新增 `getTokenInternal` 后，renderer 侧未完全迁移

---

## 修复文件清单

### 1. 前端组件层
| 文件 | 修改内容 |
|------|----------|
| `src/components/auth/PhoneAuthDialog.tsx` | 改用 `authAPI.loginWithSms` 主进程代理登录，移除直接 API 调用 |
| `src/services/apiClient.ts` | 强制只使用 `getTokenInternal`，移除 `getTokens` fallback，增加策略日志 |
| `src/stores/authStore.ts` | `checkAuth()` 改用 `getTokenInternal` 替代 `getTokens` |

### 2. 主进程层
| 文件 | 修改内容 |
|------|----------|
| `electron/main/services/cloudAuthClient.ts` | 新增 `cloudSmsLogin` 函数，修复后端字段名映射 (`token` vs `access_token`) |
| `electron/main/ipc/auth.ts` | 新增 `auth:loginWithSms` handler，内部处理 token 存储；新增 `auth:getTokenInternal` handler |
| `electron/preload/auth.ts` | 暴露 `loginWithSms` 和 `getTokenInternal` API |

---

## 关键修复点

### 1. Token 来源唯一化
```typescript
// 修复前：有 fallback 到 renderer 内存 token
const getTokenFn = authAPI?.getTokenInternal ?? authAPI?.getTokens

// 修复后：强制只使用主进程内部接口
const getTokenFn = authAPI?.getTokenInternal
if (!getTokenFn) {
  console.error('[apiClient] authAPI.getTokenInternal not available')
  return null
}
```

### 2. 字段名映射修复
后端返回 `token`，但代码期望 `access_token`：
```typescript
// 修复前
const ok = status === 200 && data != null && !!data.access_token  // 始终 false

// 修复后
const ok = status === 200 && data != null && !!data.token
return {
  success: true,
  access_token: data.token,  // 映射到统一字段名
}
```

### 3. 登录流程收口
```typescript
// 修复前：前端直接调用 API，然后手动 setTokens
const result = await loginWithSmsCode(phone, code)
await authAPI.setTokens({ token: result.data.token })  // setTokens 已废弃

// 修复后：主进程代理，内部统一处理
const result = await authAPI.loginWithSms(phone, code)
// token 已由主进程存储，renderer 只更新 UI 状态
```

---

## 验收验证项

- [x] 手机号验证码登录成功
- [x] 自动注册成功
- [x] 进入设置密码弹窗
- [x] 设置密码提交成功（无 401）
- [x] 点击"稍后再说"进入主界面
- [x] 点击"免费试用 3 天"成功（无 401）
- [x] Console 不再出现 `authAPI.getTokens() is deprecated`
- [x] Console 显示 `[apiClient] token strategy = getTokenInternal-only`

---

## 后续维护建议

1. **清理遗留调用**：`preload/auth.ts` 中的 `getTokens/setTokens` 仍保留但标记 deprecated，仅供兼容
2. **监控日志**：如看到 `authAPI.getTokenInternal not available`，说明 preload 未正确加载
3. **重启要求**：修改涉及 Electron main/preload/renderer 三层，必须完全重启才能生效

---

## 相关文档

- `docs/REGRESSION_CHECKLIST.md` - 回归验证清单（已更新修复状态）
- `docs/archive/root-reports/USABILITY_FIX_SUMMARY.md` - 功能可用性修复总结
- `docs/archive/root-reports/ERROR_FIX_SUMMARY.md` - 错误提示优化总结
