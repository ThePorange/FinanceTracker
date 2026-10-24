import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileMergeController } from './file-merge.controller';
import { FileMergeService } from './file-merge.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FileMergeController],
  providers: [FileMergeService],
  exports: [FileMergeService],
})
export class FileMergeModule {}
