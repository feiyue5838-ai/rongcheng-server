// @ts-nocheck
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NewspaperService {
  constructor(private prisma: PrismaService) {}

  async getCategories() {
    return this.prisma.newspaperCategory.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } });
  }

  async getNewspapers(query: any) {
    const { province, city, provinceCode, cityCode, level, categoryId, region } = query;
    const where: any = { status: 1 };
    if (region) where.region = region;
    if (provinceCode) where.provinceCode = provinceCode;
    else if (province) where.province = province;
    if (cityCode) where.cityCode = cityCode;
    else if (city) where.city = city;
    if (level) where.level = Number(level);
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.newspaper.findMany({ where, include: { category: true }, orderBy: { sort: 'asc' } });
  }

  async getTemplates(newspaperId?: string, categoryId?: string, businessType?: string) {
    const where: any = { status: 1 };
    if (newspaperId) where.newspaperId = newspaperId;
    if (categoryId) where.categoryId = categoryId;
    if (businessType) where.businessType = businessType;
    return this.prisma.newspaperTemplate.findMany({ where, include: { newspaper: true, category: true }, orderBy: { sort: 'asc' } });
  }

  async calculatePrice(newspaperId: string, contentLength: number, issueCount = 1, copyCount = 1) {
    const newspaper = await this.prisma.newspaper.findUnique({ where: { id: newspaperId } });
    if (!newspaper) return null;
    const words = Math.max(contentLength, newspaper.minWords);
    const price = words * Number(newspaper.pricePerWord) * (Number(issueCount) || 1) * (Number(copyCount) || 1);
    return { words, unitPrice: newspaper.pricePerWord, totalPrice: price, copies: Number(copyCount) || 1 };
  }

  // --- admin ---
  async adminCreateCategory(dto: any) {
    // ⚠ 白名单字段
    return this.prisma.newspaperCategory.create({
      data: { name: dto.name, icon: dto.icon || null, sort: dto.sort ?? 0, status: dto.status ?? 1 },
    });
  }
  async adminUpdateCategory(id: string, dto: any) {
    // ⚠ 白名单字段
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.newspaperCategory.update({ where: { id }, data });
  }
  async adminDeleteCategory(id: string) { return this.prisma.newspaperCategory.delete({ where: { id } }); }
  async adminCreateNewspaper(dto: any) {
    // ⚠ 白名单字段
    return this.prisma.newspaper.create({
      data: {
        name: dto.name, alias: dto.alias, publisher: dto.publisher,
        province: dto.province, region: dto.region, city: dto.city,
        provinceCode: dto.provinceCode, cityCode: dto.cityCode,
        pricePerWord: dto.pricePerWord, minWords: dto.minWords,
        coverage: dto.coverage, level: dto.level,
        image: dto.image, description: dto.description,
        status: dto.status ?? 1, sort: dto.sort ?? 0, categoryId: dto.categoryId,
      },
    });
  }
  async adminUpdateNewspaper(id: string, dto: any) {
    // ⚠ 白名单字段
    const fields = ['name','alias','publisher','province','region','city','provinceCode','cityCode','pricePerWord','minWords','coverage','level','image','description','status','sort','categoryId'];
    const data: any = {};
    for (const f of fields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    return this.prisma.newspaper.update({ where: { id }, data });
  }
  async adminDeleteNewspaper(id: string) { return this.prisma.newspaper.delete({ where: { id } }); }
  async adminCreateTemplate(dto: any) {
    // ⚠ 白名单字段
    return this.prisma.newspaperTemplate.create({
      data: {
        name: dto.name, content: dto.content, categoryId: dto.categoryId,
        newspaperId: dto.newspaperId, templateType: dto.templateType,
        businessType: dto.businessType, sampleData: dto.sampleData,
        desc: dto.desc, color: dto.color,
        sort: dto.sort ?? 0, status: dto.status ?? 1,
      },
    });
  }
  async adminUpdateTemplate(id: string, dto: any) {
    // ⚠ 白名单字段
    const fields = ['name','content','categoryId','newspaperId','templateType','businessType','sampleData','desc','color','sort','status'];
    const data: any = {};
    for (const f of fields) {
      if (dto[f] !== undefined) data[f] = dto[f];
    }
    return this.prisma.newspaperTemplate.update({ where: { id }, data });
  }
  async adminDeleteTemplate(id: string) { return this.prisma.newspaperTemplate.delete({ where: { id } }); }

  // ========== 个人证件 ==========
  async getPersonalDocs() {
    const categories = await this.prisma.personalDocCategory.findMany({
      where: { status: 1 }, orderBy: { sort: 'asc' },
      include: { items: { where: { status: 1 }, orderBy: { sort: 'asc' } } },
    });
    return categories.map(cat => ({
      id: cat.id, name: cat.name, desc: cat.desc, color: cat.color, iconSvg: cat.icon, total: cat.items.length,
      docs: cat.items.map(i => ({ id: i.id, name: i.name, content: i.content, desc: i.desc })),
    }));
  }
  async getPersonalDocCategories() {
    return this.prisma.personalDocCategory.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } });
  }
  async getPersonalDocItems(categoryId?: string) {
    const where: any = { status: 1 };
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.personalDocItem.findMany({ where, orderBy: { sort: 'asc' } });
  }
  async adminCreatePersonalDocCategory(dto: any) {
    return this.prisma.personalDocCategory.create({ data: dto });
  }
  async adminUpdatePersonalDocCategory(id: string, dto: any) {
    return this.prisma.personalDocCategory.update({ where: { id }, data: dto });
  }
  async adminDeletePersonalDocCategory(id: string) { return this.prisma.personalDocCategory.delete({ where: { id } }); }
  async adminCreatePersonalDocItem(dto: any) {
    return this.prisma.personalDocItem.create({ data: dto });
  }
  async adminUpdatePersonalDocItem(id: string, dto: any) {
    return this.prisma.personalDocItem.update({ where: { id }, data: dto });
  }
  async adminDeletePersonalDocItem(id: string) { return this.prisma.personalDocItem.delete({ where: { id } }); }

  // ========== 发票收据（全部无 templateType，合为一组） ==========
  async getInvoiceTemplates() {
    const CAT = 'b0447320-b0ca-41d7-a51e-b375a4eca8b4';
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    return [{ id: 'all', name: '发票收据', color: '#5B6FE8', total: templates.length, docs: templates.map(t => ({ name: t.name, content: t.content })) }];
  }

  // ========== 声明公告 ==========
  async getAnnouncementTemplates() {
    const CAT = 'e0a7a143-e4e5-409a-b094-9dfd63061df6';
    const M = {
      company:   { name: '公司公告',     color: '#5B6FE8', hot: true  },
      estate:    { name: '房产公告',     color: '#FA8C16'             },
      seal:      { name: '印章公告',     color: '#EB2F96'             },
      debt:      { name: '债务催收',     color: '#722ED1'             },
      lost:      { name: '挂失公告',     color: '#F5222D'             },
      property:  { name: '财产转让公告', color: '#FADB14'             },
      stock:     { name: '股权公告',     color: '#A0D911'             },
      notary:    { name: '公证公告',     color: '#FA541C'             },
      vehicle:   { name: '车辆公告',     color: '#13C2C2'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, desc: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 公告声明 ==========
  async getAnnouncement2Templates() {
    const CAT = 'e1023e5f-90c1-43c1-9e40-bf4ba0ed0a78';
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    return [{ id: 'all', name: '公告声明', color: '#5B6FE8', total: templates.length, docs: templates.map(t => ({ name: t.name, content: t.content })) }];
  }

  // ========== 企业证件 ==========
  async getCompanyDocTemplates() {
    const CAT = '95830b12-d797-4338-903f-d1492dd9725f';
    const M = {
      stamp_cert:            { name: '公章证照类',    color: '#F5222D', hot: true  },
      contract_agreement:    { name: '合同协议类',    color: '#FA541C', hot: true  },
      license_qualification: { name: '许可证资质类',  color: '#D4380D'             },
      invoice_receipt:       { name: '票据单证类',    color: '#8C8C8C'             },
      transportation:         { name: '运输资质类',    color: '#5B6FE8'             },
      construction:          { name: '建筑资质类',    color: '#52C41A'             },
      business_license:      { name: '营业执照类',    color: '#FA8C16'             },
      medical:               { name: '医疗资质类',    color: '#722ED1'             },
      financial_tax:          { name: '金融税务类',    color: '#0FCB7D'             },
      import_export:         { name: '进出口资质类',  color: '#EB2F96'             },
      culture_food_other:     { name: '文化食品其他',  color: '#2F54EB'             },
      transport_equipment:   { name: '运输设备类',    color: '#13C2C2'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 法院公告 ==========
  async getCourtTemplates() {
    const CAT = 'n0000001-0000-0000-0000-000000000003';
    const M = {
      debt_collect:           { name: '债权债务与催收',     color: '#F5222D', hot: true  },
      bankruptcy_liquidation:{ name: '破产与清算',         color: '#FA541C'             },
      arbitration_service:   { name: '仲裁与送达',         color: '#5B6FE8'             },
      admin_punishment:       { name: '行政处罚送达',       color: '#D4380D'             },
      civil_dispute:          { name: '民事诉讼纠纷',       color: '#52C41A'             },
      judicial_auction:       { name: '司法拍卖与资产处置', color: '#FA8C16'             },
      compensation_claim:     { name: '补偿提存与领取',     color: '#722ED1'             },
      search_people:          { name: '寻人协查与司法文书', color: '#0FCB7D'             },
      admin_regulation:       { name: '行政监管与企业公告', color: '#EB2F96'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 政府送达 ==========
  async getGovernmentTemplates() {
    const CAT = '24f5d846-eaf4-43d7-87a8-614cc8a2c84c';
    const M = {
      prosecutorial:     { name: '检察司法类公告',   color: '#722ED1'             },
      admin_punish_gov:  { name: '行政处罚送达催告', color: '#F5222D', hot: true  },
      labor_arbitration: { name: '劳动仲裁送达公告', color: '#5B6FE8', hot: true  },
      planning_permit:    { name: '规划行政许可公示', color: '#0FCB7D'             },
      notary_testament:   { name: '公证遗嘱类公告',   color: '#FA8C16'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 招标公告 ==========
  async getBiddingTemplates() {
    const CAT = 'c75ec0d3-d026-4f78-bb9e-0aa8a10ab7a8';
    const M = {
      engineering_lease:    { name: '工程场地租赁招标', color: '#F5222D', hot: true  },
      procurement_supplier:{ name: '采购供应商招标',  color: '#FA541C', hot: true  },
      recruitment_general:  { name: '招聘通用招标',    color: '#5B6FE8'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 债权债务 ==========
  async getCreditorTemplates() {
    const CAT = 'n0000001-0000-0000-0000-000000000006';
    const M = {
      debt_cleanup:    { name: '债权债务综合清算',  color: '#F5222D', hot: true  },
      debt_transfer:   { name: '债权转让公告催收', color: '#FA541C', hot: true  },
      loan_default:    { name: '贷款违约公告',      color: '#D4380D'             },
      finance_release: { name: '金融保险债权解除',  color: '#8C8C8C'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 拍卖公告 ==========
  async getAuctionTemplates() {
    const CAT = 'n0000001-0000-0000-0000-000000000004';
    const M = {
      general:  { name: '通用拍卖公告', color: '#F5222D', hot: true  },
      online:   { name: '网络线上拍卖', color: '#5B6FE8', hot: true  },
      asset:    { name: '专项资产拍卖', color: '#FA8C16'             },
      judicial: { name: '司法法院拍卖', color: '#F5222D'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 登报道歉 ==========
  async getApologyTemplates() {
    const CAT = '7f741109-cedf-4754-a621-05d25f8f39a6';
    const M = {
      personal:  { name: '个人道歉声明', color: '#EB2F96', hot: true  },
      corporate: { name: '企业道歉声明', color: '#5B6FE8', hot: true  },
      product:   { name: '产品道歉声明', color: '#FA8C16'             },
      other:     { name: '其他道歉声明', color: '#52C41A'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 环评公示 ==========
  async getEnvTemplates() {
    const CAT = 'c5385c39-917f-4ee8-b415-eb0ce5477b47';
    const M = {
      env_impact:       { name: '环境影响评价信息公示',   color: '#52C41A', hot: true  },
      env_acceptance:   { name: '竣工环保验收公示',       color: '#0FCB7D', hot: true  },
      emission_permit:   { name: '排污许可证公示',         color: '#FA8C16'             },
      clean_production:  { name: '清洁生产与环境预案公示', color: '#5B6FE8'             },
      other:             { name: '其他环保公示',           color: '#7B8FF7'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, desc: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 表扬信 ==========
  async getPraiseTemplates() {
    const CAT = '01f5ab6a-d62d-4223-b0b1-b31a7c740385';
    const M = {
      personal:  { name: '个人表扬信',  color: '#FA8C16', hot: true  },
      company:   { name: '企业表扬信',  color: '#5B6FE8', hot: true  },
      employee:  { name: '员工表扬信', color: '#52C41A'             },
      unit:      { name: '单位表扬信', color: '#F5222D'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 劳动纠纷 ==========
  async getLaborTemplates() {
    const CAT = '60b1b866-275e-42d9-ab44-a386ccc58714';
    const M = {
      labor_dismissal: { name: '解除劳动合同声明', color: '#FA8C16', hot: true  },
      labor_arb:       { name: '劳动仲裁公告',     color: '#F5222D', hot: true  },
      labor_wage:      { name: '工资欠款公告',     color: '#FAAD14', hot: true  },
      labor_injury:    { name: '工伤事故公告',     color: '#FF4D4F'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 宣传稿 ==========
  async getPublicityTemplates() {
    const CAT = '2e56de26-b2b5-47bb-9d2d-18070035c3a5';
    const M = {
      personal:   { name: '个人主体', color: '#FA8C16', hot: true  },
      corporate:  { name: '企业主体', color: '#5B6FE8', hot: true  },
      government: { name: '政府主体', color: '#F5222D', hot: true  },
      legal:      { name: '普法公益', color: '#52C41A'             },
      project:    { name: '项目工程', color: '#0FCB7D'             },
    };
    const templates = await this.prisma.newspaperTemplate.findMany({ where: { categoryId: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }
}
