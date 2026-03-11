# 阿里云 CDN 配置指南

## 目标架构

```
用户 → download.xiuer.work → 阿里云 CDN → OSS Bucket (xiuer-live-tools-download)
```

## 前置条件

- OSS Bucket: `xiuer-live-tools-download`
- OSS Endpoint: `oss-cn-hangzhou.aliyuncs.com`
- 域名: `xiuer.work`（已在万网/阿里云解析）

---

## 步骤 1：在阿里云 CDN 控制台创建加速域名

### 1.1 登录阿里云 CDN 控制台
- 地址: https://cdn.console.aliyun.com/

### 1.2 添加域名
点击【域名管理】→【添加域名】

填写以下信息：

| 字段 | 值 |
|------|-----|
| 加速域名 | `download.xiuer.work` |
| 业务类型 | 静态加速 |
| 源站信息 | OSS 域名 |
| 源站地址 | `xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com` |
| 端口 | 80（HTTP）或 443（HTTPS）|

### 1.3 开启 HTTPS（推荐）
在域名配置中：
1. 点击【HTTPS 配置】
2. 开启【HTTPS 安全加速】
3. 选择证书：
   - 选项 A：申请免费证书（阿里云自动申请）
   - 选项 B：上传已有证书（如果有 xiuer.work 通配符证书）
4. 开启【强制跳转 HTTPS】

### 1.4 记录 CNAME
添加完成后，CDN 会分配一个 CNAME 地址，形如：
```
download.xiuer.work.w.kunlunsl.com
```

**复制这个 CNAME，下一步需要用到。**

---

## 步骤 2：在万网 DNS 配置解析

### 2.1 登录阿里云域名控制台
- 地址: https://dc.console.aliyun.com/

### 2.2 添加 CNAME 记录
找到 `xiuer.work` 域名，点击【解析】

添加记录：

| 字段 | 值 |
|------|-----|
| 记录类型 | CNAME |
| 主机记录 | download |
| 记录值 | [步骤 1.4 获取的 CNAME] |
| TTL | 默认（10分钟）|

### 2.3 保存并等待生效
DNS 生效通常需要 10-30 分钟。

---

## 步骤 3：验证配置

### 3.1 验证 DNS 解析
```bash
# 方法 1
nslookup download.xiuer.work

# 方法 2
dig download.xiuer.work

# 期望结果：返回 CDN CNAME（包含 alicdn.com 或 kunlun...）
```

### 3.2 验证 HTTP 访问
```bash
# 测试访问（此时可能 404，因为 OSS 中还没有文件）
curl -I https://download.xiuer.work/releases/v1.2.2/

# 期望看到：
# HTTP/1.1 404 Not Found 或 200 OK
# Server: AliyunOSS 或 Via: CDN
```

### 3.3 验证 OSS 直连
```bash
curl -I https://xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com/releases/v1.2.2/

# 期望看到：
# HTTP/1.1 404 Not Found
# Server: AliyunOSS
```

---

## 步骤 4：触发 GitHub CI 上传文件

推送一个新 tag，CI 会自动上传文件到 OSS：

```bash
git tag v1.2.2
git push origin v1.2.2
```

等待 CI 完成，然后验证：

```bash
# 验证 CDN 访问
curl -I https://download.xiuer.work/releases/v1.2.2/latest.yml

# 验证 OSS 直连
curl -I https://xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com/releases/v1.2.2/latest.yml
```

---

## 常见问题

### Q1: DNS 解析不生效？
- 检查 CNAME 记录是否正确
- 等待 30 分钟以上
- 清除本地 DNS 缓存：`sudo killall -HUP mDNSResponder`

### Q2: HTTPS 证书错误？
- 确认证书已正确绑定到 CDN 域名
- 检查证书是否过期
- 尝试重新申请免费证书

### Q3: 访问返回 403？
- 检查 OSS Bucket 权限是否为 public-read
- 检查 CDN 回源配置是否正确

### Q4: 文件未找到（404）？
- 确认 GitHub CI 已成功上传
- 检查路径是否正确：`/releases/v1.2.2/`
- 直接访问 OSS 验证文件是否存在

---

## 配置检查清单

- [ ] CDN 域名已创建: `download.xiuer.work`
- [ ] 源站配置为 OSS: `xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com`
- [ ] HTTPS 已开启
- [ ] DNS CNAME 已添加
- [ ] DNS 已生效（nslookup 返回 CDN CNAME）
- [ ] 文件已上传到 OSS
- [ ] CDN 访问正常
- [ ] 自动更新 URL 已更新

---

## 相关文件

- `electron/config/download.ts` - 下载配置
- `.github/workflows/build-windows.yml` - CI 上传配置
- `electron-builder.json` - 自动更新配置

---

## 下载地址示例

配置完成后，用户可通过以下地址下载：

```
# CDN 加速地址（推荐）
https://download.xiuer.work/releases/v1.2.2/Xiuer-Live-Assistant_1.2.2_win-x64.exe

# OSS 直连地址（备用）
https://xiuer-live-tools-download.oss-cn-hangzhou.aliyuncs.com/releases/v1.2.2/Xiuer-Live-Assistant_1.2.2_win-x64.exe

# 自动更新地址
https://download.xiuer.work/releases/latest/latest.yml
```
