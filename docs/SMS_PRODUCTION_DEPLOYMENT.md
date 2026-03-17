# 短信服务生产环境运维说明

> 本文档记录短信验证码服务生产环境的配置要求和安全规范
> 最后更新：2026-03-17

---

## 1. 生产环境强制配置

### 1.1 短信模式（强制）
```bash
SMS_MODE=aliyun_dypns
```
**警告**：生产环境必须使用 `aliyun_dypns` 模式，禁止 fallback 到 `dev` 模式。

### 1.2 配置文件位置
```
/opt/auth-api/.env
```

### 1.3 当前短信配置
| 配置项 | 值 | 说明 |
|--------|-----|------|
| 短信签名 | `速通互联验证码` | 阿里云号码认证控制台-赠送签名 |
| 短信模板 | `100001` | 阿里云号码认证控制台-赠送模板 |
| AccessKey | RAM 用户 | 必须使用 RAM 用户，禁止云账号 AccessKey |

### 1.4 完整配置示例
```bash
# 短信服务配置（生产环境强制）
SMS_MODE=aliyun_dypns
ALIYUN_ACCESS_KEY_ID=YOUR_ALIYUN_ACCESS_KEY_ID
ALIYUN_ACCESS_KEY_SECRET=YOUR_ALIYUN_ACCESS_KEY_SECRET
ALIYUN_SMS_SIGN_NAME=速通互联验证码
ALIYUN_SMS_TEMPLATE_CODE=100001
```

---

## 2. 安全规范

### 2.1 AccessKey 安全要求
- ✅ 必须使用 **RAM 用户** AccessKey
- ❌ 禁止使用云账号（主账号）AccessKey
- ❌ 禁止将 AccessKey 提交到 Git
- ❌ 禁止在日志中打印明文 AccessKey
- ✅ 定期轮换 AccessKey（建议 90 天）

### 2.2 旧 Key 处理
- 旧 AccessKey 已删除/禁用
- 新 RAM 用户 AccessKey 已配置

### 2.3 禁止 Fallback
- 生产环境 `SMS_MODE` 必须是 `aliyun_dypns` 或 `aliyun`
- 配置不完整时服务启动失败，禁止自动 fallback 到 dev 模式
- 代码位置：`auth-api/config.py`

### 2.4 响应安全
- 发送验证码响应 **不得包含** `dev_code`
- 正确响应：`{"success": true}`
- 错误响应：返回明确错误信息，不包含可登录验证码

---

## 3. 部署规范

### 3.1 部署前检查清单
- [ ] `docker-compose.yml` 包含阿里云短信环境变量
- [ ] `/opt/auth-api/.env` 包含完整短信配置
- [ ] AccessKey 是 RAM 用户，不是云账号
- [ ] 签名和模板已在阿里云控制台配置

### 3.2 docker-compose.yml 必须包含
```yaml
environment:
  - SMS_MODE=${SMS_MODE:-aliyun_dypns}
  - ALIYUN_ACCESS_KEY_ID=${ALIYUN_ACCESS_KEY_ID:-}
  - ALIYUN_ACCESS_KEY_SECRET=${ALIYUN_ACCESS_KEY_SECRET:-}
  - ALIYUN_SMS_SIGN_NAME=${ALIYUN_SMS_SIGN_NAME:-}
  - ALIYUN_SMS_TEMPLATE_CODE=${ALIYUN_SMS_TEMPLATE_CODE:-}
```

### 3.3 禁止遗漏
- 部署脚本必须同步 `.env` 文件
- 参考脚本：`deploy/deploy-sms-api.sh`

---

## 4. 验收标准

### 4.1 短信发送验收
1. 使用真实手机号发送验证码
2. **手机必须真实收到短信**
3. 响应中不包含 `dev_code`
4. 只有真实短信验证码可登录
5. 错误验证码登录失败

### 4.2 安全检查
```bash
# 1. 检查容器环境变量
docker inspect auth-api-api-1 --format '{{json .Config.Env}}' | grep SMS_MODE
# 预期输出："SMS_MODE=aliyun_dypns"

# 2. 检查响应不包含 dev_code
curl -s -X POST "http://localhost:8000/auth/sms/send?phone=13800138000"
# 预期输出：{"success":true}

# 3. 检查日志无 fallback 警告
docker compose logs api | grep "使用 dev 模式"
# 预期：无输出
```

---

## 5. 故障排查

### 5.1 手机收不到短信
1. 检查 `.env` 配置是否完整
2. 检查阿里云控制台签名/模板状态
3. 检查 RAM 用户权限（`dypns:SendSmsVerifyCode`）
4. 检查阿里云账户余额

### 5.2 响应包含 dev_code
- 原因：`SMS_MODE` 未设置或配置不完整
- 修复：设置 `SMS_MODE=aliyun_dypns` 并配置完整阿里云参数

### 5.3 服务启动失败
- 原因：生产环境强制检查 SMS_MODE
- 修复：确保 `.env` 中 `SMS_MODE` 为 `aliyun_dypns` 或 `aliyun`

---

## 6. 历史变更

### 2026-03-17 短信配置修复
- **问题**：服务器 `.env` 缺少阿里云配置，`docker-compose.yml` 未传递短信变量
- **修复**：
  1. 从 Docker 历史层恢复原有阿里云配置
  2. 更新 `docker-compose.yml` 包含短信环境变量
  3. 配置新 RAM 用户 AccessKey
  4. 删除旧 AccessKey
- **验证**：手机真实收到短信，响应不包含 `dev_code`

---

## 7. 相关文档

- [ADMIN_PRODUCTION_DEPLOYMENT.md](./ADMIN_PRODUCTION_DEPLOYMENT.md) - 管理后台生产环境运维
- [SMS_SETUP.md](./SMS_SETUP.md) - 阿里云短信配置指南
- [阿里云号码认证控制台](https://dypns.console.aliyun.com/)
