import { Controller, Get, Query, Patch, Param, Body } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('transactions')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get()
  getTransactions(@Query() query: any) {
    const p = parseInt(query.page) || 1;
    const l = query.limit !== undefined ? parseInt(query.limit) : 50;
    return this.reportingService.getTransactions(p, l, query);
  }

  @Patch(':id')
  updateTransaction(@Param('id') id: string, @Body() updates: any) {
    return this.reportingService.updateTransaction(parseInt(id), updates);
  }
}
