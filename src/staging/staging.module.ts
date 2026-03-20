import { Module } from '@nestjs/common';
import { StagingService } from './staging.service';
import { StagingController } from './staging.controller';

@Module({
  controllers: [StagingController],
  providers: [StagingService],
  exports: [StagingService],
})
export class StagingModule {}
