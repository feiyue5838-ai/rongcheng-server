/**
 * 报纸模板通用工具方法
 * 用于减少重复代码，提升可维护性
 */

/**
 * 子分类配置接口
 */
export interface SubCategoryConfig {
  name: string;
  color: string;
  hot?: boolean;
  desc?: string;
}

/**
 * 模板分组配置接口
 */
export type TemplateGroupConfig = Record<string, SubCategoryConfig>;

/**
 * 模板返回项接口
 */
export interface TemplateGroup {
  id: string;
  name: string;
  color: string;
  hot?: boolean;
  desc?: string;
  total: number;
  docs: Array<{ name: string; content: string }>;
}

/**
 * 模板原始数据接口
 */
interface RawTemplate {
  name: string;
  content: string;
  templateType?: string;
}

/**
 * 通用模板获取方法（支持多组模式）
 *
 * @param prisma - Prisma 客户端实例
 * @param categoryId - 分类ID
 * @param groupConfig - 分组配置
 * @returns 模板分组数组
 *
 * @example
 * const templates = await getTemplatesByCategory(prisma, CATEGORY_IDS.ANNOUNCEMENT, {
 *   company: { name: '公司公告', color: '#5B6FE8', hot: true },
 *   estate: { name: '房产公告', color: '#6675EA' },
 * });
 */
export async function getTemplatesByCategory(
  prisma: any,
  categoryId: string,
  groupConfig: TemplateGroupConfig
): Promise<TemplateGroup[]> {
  // 查询该分类下所有启用的模板
  const templates = await prisma.newspaper_templates.findMany({
    where: { category_id: categoryId, status: 1 },
    orderBy: { sort: 'asc' },
  });

  // 按 templateType 分组
  const grouped: Record<string, RawTemplate[]> = {};

  for (const template of templates) {
    const type = template.templateType || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(template);
  }

  // 按配置顺序生成结果，并过滤空组
  return Object.keys(groupConfig)
    .map(key => {
      const config = groupConfig[key];
      const items = grouped[key] || [];

      return {
        id: key,
        name: config.name,
        color: config.color,
        hot: config.hot || false,
        desc: config.desc,
        total: items.length,
        docs: items.map(t => ({ name: t.name, content: t.content })),
      };
    })
    .filter(group => group.total > 0);
}

/**
 * 简化的单组模板获取方法
 *
 * @param prisma - Prisma 客户端实例
 * @param categoryId - 分类ID
 * @param name - 分组名称
 * @param color - 分组颜色
 * @returns 单个模板分组
 *
 * @example
 * const templates = await getSingleTemplateGroup(prisma, CATEGORY_IDS.INVOICE, '发票收据', '#5B6FE8');
 */
export async function getSingleTemplateGroup(
  prisma: any,
  categoryId: string,
  name: string = '通用模板',
  color: string = '#5B6FE8'
): Promise<TemplateGroup[]> {
  const templates = await prisma.newspaper_templates.findMany({
    where: { category_id: categoryId, status: 1 },
    orderBy: { sort: 'asc' },
  });

  return [{
    id: 'all',
    name,
    color,
    total: templates.length,
    docs: templates.map(t => ({ name: t.name, content: t.content })),
  }];
}
