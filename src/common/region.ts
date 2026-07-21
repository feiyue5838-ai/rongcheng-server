// 省份 -> 大区 映射（方案A：派生，不入库）
// 共8大区，覆盖34省级行政区 + 港澳台
// 注：键名必须与 outlets.province 字段实际值完全一致
export const REGION_MAP: Record<string, string> = {
  '北京市': '华北', '天津市': '华北', '河北省': '华北', '山西省': '华北', '内蒙古自治区': '华北',
  '辽宁省': '东北', '吉林省': '东北', '黑龙江省': '东北',
  '上海市': '华东', '江苏省': '华东', '浙江省': '华东', '安徽省': '华东', '福建省': '华东', '江西省': '华东', '山东省': '华东',
  '河南省': '华中', '湖北省': '华中', '湖南省': '华中',
  '广东省': '华南', '广西壮族自治区': '华南', '海南省': '华南',
  '重庆市': '西南', '四川省': '西南', '贵州省': '西南', '云南省': '西南', '西藏自治区': '西南',
  '陕西省': '西北', '甘肃省': '西北', '青海省': '西北', '宁夏回族自治区': '西北', '新疆维吾尔自治区': '西北',
  // 港澳台独立分区
  '香港': '港澳台', '澳门': '港澳台', '台湾': '港澳台',
};

export const REGIONS: string[] = [
  '华北', '东北', '华东', '华中', '华南', '西南', '西北', '港澳台',
];

export function provinceToRegion(p?: string | null): string {
  if (!p) return '未知';
  return REGION_MAP[p] || '未知';
}

export function getProvincesByRegion(region: string): string[] {
  if (region === '未知') return Object.keys(REGION_MAP).filter(k => !REGION_MAP[k]);
  return Object.keys(REGION_MAP).filter(k => REGION_MAP[k] === region);
}
