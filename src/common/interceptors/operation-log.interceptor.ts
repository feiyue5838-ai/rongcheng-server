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
// 模块与操作的中文标签映射（覆盖 @Log 装饰器传入的原始值）
const MODULE_LABELS: Record<string, string> = {
  // 英文 → 中文
  order: '订单', orders: '订单',
  seal: '刻章', seals: '刻章',
  newspaper: '登报', newspapers: '登报',
  bookkeeping: '记账', bookkeeping_package: '记账',
  outlet: '网点', outlets: '网点',
  user: '用户', users: '用户',
  admin: '管理员', admins: '管理员',
  dispatch: '派单', dispatch_rule: '派单规则',
  notification: '通知', notifications: '通知',
  faq: '问答', faqs: '问答',
  content: '内容',
  config: '系统配置', configs: '系统配置',
  delivery: '配送',
  payment: '支付',
  review: '评价',
  menu_role: '菜单权限', menu_role_config: '菜单权限',
  settlement: '结算',
  refund: '退款',
};

const ACTION_LABELS: Record<string, string> = {
  // 英文 → 中文
  create: '新增', update: '更新', delete: '删除',
  login: '登录', logout: '登出',
  dev_paid: '模拟支付',
  pay: '支付', refund: '退款',
  confirm: '确认', cancel: '取消',
  accept: '接单', deliver: '发货', sign: '签收',
  assign: '分配', reassign: '重新分配',
  read: '读取',
};

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
          const target = this.resolveTarget(meta.target, req, data ?? {});

          const moduleLabel = MODULE_LABELS[meta.module?.toLowerCase()] ?? meta.module ?? '';
          const actionLabel = ACTION_LABELS[meta.action?.toLowerCase()] ?? meta.action ?? '';
          await this.prisma.operation_logs.create({
            data: {
              admin_id,
              module: moduleLabel,
              action: actionLabel,
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
    const src = (req.params && typeof req.params === 'object') ? req.params : {};

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
      // 兼容 camelCase（代码层）和 snake_case（数据库层）两种命名
      const SENSITIVE_KEYS = /password|token|secret|openid|unionid|phone|id_card|idCard|real_name|realname|license|private_key|certificate|signature|id_number|identity_card/i;
      const redact = (val: any, key: string): any => {
        if (SENSITIVE_KEYS.test(key)) return '***';
        if (val === null || val === undefined) return val;
        if (typeof val === 'string' && val.length > 200) return val.slice(0, 200) + '...';
        if (val !== null && typeof val === 'object') return JSON.parse(JSON.stringify(val, (k, v) => redact(v, k)));
        return val;
      };
      const s = JSON.stringify(obj, (k, v) => redact(v, k));
      return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
    } catch {
      return '';
    }
  }
}
