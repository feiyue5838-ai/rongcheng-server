import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { provinceToRegion } from '../../common/region';
import { NEWSPAPER_CATEGORY_IDS } from './constants/category-ids';
import { getTemplatesByCategory, getSingleTemplateGroup } from './utils/template-helper';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateNewspaperDto,
  UpdateNewspaperDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  CreatePersonalDocCategoryDto,
  UpdatePersonalDocCategoryDto,
  CreatePersonalDocItemDto,
  UpdatePersonalDocItemDto,
  CreateSectionDto,
  UpdateSectionDto,
  GetNewspapersQueryDto,
} from './dto/newspaper.dto';

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

  async getNewspapers(query: GetNewspapersQueryDto) {
    const { province, city, province_code, city_code, level, category_id, region } = query;
    const where: Record<string, any> = { status: 1 };
    if (region) where.region = region;
    if (province_code) where.province_code = province_code;
    else if (province) where.province = province;
    if (city_code) where.city_code = city_code;
    else if (city) where.city = city;
    if (level) where.level = Number(level);
    if (category_id) where.category_id = category_id;
    // 分页支持
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 500);
    const pageNum = Math.max(Number(query.pageNum) || 1, 1);
    const skip = (pageNum - 1) * pageSize;
    const [rawList, total] = await Promise.all([
      this.prisma.newspapers.findMany({
        where,
        select: { id: true, name: true, alias: true, publisher: true,
          province: true, province_code: true, city: true, city_code: true,
          region: true, enable_sections: true, price_per_word: true, min_words: true,
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
    const list = rawList.map((n: Record<string, any>) => {
      const r = n.region || provinceToRegion(n.province_code ? null : n.province);
      return { ...n, region: r };
    });
    const result = { list: toCamelDeep(list), total };
    // 缓存改为fire-and-forget，避免Redis阻塞主响应
    const cacheKey = `news:papers:${province_code || ''}:${city_code || ''}:${level || ''}:${category_id || ''}:${region || ''}:${pageSize}:${pageNum}`;
    this.cache.set(cacheKey, result, 60 * 1000).catch(() => {});
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
        region: true, enable_sections: true, price_per_word: true, min_words: true,
        coverage: true, level: true, image: true, category_id: true,
        sort: true, status: true, created_at: true, updated_at: true,
        newspaper_categories: true },
      orderBy: { sort: 'asc' },
    });
    const list = rawList.map((n: Record<string, any>) => ({
      ...n,
      region: n.region || provinceToRegion(n.province_code ? null : n.province),
    }));
    const result = { list: toCamelDeep(list), total: list.length };
    // 缓存fire-and-forget，避免Redis阻塞
    this.cache.set(cacheKey, result, 60 * 1000).catch(() => {});
    return result;
  }

  async getNewspaperById(id: string) {
    const newspaper = await this.prisma.newspapers.findUnique({
      where: { id },
      include: {
        newspaper_sections: {
          where: { status: 1 },
          orderBy: { sort: 'asc' }
        }
      }
    });
    
    if (!newspaper) {
      throw new NotFoundException('报纸不存在');
    }
    
    return { data: toCamelDeep(newspaper) };
  }

  async getTemplates(
    newspaper_id?: string,
    category_id?: string,
    businessType?: string,
    page?: number,
    pageSize?: number,
    skipCache = false
  ) {
    // 分页查询不走缓存（避免缓存分页碎片）
    const useCache = !skipCache && !page && !pageSize;
    if (useCache) {
      const key = `news:tmpl:${newspaper_id || ''}:${category_id || ''}:${businessType || ''}`;
      const cached = await this.cache.get<any>(key);
      if (cached) return cached;
    }
    const where: Record<string, any> = { status: 1 };
    if (newspaper_id) where.newspaper_id = newspaper_id;
    if (category_id) where.category_id = category_id;
    if (businessType) where.businessType = businessType;

    const p = Math.max(1, page || 1);
    const ps = Math.min(500, Math.max(1, pageSize || 20));

    const [rawList, totalCount] = await Promise.all([
      this.prisma.newspaper_templates.findMany({
        where,
        include: { newspaper: true, newspaper_categories: true },
        orderBy: { sort: 'asc' },
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.newspaper_templates.count({ where }),
    ]);

    const result = { list: toCamelDeep(rawList), total: totalCount };
    if (useCache) await this.cache.set(`news:tmpl:${newspaper_id || ''}:${category_id || ''}:${businessType || ''}`, result, 60 * 1000);
    return result;
  }

  async calculatePrice(newspaper_id: string, contentLength: number, issueCount = 1, copyCount = 1, section_id?: string) {
    if (!newspaper_id) return null;
    const newspaper = await this.prisma.newspapers.findUnique({ where: { id: newspaper_id } });
    if (!newspaper) return null;
    const words = Math.max(contentLength, Number(newspaper.min_words));
    const unitPrice = Number(newspaper.price_per_word);
    const copies = Number(copyCount) || 1;
    const ic = Number(issueCount) || 1;
    const wordPrice = Math.round(words * unitPrice * ic * copies * 100) / 100;
    let sectionId = '';
    let sectionName = '';
    let sectionPrice = 0;
    if (section_id) {
      const sec = await this.prisma.newspaper_sections.findFirst({
        where: { id: section_id, newspaper_id, status: 1 },
      });
      if (sec) {
        sectionId = sec.id;
        sectionName = sec.name;
        sectionPrice = Math.round(Number(sec.list_price) * ic * copies * 100) / 100;
      }
    }
    const totalPrice = Math.round((wordPrice + sectionPrice) * 100) / 100;
    return { words, unitPrice, wordPrice, sectionId, sectionName, sectionPrice, totalPrice, copies };
  }

  // --- admin ---
  /** 清除报纸模块缓存（已知键逐个删） */
  private async invalidateCache() {
    try {
      await this.cache.del('news:categories');
    } catch { /* 静默 */ }
  }

  async adminCreateCategory(dto: CreateCategoryDto) {
    const result = await this.prisma.newspaper_categories.create({
      data: {
        name: dto.name,
        icon: dto.icon || null,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
        sub_types: dto.subTypes,
      },
    });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminUpdateCategory(id: string, dto: UpdateCategoryDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.subTypes !== undefined) data.sub_types = dto.subTypes;
    const result = await this.prisma.newspaper_categories.update({ where: { id }, data });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminDeleteCategory(id: string) {
    const result = await this.prisma.newspaper_categories.delete({ where: { id } });
    await this.invalidateCache();
    return toCamelDeep(result);
  }
  async adminCreateNewspaper(dto: CreateNewspaperDto) {
    const result = await this.prisma.newspapers.create({
      data: {
        name: dto.name, alias: dto.alias, publisher: dto.publisher,
        province: dto.province, region: dto.region, city: dto.city,
        province_code: dto.provinceCode, city_code: dto.cityCode,
        price_per_word: dto.pricePerWord ?? 0.5, min_words: dto.minWords ?? 50,
        coverage: dto.coverage ?? 0, level: dto.level ?? 1,
        image: dto.image, description: dto.description,
        status: dto.status ?? 1, sort: dto.sort ?? 0, category_id: dto.categoryId,
        enable_sections: dto.enableSections ?? 1,
      },
    });
    return toCamelDeep(result);
  }
  async adminUpdateNewspaper(id: string, dto: UpdateNewspaperDto) {
    const map: Record<string,string> = {
      name:'name', alias:'alias', publisher:'publisher',
      province:'province', region:'region', city:'city',
      province_code:'provinceCode', city_code:'cityCode',
      price_per_word:'pricePerWord', min_words:'minWords',
      coverage:'coverage', level:'level',
      image:'image', description:'description',
      status:'status', sort:'sort', category_id:'categoryId',
      enable_sections:'enableSections',
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
  async adminCreateTemplate(dto: CreateTemplateDto) {
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
  async adminUpdateTemplate(id: string, dto: UpdateTemplateDto) {
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
        throw new NotFoundException('该模板不存在或已被删除');
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
    const where: Record<string, any> = { status: 1 };
    if (category_id) where.category_id = category_id;
    return this.prisma.personal_doc_items.findMany({ where, orderBy: { sort: 'asc' } });
  }
  async adminCreatePersonalDocCategory(dto: CreatePersonalDocCategoryDto) {
    return this.prisma.personal_doc_categories.create({ data: dto });
  }
  async adminUpdatePersonalDocCategory(id: string, dto: UpdatePersonalDocCategoryDto) {
    return this.prisma.personal_doc_categories.update({ where: { id }, data: dto });
  }
  async adminDeletePersonalDocCategory(id: string) { return this.prisma.personal_doc_categories.delete({ where: { id } }); }
  async adminCreatePersonalDocItem(dto: CreatePersonalDocItemDto) {
    return this.prisma.personal_doc_items.create({
      data: {
        name: dto.name,
        category_id: dto.categoryId,
        desc: dto.desc,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      } as any,
    });
  }
  async adminUpdatePersonalDocItem(id: string, dto: UpdatePersonalDocItemDto) {
    return this.prisma.personal_doc_items.update({
      where: { id },
      data: {
        name: dto.name,
        category_id: dto.categoryId,
        desc: dto.desc,
        sort: dto.sort ?? 0,
        status: dto.status ?? 1,
      } as any,
    });
  }
  async adminDeletePersonalDocItem(id: string) { return this.prisma.personal_doc_items.delete({ where: { id } }); }

  // ========== 发票收据（全部无 templateType，合为一组） ==========
  async getInvoiceTemplates() {
    return getSingleTemplateGroup(this.prisma, NEWSPAPER_CATEGORY_IDS.INVOICE, '发票收据', '#5B6FE8');
  }

  // ========== 声明公告 ==========
  async getAnnouncementTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.ANNOUNCEMENT, {
      company: { name: '公司公告', color: '#5B6FE8', hot: true },
      estate: { name: '房产公告', color: '#6675EA' },
      seal: { name: '印章公告', color: '#717AEC' },
      debt: { name: '债务催收', color: '#7C80EE' },
      lost: { name: '挂失公告', color: '#8886F0' },
      property: { name: '财产转让公告', color: '#938BF1' },
      stock: { name: '股权公告', color: '#9E91F3' },
      notary: { name: '公证公告', color: '#A996F5' },
      vehicle: { name: '车辆公告', color: '#B49CF7' }
    });
  }

  // ========== 公告声明 ==========
  async getNoticeTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.NOTICE, {
      company:  { name: '企业公告',     color: '#5F71E9', hot: true },
    });
  }

  // 保留旧方法以兼容
  async getAnnouncement2Templates() {
    return this.getNoticeTemplates();
  }

  // ========== 企业证件 ==========
  async getCompanyDocTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.COMPANY_DOC, {
      stamp_cert: { name: '公章证照类', color: '#6474EA', hot: true },
      contract_agreement: { name: '合同协议类', color: '#6B77EB', hot: true },
      license_qualification: { name: '许可证资质类', color: '#727BEC' },
      invoice_receipt: { name: '票据单证类', color: '#7A7FED' },
      transportation: { name: '运输资质类', color: '#8182EE' },
      construction: { name: '建筑资质类', color: '#8886F0' },
      business_license: { name: '营业执照类', color: '#908AF1' },
      medical: { name: '医疗资质类', color: '#978DF2' },
      financial_tax: { name: '金融税务类', color: '#9E91F3' },
      import_export: { name: '进出口资质类', color: '#A595F5' },
      culture_food_other: { name: '文化食品其他', color: '#AD98F6' },
      transport_equipment: { name: '运输设备类', color: '#B49CF7' }
    });
  }

  // ========== 法院公告 ==========
  async getCourtTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.COURT, {
      debt_collect: { name: '债权债务与催收', color: '#6876EA', hot: true },
      bankruptcy_liquidation: { name: '破产与清算', color: '#727BEC' },
      arbitration_service: { name: '仲裁与送达', color: '#7B7FED' },
      admin_punishment: { name: '行政处罚送达', color: '#8584EF' },
      civil_dispute: { name: '民事诉讼纠纷', color: '#8E89F1' },
      judicial_auction: { name: '司法拍卖与资产处置', color: '#988EF2' },
      compensation_claim: { name: '补偿提存与领取', color: '#A192F4' },
      search_people: { name: '寻人协查与司法文书', color: '#AB97F5' },
      admin_regulation: { name: '行政监管与企业公告', color: '#B49CF7' }
    });
  }

  // ========== 政府送达 ==========
  async getGovernmentTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.GOVERNMENT, {
      prosecutorial: { name: '检察司法类公告', color: '#6D78EB' },
      admin_punish_gov: { name: '行政处罚送达催告', color: '#7F81EE', hot: true },
      labor_arb: { name: '劳动仲裁送达公告', color: '#908AF1', hot: true },
      land_expropriation: { name: '土地征收公告', color: '#9A93F3' },
      tax_notice: { name: '税务通知书公告', color: '#A196F5' },
      administrative_licensing: { name: '行政许可公示', color: '#A99AF6' },
      customs_notice: { name: '海关公告', color: '#B29DF7' },
      planning_permit: { name: '规划行政许可公示', color: '#A293F4' },
      notary_testament: { name: '公证遗嘱类公告', color: '#B49CF7' }
    });
  }

  // ========== 招标公告 ==========
  async getBiddingTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.BIDDING, {
      engineering_lease: { name: '工程场地租赁招标', color: '#717AEC', hot: true },
      procurement_supplier: { name: '采购供应商招标', color: '#938BF1', hot: true },
      recruitment_general: { name: '招聘通用招标', color: '#B49CF7' }
    });
  }

  // ========== 债权债务 ==========
  async getCreditorTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.CREDITOR, {
      debt_cleanup: { name: '债权债务综合清算', color: '#767DED', hot: true },
      debt_transfer: { name: '债权转让公告催收', color: '#8A87F0', hot: true },
      loan_default: { name: '贷款违约公告', color: '#9F92F4' },
      finance_release: { name: '金融保险债权解除', color: '#B49CF7' }
    });
  }

  // ========== 拍卖公告 ==========
  async getAuctionTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.AUCTION, {
      general: { name: '通用拍卖公告', color: '#7A7FED', hot: true },
      online: { name: '网络线上拍卖', color: '#8D89F1', hot: true },
      asset: { name: '专项资产拍卖', color: '#A192F4' },
      judicial: { name: '司法法院拍卖', color: '#B49CF7' }
    });
  }

  // ========== 登报道歉 ==========
  async getApologyTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.APOLOGY, {
      personal: { name: '个人道歉声明', color: '#7F81EE', hot: true },
      corporate: { name: '企业道歉声明', color: '#908AF1', hot: true },
      product: { name: '产品道歉声明', color: '#A293F4' },
      other: { name: '其他道歉声明', color: '#B49CF7' }
    });
  }

  // ========== 环评公示 ==========
  async getEnvTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.ENV, {
      env_impact: { name: '环境影响评价信息公示', color: '#8383EF', hot: true },
      env_acceptance: { name: '竣工环保验收公示', color: '#8F89F1', hot: true },
      emission_permit: { name: '排污许可证公示', color: '#9C90F3' },
      clean_production: { name: '清洁生产与环境预案公示', color: '#A896F5' },
      other: { name: '其他环保公示', color: '#B49CF7' }
    });
  }

  // ========== 表扬信 ==========
  async getPraiseTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.PRAISE, {
      personal: { name: '个人表扬信', color: '#8886F0', hot: true },
      company: { name: '企业表扬信', color: '#968DF2', hot: true },
      employee: { name: '员工表扬信', color: '#A595F5' },
      unit: { name: '单位表扬信', color: '#B49CF7' }
    });
  }

  // ========== 劳动纠纷 ==========
  async getLaborTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.LABOR, {
      labor_dismissal: { name: '解除劳动合同声明', color: '#8C88F0', hot: true },
      labor_arb: { name: '劳动仲裁公告', color: '#998FF3', hot: true },
      labor_wage: { name: '工资欠款公告', color: '#A795F5', hot: true },
      labor_injury: { name: '工伤事故公告', color: '#B49CF7' }
    });
  }

  // ========== 宣传稿 ==========
  async getPublicityTemplates() {
    return getTemplatesByCategory(this.prisma, NEWSPAPER_CATEGORY_IDS.PUBLICITY, {
      personal: { name: '个人主体', color: '#908AF1', hot: true },
      corporate: { name: '企业主体', color: '#998FF3', hot: true },
      government: { name: '政府主体', color: '#A293F4', hot: true },
      legal: { name: '普法公益', color: '#AB98F6' },
      project: { name: '项目工程', color: '#B49CF7' }
    });
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

  // ========== 版面管理 ==========
  async getNewspaperSections(newspaperId: string) {
    const list = await this.prisma.newspaper_sections.findMany({
      where: { newspaper_id: newspaperId },
      orderBy: [{ sort: 'asc' }, { created_at: 'asc' }],
    });
    return { list: toCamelDeep(list), total: list.length };
  }

  async adminCreateNewspaperSection(newspaperId: string, dto: CreateSectionDto) {
    const data: any = {
      newspaper_id: newspaperId,
      name: dto.name,
      category: dto.category || null,
      list_price: dto.listPrice ? Number(dto.listPrice) : 0,
      deadline_time: dto.deadlineTime || null,
      publish_cycle: dto.publishCycle || null,
      sort: dto.sort ? Number(dto.sort) : 0,
      status: dto.status !== undefined ? Number(dto.status) : 1,
      remark: dto.remark || null,
    };
    const section = await this.prisma.newspaper_sections.create({ data });
    return toCamelDeep(section);
  }

  async adminUpdateNewspaperSection(newspaperId: string, sectionId: string, dto: UpdateSectionDto) {
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.listPrice !== undefined) data.list_price = Number(dto.listPrice);
    if (dto.deadlineTime !== undefined) data.deadline_time = dto.deadlineTime;
    if (dto.publishCycle !== undefined) data.publish_cycle = dto.publishCycle;
    if (dto.sort !== undefined) data.sort = Number(dto.sort);
    if (dto.status !== undefined) data.status = Number(dto.status);
    if (dto.remark !== undefined) data.remark = dto.remark;

    const section = await this.prisma.newspaper_sections.update({
      where: { id: sectionId },
      data,
    });
    return toCamelDeep(section);
  }

  async adminDeleteNewspaperSection(newspaperId: string, sectionId: string) {
    await this.prisma.newspaper_sections.delete({ where: { id: sectionId } });
    return { success: true };
  }
}

