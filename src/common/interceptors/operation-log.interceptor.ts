// @ts-nocheck
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LOG_METADATA_KEY } from '../decorators/log.decorator';

/**
 * 全局操作日志拦截器
 * - 读取 @Log 装饰器元数据
 * - 仅对 POST/PUT/DELETE/PATCH 写操作生效（GET 不记日志）
 * - 成功后才落库；失败不入库（避免脏数据）
 * - 自动从 JWT 中取 admin_id，从 request 取 ip / user_agent
 */
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('OperationLog');

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get(LOG_METADATA_KEY, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const method = (req.method || '').toUpperCase();
    // 只记录写操作
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return next.handle();

    return next.handle().pipe(
      tap(async (data) => {
        try {
          const admin_id = req.user?.id || req.user?.sub || null;
          const ip =
            (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            req.ip ||
            req.socket?.remoteAddress ||
            null;
          const user_agent = (req.headers?.['user-agent'] as string) || null;

          // 解析 target
          const target = this.resolveTarget(meta.target, req, data);

          await this.prisma.operation_logs.create({
            data: {
              admin_id,
              module: meta.module,
              action: meta.action,
              target,
              detail: this.safeStringify({ body: req.body, params: req.params, result: data }, 800),
              ip,
              user_agent,
            },
          });
        } catch (err: any) {
          // 写日志失败不能影响业务
          this.logger.error(`写操作日志失败: ${err.message}`);
        }
      }),
      catchError((err) => throwError(() => err)),
    );
  }

  private resolveTarget(template: string | undefined, req: any, data: any): string {
    if (!template) {
      // 默认：方法 + 路径
      return `${req.method} ${req.originalUrl || req.url}`;
    }
    let result = template;

    // 优先取真实路由参数（req.params 已有 Express 已解析的值）
    const src = req.params ?? {};

    // 风格 1: :paramName（Express 路由参数语法，有前缀 /）
    // 示例: "admin/:id" → "admin/abc123"
    for (const m of template.matchAll(/\/:(\w+)/g)) {
      const key = m[1];
      const val = src[key] ?? req.body?.[key] ?? req.query?.[key] ?? data?.id ?? '';
      result = result.replace(`/:${key}`, val ? `/${val}` : '');
    }

    // 风格 1b: 纯 :paramName（无前缀，常用于单资源路径）
    // 示例: ":id" → "abc123"
    for (const m of template.matchAll(/^:(\w+)$/g)) {
      const key = m[1];
      const val = src[key] ?? req.body?.[key] ?? req.query?.[key] ?? data?.id ?? '';
      result = result.replace(`:${key}`, val);
    }

    // 风格 2: {paramName}（纯文本模板占位符，admin.controller.ts 风格）
    // 示例: "管理员 {id}" → "管理员 abc123"
    for (const m of result.matchAll(/\{(\w+)\}/g)) {
      const key = m[1];
      const val = src[key] ?? req.body?.[key] ?? req.query?.[key] ?? data?.id ?? '';
      result = result.replace(`{${key}}`, String(val));
    }

    return result;
  }

  private safeStringify(obj: any, maxLen: number): string {
    try {
      // S-08: 敏感字段脱敏，防止密码/openid/token 明文写入日志
      const SENSITIVE_KEYS = /password|token|secret|openid|phone|idCard|realname|license/i;
      const redact = (val: any, key: string): any => {
        if (SENSITIVE_KEYS.test(key)) return '***';
        if (val === null || val === undefined) return val;
        if (typeof val === 'string' && val.length > 200) return val.slice(0, 200) + '...';
        if (typeof val === 'object') return JSON.parse(JSON.stringify(val, (k, v) => redact(v, k)));
        return val;
      };
      const s = JSON.stringify(obj, (k, v) => redact(v, k));
      return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
    } catch {
      return '';
    }
  }
}
