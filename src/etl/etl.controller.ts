import { Controller, Get, Post, Param, UploadedFile, UseInterceptors, BadRequestException, ParseIntPipe, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EtlService } from './etl.service';

@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('import/:account_source_id')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Param('account_source_id', ParseIntPipe) accountId: number,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.etlService.importCsv(accountId, file.originalname, file.buffer);
  }

  @Post('run')
  runEtlJob(@Body() body: { sourceId?: number }) {
    return this.etlService.runEtlJob(body?.sourceId);
  }

  @Get('jobs')
  getEtlJobs() {
    return this.etlService.getEtlJobs();
  }

  @Get('jobs/:id')
  getEtlJob(@Param('id', ParseIntPipe) id: number) {
    return this.etlService.getEtlJob(id);
  }
}
