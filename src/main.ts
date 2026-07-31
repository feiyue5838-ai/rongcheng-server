import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { Express } from 'express';
import * as express from 'express';
import * as path from 'path';

import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS: 开发环境允许前端 localhost:5173/5174，生产环境配置实际域名
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ],
    credentials: true,
  });

  // 移除 X-Powered-By: Express 头（信息泄露防护）
  app.disable('x-powered-by');

  app.useGlobalPipes(new ValidationPipe());

  // 禁止 API 响应被浏览器/代理缓存，确保管理后台总能拿到最新排序数据（解决排序刷新无效问题）
  app.use('/api', (req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // 静态资源：上传的图片通过 /uploads 访问
  // 统一使用 process.cwd() 路径（PM2 cluster 模式下 __dirname 会指向每个 worker 的目录）
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // 全局前缀: 所有路由统一加上 /api
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API Base: http://localhost:${port}/api`);
}
bootstrap();
