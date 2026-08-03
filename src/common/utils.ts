/**
 * 省份名称归一化匹配（处理"内蒙古"vs"内蒙古自治区"等情况）
 */
export function provincesMatch(addrProv: string, areaProv: string): boolean {
  if (!addrProv || !areaProv) return false;
  const a = addrProv.trim();
  const b = areaProv.trim();
  if (a === b) return true;
  // 去除"省/自治区/市/特别行政区"后缀
  const norm = (s: string) => s.replace(/省|自治区|特别行政区|市$/g, '').trim();
  return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
}
