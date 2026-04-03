import { Module } from '@nestjs/common';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService]
})
export class RulesModule {}
