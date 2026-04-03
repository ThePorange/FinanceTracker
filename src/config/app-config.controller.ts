import { Controller, Get, Patch, Body } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('config')
export class AppConfigController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  getConfig() {
    const rows = this.db.getDb().prepare('SELECT config_key, config_value FROM sys_config').all() as any[];
    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.config_key] = JSON.parse(row.config_value);
      } catch (e) {
        result[row.config_key] = row.config_value;
      }
    }
    return result;
  }

  @Patch()
  updateConfig(@Body() body: Record<string, any>) {
    const db = this.db.getDb();
    const update = db.transaction((configObj: Record<string, any>) => {
      const upsert = db.prepare('INSERT INTO sys_config (config_key, config_value) VALUES (?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value');
      for (const [key, value] of Object.entries(configObj)) {
        const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        upsert.run(key, strVal);
      }
    });
    update(body);
    return this.getConfig();
  }
}
