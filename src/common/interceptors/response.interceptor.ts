import { CallHandler, NestInterceptor, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { SKIP_WRAP_KEY } from '../decorators/skip-wrap.decorator';

/**
 * 全局响应拦截器 —— 统一包装 {code: 0, data: ...}
 *
 * 规则（按顺序）：
 *  1. 标记 @SkipWrap()   → 直接返回
 *  2. 已有标准 {code:0, data}   → 直接返回
 *  3. 微信回调 {code:'SUCCESS'|'FAIL', message} → 直接返回
 *  4. 文件上传 { url | urls }  → 直接返回
 *  5. 内容管理列表 { list } → 直接返回
 *  6. 错误提示 {code, message, 无 data} → 直接返回
 *  7. 已有 {data: xxx} 包装 → 取出 data 再统一 wrap
 *  8. 其余全部统一 wrap
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.get(SKIP_WRAP_KEY, context.getHandler());
    if (skip) return next.handle();
    return next.handle().pipe(map(data => this.wrap(data)));
  }

  private wrap(data: any): any {
    if (data && typeof data === 'object' && data.code === 0 && 'data' in data) {
      return data;
    }
    if (data && typeof data === 'object' && 'code' in data && typeof data.code === 'string') {
      return data;
    }
    if (data && typeof data === 'object' && ('url' in data || 'urls' in data)) {
      return data;
    }
    if (data && typeof data === 'object' && 'list' in data && 'pagination' in data) {
      return { code: 0, data };
    }
    if (
      data &&
      typeof data === 'object' &&
      'code' in data &&
      'message' in data &&
      !('data' in data)
    ) {
      return data;
    }
    if (data && typeof data === 'object' && 'data' in data) {
      return { code: 0, data: data.data };
    }
    return { code: 0, data };
  }
}
