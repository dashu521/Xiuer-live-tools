# 上线前验收清单（Pre-Deploy Checklist）

> **版本**: v1.0  
> **最后更新**: 2026-03-15  
> **状态**: 已固化  
> **负责人**: TEAM  
> **适用范围**: auth-api 生产部署  

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

## 二、部署配置核查

### 2.1 环境变量完整性

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

### 2.2 数据库配置

| 检查项 | 要求 | 状态 |
|--------|------|------|
| 生产环境使用 MySQL/RDS | 非 SQLite | [ ] |
| 数据库连接使用 SSL | 加密传输 | [ ] |
| 数据库凭据非 root | 专用账号 | [ ] |

---

## 三、代码质量门禁

### 3.1 CI 检查通过

| 检查项 | 命令 | 状态 |
|--------|------|------|
| Biome 代码检查 | `npx biome check .` | [ ] |
| TypeScript 类型检查 | `npx tsc --noEmit` | [ ] |
| 单元测试通过 | `npm test` | [ ] |
| Python 语法检查 | `python -m py_compile **/*.py` | [ ] |

---

## 四、验收签字

| 角色 | 签字 | 日期 |
|------|------|------|
| 开发负责人 | | |
| 运维负责人 | | |
| 安全负责人 | | |

---

## 五、快速检查脚本

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

## 六、历史记录

| 日期 | 版本 | 说明 | 签字 |
|------|------|------|------|
| 2026-03-15 | v1.0 | 初始版本，固化 JWT_SECRET/ADMIN_PASSWORD/CORS_ORIGINS 检查项 | - |
