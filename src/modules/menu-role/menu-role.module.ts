import { Module } from '@nestjs/common'
import { MenuRoleController } from './menu-role.controller'
import { MenuRoleService } from './menu-role.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [MenuRoleController],
  providers: [MenuRoleService],
  exports: [MenuRoleService],
})
export class MenuRoleModule {}
