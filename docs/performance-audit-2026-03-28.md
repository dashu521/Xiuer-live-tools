# 秀儿直播助手性能专项审计报告

- 审计日期：2026-03-28
- 审计范围：Electron 主进程任务编排、`auth-api` 服务、配置同步、消息流、发布门禁
- 原始数据：
  - `tmp/perf-audit/auth-api-audit-2026-03-28T08-36-04-325Z.json`
  - `tmp/perf-audit/task-manager-benchmark-2026-03-28T08-22-58-933Z.json`

## 1. 总体结论

当前版本具备基本可用性，但距离“高负载和异常场景下仍稳定可靠运行”的目标还有明显差距，结论为：

- `auth-api` 读路径里，`/health` 和 `/config` 表现良好，但 `/status` 明显偏慢，CPU 饱和明显。
- `config/sync` 在首次并发写场景下会稳定触发 `500`，属于数据一致性和可靠性缺陷。
- Electron `TaskManager` 吞吐本身不差，但存在同账号同任务重复启动的竞态窗口。
- 服务故障恢复时间约 2.21s，但恢复前几乎所有请求都会失败；当前部署形态没有负载均衡和高可用兜底。
- SSE 消息流具备基础实现，但当前架构是进程内事件总线，无法支撑多实例横向扩展。

## 2. 审计环境与方法

### 2.1 环境

- 本地工作区：`/Users/xiuer/Project Directory/Xiuer-live-tools`
- Node：`v20.20.1`
- `auth-api`：单 worker `uvicorn`
- 数据库：SQLite（审计临时库）
- 说明：`ps` 的 `%CPU` 为多核累计值，因此可能超过 `100%`

### 2.2 已执行检查

- `npm test`：14 个测试文件、104 个用例全部通过；总耗时 `1.10s`；最大 RSS `160MB`
- `npm run typecheck`：通过；总耗时 `5.61s`；最大 RSS `676MB`
- `npm run auth:test`：通过；总耗时 `6.21s`；最大 RSS `100MB`
- `npm run lint`：失败，原因为现有脏工作区里 `electron/main/app.ts` 的格式差异
- `npm run build`：构建流程会因缺失 `VITE_AUTH_API_BASE_URL` / `AUTH_STORAGE_SECRET` 被 `scripts/generate-build-config.js` 阻断

### 2.3 已执行专项测试

- 负载测试：`/health`、`/status`、`/config`、`/config/sync`、`/login`
- 稳定性测试：30 秒混合读写 soak
- 故障注入：`auth-api` 进程硬杀后重启
- 并发一致性测试：`config/sync` 首次并发写入
- 前端并发基准：`TaskManager` 100 账号、300 个任务启动/停止，以及重复启动竞态

### 2.4 二阶段待补测试

- 真实多账号浏览器会话压测：5/10/20 账号，采集 Chrome 实例 CPU、RSS、I/O、网络
- MySQL/RDS 环境复测：验证 SQLite 与 MySQL 的差异
- 反向代理与多实例 SSE 复测：Nginx/SLB/多 worker 下的消息广播一致性
- 长稳测试：2 小时以上 soak + 网络抖动 + 数据库重启

## 3. 预设基准与实测结果

| 场景 | 基准 | 实测 | 结论 |
| --- | --- | --- | --- |
| `/health` 50 并发 | p95 <= 60ms，错误率 <= 1% | p95 `21.79ms`，错误率 `0`，`2732 rps` | 通过 |
| `/status` 20 并发 | p95 <= 120ms，错误率 <= 1% | p95 `383.94ms`，错误率 `0`，`70.42 rps` | 不通过 |
| `/config` 20 并发 | p95 <= 120ms，错误率 <= 1% | p95 `37.39ms`，错误率 `0`，`709.92 rps` | 通过 |
| `/config/sync` 12 并发 | p95 <= 220ms，错误率 <= 2% | p95 `97.22ms`，错误率 `4.17%`，`342.43 rps` | 不通过 |
| `/login` 20 并发 | p95 <= 450ms，错误率 <= 2% | p95 `390.11ms`，错误率 `0`，`67.39 rps` | 通过 |
| 30 秒混合 soak | p95 <= 250ms，可用性 >= 99% | p95 `208.93ms`，错误率 `0`，可用性 `100%` | 通过 |
| 进程硬杀恢复 | 恢复 <= 5s，可用性 >= 90% | 恢复 `2.21s`，可用性 `0.49%` | 恢复快，但无 HA |

### 3.1 资源利用率

- `auth-api` 内存：
  - `/health` 压测时 RSS 约 `99MB`
  - `/status` / `/login` 压测时 RSS 峰值约 `112MB`
- `auth-api` CPU：
  - `/status` 平均 `1443%`，峰值 `1498%`
  - `/login` 平均 `1368%`，峰值 `1494%`
  - 说明：读路径已呈明显 CPU 绑定
- 磁盘写入代理指标：
  - `login` 突发压测期间 SQLite 文件增长 `110592 bytes`
  - `config/sync`/soak 阶段库文件大小不明显增长，属于覆盖式更新
- 网络吞吐代理指标：
  - `/status`：约 `67.8 KB/s`
  - `/login`：约 `69.1 KB/s`
  - 混合 soak：约 `61.5 KB/s`

### 3.2 前端任务编排基准

- 100 账号、300 个任务 synthetic 启停：
  - 启动总耗时 `9.88ms`
  - 停止总耗时 `6.24ms`
  - 启动 p95 `6.02ms`
  - 停止 p95 `3.78ms`
- 但重复启动竞态测试显示：
  - 同账号同任务并发 `start()` 5 次
  - 5 次全部成功
  - 同时进入 `start()` 的最大并发数为 `5`
  - 结论：存在重复启动竞态，吞吐通过但可靠性不通过

## 4. 关键问题清单

### P0：`config/sync` 首次并发写会触发 `500`

- 证据：
  - 审计脚本 `config-write` 场景 `240` 次请求中有 `10` 次 `500`
  - 复现实验 `40` 个并发首次写请求中，`31` 次成功、`9` 次 `500`
  - 服务端栈显示 `UNIQUE constraint failed: user_configs.user_id`
- 根因：
  - [`auth-api/routers/config.py`](auth-api/routers/config.py) 第 `59-74` 行先查后插
  - [`auth-api/models.py`](auth-api/models.py) 第 `142-149` 行对 `user_id` 加了唯一约束
  - 多个请求同时看到“记录不存在”后并发 `INSERT`，最终撞唯一键
- 影响：
  - 配置云同步在首次写入或数据被清理后会随机报错
  - 多设备并发登录/切换时容易放大为用户可见故障

### P1：`/status` 读路径 CPU 过高，响应时间不达标

- 证据：
  - p95 `383.94ms`，吞吐仅 `70.42 rps`
  - CPU 平均 `1443%`，峰值 `1498%`
- 根因定位：
  - [`auth-api/routers/auth.py`](auth-api/routers/auth.py) 第 `89-125` 行每次都会查询订阅和试用信息
  - [`auth-api/routers/auth.py`](auth-api/routers/auth.py) 第 `164` 行每次调用 `bcrypt.checkpw` 判断 `has_password`
  - [`auth-api/deps.py`](auth-api/deps.py) 第 `177-193` 行认证后还会查用户，并在 60 秒窗口外执行一次 `commit`
- 影响：
  - 用户中心/鉴权态刷新的峰值能力不足
  - CPU 很容易先于内存成为瓶颈

### P1：`TaskManager` 存在重复启动竞态

- 证据：
  - synthetic 并发测试中，同任务同账号并发启动 5 次，5 次全部成功
- 根因：
  - [`src/tasks/TaskManager.ts`](src/tasks/TaskManager.ts) 第 `158-189` 行在 `await task.start(ctx)` 成功后才把状态置为 `running`
  - 启动过程缺少账号级别或任务级别的 in-flight 锁
- 影响：
  - 用户双击、热键重复触发、IPC 重入时可能导致同一任务重复订阅事件或重复发起副作用

### P1：当前部署不具备高可用和有效负载均衡

- 证据：
  - 故障注入里恢复时间约 `2.21s`，但恢复前请求可用性仅 `0.49%`
  - [`deploy/docker-compose.yml`](deploy/docker-compose.yml) 第 `8-39` 行只有单个 `api` 实例，没有副本、没有 upstream、没有 LB 健康剔除
- 根因：
  - 当前部署模型是单实例 + 本地/单 MySQL 服务
  - 缺少熔断、重试、切流、热备
- 影响：
  - 单进程崩溃、发布重启、宿主机抖动都会让在线请求直接失败

### P1：SSE 消息流无法横向扩展

- 证据：
  - [`auth-api/routers/messages.py`](auth-api/routers/messages.py) 第 `28-56` 行的 `AnnouncementStreamHub` 是进程内事件对象
  - [`auth-api/routers/messages.py`](auth-api/routers/messages.py) 第 `270-303` 行 `stream_messages()` 直接依赖同进程 `stream_hub`
- 根因：
  - 没有 Redis / MQ / DB NOTIFY 这类跨实例广播层
- 影响：
  - 多 worker、多实例或未来接入负载均衡后，客户端可能连到不同实例，消息变更无法一致广播
  - 当前 SSE 指标只能在单实例内做局部验证，无法形成真实生产 SLA

### P2：健康检查过浅，无法反映真实可用性

- 证据：
  - [`auth-api/main.py`](auth-api/main.py) 第 `68-70` 行 `/health` 仅返回 `{ "ok": true }`
- 影响：
  - 数据库断连、迁移失败、消息流异常时，健康检查仍可能返回成功
  - LB 或监控系统会误判服务健康

### P2：Electron 会话模型按账号启动完整浏览器，资源随账号数线性增长

- 证据：
  - [`electron/main/managers/BrowserSessionManager.ts`](electron/main/managers/BrowserSessionManager.ts) 第 `73-162` 行每次 `createSession()` 都先 `chromium.launch()`，再建 `context` 和 `page`
- 影响：
  - 5/10/20 账号扩容时，CPU、内存、句柄数会线性放大
  - 当前仓库没有浏览器池、上下文复用或硬性资源上限

### P2：构建门禁依赖人工环境变量，发布稳定性受环境影响

- 证据：
  - [`scripts/generate-build-config.js`](scripts/generate-build-config.js) 第 `18-62` 行要求 `VITE_AUTH_API_BASE_URL` 和 `AUTH_STORAGE_SECRET`
  - 本次 `npm run build` 在产物已生成后被配置校验拦截
- 影响：
  - 不是运行时性能缺陷，但属于发布链路可靠性风险
  - 环境变量不齐时，CI/CD 或本地发布会在后段失败

## 5. 瓶颈定位

### 5.1 服务端热点

- `/status` 的主要瓶颈不是网络，而是 CPU：
  - 订阅表查询
  - trials 表查询
  - `bcrypt.checkpw` 计算
  - access session 与用户查询
- `config/sync` 的主要瓶颈不是延迟，而是首次并发创建的写冲突
- 故障注入中恢复时间尚可，但因为没有上游兜底，恢复前几乎所有请求都会超时

### 5.2 桌面端热点

- `TaskManager` 更像“可靠性竞态”而不是吞吐瓶颈
- 浏览器会话模型才是桌面端的真实容量边界，当前缺少真实多账号压测数据

## 6. 优化建议与实施优先级

### P0：一周内完成

1. 将 `config/sync` 改为真正的原子 upsert
   - SQLite：`INSERT ... ON CONFLICT(user_id) DO UPDATE`
   - MySQL：`INSERT ... ON DUPLICATE KEY UPDATE`
   - 对 `IntegrityError` 做降级重试，不能裸 `500`
2. 为配置同步增加版本号或更新时间戳校验
   - 至少做到“最后写入者可见”
   - 更好是乐观锁冲突提示

### P1：两周内完成

1. 重构 `/status`
   - 去掉每次请求的 `bcrypt.checkpw`
   - 合并/缓存订阅与试用信息
   - 视情况给 `build_user_status_response` 加请求级缓存或预计算字段
2. 为 `TaskManager.start()` 增加 in-flight 锁
   - 粒度建议：`accountId + taskId`
   - 启动中状态建议单独引入 `starting`
3. 为 `auth-api` 增加高可用兜底
   - 最少双实例
   - 前置反向代理/SLB 健康检查与重试
   - 发布采用滚动或蓝绿
4. 将 SSE 广播改成共享消息总线
   - Redis pub/sub、数据库通知或专用消息服务

### P2：一个月内完成

1. 扩展 `/health`
   - 数据库连通性
   - 关键表读写
   - SSE/后台任务就绪态
2. 增强可观测性
   - Prometheus 指标：响应时间、错误率、活跃连接、DB 时延、SSE 连接数
   - 请求链路日志统一带 `request_id`
3. 做真实多账号浏览器压测
   - 5/10/20 账号，分别测 headless/headed
   - 采集 CPU、RSS、磁盘 I/O、网络带宽、浏览器崩溃率

## 7. 推荐测试方案

### 7.1 压力测试

- `auth-api`
  - `/status`：20/50/100 并发，持续 60 秒
  - `/config/sync`：首次写 / 已有记录写 / 多设备交替写三类场景
  - `/messages/stream`：20/50/100 长连接
- Electron
  - 5/10/20 账号同时连接中控台
  - 同时开启自动回复、自动发言、数据监控

### 7.2 负载测试

- 以“正常高峰”建模：
  - 80% 读请求，20% 写请求
  - 30 分钟持续运行
  - 观察 p95、错误率、内存曲线是否平稳

### 7.3 稳定性测试

- `auth-api` + MySQL/RDS 环境做 2 小时 soak
- Electron 多账号真实浏览器场景做 1 小时 soak
- 重点记录：
  - 内存是否持续上升
  - SSE 是否掉线
  - 浏览器句柄与子进程数量是否泄漏

### 7.4 故障注入测试

- 杀掉 `auth-api` 进程
- 重启 MySQL / 断开数据库连接
- 人为增加 500ms/1000ms 网络延迟
- 反向代理切走一个实例
- 桌面端关闭单账号浏览器 / 模拟 page crash / 模拟 token 失效

## 8. 审计结论

当前版本最紧急的问题不是绝对吞吐，而是“并发一致性”和“高可用缺口”：

- `config/sync` 已经在实测中证实会因并发首写报 `500`
- `TaskManager` 已经在基准中证实存在重复启动竞态
- `/status` 已经在读压测中证实 CPU 过高、延迟不达标
- `auth-api` 恢复速度尚可，但当前没有任何负载均衡或高可用保护，异常期间几乎全量失败

在完成 P0/P1 整改前，不建议把当前版本视为“已通过高负载与异常场景稳定性审计”。
