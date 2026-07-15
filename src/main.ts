import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.useGlobalPipes(new ValidationPipe());

  // 全局前缀: 所有路由统一加上 /api
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
  console.log(`API Base: http://localhost:${port}/api`);
}
bootstrap();
