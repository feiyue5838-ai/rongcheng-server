import { Controller, Post, Body, UseInterceptors, UploadedFile, UploadedFiles, UseGuards } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { AdminJwtAuthGuard, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreJwtAuthGuard } from '../auth/guards/outlet-jwt-auth.guard';

@ApiTags('文件上传')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图片（管理端）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'images');
    return { url };
  }

  @Post('user-image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图片（用户端，登报证件等）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'newspapers');
    return { url };
  }

  @Post('user-material')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传材料文件（用户端，刻章材料）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadUserMaterial(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'materials');
    return { url };
  }

  @Post('images')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '批量上传图片（管理端）' })
  @UseInterceptors(FilesInterceptor('files', 9))
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    const urls = await this.uploadService.uploadFiles(files, 'images');
    return { urls };
  }

  @Post('material')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传材料文件（管理端）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadMaterial(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'materials');
    return { url };
  }

  @Post('seal')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传印章图片（管理端）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadSealImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'seals');
    return { url };
  }

  @Post('outlet-image')
  @UseGuards(StoreJwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传图片（网点端：印章照片/交付凭证）' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadOutletImage(@UploadedFile() file: Express.Multer.File) {
    const url = await this.uploadService.uploadFile(file, 'outlets');
    return { url };
  }
}
