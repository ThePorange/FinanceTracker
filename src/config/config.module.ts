import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { AppConfigController } from './app-config.controller';

@Module({
  controllers: [AppConfigController, ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
