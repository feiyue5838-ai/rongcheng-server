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
  }
}
