/**
 * auth-api 基准地址（与后端约定唯一配置）
 * 所有登录/注册请求必须使用本常量拼接：POST ${API_BASE}/login、POST ${API_BASE}/register
 * 后端仅支持无 /auth 前缀：/login、/register
 * 应急回退：生产环境暂时走旧直连地址；开发环境默认走本地地址
 */
export const AUTH_API_BASE =
  import.meta.env.VITE_AUTH_API_BASE_URL ||
  (import.meta.env.PROD ? 'http://121.41.179.197:8000' : 'http://localhost:8000')
