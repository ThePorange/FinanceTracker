import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { EtlService } from './etl.service';

@Controller('etl')
export class EtlJobController {
  constructor(private readonly etlService: EtlService) {}

  @Post('run')
  runEtl(@Body() body: { sourceId?: number }) {
    return this.etlService.runEtlJob(body?.sourceId);
  }

  @Get('jobs')
  getJobs() {
    return this.etlService.getEtlJobs();
  }

  @Get('jobs/:id')
  getJob(@Param('id', ParseIntPipe) id: number) {
    return this.etlService.getEtlJob(id);
  }
  
  @Delete('jobs/:id')
  deleteJob(@Param('id', ParseIntPipe) id: number) {
    return this.etlService.deleteEtlJob(id);
  }
}
