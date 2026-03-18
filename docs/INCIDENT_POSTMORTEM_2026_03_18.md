# 认证链路修复事件收口报告

**事件日期**: 2026-03-18  
**报告日期**: 2026-03-18  
**状态**: 已解决 ✅

---

## 一、问题背景

### 初始现象
- 短信验证码发送失败，返回 `InvalidAccessKeyId.NotFound` (404)
- 双设备登录踢下线功能失效
- 多设备配置同步异常

### 问题范围
- 后端: auth-api (FastAPI)
- 前端: Electron + React + TypeScript
- 部署: 阿里云 ECS Docker Compose

---

## 二、真正根因链

### 根因 1: 服务器代码未同步 (主要)
**问题**: 本地仓库已实现 jti/session-check，但服务器容器运行旧代码

**证据**:
```bash
# 服务器容器内代码 (旧)
access_token = create_access_token(user.id)  # 无 jti

# 本地仓库代码 (新)
access_token = create_access_token(user.id, jti=refresh_token_id)  # 有 jti
```

**影响**:
- session-check 接口不存在 (404)
- 双设备踢下线完全失效
- 所有客户端使用无 jti 的 token

### 根因 2: AccessKey 切换失控
**问题**: 服务器上存在多个阿里云短信 Key，容器启动时使用了错误的 Key

**证据**:
```
.env 文件: LTAI5tFC1F2FficL1kLrszWz (旧, 404)
容器实际: LTAI5tGZ6FrCbDaHSLr6zJmq (旧, 404)
正确 Key: LTAI5t69WToNmLYqyBPhxki4 (新, 有效)
```

**影响**:
- 短信发送 404
- 验证码登录链路中断

### 根因 3: 旧 token 客户端无法启动心跳
**问题**: 旧 token (无 jti) 导致认证初始化失败，Heartbeat 不启动

**代码路径**:
```
stores/authStore.ts:checkAuth()
  ↓
getMe() 调用 /me
  ↓
/me 返回 401 token_invalid (旧 token 无 jti)
  ↓
isAuthenticated = false
  ↓
Heartbeat 启动条件不满足
  ↓
无法检测 kicked_out
```

---

## 三、错误判断与纠正

| 阶段 | 错误判断 | 纠正措施 |
|-----|---------|---------|
| 初期 | 认为短信 Key 失效 | 发现是容器使用了错误的 Key |
| 中期 | 怀疑代码逻辑错误 | 发现服务器代码与本地不一致 |
| 后期 | 怀疑前端问题 | 确认是后端代码未部署 |
| 最终 | 确认根因 | 服务器代码同步 + 旧 token 清理 |

---

## 四、最终修复点

### 后端修复

#### 1. auth-api/routers/auth.py
```python
# login: 添加 jti 传递
access_token = create_access_token(user.id, jti=refresh_token_id)

# refresh: 添加 jti 传递
new_access_token = create_access_token(user_id, jti=refresh_record.id)

# session-check: 基于 jti 精确检查
jti = decode_access_token_jti(credentials.credentials)
if not jti:
    raise HTTPException(401, detail={"code": "token_invalid", ...})

# 查询该 jti 对应的 refresh_token
refresh_record = db.query(RefreshToken).filter(
    RefreshToken.id == jti,
    RefreshToken.revoked_at.is_(None),
).first()
```

#### 2. auth-api/deps.py
```python
def create_access_token(user_id: str, jti: Optional[str] = None):
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    if jti:
        payload["jti"] = jti
    return jwt.encode(payload, ...)

def decode_access_token_jti(token: str) -> Optional[str]:
    payload = jwt.decode(token, ...)
    return payload.get("jti")
```

### 前端修复

#### 3. src/stores/authStore.ts
```typescript
// 旧 token (无 jti) 自动清理
if (!result.ok && result.error?.code === 'token_invalid') {
    set({ token: null, refreshToken: null, isAuthenticated: false })
    window.dispatchEvent(new CustomEvent('auth:required'))
    return
}
```

#### 4. src/App.tsx
```typescript
// 登录成功后立即加载云端配置
if (!hasLoadedFromCloudRef.current) {
    hasLoadedFromCloudRef.current = true
    configSyncService.loadFromCloud().catch(...)
}
```

---

## 五、最终验收结果

| 验收项 | 状态 | 验证方法 |
|-------|------|---------|
| 短信发送 | ✅ 通过 | `curl -X POST /auth/sms/send` |
| 验证码登录 | ✅ 通过 | 前端实测 |
| 双设备登录踢下线 | ✅ 通过 | 设备A登录 → 设备B登录 → 设备A被踢 |
| 登录后 loadFromCloud | ✅ 通过 | 设备B登录后加载设备A配置 |
| 设置修改后 syncToCloud | ✅ 通过 | 修改设置 → 云端同步 |
| 直播账号同步 | ✅ 通过 | 多设备间直播账号列表一致 |

---

## 六、后续维护注意事项

### 1. 服务器部署规范
- **必须核验容器内实际代码**，不能只看本地仓库
- **不能仅 docker restart**，必须确认新版代码已进入容器
- **必须验证 /auth/session-check 存在且非 404**
- **.env 修改后必须重建容器** (docker-compose down + up)

### 2. 回归测试清单
任何涉及以下内容的改动，必须执行完整回归：
- token / jti / session-check
- login / refresh / 短信登录
- 配置同步 (loadFromCloud / syncToCloud)

### 3. 禁止无原因改动的链路
- ✅ 短信发送链路 (已恢复)
- ✅ jti / session-check 链路 (已恢复)
- ✅ 配置同步链路 (已恢复)

**如需改动上述链路，必须先做影响面评估，再做完整回归。**

---

## 七、相关文档

- `docs/AUTH_REGRESSION_AUDIT_REPORT.md` - 认证链路回归审计报告
- `docs/INCIDENT_POSTMORTEM_2026_03_18.md` - 本收口报告
- `deploy/SMS_RECOVERY_REPORT.md` - 短信功能修复报告
- `deploy/SMS_REGRESSION_TEST.md` - 短信功能回归测试清单

---

**一句话阶段结论**: 本轮认证链路修复已完成，服务器代码已同步，jti/session-check 功能已生效，双设备踢下线、短信发送、配置同步均已验证通过。
