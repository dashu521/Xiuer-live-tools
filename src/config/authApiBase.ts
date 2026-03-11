/**
 * auth-api 基准地址（与后端约定唯一配置）
 * 所有登录/注册请求必须使用本常量拼接：POST ${API_BASE}/login、POST ${API_BASE}/register
 * 后端仅支持无 /auth 前缀：/login、/register
 * 生产环境从环境变量读取
 */
export const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE_URL || 'http://localhost:8000'
