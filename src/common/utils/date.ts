/**
 * 日期参数校验工具（F-12）
 * 防止无效日期字符串传入导致 Invalid Date 或数据库错误
 */

/** 校验并解析 YYYY-MM-DD 格式日期，失败返回 null 或抛 400 */
export function parseDateParam(dateStr: string | undefined, paramName: string): Date | null {
  if (!dateStr) return null;
  // 严格校验 ISO 格式：YYYY-MM-DD
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) {
    throw new Error(`${paramName} 格式错误，应为 YYYY-MM-DD（例如 2024-01-15），实际收到：${dateStr}`);
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`${paramName} 无效日期：${dateStr}`);
  }
  return d;
}

/** 解析带时间的 ISO 字符串，返回 Date（校验失败抛错，由全局异常过滤器返回 400） */
export function parseDateTimeParam(dateStr: string | undefined, paramName: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new Error(`${paramName} 无效日期格式：${dateStr}`);
  }
  return d;
}
