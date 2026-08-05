import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'

@Injectable()
export class MenuRoleService {
  constructor(private prisma: PrismaService) {}

  private toCamel(row: any): any {
    if (!row) return row
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

  async upsert(id: string | null, data: { path: string; pathType: string; roles: string[]; sort: number; enabled: boolean; updatedBy?: string }) {
    const roles = '{' + data.roles.map(r => '"' + r + '"').join(',') + '}'
    if (id) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE menu_role_config SET path=$1, path_type=$2, roles=$3::text[], sort=$4, enabled=$5, updated_by=$6, updated_at=NOW() WHERE id=$7`,
        data.path, data.pathType, roles, data.sort, data.enabled, data.updatedBy || null, id
      )
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM menu_role_config WHERE id = $1', id
      )
      return this.toCamel(rows[0])
    } else {
      try {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO menu_role_config (id, path, path_type, roles, sort, enabled, updated_by) VALUES (gen_random_uuid(), $1, $2, $3::text[], $4, $5, $6)`,
          data.path, data.pathType, roles, data.sort, data.enabled, data.updatedBy || null
        )
      } catch (_) { /* ignore duplicate */ }
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM menu_role_config WHERE path = $1', data.path
      )
      return this.toCamel(rows[0])
    }
  }

  async remove(id: string) {
    await this.prisma.$executeRawUnsafe('DELETE FROM menu_role_config WHERE id = $1', id)
  }

  async reset() {
    await this.prisma.$executeRawUnsafe('DELETE FROM menu_role_config')
  }
}
