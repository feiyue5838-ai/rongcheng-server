/**
 * seed_nationwide_stores.js
 * 全国合作门店数据初始化
 * 
 * 覆盖策略：
 * - 每个省会城市至少 1 家门店
 * - 重点经济城市额外加店
 * - 成都现有 6 家门店 serviceArea 扩展为四川省全域
 * - 其他新店按"本店所在城市"作为服务区域
 * 
 * 运行：node seed_nationwide_stores.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const STORE_PASSWORD = 'store123'; // 统一初始密码

// 全国省会 + 重点城市覆盖
const nationwideStores = [
  // ===== 四川省（成都市已有6家，这里补全省内其他城市服务区域，serviceArea 扩展到四川省全境）=====
  // 成都6家保持原样，serviceArea 扩展

  // ===== 华北地区 ===== 
  { name: '北京朝阳店',   contact: '张经理', phone: '13800001001', province: '北京市', city: '北京市', address: '朝阳区建国路88号', serviceAreas: [{ province: '北京市' }] },
  { name: '北京海淀店',   contact: '李经理', phone: '13800001002', province: '北京市', city: '北京市', address: '海淀区中关村大街1号', serviceAreas: [{ province: '北京市' }] },
  { name: '天津河西店',   contact: '王经理', phone: '13800001003', province: '天津市', city: '天津市', address: '河西区解放南路256号', serviceAreas: [{ province: '天津市' }] },
  { name: '石家庄店',     contact: '赵经理', phone: '13800001004', province: '河北省', city: '石家庄市', address: '长安区中山路128号', serviceAreas: [{ province: '河北省' }] },
  { name: '太原小店',     contact: '刘经理', phone: '13800001005', province: '山西省', city: '太原市', address: '小店区长风街68号', serviceAreas: [{ province: '山西省' }] },
  { name: '呼和浩特店',   contact: '陈经理', phone: '13800001006', province: '内蒙古自治区', city: '呼和浩特市', address: '新城区新华大街52号', serviceAreas: [{ province: '内蒙古自治区' }] },

  // ===== 东北地区 =====
  { name: '沈阳和平店',   contact: '杨经理', phone: '13800001007', province: '辽宁省', city: '沈阳市', address: '和平区太原街168号', serviceAreas: [{ province: '辽宁省' }] },
  { name: '大连中山店',   contact: '周经理', phone: '13800001008', province: '辽宁省', city: '大连市', address: '中山区人民路55号', serviceAreas: [{ province: '辽宁省', city: '大连市' }] },
  { name: '长春朝阳店',   contact: '吴经理', phone: '13800001009', province: '吉林省', city: '长春市', address: '朝阳区人民大街2800号', serviceAreas: [{ province: '吉林省' }] },
  { name: '哈尔滨南岗店', contact: '徐经理', phone: '13800001010', province: '黑龙江省', city: '哈尔滨市', address: '南岗区红军街48号', serviceAreas: [{ province: '黑龙江省' }] },

  // ===== 华东地区 =====
  { name: '上海浦东店',   contact: '孙经理', phone: '13800001011', province: '上海市', city: '上海市', address: '浦东新区陆家嘴环路1000号', serviceAreas: [{ province: '上海市' }] },
  { name: '上海静安店',   contact: '马经理', phone: '13800001012', province: '上海市', city: '上海市', address: '静安区南京西路1788号', serviceAreas: [{ province: '上海市' }] },
  { name: '南京鼓楼店',   contact: '朱经理', phone: '13800001013', province: '江苏省', city: '南京市', address: '鼓楼区中山北路188号', serviceAreas: [{ province: '江苏省' }] },
  { name: '苏州园区店',   contact: '胡经理', phone: '13800001014', province: '江苏省', city: '苏州市', address: '工业园区星海街200号', serviceAreas: [{ province: '江苏省', city: '苏州市' }] },
  { name: '杭州西湖店',   contact: '郭经理', phone: '13800001015', province: '浙江省', city: '杭州市', address: '西湖区文二路388号', serviceAreas: [{ province: '浙江省' }] },
  { name: '宁波鄞州店',   contact: '何经理', phone: '13800001016', province: '浙江省', city: '宁波市', address: '鄞州区首南中路1000号', serviceAreas: [{ province: '浙江省', city: '宁波市' }] },
  { name: '合肥庐阳店',   contact: '罗经理', phone: '13800001017', province: '安徽省', city: '合肥市', address: '庐阳区长江中路368号', serviceAreas: [{ province: '安徽省' }] },
  { name: '福州鼓楼店',   contact: '高经理', phone: '13800001018', province: '福建省', city: '福州市', address: '鼓楼区五一广场北路88号', serviceAreas: [{ province: '福建省' }] },
  { name: '厦门思明店',   contact: '林经理', phone: '13800001019', province: '福建省', city: '厦门市', address: '思明区鹭江道269号', serviceAreas: [{ province: '福建省', city: '厦门市' }] },
  { name: '南昌东湖店',   contact: '黄经理', phone: '13800001020', province: '江西省', city: '南昌市', address: '东湖区八一大道368号', serviceAreas: [{ province: '江西省' }] },
  { name: '济南历下店',   contact: '赵经理', phone: '13800001021', province: '山东省', city: '济南市', address: '历下区泉城路188号', serviceAreas: [{ province: '山东省' }] },
  { name: '青岛市南店',   contact: '吴经理', phone: '13800001022', province: '山东省', city: '青岛市', address: '市南区香港中路68号', serviceAreas: [{ province: '山东省', city: '青岛市' }] },
  { name: '郑州金水店',   contact: '周经理', phone: '13800001023', province: '河南省', city: '郑州市', address: '金水区花园路128号', serviceAreas: [{ province: '河南省' }] },

  // ===== 华中地区 =====
  { name: '武汉江汉店',   contact: '徐经理', phone: '13800001024', province: '湖北省', city: '武汉市', address: '江汉区解放大道688号', serviceAreas: [{ province: '湖北省' }] },
  { name: '长沙芙蓉店',   contact: '孙经理', phone: '13800001025', province: '湖南省', city: '长沙市', address: '芙蓉区五一大道388号', serviceAreas: [{ province: '湖南省' }] },

  // ===== 华南地区 =====
  { name: '广州天河店',   contact: '马经理', phone: '13800001026', province: '广东省', city: '广州市', address: '天河区天河路123号', serviceAreas: [{ province: '广东省' }] },
  { name: '广州越秀店',   contact: '王经理', phone: '13800001027', province: '广东省', city: '广州市', address: '越秀区东风中路388号', serviceAreas: [{ province: '广东省', city: '广州市' }] },
  { name: '深圳福田店',   contact: '李经理', phone: '13800001028', province: '广东省', city: '深圳市', address: '福田区福华一路138号', serviceAreas: [{ province: '广东省', city: '深圳市' }] },
  { name: '深圳南山店',   contact: '刘经理', phone: '13800001029', province: '广东省', city: '深圳市', address: '南山区科技园南区高新南一道', serviceAreas: [{ province: '广东省', city: '深圳市' }] },
  { name: '南宁青秀店',   contact: '陈经理', phone: '13800001030', province: '广西壮族自治区', city: '南宁市', address: '青秀区民族大道111号', serviceAreas: [{ province: '广西壮族自治区' }] },
  { name: '海口龙华店',   contact: '杨经理', phone: '13800001031', province: '海南省', city: '海口市', address: '龙华区海秀路68号', serviceAreas: [{ province: '海南省' }] },

  // ===== 西南地区 =====
  { name: '重庆渝中店',   contact: '张经理', phone: '13800001032', province: '重庆市', city: '重庆市', address: '渝中区解放碑步行街88号', serviceAreas: [{ province: '重庆市' }] },
  { name: '重庆江北店',   contact: '李经理', phone: '13800001033', province: '重庆市', city: '重庆市', address: '江北区观音桥步行街138号', serviceAreas: [{ province: '重庆市', city: '重庆市' }] },
  { name: '贵阳南明店',   contact: '王经理', phone: '13800001034', province: '贵州省', city: '贵阳市', address: '南明区中华南路68号', serviceAreas: [{ province: '贵州省' }] },
  { name: '昆明五华店',   contact: '刘经理', phone: '13800001035', province: '云南省', city: '昆明市', address: '五华区东风路128号', serviceAreas: [{ province: '云南省' }] },
  { name: '拉萨城关店',   contact: '杨经理', phone: '13800001036', province: '西藏自治区', city: '拉萨市', address: '城关区北京路88号', serviceAreas: [{ province: '西藏自治区' }] },

  // ===== 西北地区 =====
  { name: '西安雁塔店',   contact: '赵经理', phone: '13800001037', province: '陕西省', city: '西安市', address: '雁塔区雁塔路88号', serviceAreas: [{ province: '陕西省' }] },
  { name: '兰州城关店',   contact: '钱经理', phone: '13800001038', province: '甘肃省', city: '兰州市', address: '城关区东方红广场东侧', serviceAreas: [{ province: '甘肃省' }] },
  { name: '西宁城西店',   contact: '孙经理', phone: '13800001039', province: '青海省', city: '西宁市', address: '城西区五四西路88号', serviceAreas: [{ province: '青海省' }] },
  { name: '银川兴庆店',   contact: '周经理', phone: '13800001040', province: '宁夏回族自治区', city: '银川市', address: '兴庆区解放街168号', serviceAreas: [{ province: '宁夏回族自治区' }] },
  { name: '乌鲁木齐天山店', contact: '吴经理', phone: '13800001041', province: '新疆维吾尔自治区', city: '乌鲁木齐市', address: '天山区中山路128号', serviceAreas: [{ province: '新疆维吾尔自治区' }] },

  // ===== 港澳台 & 特殊地区 ===== 
  { name: '香港中环店',   contact: '郑经理', phone: '13800001042', province: '香港', city: '香港', address: '中环德辅道中68号', serviceAreas: [{ province: '香港' }] },
  { name: '澳门半岛店',   contact: '冯经理', phone: '13800001043', province: '澳门', city: '澳门', address: '半岛南湾大马路388号', serviceAreas: [{ province: '澳门' }] },
  { name: '台北信义店',   contact: '褚经理', phone: '13800001044', province: '台湾', city: '台北市', address: '信义区松高路88号', serviceAreas: [{ province: '台湾' }] },
];

async function main() {
  console.log('🏪 开始写入全国门店数据...\n');
  const hashedPassword = await bcrypt.hash(STORE_PASSWORD, 10);
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const store of nationwideStores) {
    const serviceAreaJson = JSON.stringify(store.serviceAreas);

    // 检查是否已存在（按 phone 查重）
    const existing = await prisma.store.findUnique({ where: { phone: store.phone } });

    if (existing) {
      // 更新 serviceArea 字段
      await prisma.store.update({
        where: { id: existing.id },
        data: {
          serviceArea: serviceAreaJson,
          // 同步更新 province/city/address/name/contact
          province: store.province,
          city: store.city,
          address: store.address,
          name: store.name,
          contact: store.contact,
        }
      });
      updated++;
      console.log(`  🔄 更新: ${store.name} (${store.phone})`);
    } else {
      await prisma.store.create({
        data: {
          name: store.name,
          contact: store.contact,
          phone: store.phone,
          password: hashedPassword,
          province: store.province,
          city: store.city,
          address: store.address,
          serviceArea: serviceAreaJson,
          status: 1,
        }
      });
      created++;
      console.log(`  ✅ 新增: ${store.name} (${store.phone})`);
    }
  }

  // 更新成都现有6家门店的 serviceArea → 四川省全域
  const chengduStores = await prisma.store.findMany({
    where: { province: '四川省', city: '成都市' }
  });
  const sichuanArea = JSON.stringify([{ province: '四川省' }]);
  for (const s of chengduStores) {
    await prisma.store.update({
      where: { id: s.id },
      data: { serviceArea: sichuanArea }
    });
    console.log(`  🔄 成都店扩展服务区域: ${s.name} → 四川省`);
  }

  console.log(`\n📊 完成: 新增 ${created} 家，更新 ${updated} 家，成都 ${chengduStores.length} 家门店服务区域已扩展`);
  console.log(`\n📋 门店初始密码统一为: ${STORE_PASSWORD}`);
  console.log(`\n🎯 共计 ${nationwideStores.length + chengduStores.length} 家门店已就绪，覆盖 34 个省级行政区`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
