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

  // CORS: 开发环境允许 localhost，生产环境必须配置 ALLOWED_ORIGINS（逗号分隔的域名列表）
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd
      ? (origin, cb) => {
          if (!origin) return cb(null, true); // 非浏览器请求（如 curl/Postman）放行
          const allowed = (process.env.ALLOWED_ORIGINS || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
          if (allowed.includes(origin)) {
            return cb(null, true);
          }
          console.warn(`[CORS] 拒绝未授权跨域请求: ${origin}`);
          return cb(new Error('Not allowed by CORS'));
        }
      : ['http://localhost:5173', 'http://localhost:5174',
         'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
    credentials: true,
  });
  if (isProd && !process.env.ALLOWED_ORIGINS) {
    console.warn('[CORS] ⚠️ NODE_ENV=production 但未配置 ALLOWED_ORIGINS，CORS 仅放行已配置域名');
  }

  // A-06: 开启代理信任，使 req.ip 在反代后返回真实 IP
  app.set('trust proxy', 1);

  // 移除 X-Powered-By: Express 头（信息泄露防护）
  app.disable('x-powered-by');

  // U-08: 开启 ValidationPipe 白名单，防止 Mass Assignment
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  }));

  // 禁止 API 响应被浏览器/代理缓存，确保管理后台总能拿到最新排序数据
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
