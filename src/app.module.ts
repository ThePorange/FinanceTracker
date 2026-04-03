import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from './config/config.module';
import { StagingModule } from './staging/staging.module';
import { EtlModule } from './etl/etl.module';
import { RulesModule } from './rules/rules.module';
import { ReportingModule } from './reporting/reporting.module';
import { SourcesModule } from './sources/sources.module';

@Module({
  imports: [DatabaseModule, ConfigModule, StagingModule, EtlModule, RulesModule, ReportingModule, SourcesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
