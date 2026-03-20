import { Controller, Post, Param, UploadedFile, UseInterceptors, BadRequestException, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EtlService } from './etl.service';

@Controller('import')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post(':account_source_id')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Param('account_source_id', ParseIntPipe) accountId: number,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.etlService.importCsv(accountId, file.originalname, file.buffer);
  }
}
