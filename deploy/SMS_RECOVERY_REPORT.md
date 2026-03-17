# 短信功能修复报告

## 修复日期
2026-03-18

## 问题概述
短信验证码发送功能失效，错误码 `InvalidAccessKeyId.NotFound` (404)

---

## 最终有效配置

### RAM 用户信息
- **RAM 用户名**: `sms-api-user`
- **状态**: 已启用
- **最后使用服务**: Dypns (号码认证服务)
- **最后使用时间**: 2026-03-18

### 当前有效 AccessKey
- **AccessKey ID**: `LTAI5t69************` (已脱敏)
- **状态**: 已启用
- **生效方式**: 通过 docker-compose 环境变量注入

### 所需权限策略
- `AliyunDySmsFullAccess` (短信服务全权限)
- `AliyunDypnsFullAccess` (号码认证服务全权限)
- 或最小权限: `dypns:SendSmsVerifyCode`

### 短信配置参数
```bash
SMS_MODE=aliyun_dypns
ALIYUN_ACCESS_KEY_ID=<your-access-key-id>
ALIYUN_ACCESS_KEY_SECRET=<your-access-key-secret>
ALIYUN_SMS_SIGN_NAME=速通互联验证码
ALIYUN_SMS_TEMPLATE_CODE=100001
```

---

## 根因分析

### 直接原因
1. **容器环境变量未同步** - docker-compose 从 shell 环境继承了旧 Key
2. **新旧 Key 切换失控** - 服务器上存在多个 Key，容器启动时使用了错误的 Key

### 代码变更
- **文件**: `auth-api/sms_service.py`
- **变更**: 移除可选参数 `code_length`, `valid_time`, `interval`
- **原因**: 与阿里云控制台请求保持一致
- **Commit**: `ca5ea6e`

---

## 重要操作规范

### 修改 .env 后必须执行
```bash
cd /opt/auth-api
docker compose down api
ALIYUN_ACCESS_KEY_ID=xxx ALIYUN_ACCESS_KEY_SECRET=xxx docker compose up -d api
```

### 短信请求必须只传必要字段
```python
req = dypns_models.SendSmsVerifyCodeRequest(
    phone_number=phone,
    sign_name=self.sign_name,
    template_code=self.template_code,
    template_param=template_param,
    # 不要传: code_length, valid_time, interval
)
```

---

## 已废弃/归档的 Key

| Key ID | 状态 | 备注 |
|--------|------|------|
| `LTAI5tFC************` | ❌ 废弃 | 404 无效 |
| `LTAI5tGZ************` | ❌ 废弃 | 404 无效 |

---

## 后续维护建议

1. **定期轮换 Key** - 每 6 个月轮换一次 AccessKey
2. **监控短信发送** - 设置告警监控短信发送成功率
3. **备份配置** - 修改 .env 前务必备份
4. **测试验证** - 每次配置变更后立即测试短信发送
