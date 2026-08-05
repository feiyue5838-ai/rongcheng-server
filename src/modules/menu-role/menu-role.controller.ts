import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common'
import { MenuRoleService } from './menu-role.service'
import { AdminJwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('menu-roles')
@UseGuards(AdminJwtAuthGuard)
export class MenuRoleController {
  constructor(private readonly menuRoleService: MenuRoleService) {}

  @Get()
  findAll() {
    return this.menuRoleService.findAll()
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.menuRoleService.upsert(null, {
      ...body,
      updatedBy: req.user?.username,
    })
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.menuRoleService.upsert(id, {
      ...body,
      updatedBy: req.user?.username,
    })
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menuRoleService.remove(id)
  }

  @Post('reset')
  reset() {
    return this.menuRoleService.reset()
  }
}
