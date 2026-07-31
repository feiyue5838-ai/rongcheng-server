// 迁移脚本：为 newspaper_categories 表初始化 sub_types JSON 数据
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 硬编码数据（来自 getTemplateMeta 的 M 映射）
const SUB_TYPES_MAP = {
  '声明公告': [
    { key: 'company',   name: '公司公告',     color: '#5B6FE8', hot: true  },
    { key: 'estate',    name: '房产公告',     color: '#FA8C16'             },
    { key: 'seal',      name: '印章公告',     color: '#EB2F96'             },
    { key: 'debt',      name: '债务催收',     color: '#722ED1'             },
    { key: 'lost',      name: '挂失公告',     color: '#F5222D'             },
    { key: 'property',  name: '财产转让公告', color: '#FADB14'             },
    { key: 'stock',     name: '股权公告',     color: '#A0D911'             },
    { key: 'notary',    name: '公证公告',     color: '#FA541C'             },
    { key: 'vehicle',   name: '车辆公告',     color: '#13C2C2'             },
  ],
  '公告声明': [
    { key: 'company',   name: '公司公告',     color: '#5B6FE8', hot: true  },
    { key: 'estate',    name: '房产公告',     color: '#FA8C16'             },
    { key: 'seal',      name: '印章公告',     color: '#EB2F96'             },
    { key: 'debt',      name: '债务催收',     color: '#722ED1'             },
    { key: 'lost',      name: '挂失公告',     color: '#F5222D'             },
    { key: 'property',  name: '财产转让公告', color: '#FADB14'             },
    { key: 'stock',     name: '股权公告',     color: '#A0D911'             },
    { key: 'notary',    name: '公证公告',     color: '#FA541C'             },
    { key: 'vehicle',   name: '车辆公告',     color: '#13C2C2'             },
  ],
  '企业证件': [
    { key: 'stamp_cert',            name: '公章证照类',    color: '#F5222D', hot: true  },
    { key: 'contract_agreement',    name: '合同协议类',    color: '#FA541C', hot: true  },
    { key: 'license_qualification', name: '许可证资质类',  color: '#D4380D'             },
    { key: 'invoice_receipt',       name: '票据单证类',    color: '#8C8C8C'             },
    { key: 'transportation',        name: '运输资质类',    color: '#5B6FE8'             },
    { key: 'construction',          name: '建筑资质类',    color: '#52C41A'             },
    { key: 'business_license',      name: '营业执照类',    color: '#FA8C16'             },
    { key: 'medical',               name: '医疗资质类',    color: '#722ED1'             },
    { key: 'financial_tax',         name: '金融税务类',    color: '#0FCB7D'             },
    { key: 'import_export',         name: '进出口资质类',  color: '#EB2F96'             },
    { key: 'culture_food_other',    name: '文化食品其他',  color: '#2F54EB'             },
    { key: 'transport_equipment',  name: '运输设备类',    color: '#13C2C2'             },
  ],
  '法院公告': [
    { key: 'debt_collect',           name: '债权债务与催收',     color: '#F5222D', hot: true  },
    { key: 'bankruptcy_liquidation', name: '破产与清算',         color: '#FA541C'             },
    { key: 'arbitration_service',    name: '仲裁与送达',         color: '#5B6FE8'             },
    { key: 'admin_punishment',      name: '行政处罚送达',       color: '#D4380D'             },
    { key: 'civil_dispute',         name: '民事诉讼纠纷',       color: '#52C41A'             },
    { key: 'judicial_auction',      name: '司法拍卖与资产处置', color: '#FA8C16'             },
    { key: 'compensation_claim',    name: '补偿提存与领取',    color: '#722ED1'             },
    { key: 'search_people',         name: '寻人协查与司法文书', color: '#0FCB7D'             },
    { key: 'admin_regulation',      name: '行政监管与企业公告', color: '#EB2F96'             },
  ],
  '政府送达': [
    { key: 'prosecutorial',         name: '检察司法类公告',    color: '#722ED1'             },
    { key: 'admin_punish_gov',      name: '行政处罚送达催告',  color: '#F5222D', hot: true  },
    { key: 'labor_arbitration',     name: '劳动仲裁送达公告',  color: '#5B6FE8', hot: true  },
    { key: 'planning_permit',       name: '规划行政许可公示',  color: '#0FCB7D'             },
    { key: 'notary_testament',      name: '公证遗嘱类公告',    color: '#FA8C16'             },
  ],
  '招标公告': [
    { key: 'engineering_lease',      name: '工程场地租赁招标', color: '#F5222D', hot: true  },
    { key: 'procurement_supplier',  name: '采购供应商招标',  color: '#FA541C', hot: true  },
    { key: 'recruitment_general',    name: '招聘通用招标',    color: '#5B6FE8'             },
  ],
  '债权债务': [
    { key: 'debt_cleanup',   name: '债权债务综合清算',  color: '#F5222D', hot: true  },
    { key: 'debt_transfer',  name: '债权转让公告催收', color: '#FA541C', hot: true  },
    { key: 'loan_default',   name: '贷款违约公告',      color: '#D4380D'             },
    { key: 'finance_release',name: '金融保险债权解除',  color: '#8C8C8C'             },
  ],
  '拍卖公告': [
    { key: 'general',  name: '通用拍卖公告', color: '#F5222D', hot: true  },
    { key: 'online',   name: '网络线上拍卖', color: '#5B6FE8', hot: true  },
    { key: 'asset',    name: '专项资产拍卖', color: '#FA8C16'             },
    { key: 'judicial', name: '司法法院拍卖', color: '#F5222D'             },
  ],
  '登报道歉': [
    { key: 'personal',  name: '个人道歉声明', color: '#EB2F96', hot: true  },
    { key: 'corporate', name: '企业道歉声明', color: '#5B6FE8', hot: true  },
    { key: 'product',   name: '产品道歉声明', color: '#FA8C16'             },
    { key: 'other',     name: '其他道歉声明', color: '#52C41A'             },
  ],
  '环评公示': [
    { key: 'env_impact',       name: '环境影响评价信息公示',   color: '#52C41A', hot: true  },
    { key: 'env_acceptance',   name: '竣工环保验收公示',       color: '#0FCB7D', hot: true  },
    { key: 'emission_permit',  name: '排污许可证公示',         color: '#FA8C16'             },
    { key: 'clean_production', name: '清洁生产与环境预案公示', color: '#5B6FE8'             },
    { key: 'other',             name: '其他环保公示',           color: '#7B8FF7'             },
  ],
  '表扬信': [
    { key: 'personal',  name: '个人表扬信',  color: '#FA8C16', hot: true  },
    { key: 'company',   name: '企业表扬信',  color: '#5B6FE8', hot: true  },
    { key: 'employee',  name: '员工表扬信', color: '#52C41A'             },
    { key: 'unit',      name: '单位表扬信', color: '#F5222D'             },
  ],
  '解除劳动': [
    { key: 'labor_dismissal', name: '解除劳动合同声明', color: '#FA8C16', hot: true  },
    { key: 'labor_arb',       name: '劳动仲裁公告',     color: '#F5222D', hot: true  },
    { key: 'labor_wage',      name: '工资欠款公告',     color: '#FAAD14', hot: true  },
    { key: 'labor_injury',    name: '工伤事故公告',     color: '#FF4D4F'             },
  ],
  '宣传稿': [
    { key: 'personal',   name: '个人主体', color: '#FA8C16', hot: true  },
    { key: 'corporate',  name: '企业主体', color: '#5B6FE8', hot: true  },
    { key: 'government', name: '政府主体', color: '#F5222D', hot: true  },
    { key: 'legal',      name: '普法公益', color: '#52C41A'             },
    { key: 'project',    name: '项目工程', color: '#0FCB7D'             },
  ],
  '身份证挂失': [
    { key: 'lost', name: '挂失公告', color: '#F5222D', hot: true },
  ],
  '发票收据': [
    { key: '收据类',              name: '收据类'              },
    { key: '专用发票',            name: '专用发票'            },
    { key: '通用基础发票',         name: '通用基础发票'         },
    { key: '发票管理配套凭证',     name: '发票管理配套凭证'     },
    { key: '支票结算凭证',         name: '支票结算凭证'         },
    { key: '金融财税与票据',       name: '金融财税与票据'       },
    { key: '机动车车船税费票据',   name: '机动车车船税费票据'   },
    { key: '房产不动产发票',       name: '房产不动产发票'       },
    { key: '建筑服务业发票',       name: '建筑服务业发票'       },
    { key: '进出口外贸发票',       name: '进出口外贸发票'       },
    { key: '保险医疗票据',         name: '保险医疗票据'         },
  ],
};

async function main() {
  const categories = await prisma.newspaper_categories.findMany({ where: { status: 1 } });
  let updated = 0, skipped = 0;

  for (const cat of categories) {
    const subs = SUB_TYPES_MAP[cat.name];
    if (!subs) {
      console.log(`[SKIP] "${cat.name}" (${cat.id}) - 无子分类数据`);
      skipped++;
      continue;
    }
    await prisma.newspaper_categories.update({
      where: { id: cat.id },
      data: { sub_types: subs },
    });
    console.log(`[OK] "${cat.name}" (${cat.id}) - ${subs.length}个子分类`);
    updated++;
  }

  console.log(`\n完成：更新 ${updated} 个分类，跳过 ${skipped} 个`);
}
main().finally(() => prisma.$disconnect());
