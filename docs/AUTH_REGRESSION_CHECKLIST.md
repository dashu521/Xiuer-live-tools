# 认证链路回归检查清单

**版本**: v1.0  
**更新日期**: 2026-03-18  
**适用范围**: auth-api 后端改动、认证相关前端改动

---

## 一、必须执行的回归测试

### 1. 验证码发送
```bash
curl -X POST "https://auth.xiuer.work/auth/sms/send?phone=15639913165"
```
**预期**: `{"success":true}` 或 `{"detail":"too_many_requests"}` (频率限制)
**禁止**: `InvalidAccessKeyId.NotFound` (404) / `Forbidden.NoPermission` (403)

### 2. 验证码登录
**步骤**:
1. 发送验证码到手机号
2. 使用收到的验证码登录
3. 确认登录成功，token 包含 jti

**验证点**:
- 登录成功
- access_token 包含 jti 字段
- refresh_token 正常返回

### 3. 双机登录踢下线
**步骤**:
1. 设备A登录账号
2. 设备B登录同一账号
3. 观察设备A是否被踢下线

**验证点**:
- 设备A显示"账号已在其他设备登录"
- 设备A心跳停止
- 设备A弹出登录对话框

### 4. 登录后 loadFromCloud
**步骤**:
1. 设备A修改设置/直播账号
2. 设备B登录同一账号
3. 观察设备B是否加载设备A的配置

**验证点**:
- 设备B登录后显示设备A的设置
- 设备B的直播账号列表与设备A一致

### 5. 设置修改后 syncToCloud
**步骤**:
1. 设备A修改设置
2. 等待 2-5 秒
3. 检查云端配置是否更新

**验证点**:
- 网络请求 `POST /user/config` 成功
- 云端配置与本地一致

### 6. 直播账号同步
**步骤**:
1. 设备A添加/删除直播账号
2. 设备B登录同一账号
3. 观察设备B的直播账号列表

**验证点**:
- 设备B显示设备A的直播账号
- 多设备间直播账号列表一致

---

## 二、服务器部署核验清单

### 部署前检查
- [ ] 本地代码已提交并推送
- [ ] 本地单元测试通过
- [ ] 确认修改的文件列表

### 部署中检查
- [ ] 代码已复制到服务器 `/opt/auth-api`
- [ ] 容器已重建 (docker-compose down + up)
- [ ] 环境变量正确设置

### 部署后核验
- [ ] 容器内代码与本地一致
```bash
docker exec auth-api-api-1 cat /app/routers/auth.py | grep 'jti'
# 应显示 jti 相关代码
```

- [ ] /auth/session-check 接口存在
```bash
curl https://auth.xiuer.work/auth/session-check -H "Authorization: Bearer test"
# 应返回 {"detail":{"code":"token_invalid"}} (不是 404)
```

- [ ] 短信发送正常
```bash
curl -X POST "https://auth.xiuer.work/auth/sms/send?phone=15639913165"
# 应返回 {"success":true} 或频率限制错误 (不是 404/403)
```

---

## 三、禁止无原因改动的文件

### 后端 (auth-api)
- `auth-api/routers/auth.py` - login/refresh/session-check 逻辑
- `auth-api/deps.py` - token 生成/解码
- `auth-api/sms_service.py` - 短信发送逻辑

### 前端 (src)
- `src/components/auth/AuthProvider.tsx` - 认证状态管理
- `src/stores/authStore.ts` - 认证存储
- `src/services/apiClient.ts` - API 客户端
- `src/services/configSyncService.ts` - 配置同步
- `src/hooks/useAccounts.ts` - 账号管理
- `src/App.tsx` - 应用入口

**如需改动上述文件，必须先做影响面评估，再做完整回归测试。**

---

## 四、常见问题排查

### 问题 1: 双设备踢下线不生效
**检查点**:
1. 服务器代码是否包含 jti/session-check
2. 客户端 token 是否包含 jti
3. 心跳检测是否正常启动

### 问题 2: 短信发送 404/403
**检查点**:
1. 容器内 ALIYUN_ACCESS_KEY_ID 是否正确
2. 阿里云 AccessKey 是否有效
3. RAM 用户是否有短信权限

### 问题 3: 配置同步失败
**检查点**:
1. 登录后是否调用 loadFromCloud
2. 修改后是否调用 syncToCloud
3. 网络请求是否成功

---

## 五、相关文档

- `docs/INCIDENT_POSTMORTEM_2026_03_18.md` - 事件收口报告
- `docs/AUTH_REGRESSION_AUDIT_REPORT.md` - 回归审计报告
- `deploy/SMS_RECOVERY_REPORT.md` - 短信修复报告
