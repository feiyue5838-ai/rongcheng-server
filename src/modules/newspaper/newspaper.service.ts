// @ts-nocheck
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { provinceToRegion } from '../../common/region';

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function toCamelDeep(obj: any): any {
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) obj[i] = toCamelDeep(obj[i]);
    return obj;
  }
  if (obj !== null && typeof obj === 'object') {
    if (typeof obj.toString === 'function' && !('getTime' in obj)) {
      const str = obj.toString();
      if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
    }
    // 就地重命名 snake_case → camelCase，避免保留原字段
    for (const key of Object.keys(obj)) {
      const camelKey = snakeToCamel(key);
      const value = toCamelDeep(obj[key]);
      if (camelKey !== key) delete obj[key];
      obj[camelKey] = value;
    }
    return obj;
  }
  return obj;
}

@Injectable()
export class NewspaperService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getCategories(skipCache = false) {
    if (!skipCache) {
      const key = 'news:categories';
      const cached = await this.cache.get<any[]>(key);
      if (cached) return cached;
    }
    const result = toCamelDeep(await this.prisma.newspaper_categories.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } }));
    if (!skipCache) await this.cache.set('news:categories', result, 300 * 1000);
    return result;
  }

  async getNewspapers(query: any) {
    const { province, city, province_code, city_code, level, category_id, region } = query;
    const where: any = { status: 1 };
    if (region) where.region = region;
    if (province_code) where.province_code = province_code;
    else if (province) where.province = province;
    if (city_code) where.city_code = city_code;
    else if (city) where.city = city;
    if (level) where.level = Number(level);
    if (category_id) where.category_id = category_id;
    // 分页支持
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 200);
    const pageNum = Math.max(Number(query.pageNum) || 1, 1);
    const skip = (pageNum - 1) * pageSize;
    const [rawList, total] = await Promise.all([
      this.prisma.newspapers.findMany({
        where,
        select: { id: true, name: true, alias: true, publisher: true,
          province: true, province_code: true, city: true, city_code: true,
          region: true, price_per_word: true, min_words: true,
          coverage: true, level: true, image: true, category_id: true,
          sort: true, status: true, created_at: true, updated_at: true,
          newspaper_categories: true },
        orderBy: { sort: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.newspapers.count({ where }),
    ]);
    // 注入 region 字段
    const list = rawList.map((n: any) => {
      const r = n.region || provinceToRegion(n.province_code ? null : n.province);
      return { ...n, region: r };
    });
    const result = { list: toCamelDeep(list), total };
    // 缓存key必须含分页参数，否则不同页返回同一缓存
    const cacheKey = `news:papers:${province_code || ''}:${city_code || ''}:${level || ''}:${category_id || ''}:${region || ''}:${pageSize}:${pageNum}`;
    await this.cache.set(cacheKey, result, 60 * 1000);
    return result;
  }

  async getAllNewspapers() {
    const cacheKey = 'news:papers:all:no-pagination';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const rawList = await this.prisma.newspapers.findMany({
      where: { status: 1 },
      select: { id: true, name: true, alias: true, publisher: true,
        province: true, province_code: true, city: true, city_code: true,
        region: true, price_per_word: true, min_words: true,
        coverage: true, level: true, image: true, category_id: true,
        sort: true, status: true, created_at: true, updated_at: true,
        newspaper_categories: true },
      orderBy: { sort: 'asc' },
    });
    const list = rawList.map((n: any) => ({
      ...n,
      region: n.region || provinceToRegion(n.province_code ? null : n.province),
    }));
    const result = { list: toCamelDeep(list), total: list.length };
    await this.cache.set(cacheKey, result, 60 * 1000);
    return result;
  }

  async getTemplates(newspaper_id?: string, category_id?: string, businessType?: string, skipCache = false) {
    if (!skipCache) {
      const key = `news:tmpl:${newspaper_id || ''}:${category_id || ''}:${businessType || ''}`;
      const cached = await this.cache.get<any>(key);
      if (cached) return cached;
    }
    const where: any = { status: 1 };
    if (newspaper_id) where.newspaper_id = newspaper_id;
    if (category_id) where.category_id = category_id;
    if (businessType) where.businessType = businessType;
    const rawList = await this.prisma.newspaper_templates.findMany({
      where,
      include: { newspaper: true, newspaper_categories: true },
      orderBy: { sort: 'asc' },
    });
    const result = { list: toCamelDeep(rawList), total: rawList.length };
    if (!skipCache) await this.cache.set(`news:tmpl:${newspaper_id || ''}:${category_id || ''}:${businessType || ''}`, result, 60 * 1000);
    return result;
  }

  async calculatePrice(newspaper_id: string, contentLength: number, issueCount = 1, copyCount = 1) {
    if (!newspaper_id) return null;
    const newspaper = await this.prisma.newspapers.findUnique({ where: { id: newspaper_id } });
    if (!newspaper) return null;
    const words = Math.max(contentLength, Number(newspaper.min_words));
    const unitPrice = Number(newspaper.price_per_word);
    const copies = Number(copyCount) || 1;
    const ic = Number(issueCount) || 1;
    const price = Math.round(words * unitPrice * ic * copies * 100) / 100;
    return { words, unitPrice, totalPrice: price, copies };
  }

  // --- admin ---
  /** 清除报纸模块缓存（已知键逐个删） */
  private async invalidateCache() {
    try {
      await this.cache.del('news:categories');
    } catch { /* 静默 */ }
  }

  async adminCreateCategory(dto: any) {
    const result = await this.prisma.newspaper_categories.create({
      data: {
        name: dto.name,
        icon: dto.icon || null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
        sub_types: dto.sub_types ?? null,
      },
    });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminUpdateCategory(id: string, dto: any) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sub_types !== undefined) data.sub_types = dto.sub_types;
    const result = await this.prisma.newspaper_categories.update({ where: { id }, data });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminDeleteCategory(id: string) {
    const result = await this.prisma.newspaper_categories.delete({ where: { id } });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminCreateNewspaper(dto: any) {
    const result = await this.prisma.newspapers.create({
      data: {
        name: dto.name, alias: dto.alias, publisher: dto.publisher,
        province: dto.province, region: dto.region, city: dto.city,
        province_code: dto.provinceCode, city_code: dto.cityCode,
        price_per_word: dto.pricePerWord ?? 0.5, min_words: dto.minWords ?? 50,
        coverage: dto.coverage ?? 0, level: dto.level ?? 1,
        image: dto.image, description: dto.description,
        status: dto.status ?? 1, sort: dto.sort ?? 0, category_id: dto.categoryId,
      },
    });
    return toCamelDeep(result);
  }
  async adminUpdateNewspaper(id: string, dto: any) {
    const map: Record<string,string> = {
      name:'name', alias:'alias', publisher:'publisher',
      province:'province', region:'region', city:'city',
      province_code:'provinceCode', city_code:'cityCode',
      price_per_word:'pricePerWord', min_words:'minWords',
      coverage:'coverage', level:'level',
      image:'image', description:'description',
      status:'status', sort:'sort', category_id:'categoryId',
    };
    const data: any = {};
    for (const [db, camel] of Object.entries(map)) {
      if (dto[camel] !== undefined) data[db] = dto[camel];
    }
    const result = await this.prisma.newspapers.update({ where: { id }, data });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminDeleteNewspaper(id: string) {
    const result = await this.prisma.newspapers.delete({ where: { id } });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminCreateTemplate(dto: any) {
    // name 和 content 都是 NOT NULL，必须始终存在
    const createData: any = {
      name: dto.name != null ? dto.name : '',
      content: dto.content != null ? dto.content : '',
    };
    // 使用 category_id 直接赋值（避免 Prisma relation 强制要求 create/connect）
    if (dto.categoryId) createData.category_id = dto.categoryId;
    if (dto.newspaperId) createData.newspaper_id = dto.newspaperId;
    if (dto.templateType) createData.templateType = dto.templateType;
    // businessType：废弃字段，API 接受但忽略，只写 templateType
    // if (dto.businessType) createData.businessType = dto.businessType;
    if (dto.sampleData) createData.sample_data = dto.sampleData;
    if (dto.desc) createData.desc = dto.desc;
    if (dto.color) createData.color = dto.color;
    createData.sort = dto.sort ?? 0;
    createData.status = dto.status ?? 1;

    const result = await this.prisma.newspaper_templates.create({ data: createData });
    return toCamelDeep(result);
  }
  async adminUpdateTemplate(id: string, dto: any) {
    const map: Record<string,string> = {
      name:'name', content:'content',
      category_id:'categoryId', newspaper_id:'newspaperId',
      templateType:'templateType',
      // businessType：废弃字段，API 接受但忽略
      sample_data:'sampleData', desc:'desc',
      color:'color', sort:'sort', status:'status',
    };
    const data: any = {};
    for (const [db, camel] of Object.entries(map)) {
      if (dto[camel] !== undefined && camel !== 'businessType') data[db] = dto[camel];
    }
    const result = await this.prisma.newspaper_templates.update({ where: { id }, data });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminDeleteTemplate(id: string) {
    try {
      const result = await this.prisma.newspaper_templates.delete({ where: { id } });
      await this.invalidateCache();
      return toCamelDeep(result);
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new Error('该模板不存在或已被删除');
      }
      throw e;
    }
  }

  // ========== 个人证件 ==========
  async getPersonalDocs() {
    const categories = await this.prisma.personal_doc_categories.findMany({
      where: { status: 1 }, orderBy: { sort: 'asc' },
      include: { personal_doc_items: { where: { status: 1 }, orderBy: { sort: 'asc' } } },
    });
    return categories.map(cat => ({
      id: cat.id, name: cat.name, desc: cat.desc, color: cat.color, iconSvg: cat.icon, total: cat.personal_doc_items.length,
      docs: cat.personal_doc_items.map(i => ({ id: i.id, name: i.name, content: i.content, desc: i.desc })),
    }));
  }
  async getPersonalDocCategories() {
    return this.prisma.personal_doc_categories.findMany({ where: { status: 1 }, orderBy: { sort: 'asc' } });
  }
  async getPersonalDocItems(category_id?: string) {
    const where: any = { status: 1 };
    if (category_id) where.category_id = category_id;
    return this.prisma.personal_doc_items.findMany({ where, orderBy: { sort: 'asc' } });
  }
  async adminCreatePersonalDocCategory(dto: any) {
    return this.prisma.personal_doc_categories.create({ data: dto });
  }
  async adminUpdatePersonalDocCategory(id: string, dto: any) {
    return this.prisma.personal_doc_categories.update({ where: { id }, data: dto });
  }
  async adminDeletePersonalDocCategory(id: string) { return this.prisma.personal_doc_categories.delete({ where: { id } }); }
  async adminCreatePersonalDocItem(dto: any) {
    return this.prisma.personal_doc_items.create({ data: dto });
  }
  async adminUpdatePersonalDocItem(id: string, dto: any) {
    return this.prisma.personal_doc_items.update({ where: { id }, data: dto });
  }
  async adminDeletePersonalDocItem(id: string) { return this.prisma.personal_doc_items.delete({ where: { id } }); }

  // ========== 发票收据（全部无 templateType，合为一组） ==========
  async getInvoiceTemplates() {
    const CAT = 'b0447320-b0ca-41d7-a51e-b375a4eca8b4';
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
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
    const templates = await this.prisma.newspaper_templates.findMany({ where: { category_id: CAT, status: 1 }, orderBy: { sort: 'asc' } });
    const g: Record<string, any[]> = {};
    for (const t of templates) { const k = t.templateType || 'other'; (g[k] = g[k] || []).push(t); }
    return Object.keys(M).map(k => {
      const items = g[k] || [];
      return { id: k, name: M[k].name, color: M[k].color, hot: M[k].hot || false, total: items.length, docs: items.map(t => ({ name: t.name, content: t.content })) };
    }).filter(x => x.total > 0);
  }

  // ========== 导出分组元数据（供管理前端下拉使用）==========
  async getTemplateMeta() {
    // 从 DB 读取各分类的 sub_types
    const cats = await this.prisma.newspaper_categories.findMany({
      where: { status: 1 },
      select: { name: true, sub_types: true },
    });

    // businessTypes = 所有子分类扁平列表（key=子分类key，name=子分类name，存 businessType 字段）
    // subTypes = { 主分类名: [子分类列表] }（按分类名组织子分类）
    const businessTypes: { key: string; name: string }[] = [];
    const subTypes: Record<string, { key: string; name: string }[]> = {};

    for (const cat of cats) {
      const raw = cat.sub_types as any[] | null;
      const subs = (raw || []).map((s: any) => ({ key: s.key, name: s.name }));
      // 业务类型下拉：key=子分类key（用于存储），name=子分类name（显示用）
      for (const s of subs) {
        businessTypes.push({ key: s.key, name: s.name });
      }
      // 子分组映射：key=主分类名，value=该分类下的子分类列表
      subTypes[cat.name] = subs;
    }

    return { businessTypes, subTypes };
  }
}
