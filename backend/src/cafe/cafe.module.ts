import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [ConfigController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class CafeModule {}
