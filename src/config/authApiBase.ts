/**
 * auth-api 基准地址（与后端约定唯一配置）
 * 所有登录/注册请求必须使用本常量拼接：POST ${API_BASE}/login、POST ${API_BASE}/register
 * 后端仅支持无 /auth 前缀：/login、/register
 * 生产环境默认走 HTTPS 域名；开发环境默认走本地地址
 */
export const AUTH_API_BASE =
  import.meta.env.VITE_AUTH_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://auth.xiuer.work' : 'http://dev-api-placeholder')
