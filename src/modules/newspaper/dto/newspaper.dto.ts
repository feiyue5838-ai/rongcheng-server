/**
 * 报纸模块 DTO 类型定义
 * 阶段3：替换 any 类型，提升类型安全性
 */

import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ==================== 分类 DTO ====================

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '子分类配置', type: 'object' })
  @IsOptional()
  subTypes?: Record<string, any>;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: '分类名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '子分类配置', type: 'object' })
  @IsOptional()
  subTypes?: Record<string, any>;
}

// ==================== 报纸 DTO ====================

export class CreateNewspaperDto {
  @ApiProperty({ description: '报纸名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '别名' })
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({ description: '出版社' })
  @IsOptional()
  @IsString()
  publisher?: string;

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: '单价（元/字）', example: 0.5 })
  @IsNumber()
  @Min(0)
  pricePerWord: number;

  @ApiPropertyOptional({ description: '最低字数', default: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minWords?: number;

  @ApiPropertyOptional({ description: '发行量', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  coverage?: number;

  @ApiPropertyOptional({ description: '级别 1普通 2省级 3国家级', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  level?: number;

  @ApiPropertyOptional({ description: '封面图' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '城市代码' })
  @IsOptional()
  @IsString()
  cityCode?: string;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '启用版面选择', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  enableSections?: number;
}

export class UpdateNewspaperDto extends CreateNewspaperDto {}

// ==================== 模板 DTO ====================

export class CreateTemplateDto {
  @ApiPropertyOptional({ description: '报纸ID' })
  @IsOptional()
  @IsString()
  newspaperId?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: '模板名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '模板内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '示例数据' })
  @IsOptional()
  @IsString()
  sampleData?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '颜色' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiPropertyOptional({ description: '子分类 key' })
  @IsOptional()
  @IsString()
  templateType?: string;
}

export class UpdateTemplateDto extends CreateTemplateDto {}

// ==================== 个人证件 DTO ====================

export class CreatePersonalDocCategoryDto {
  @ApiProperty({ description: '分类名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;
}

export class UpdatePersonalDocCategoryDto {
  @ApiPropertyOptional({ description: '分类名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;
}

export class CreatePersonalDocItemDto {
  @ApiProperty({ description: '证件名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;
}

export class UpdatePersonalDocItemDto {
  @ApiPropertyOptional({ description: '证件名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;
}

// ==================== 版面 DTO ====================

export class CreateSectionDto {
  @ApiProperty({ description: '版面名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '版面类别：头版/二版/财经版/分类广告版等' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '刊例价' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  listPrice?: number;

  @ApiPropertyOptional({ description: '截稿时间，如 "17:00"' })
  @IsOptional()
  @IsString()
  deadlineTime?: string;

  @ApiPropertyOptional({ description: '见报周期，如 "每周一/三/五" 或 "次日见报"' })
  @IsOptional()
  @IsString()
  publishCycle?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateSectionDto extends CreateSectionDto {}

// ==================== 查询 DTO ====================

export class GetNewspapersQueryDto {
  @ApiPropertyOptional({ description: '搜索关键词（名称/别名）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '大区：华北/东北/华东/华中/华南/西南/西北' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: '省份代码' })
  @IsOptional()
  @IsString()
  province_code?: string;

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: '城市代码' })
  @IsOptional()
  @IsString()
  city_code?: string;

  @ApiPropertyOptional({ description: '分类ID' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ description: '状态 1启用 0禁用', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  status?: number;

  @ApiPropertyOptional({ description: '级别 1普通 2省级 3国家级' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: '启用版面选择', default: '1' })
  @IsOptional()
  @IsString()
  enableSections?: string;

  @ApiPropertyOptional({ description: '页码', default: '1' })
  @IsOptional()
  @IsString()
  pageNum?: string = '1';

  @ApiPropertyOptional({ description: '每页数量', default: '10' })
  @IsOptional()
  @IsString()
  pageSize?: string = '10';
}

// ==================== 工具类型 ====================

/**
 * Prisma Where 输入类型
 * 用于构建复杂的查询条件
 */
export interface PrismaWhereInput {
  [key: string]: any;
}

/**
 * Prisma Include 配置类型
 */
export interface PrismaIncludeInput {
  [key: string]: boolean | PrismaIncludeInput;
}
