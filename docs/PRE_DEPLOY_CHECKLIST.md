# 上线前验收清单（Pre-Deploy Checklist）

> **版本**: v1.2
> **最后更新**: 2026-03-24
> **状态**: 已固化
> **负责人**: TEAM
> **适用范围**: auth-api 生产部署 + 前端构建发布  

---

## 说明

本文档固化生产环境部署前必须核查的安全配置项。**任何一项未通过，禁止上线。**

---

## 一、安全核查项（必查）

### 1.1 JWT_SECRET 已配置

| 检查项 | 要求 | 检查命令/方法 | 状态 |
|--------|------|---------------|------|
| JWT_SECRET 已设置 | 非空，长度 ≥ 32 | `echo $JWT_SECRET` | [ ] |
| JWT_SECRET 强度 | 随机字符串，非默认值 | 人工确认 | [ ] |
| JWT_SECRET 未提交到仓库 | .env 文件在 .gitignore 中 | `git status` | [ ] |

**风险**: JWT_SECRET 为空或弱密钥可导致 token 被伪造，攻击者可冒充任意用户。

---

### 1.2 ADMIN_PASSWORD 已配置

| 检查项 | 要求 | 检查命令/方法 | 状态 |
|--------|------|---------------|------|
| ADMIN_PASSWORD 已设置 | 非空，长度 ≥ 8 | `echo $ADMIN_PASSWORD` | [ ] |
| ADMIN_PASSWORD 强度 | 包含大小写+数字+特殊字符 | 人工确认 | [ ] |
| ADMIN_PASSWORD 非默认值 | 不是 "admin"/"password" 等 | 人工确认 | [ ] |

**风险**: ADMIN_PASSWORD 为空或弱密码可导致管理后台被暴力破解。

---

### 1.3 CORS_ORIGINS 白名单配置

| 检查项 | 要求 | 检查命令/方法 | 状态 |
|--------|------|---------------|------|
| CORS_ORIGINS 已设置 | 具体域名，非 `*` | `echo $CORS_ORIGINS` | [ ] |
| 不包含通配符 | 值中无 `*` | 人工确认 | [ ] |
| 域名格式正确 | 以 http/https 开头 | 人工确认 | [ ] |

**风险**: CORS_ORIGINS="*" + allow_credentials=True 可导致 CSRF 攻击，攻击者可窃取用户 token。

**正确示例**:
```bash
# ✅ 正确
CORS_ORIGINS=https://xiuer.work,https://admin.xiuer.work

# ❌ 错误（禁止上线）
CORS_ORIGINS=*
CORS_ORIGINS=http://localhost:3000,*
```

---

## 二、前端构建发布核查

### 2.1 生产环境 API 地址配置

| 检查项 | 要求 | 检查命令/方法 | 状态 |
|--------|------|---------------|------|
| VITE_AUTH_API_BASE_URL 已设置 | 必须非空 | `echo $VITE_AUTH_API_BASE_URL` | [ ] |
| VITE_AUTH_API_BASE_URL 精确为 `https://auth.xiuer.work` | 精确值，不得为其他地址 | `echo $VITE_AUTH_API_BASE_URL` | [ ] |
| 不包含 localhost/127.0.0.1 | 禁止本地地址 | 人工确认 | [ ] |
| 不包含裸 IP 明文 HTTP | 禁止 `http://121.41.179.197:8000` 等 | 人工确认 | [ ] |
| AUTH_STORAGE_SECRET 已设置 | 32+ 字符随机字符串 | `echo $AUTH_STORAGE_SECRET` | [ ] |
| Release Guard 检查通过 | 无 BLOCKER 级别错误 | `npm run release:guard` | [ ] |

**生产环境 API 地址（已固化）**：
```bash
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work
export AUTH_STORAGE_SECRET=$(openssl rand -hex 32)
```

**风险**:
- 未设置生产 API 地址会导致 renderer fallback 到 `localhost:8000`，安装包无法连接生产服务器
- localhost fallback 进入发布包会导致生产环境无法正常使用
- Release Guard 会拦截未设置或使用本地地址的发布
- **安装包打完后必须取证验证**，不得仅凭 Release Guard 通过就认为合格

**正确示例**:
```bash
# ✅ 正确
export VITE_AUTH_API_BASE_URL=https://auth.xiuer.work

# ❌ 错误（禁止发布）
export VITE_AUTH_API_BASE_URL=https://<your-auth-api-domain>   # 占位符地址
export VITE_AUTH_API_BASE_URL=http://localhost:8000
export VITE_AUTH_API_BASE_URL=http://127.0.0.1:8000
export VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000
# 或未设置环境变量
```

### 2.2 构建产物取证检查（安装包验收）

> **重要**：构建完成后、发布前，必须执行以下取证检查。

| 检查项 | 要求 | 检查命令/方法 | 通过标准 | 状态 |
|--------|------|---------------|---------|------|
| renderer 产物中 API 地址为生产地址 | `dist/assets/` 中不含 localhost | `grep -r "localhost:8000" dist/assets/` | 无匹配 | [ ] |
| renderer 产物不含 fallback 残留 | `dist/assets/` 中不含 127.0.0.1 | `grep -r "127.0.0.1:8000" dist/assets/` | 无匹配 | [ ] |
| build-config.json 地址正确 | 主进程读取的地址正确 | `cat dist-electron/build-config.json` | `authApiBaseUrl` 为 `https://auth.xiuer.work` | [ ] |
| /health 运行时发往 auth.xiuer.work | 启动安装包验证 | DevTools Network 或抓包 | 请求发往 `https://auth.xiuer.work/health` | [ ] |

> **全部通过后，方可进入发布后续步骤**。任一项不通过，必须重新构建。

---

## 三、部署配置核查

### 3.1 环境变量完整性

| 变量名 | 是否必填 | 检查状态 |
|--------|----------|----------|
| DATABASE_URL | 是 | [ ] |
| JWT_SECRET | 是 | [ ] |
| ADMIN_USERNAME | 是（若使用管理后台） | [ ] |
| ADMIN_PASSWORD | 是（若使用管理后台） | [ ] |
| CORS_ORIGINS | 是 | [ ] |
| SMS_MODE | 否（默认 dev） | [ ] |
| ALIYUN_ACCESS_KEY_ID | 否（SMS_MODE=aliyun 时必填） | [ ] |
| ALIYUN_ACCESS_KEY_SECRET | 否（SMS_MODE=aliyun 时必填） | [ ] |

---

### 3.2 数据库配置

| 检查项 | 要求 | 状态 |
|--------|------|------|
| 生产环境使用 MySQL/RDS | 非 SQLite | [ ] |
| 数据库连接使用 SSL | 加密传输 | [ ] |
| 数据库凭据非 root | 专用账号 | [ ] |

---

## 四、代码质量门禁

### 4.1 CI 检查通过

| 检查项 | 命令 | 状态 |
|--------|------|------|
| Biome 代码检查 | `npx biome check .` | [ ] |
| TypeScript 类型检查 | `npx tsc --noEmit` | [ ] |
| 单元测试通过 | `npm test` | [ ] |
| Python 语法检查 | `python -m py_compile **/*.py` | [ ] |

---

## 五、验收签字

| 角色 | 签字 | 日期 |
|------|------|------|
| 开发负责人 | | |
| 运维负责人 | | |
| 安全负责人 | | |

---

## 六、快速检查脚本

```bash
#!/bin/bash
# 生产环境配置快速检查脚本
# 在部署服务器上运行

echo "=== 上线前配置检查 ==="

# 1. JWT_SECRET
echo -n "JWT_SECRET 已设置: "
if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -ge 32 ]; then
    echo "✅ 通过"
else
    echo "❌ 失败"
    exit 1
fi

# 2. ADMIN_PASSWORD
echo -n "ADMIN_PASSWORD 已设置: "
if [ -n "$ADMIN_PASSWORD" ] && [ ${#ADMIN_PASSWORD} -ge 8 ]; then
    echo "✅ 通过"
else
    echo "❌ 失败"
    exit 1
fi

# 3. CORS_ORIGINS
echo -n "CORS_ORIGINS 非通配符: "
if [ -n "$CORS_ORIGINS" ] && [[ "$CORS_ORIGINS" != *"*"* ]]; then
    echo "✅ 通过"
else
    echo "❌ 失败"
    exit 1
fi

# 4. DATABASE_URL
echo -n "DATABASE_URL 已设置: "
if [ -n "$DATABASE_URL" ]; then
    echo "✅ 通过"
else
    echo "❌ 失败"
    exit 1
fi

echo ""
echo "=== 所有检查通过，可以上线 ==="
```

---

## 七、历史记录

| 日期 | 版本 | 说明 | 签字 |
|------|------|------|------|
| 2026-03-15 | v1.0 | 初始版本，固化 JWT_SECRET/ADMIN_PASSWORD/CORS_ORIGINS 检查项 | - |
| 2026-03-18 | v1.1 | 添加前端构建发布核查章节，固化 VITE_AUTH_API_BASE_URL 生产地址检查项，明确禁止 localhost fallback 进入发布包 | - |
| 2026-03-24 | v1.2 | 生产 API 地址固化为 `https://auth.xiuer.work`（精确值，禁止占位符）；新增构建产物取证检查章节（2.2），要求构建后验证 renderer 和 main 进程实际地址；新增 AUTH_STORAGE_SECRET 必填检查 | - |
