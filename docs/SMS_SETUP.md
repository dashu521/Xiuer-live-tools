# 短信验证码配置说明

手机验证码登录/注册依赖真实短信下发。若**收不到验证码**，请按下面检查。

## 1. 当前模式：开发模式默认不发真实短信

- 环境变量 **`SMS_MODE`** 默认是 **`dev`**。
- **dev 模式**：验证码只写入**服务端日志**，不会调用任何短信服务商，**手机不会收到短信**，仅用于本地/测试。
- 生产环境需改为 **`aliyun_dypns`**（推荐个人开发者）或 **`aliyun`**（需自备签名/模板）。

## 2. 个人开发者推荐：阿里云「短信认证服务」（免企业资质）

**免签名/免模板申请**：使用阿里云**号码认证服务**提供的「短信认证」能力，在控制台使用**赠送的签名与模板**即可，无需企业资质。

在运行 auth-api 的环境（本机或服务器/Docker）中设置：

| 环境变量 | 说明 |
|----------|------|
| `SMS_MODE` | 设为 **`aliyun_dypns`** |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID（RAM 用户需授予 `dypns:SendSmsVerifyCode`、`dypns:CheckSmsVerifyCode`） |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_SMS_SIGN_NAME` | **赠送签名**名称（在 [号码认证控制台-赠送签名配置](https://dypns.console.aliyun.com/smsCertParamsConfig/sign) 中查看） |
| `ALIYUN_SMS_TEMPLATE_CODE` | **赠送模板** Code（在 [赠送模板配置](https://dypns.console.aliyun.com/smsCertParamsConfig/template) 中查看，需含变量 `code`） |

**开通步骤**：登录 [号码认证控制台](https://dypns.console.aliyun.com/) → 开通「短信认证」→ 在「赠送签名配置」「赠送模板配置」中复制签名名称与模板 Code 填入上述环境变量。

仅配置 AccessKey 时，发送接口会提示配置赠送签名与模板；配置完整后即可正常收短信。

## 3. 企业自备签名/模板：阿里云国内短信（Dysmsapi）

若已在国内短信控制台申请过签名与模板，可使用 `SMS_MODE=aliyun`：

| 环境变量 | 说明 |
|----------|------|
| `SMS_MODE` | 设为 `aliyun` |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_SMS_SIGN_NAME` | 国内短信控制台申请的签名名称 |
| `ALIYUN_SMS_TEMPLATE_CODE` | 国内短信模板 Code（含变量 `code`） |

若 `SMS_MODE=aliyun` 或 `aliyun_dypns` 但配置不完整，接口会返回 **500** 及具体错误信息，便于排查。

### 服务器 Docker 部署

在 **执行 `docker compose` 的目录**（如 `deploy/` 或服务器上的 `/opt/auth-api`）创建 `.env` 文件，填入 `SMS_MODE` 与阿里云相关变量；或在该目录下 `export` 后再执行 `docker compose up -d`。  
`deploy/docker-compose.yml` 已预留 `SMS_MODE` 与四项阿里云变量，会从环境变量或 `.env` 读取。  
参考：`auth-api/.env.example`。

## 4. 开发环境下真实收到验证码

- **本地开发**：在 **auth-api** 目录下复制 `cp .env.example .env`，填写 `SMS_MODE=aliyun_dypns` 及阿里云四项变量。启动 auth-api 时会自动加载 `.env`，即可在开发模式下真实下发短信。
- **不配置阿里云**：保持 `SMS_MODE=dev`（或未设置），点击「发送验证码」后到 **auth-api 运行日志** 中查看，会有类似：  
  `[SMS][DEV] phone=138****8000 code=123456`；或依赖前端「验证码已填入」提示（dev/aliyun 模式接口会返回 `dev_code`）。

## 5. 构建安装后收不到短信时的兜底

- 服务端在 **dev 模式**或 **aliyun 国内短信** 下会同时返回 `dev_code`，安装包内点击「发送验证码」后，若未收到短信，界面会**自动填入验证码**并提示「若未收到短信可直接使用」。
- 若阿里云发送失败但服务端生成了本地验证码，会返回 200 + `dev_code` + `sms_failed`，界面提示「短信发送失败，验证码已填入，请直接登录」。
- 部署时在 **执行 docker compose 的目录**（如 `deploy/`）创建 `.env` 并填写 `SMS_MODE` 与四项 `ALIYUN_*`，重启容器后即可真实下发短信；未配置时服务端会走 dev 兜底并返回 `dev_code`。

## 6. 生产环境强制配置

### 6.1 短信模式（强制）

```bash
SMS_MODE=aliyun_dypns
```

**警告**：生产环境必须使用 `aliyun_dypns` 模式，禁止 fallback 到 `dev` 模式。

### 6.2 安全规范

- ✅ 必须使用 **RAM 用户** AccessKey
- ❌ 禁止使用云账号（主账号）AccessKey
- ❌ 禁止将 AccessKey 提交到 Git
- ❌ 禁止在日志中打印明文 AccessKey
- ✅ 定期轮换 AccessKey（建议 90 天）

### 6.3 部署前检查清单

- [ ] `docker-compose.yml` 包含阿里云短信环境变量
- [ ] `/opt/auth-api/.env` 包含完整短信配置
- [ ] AccessKey 是 RAM 用户，不是云账号
- [ ] 签名和模板已在阿里云控制台配置

### 6.4 验收标准

1. 使用真实手机号发送验证码
2. **手机必须真实收到短信**
3. 响应中不包含 `dev_code`
4. 只有真实短信验证码可登录
5. 错误验证码登录失败

---

## 7. 测试发送接口

接口为 **POST**，手机号为 **Query 参数**（不是 JSON body）：

```bash
curl -X POST "http://你的域名或IP:8000/auth/sms/send?phone=13800138000"
```

成功返回：`{"success": true}`。若未配置或发送失败，会返回 500 及错误信息。

---

> **文档关系**：
> - 本文档为短信配置的完整说明（开发/生产）
> - 短信排障请查阅 [SMS_TROUBLESHOOTING.md](./SMS_TROUBLESHOOTING.md)
> - 本文档已吸收原 [SMS_PRODUCTION_DEPLOYMENT.md](./archive/2026-03-sms-fix/SMS_PRODUCTION_DEPLOYMENT.md) 中的生产环境强制配置内容
