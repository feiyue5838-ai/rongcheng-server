import { SetMetadata } from '@nestjs/common';

export const SKIP_WRAP_KEY = 'skip_wrap';
/**
 * 跳过统一响应包装
 * 用于返回 {code:400}、{code:'FAIL'} 等特殊格式的端点。
 */
export const SkipWrap = () => SetMetadata(SKIP_WRAP_KEY, true);
