import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 上传文件
   * @param file 上传的文件对象
   * @param subDir 子目录（如 'materials', 'avatars', 'newspapers'）
   * @returns 文件访问 URL
   */
  async uploadFile(file: Express.Multer.File, subDir = 'general'): Promise<string> {
    if (!file) throw new BadRequestException('未检测到上传文件');

    // 文件大小限制：10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) throw new BadRequestException('文件大小不能超过 10MB');

    // 允许的图片格式
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('仅支持 jpg、png、gif、webp、pdf 格式');
    }

    // 创建子目录
    const targetDir = path.join(this.uploadDir, subDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 生成唯一文件名
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(targetDir, filename);

    // 写入文件
    fs.writeFileSync(filePath, file.buffer);

    // 返回访问路径
    // 返回相对路径，让前端通过当前域名访问
    return `/uploads/${subDir}/${filename}`;
  }

  /**
   * 上传多个文件
   */
  async uploadFiles(files: Express.Multer.File[], subDir = 'general'): Promise<string[]> {
    return Promise.all(files.map((file) => this.uploadFile(file, subDir)));
  }
}
