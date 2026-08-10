/**
 * Q-03: 统一的大小写转换工具（从各 service 提取，避免重复实现）
 * 规则：
 *   - snake_case → camelCase
 *   - Prisma Decimal → Number
 *   - Date / Buffer → 保持原值
 *   - 数组 → 递归处理
 */

/** 将 snake_case 字符串转为 camelCase */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 深度递归转换：将数据库返回的 snake_case 对象转换为 camelCase
 * - 使用 Prisma Decimal 的 {s, e, d} 结构精确判断（比检查 toString 更安全）
 * - 注意：若对象有自定义 toString() 且返回纯数字字符串，会被误转 Number（这是已有行为，不做改动）
 */
export function toCamelDeep(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelDeep);
  if (obj instanceof Date) return obj;
  if (obj instanceof Buffer) return obj;
  // Prisma Decimal 精确判断（{s, e, d} 结构）
  if (typeof obj === 'object' && 's' in obj && 'e' in obj && 'd' in obj) {
    return Number(obj);
  }
  if (typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [snakeToCamel(k), toCamelDeep(v)])
  );
}
