import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from './config/config.module';
import { StagingModule } from './staging/staging.module';
import { EtlModule } from './etl/etl.module';
import { RuleEngineModule } from './rule-engine/rule-engine.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [DatabaseModule, ConfigModule, StagingModule, EtlModule, RuleEngineModule, ReportingModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
