import { Controller, Get, Post, Put, Delete, Query, Patch, Param, Body } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller()
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('transactions')
  getTransactions(@Query() query: any) {
    const p = parseInt(query.page) || 1;
    const l = query.limit !== undefined ? parseInt(query.limit) : 50;
    return this.reportingService.getTransactions(p, l, query);
  }

  @Post('transactions/by-checksums')
  getTransactionsByChecksums(@Body() body: { checksums: string[] }) {
    return this.reportingService.getTransactions(1, -1, { checksums: body.checksums });
  }

  @Patch('transactions/:id')
  updateTransaction(@Param('id') id: string, @Body() updates: any) {
    return this.reportingService.updateTransaction(parseInt(id), updates);
  }

  @Get('reporting/definitions')
  getReportDefinitions() {
    return this.reportingService.getReportDefinitions();
  }

  @Get('reporting/definitions/:id')
  getReportDefinitionById(@Param('id') id: string) {
    return this.reportingService.getReportDefinitionById(parseInt(id));
  }

  @Post('reporting/definitions')
  createReportDefinition(@Body() body: { report_name: string; chart_type: string; definition_json: string | object }) {
    const jsonStr = typeof body.definition_json === 'string' ? body.definition_json : JSON.stringify(body.definition_json);
    return this.reportingService.createReportDefinition(body.report_name, body.chart_type || 'line', jsonStr);
  }

  @Put('reporting/definitions/:id')
  updateReportDefinition(@Param('id') id: string, @Body() body: { report_name: string; chart_type: string; definition_json: string | object }) {
    const jsonStr = typeof body.definition_json === 'string' ? body.definition_json : JSON.stringify(body.definition_json);
    return this.reportingService.updateReportDefinition(parseInt(id), body.report_name, body.chart_type || 'line', jsonStr);
  }

  @Delete('reporting/definitions/:id')
  deleteReportDefinition(@Param('id') id: string) {
    return this.reportingService.deleteReportDefinition(parseInt(id));
  }

  @Post('reporting/evaluate')
  evaluateReport(@Body() body: any) {
    return this.reportingService.evaluateReport(body);
  }
}


