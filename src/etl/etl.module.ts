import { Module } from '@nestjs/common';
import { EtlService } from './etl.service';
import { EtlController } from './etl.controller';
import { EtlJobController } from './etl-job.controller';
import { RulesModule } from '../rules/rules.module';

@Module({
  imports: [RulesModule],
  controllers: [EtlController, EtlJobController],
  providers: [EtlService],
})
export class EtlModule {}
