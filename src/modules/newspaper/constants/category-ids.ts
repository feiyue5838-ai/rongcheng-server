/**
 * 报纸模板分类 ID 常量
 * 从数据库 newspaper_categories 表提取
 * 
 * 维护说明：
 * 1. 如需新增分类，先在数据库 newspaper_categories 表添加
 * 2. 然后在此文件添加对应常量
 * 3. 常量命名规则：大写蛇形命名，与业务含义对应
 */
export const NEWSPAPER_CATEGORY_IDS = {
  // ========== 登报业务分类 ==========
  
  /** 遗失声明（发票/证件等） */
  INVOICE: 'b0447320-b0ca-41d7-a51e-b375a4eca8b4',
  
  /** 公告声明 */
  ANNOUNCEMENT: 'e1023e5f-90c1-43c1-9e40-bf4ba0ed0a78',
  
  /** 法院通知 */
  NOTICE: 'e0a7a143-e4e5-409a-b094-9dfd63061df6',
  
  /** 企业证件 */
  COMPANY_DOC: '95830b12-d797-4338-903f-d1492dd9725f',
  
  /** 法院公告 */
  COURT: 'n0000001-0000-0000-0000-000000000003',
  
  /** 政府采购 */
  GOVERNMENT: '24f5d846-eaf4-43d7-87a8-614cc8a2c84c',
  
  /** 招标公告 */
  BIDDING: 'c75ec0d3-d026-4f78-bb9e-0aa8a10ab7a8',
  
  /** 债权债务 */
  CREDITOR: 'n0000001-0000-0000-0000-000000000006',
  
  /** 拍卖公告 */
  AUCTION: 'n0000001-0000-0000-0000-000000000004',
  
  /** 登报道歉 */
  APOLOGY: '7f741109-cedf-4754-a621-05d25f8f39a6',
  
  /** 环评公示 */
  ENV: 'c5385c39-917f-4ee8-b415-eb0ce5477b47',
  
  /** 表扬信 */
  PRAISE: '01f5ab6a-d62d-4223-b0b1-b31a7c740385',
  
  /** 劳动纠纷 */
  LABOR: '60b1b866-275e-42d9-ab44-a386ccc58714',
  
  /** 宣传稿 */
  PUBLICITY: '2e56de26-b2b5-47bb-9d2d-18070035c3a5',
  
} as const;

/**
 * 分类 ID 类型
 * 用于类型安全
 */
export type CategoryId = typeof NEWSPAPER_CATEGORY_IDS[keyof typeof NEWSPAPER_CATEGORY_IDS];
