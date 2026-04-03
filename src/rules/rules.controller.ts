import { Controller, Post, Body, Delete, Param } from '@nestjs/common';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post('execute')
  executeRules(@Body() body: { sourceId?: number; ruleId?: number }) {
    return this.rulesService.executeRules(body?.sourceId, body?.ruleId);
  }

  @Delete(':id')
  deleteRule(@Param('id') id: string) {
    return this.rulesService.deleteRule(parseInt(id));
  }
}
