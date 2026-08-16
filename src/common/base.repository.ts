// DDD 架构 - Repository 基类
// 所有领域仓库继承此类，提供统一的 CRUD 接口

export abstract class BaseRepository<T> {
  protected abstract model: any;
  
  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }
  
  async findOne(where: any): Promise<T | null> {
    return this.model.findFirst({ where });
  }
  
  async findMany(where?: any, options?: {
    skip?: number;
    take?: number;
    orderBy?: any;
    include?: any;
  }): Promise<T[]> {
    return this.model.findMany({
      where,
      ...options
    });
  }
  
  async create(data: any): Promise<T> {
    return this.model.create({ data });
  }
  
  async update(id: string, data: any): Promise<T> {
    return this.model.update({ where: { id }, data });
  }
  
  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }
  
  async count(where?: any): Promise<number> {
    return this.model.count({ where });
  }
  
  async exists(where: any): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
  
  async transaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    return prisma.$transaction(fn);
  }
}
