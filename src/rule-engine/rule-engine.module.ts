import { Module } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';
import { RuleEngineController } from './rule-engine.controller';

@Module({
  controllers: [RuleEngineController],
  providers: [RuleEngineService],
})
export class RuleEngineModule {}
