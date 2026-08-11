import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class MenuRoleService {
  constructor(private prisma: PrismaService) {}

  private toCamel(row: any): any {
    if (!row) return null
    return {
      id: row.id,
      path: row.path,
      pathType: row.path_type,
      roles: row.roles || [],
      sort: row.sort,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    }
  }

  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM menu_role_config ORDER BY sort ASC, path ASC'
    )
    return rows.map(r => this.toCamel(r))
  }

  async upsert(id: string | null, data: { path: string; pathType: string; roles?: string[]; sort?: number; enabled?: boolean; updatedBy?: string }) {
    const path = data.path ?? ''
    const pathType = data.pathType ?? 'page'
    const sort = data.sort ?? 0
    const enabled = data.enabled !== undefined ? data.enabled : true
    if (id) {
      await this.prisma.menu_role_config.update({
        where: { id },
        data: { path, path_type: pathType, roles: data.roles || [], sort, enabled, updated_by: data.updatedBy || null },
      })
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM menu_role_config WHERE id = $1', id
      )
      return rows[0] ? this.toCamel(rows[0]) : null
    } else {
      try {
        await this.prisma.menu_role_config.create({
          data: {
            path,
            path_type: pathType,
            roles: data.roles || [],
            sort,
            enabled,
            updated_by: data.updatedBy || null,
            updated_at: new Date(),
          },
        })
      } catch (_) { /* ignore duplicate */ }
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM menu_role_config WHERE path = $1 AND path_type = $2', path, pathType
      )
      return rows[0] ? this.toCamel(rows[0]) : null
    }
  }

  async remove(id: string) {
    await this.prisma.$executeRawUnsafe('DELETE FROM menu_role_config WHERE id = $1', id)
  }

  async reset() {
    await this.prisma.$executeRawUnsafe('DELETE FROM menu_role_config')

    const defaults = [
      { path: '/dashboard', pathType: 'exact', roles: ['*'], sort: 0, enabled: true },
      { path: '/outlets', pathType: 'prefix', roles: ['superadmin', 'outlet_admin', 'order_admin'], sort: 1, enabled: true },
      { path: '/outlets/overview', pathType: 'exact', roles: ['superadmin', 'outlet_admin', 'order_admin'], sort: 2, enabled: true },
      { path: '/outlets/dashboard', pathType: 'exact', roles: ['superadmin', 'outlet_admin', 'order_admin'], sort: 3, enabled: true },
      { path: '/outlets/assign', pathType: 'exact', roles: ['superadmin', 'outlet_admin', 'order_admin'], sort: 4, enabled: true },
      { path: '/outlets/receipts', pathType: 'exact', roles: ['superadmin', 'outlet_admin', 'order_admin'], sort: 5, enabled: true },
      { path: '/orders', pathType: 'prefix', roles: ['superadmin', 'order_admin', 'outlet_admin'], sort: 10, enabled: true },
      { path: '/orders/seal', pathType: 'exact', roles: ['superadmin', 'order_admin', 'outlet_admin'], sort: 11, enabled: true },
      { path: '/orders/newspaper', pathType: 'exact', roles: ['superadmin', 'order_admin', 'outlet_admin'], sort: 12, enabled: true },
      { path: '/orders/bookkeeping', pathType: 'exact', roles: ['superadmin', 'order_admin', 'outlet_admin'], sort: 13, enabled: true },
      { path: '/after-sales', pathType: 'prefix', roles: ['superadmin', 'order_admin'], sort: 20, enabled: true },
      { path: '/products', pathType: 'prefix', roles: ['superadmin', 'product_admin'], sort: 30, enabled: true },
      { path: '/products/seals/enterprise', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 31, enabled: true },
      { path: '/products/seals/personal', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 32, enabled: true },
      { path: '/products/seals/electronic', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 33, enabled: true },
      { path: '/products/newspapers', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 34, enabled: true },
      { path: '/products/newspaper-templates', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 35, enabled: true },
      { path: '/products/bookkeeping-packages', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 36, enabled: true },
      { path: '/products/scenes', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 37, enabled: true },
      { path: '/products/packages', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 38, enabled: true },
      { path: '/products/record-queries', pathType: 'exact', roles: ['superadmin', 'product_admin'], sort: 39, enabled: true },
      { path: '/users', pathType: 'exact', roles: ['superadmin', 'content_admin'], sort: 40, enabled: true },
      { path: '/reviews', pathType: 'exact', roles: ['superadmin', 'content_admin'], sort: 41, enabled: true },
      { path: '/questions', pathType: 'exact', roles: ['superadmin', 'content_admin'], sort: 42, enabled: true },
      { path: '/faq', pathType: 'exact', roles: ['superadmin', 'content_admin'], sort: 43, enabled: true },
      { path: '/content', pathType: 'exact', roles: ['superadmin', 'content_admin'], sort: 44, enabled: true },
      { path: '/finance', pathType: 'prefix', roles: ['superadmin'], sort: 50, enabled: true },
      { path: '/system/admins', pathType: 'exact', roles: ['superadmin'], sort: 60, enabled: true },
      { path: '/system/logs', pathType: 'exact', roles: ['superadmin'], sort: 61, enabled: true },
      { path: '/system/configs', pathType: 'exact', roles: ['superadmin'], sort: 62, enabled: true },
      { path: '/system/dispatch-rules', pathType: 'exact', roles: ['superadmin'], sort: 63, enabled: true },
      { path: '/system/menu-roles', pathType: 'exact', roles: ['superadmin'], sort: 64, enabled: true },
    ]

    for (const d of defaults) {
      await this.prisma.menu_role_config.create({
        data: {
          id: require('crypto').randomUUID(),
          path: d.path,
          path_type: d.pathType,
          roles: d.roles,
          sort: d.sort,
          enabled: d.enabled,
          updated_at: new Date(),
          updated_by: null,
        },
      })
    }
  }
}
