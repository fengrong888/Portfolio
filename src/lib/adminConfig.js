// Cloudflare Worker 后台 API 地址（生产已启用）：
// 后台密码校验 / 数据读写全部走该 Worker，密码与 GitHub 令牌仅存 Worker Secret，前端不含任何明文。
// 更换地址：先部署新 Worker 并验证，再改这里；不要把任何 Secret 写进本文件。
export const ADMIN_API_URL = 'https://portfolio-admin.1205898527.workers.dev'
