# 收不到验证码排查说明

之前短信正常、服务器已部署好，现在又收不到验证码，常见原因与排查步骤如下。

## 可能原因概览

| 情况 | 可能原因 | 如何确认 |
|------|----------|----------|
| 1. 容器内没有阿里云环境变量 | 重新部署时未带 `.env`，或 `.env` 被覆盖/丢失 | 在服务器上执行下方「步骤 1」看 `configured` |
| 2. 阿里云侧失败 | 配额、签名/模板过期、号码限制等 | 看 auth-api 日志中的 `[SMS]` 报错 |
| 3. 服务未用最新代码 | 仍为旧版，发送失败时直接 500，前端拿不到兜底验证码 | 重新构建镜像并部署，再测 |
| 4. 前端请求不到接口 | 基址错误、网络/防火墙 | 浏览器控制台看请求是否 200、响应内容 |

## 在服务器上执行的排查步骤

### 步骤 1：看当前短信配置是否进容器

在**服务器**上（能访问到 api 的机器）：

```bash
curl -s http://127.0.0.1:8000/auth/sms/status
```

若从外网访问，把 `127.0.0.1:8000` 换成你的域名或 IP:端口。

- **`configured: true`**：说明 `SMS_MODE` 与四项 `ALIYUN_*` 已传入容器，可继续看步骤 2。
- **`configured: false`**：说明容器里没有正确拿到阿里云配置，**这是最常见原因**。
  - 到**执行 `docker compose` 的目录**（如 `deploy/` 或 `/opt/auth-api`）确认存在 `.env`。
  - `.env` 中要有：`SMS_MODE=aliyun_dypns`、`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`、`ALIYUN_SMS_SIGN_NAME`、`ALIYUN_SMS_TEMPLATE_CODE`。
  - 修改后执行：`docker compose up -d --force-recreate api`，再测发送验证码。

### 步骤 2：看 api 日志里短信发送结果

发送一次验证码后，在服务器上看 api 容器日志：

```bash
docker compose logs api --tail 100 2>&1 | grep -E '\[SMS\]'
```

- 出现 **`[SMS] 短信认证发送成功`**：说明服务端已调用阿里云成功，若手机仍收不到，多半是运营商/阿里云侧或号码问题。
- 出现 **`[SMS] 短信认证发送失败`** 或 **`发送异常`**：后面会带阿里云返回的 message，按报错查阿里云控制台（签名、模板、配额、号码限制等）。
- 出现 **`[SMS][DEV]`** 或 **`Dev mode enabled`**：说明当前跑的是 dev 模式，没有真实发短信，需按步骤 1 把阿里云配置进容器。

### 步骤 3：用脚本快速查一遍（可选）

在 **deploy 目录**下：

```bash
chmod +x check-sms.sh
./check-sms.sh http://127.0.0.1:8000
```

会把「状态接口」和「需要检查的配置项」打出来。

## 确保部署时带上 .env

- `docker-compose.yml` 里已用 `SMS_MODE=${SMS_MODE:-aliyun_dypns}` 和 `${ALIYUN_ACCESS_KEY_ID:-}` 等形式从**环境**读配置。
- 在**执行 `docker compose` 的目录**放 `.env` 后，Compose 会自动把 `.env` 里的变量注入到该 shell，再传给容器。
- 若用 `docker compose -f deploy/docker-compose.yml up -d`，要在**当前目录**有 `.env`，或在 `deploy` 下执行并在 `deploy` 下放 `.env`。

## 小结

- **之前正常、现在收不到**：优先检查服务器上是否还有 `.env`、是否在正确目录执行 `docker compose`、是否在改完配置后做了 `docker compose up -d --force-recreate api`。
- 用 `GET /auth/sms/status` 看 `configured` 是否为 true，用 api 日志里的 `[SMS]` 判断是「未配置」「阿里云报错」还是「发送成功但手机未收到」。
