/**
 * A-02/A-03: JWT 密钥配置
 * A-02: 生产环境必须配置有效密钥，启动 fail-fast
 * A-03: 为三类主体（user/admin/Outlet）分别配置独立密钥，从密码学层面隔离
 *   - JWT_SECRET       → 用户 token（wxLogin）
 *   - JWT_SECRET_ADMIN → 管理员 token（adminLogin）
 *   - JWT_SECRET_OUTLET→ 网点 token（storeLogin）
 * 三类主体共用一个密钥时，任何 Strategy 忘记校验 type 字段即产生跨端令牌混用漏洞。
 * 分离后即使忘记校验 type，攻击者也无法用 user token 访问 admin 接口（密钥不匹配）。
 */

function getJwtSecret(envKey: string, displayName: string): string {
  const val = process.env[envKey];
  if (!val || val.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[JWT] ${displayName} 未配置或强度不足（要求 >=32 字符）。请在 .env 中设置 ${envKey}=<随机字符串>`,
      );
    }
    console.warn(`[JWT] ⚠️  未配置 ${envKey}，使用硬编码兜底（仅开发环境允许）`);
    // 开发环境用独立默认值，防止不同主体密钥相同
    const defaults: Record<string, string> = {
      JWT_SECRET: 'dev-user-jwt-secret-min-32-chars-abcdef',
      JWT_SECRET_ADMIN: 'dev-admin-jwt-secret-min-32-chars-ghijkl',
      JWT_SECRET_OUTLET: 'dev-outlet-jwt-secret-min-32-chars-mnopqr',
    };
    return defaults[envKey] || 'dev-fallback-jwt-secret-32chars-min';
  }
  return val;
}

export const JWT_SECRET = getJwtSecret('JWT_SECRET', 'JWT_SECRET（用户令牌）');
export const JWT_SECRET_ADMIN = getJwtSecret('JWT_SECRET_ADMIN', 'JWT_SECRET_ADMIN（管理员令牌）');
export const JWT_SECRET_OUTLET = getJwtSecret('JWT_SECRET_OUTLET', 'JWT_SECRET_OUTLET（网点令牌）');
