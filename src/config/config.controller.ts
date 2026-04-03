import { Controller, Get, Post, Put, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ConfigService } from './config.service';
import * as dtos from './config.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  private async validateDto(table: string, data: any) {
    const dtoMap: Record<string, any> = {
      sys_account_source: dtos.CreateSysAccountSourceDto,
      sys_account_mapping: dtos.CreateSysAccountMappingDto,
      sys_transaction_category: dtos.CreateSysTransactionCategoryDto,
      sys_rules: dtos.CreateSysRulesDto,
      sys_currency: dtos.CreateSysCurrencyDto,
      sys_currency_pair: dtos.CreateSysCurrencyPairDto,
      sys_fx_rate: dtos.CreateSysFxRateDto,
      sys_config: dtos.CreateSysConfigDto,
      sys_staging_fields: dtos.CreateSysStagingFieldsDto,
      sys_account_group: dtos.CreateSysAccountGroupDto,
      sys_account_group_map: dtos.CreateSysAccountGroupMapDto,
    };
    const DtoClass = dtoMap[table];
    if (!DtoClass) throw new BadRequestException(`No DTO schema for table ${table}`);
    
    // class-transformer conversion based on DTO classes with implicit casts
    const instance = plainToInstance(DtoClass, data, { enableImplicitConversion: true }) as object;
    const errors = await validate(instance);
    if (errors.length > 0) {
      throw new BadRequestException(errors.map(e => Object.values(e.constraints || {})).flat().join(', '));
    }
    return instance as Record<string, any>;
  }

  @Get('meta/staging-tables')
  getStagingTables() {
    return this.configService.getStagingTables();
  }

  @Get('meta/schema/:table')
  getTableSchema(@Param('table') table: string) {
    return this.configService.getTableSchema(table);
  }

  @Get(':table')
  findAll(@Param('table') table: string, @Query('page') page: string, @Query('limit') limit: string, @Query() filters: any) {
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    delete filters.page;
    delete filters.limit;
    return this.configService.findAll(table, p, l, filters);
  }

  @Post(':table')
  async create(@Param('table') table: string, @Body() data: any) {
    try {
      const validated = await this.validateDto(table, data);
      return this.configService.create(table, validated);
    } catch (e: any) {
      require('fs').writeFileSync('last_error.log', e.stack || e.message);
      throw e;
    }
  }

  @Put(':table/:idField/:idId')
  async update(@Param('table') table: string, @Param('idField') idField: string, @Param('idId') id: string, @Body() data: any) {
    // Basic dynamic update, you might add partial validation in a production system.
    return this.configService.update(table, idField, parseInt(id), data);
  }

  @Delete(':table/:idField/:idId')
  remove(@Param('table') table: string, @Param('idField') idField: string, @Param('idId') id: string) {
    return this.configService.remove(table, idField, parseInt(id));
  }
}
