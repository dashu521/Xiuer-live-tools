# 服务器 121.41.179.197 登录说明

## 现象
- `ssh root@121.41.179.197` 没反应：实际是 SSH 在用 `~/.ssh/cursor_deploy` 做密钥登录，但该文件无法作为私钥使用，认证卡住。
- 你本机配置里该主机用的是 **deploy** 用户（不是 root），密钥同上。

## 方法一：用密码登录（临时跳过密钥）

在终端执行（会提示输入**密码**，输入时无回显，输完回车即可）：

```bash
ssh -o PubkeyAuthentication=no root@121.41.179.197
```

若 root 不能密码登录，试 deploy 用户：

```bash
ssh -o PubkeyAuthentication=no deploy@121.41.179.197
```

登录成功后，在服务器上执行诊断：

```bash
cd /opt/auth-api && docker compose ps -a && echo "--- api 日志 ---" && docker compose logs --tail=150 api
```

把输出发给我即可继续排查 503。

## 方法二：修好密钥后再用密钥登录

1. 确认私钥文件是「私钥」而不是公钥：
   - 私钥内容应以 `-----BEGIN OPENSSH PRIVATE KEY-----` 或 `-----BEGIN RSA PRIVATE KEY-----` 开头。
   - 若 `cursor_deploy` 是 `.pub` 内容或只有一行，说明是公钥，需要把对应的**私钥**放到 `~/.ssh/cursor_deploy`。

2. 权限设为仅本人可读：
   ```bash
   chmod 600 ~/.ssh/cursor_deploy
   ```

3. 再试：
   ```bash
   ssh root@121.41.179.197
   # 或
   ssh deploy@121.41.179.197
   ```

## 若 deploy 有 sudo、想用 root 权限跑 docker

登录后执行：
```bash
sudo -i
cd /opt/auth-api && docker compose ps -a && docker compose logs --tail=150 api
```
