import { Controller, Get, Query } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('transactions')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get()
  getTransactions(@Query('page') page: string, @Query('limit') limit: string) {
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    return this.reportingService.getTransactions(p, l);
  }
}
