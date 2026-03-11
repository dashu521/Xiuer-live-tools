# 修复 MySQL 退出并恢复 auth-api

## 当前状态（从你截图）
- **auth-api-mysql-1**：Exited (255) — MySQL 已退出
- **auth-api-api-1**：依赖 MySQL，MySQL 不健康时 api 无法正常跑 → 503

## 在服务器上按顺序执行

### 1. 看 MySQL 为什么退出
```bash
cd /opt/auth-api
docker compose logs --tail=80 mysql
```
把输出发给我，便于判断是内存、配置还是数据问题。

### 2. 重新启动所有服务
```bash
docker compose up -d
```
等约 30 秒后执行：
```bash
docker compose ps -a
```
确认 mysql 和 api 都是 **Up**。

### 3. 若 MySQL 再次退出
执行：
```bash
docker compose logs mysql
```
把完整日志发给我。常见原因：内存不足、数据目录权限、端口 3306 被占用。

### 4. 验证接口
```bash
curl -s http://127.0.0.1:8000/health
```
应返回 `{"ok":true}`。然后可在浏览器再试「发送验证码」。
