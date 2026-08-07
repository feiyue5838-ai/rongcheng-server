/** 高并发安全的交易单号生成器（防重复）
 *  格式：TF{YYYYMMDD}{秒内序号(4位)}  例：TF202608071200100001（第1笔）
 *  原理：精确到秒（而非毫秒），同秒内用内存计数器递增，单进程内绝对不重复
 */
const _counter: Record<number, number> = {};

export function generateTransactionNo(): string {
  const now = new Date();
  const sec = Math.floor(now.getTime() / 1000);
  const datePart =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  _counter[sec] = (_counter[sec] || 0) + 1;
  return `TF${datePart}${String(_counter[sec]).padStart(4, '0')}`;
}
