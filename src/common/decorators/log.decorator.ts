import { SetMetadata } from '@nestjs/common';

export const LOG_METADATA_KEY = 'op_log';

/**
 * 操作日志装饰器
 * 用法：@Log('管理员', '创建管理员')
 * @param module  模块名（订单/管理员/系统等）
 * @param action  操作动作（创建/更新/删除/审核等）
 * @param target  可选，操作对象描述模板，支持 {paramId} 占位
 *                例如 '订单 {id}'，会在请求路径中查找 :id 替换
 */
export const Log = (module: string, action: string, target?: string) =>
  SetMetadata(LOG_METADATA_KEY, { module, action, target });
