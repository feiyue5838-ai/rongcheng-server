import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          // 提高连接池上限以支撑并发（默认 num_cpus*2+1 在 200 并发时排队）
          url: (process.env.DATABASE_URL || 'postgresql://postgres:wuhongyuan198911@localhost:5432/rongcheng') + (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=20&pool_timeout=30&socket_timeout=30',
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
