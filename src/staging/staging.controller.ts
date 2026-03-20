import { Controller, Post, Body, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StagingService } from './staging.service';

@Controller('staging')
export class StagingController {
  constructor(private readonly stagingService: StagingService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.stagingService.previewCsv(file.buffer);
  }

  @Post('confirm')
  confirmMapping(@Body() body: { accountId: number; mappings: any[] }) {
    if (!body.accountId || !body.mappings || !Array.isArray(body.mappings)) {
      throw new BadRequestException('Invalid confirmation body');
    }
    return this.stagingService.createStagingTable(body.accountId, body.mappings);
  }
}
