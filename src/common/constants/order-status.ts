/**
 * 订单状态常量（统一三套冲突枚举）
 * 
 * 历史问题：
 * - adminUpdateOrder: 7=退款中, 8=已退款
 * - getStatistics: 7=售后中, 8=退款中, 9=已退款
 * - refundOrder/wechat回调: 入口允许[2,3,4,7]，出口置8，回调置9
 * 
 * 统一方案：
 * - 1=待支付, 2=已支付, 3=制作中, 4=已发货, 5=已完成, 6=已取消
 * - 7=售后中, 8=退款中, 9=已退款
 */

/** 订单状态枚举 */
export enum OrderStatus {
  PENDING_PAYMENT = 1,    // 待支付
  PAID = 2,              // 已支付
  IN_PRODUCTION = 3,     // 制作中
  SHIPPED = 4,           // 已发货
  COMPLETED = 5,         // 已完成
  CANCELLED = 6,         // 已取消
  AFTER_SALES = 7,       // 售后中
  REFUNDING = 8,         // 退款中
  REFUNDED = 9,          // 已退款
}

/** 状态文本映射 */
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  [OrderStatus.PENDING_PAYMENT]: '待支付',
  [OrderStatus.PAID]: '已支付',
  [OrderStatus.IN_PRODUCTION]: '制作中',
  [OrderStatus.SHIPPED]: '已发货',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.CANCELLED]: '已取消',
  [OrderStatus.AFTER_SALES]: '售后中',
  [OrderStatus.REFUNDING]: '退款中',
  [OrderStatus.REFUNDED]: '已退款',
};

/** 终态：不允许再变更 */
export const TERMINAL_STATUSES = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
] as const;

/** 合法状态流转表 */
export const VALID_STATUS_TRANSITIONS: Record<number, number[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.AFTER_SALES, OrderStatus.REFUNDING],
  [OrderStatus.IN_PRODUCTION]: [OrderStatus.SHIPPED, OrderStatus.COMPLETED, OrderStatus.AFTER_SALES, OrderStatus.REFUNDING],
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED, OrderStatus.AFTER_SALES, OrderStatus.REFUNDING],
  [OrderStatus.AFTER_SALES]: [OrderStatus.COMPLETED, OrderStatus.REFUNDING],
  [OrderStatus.REFUNDING]: [OrderStatus.REFUNDED, OrderStatus.PAID, OrderStatus.AFTER_SALES, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED],
  [OrderStatus.COMPLETED]: [], // 终态
  [OrderStatus.CANCELLED]: [], // 终态
  [OrderStatus.REFUNDED]: [],  // 终态
};

/** 可退款状态 */
export const REFUNDABLE_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.SHIPPED,
  OrderStatus.AFTER_SALES,
] as const;

/** 可取消状态（仅未支付） */
export const CANCELABLE_STATUSES = [
  OrderStatus.PENDING_PAYMENT,
] as const;
