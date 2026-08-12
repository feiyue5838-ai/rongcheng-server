import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common'
import { MenuRoleService } from './menu-role.service'
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Log } from '../../common/decorators/log.decorator';

@Controller('menu-roles')
@UseGuards(AdminJwtAuthGuard)
export class MenuRoleController {
  constructor(private readonly menuRoleService: MenuRoleService) {}

  @Get()
  findAll() {
    return this.menuRoleService.findAll()
  }

  @Post()
  @Log('系统', '新增菜单权限')
  create(@Body() body: any, @Request() req: any) {
    return this.menuRoleService.upsert(null, {
      ...body,
      updatedBy: req.user?.username || req.user?.id,
    })
  }

  @Put(':id')
  @Log('系统', '更新菜单权限')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.menuRoleService.upsert(id, {
      ...body,
      updatedBy: req.user?.username || req.user?.id,
    })
  }

  @Delete(':id')
  @Log('系统', '删除菜单权限')
  remove(@Param('id') id: string) {
    return this.menuRoleService.remove(id)
  }

  @Post('reset')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  @Log('系统', '重置菜单权限')
  reset() {
    return this.menuRoleService.reset()
  }
}
