import { Controller, Post, Param, ParseIntPipe, Body } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';

@Controller('rules')
export class RuleEngineController {
  constructor(private readonly ruleEngineService: RuleEngineService) {}

  @Post('apply/:account_source_id')
  applyRules(@Param('account_source_id', ParseIntPipe) accountId: number) {
    return this.ruleEngineService.applyRules(accountId);
  }

  @Post('test')
  testRule(@Body() body: { description: string; amount?: number }) {
    return this.ruleEngineService.testRuleEvaluation(body.description, body.amount);
  }
}
