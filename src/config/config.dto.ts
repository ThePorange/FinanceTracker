import { IsString, IsOptional, IsInt, IsNumber } from 'class-validator';

export class CreateSysAccountSourceDto {
  @IsString() account_source_name!: string;
}

export class CreateSysAccountMappingDto {
  @IsInt() sys_account_source_id!: number;
  @IsString() staging_tablename!: string;
  @IsString() sourcefile_fieldname!: string;
  @IsString() staging_table_fieldname!: string;
  @IsString() datatype!: string;
  @IsString() transaction_table_fieldname!: string;
  @IsOptional() @IsString() default_value?: string;
  @IsInt() derived_field!: number;
  @IsOptional() @IsInt() unique_records?: number;
}

export class CreateSysTransactionCategoryDto {
  @IsString() category_name!: string;
  @IsOptional() @IsInt() sys_account_source_id?: number;
}

export class CreateSysRulesDto {
  @IsString() rule_name!: string;
  @IsString() rule_json!: string;
  @IsOptional() @IsInt() sys_transaction_category_id?: number;
  @IsOptional() @IsInt() sys_account_source_id?: number;
}

export class CreateSysCurrencyDto {
  @IsString() currency_code!: string;
}

export class CreateSysCurrencyPairDto {
  @IsInt() from_ccy_id!: number;
  @IsInt() to_ccy_id!: number;
}

export class CreateSysFxRateDto {
  @IsOptional() @IsInt() sys_currency_pair_id?: number;
  @IsOptional() @IsString() business_date?: string;
  @IsNumber() fx_rate!: number;
}

export class CreateSysConfigDto {
  @IsString() config_key!: string;
  @IsString() config_value!: string;
}

export class CreateSysStagingFieldsDto {
  @IsString() staging_table_fieldname!: string;
  @IsString() datatype!: string;
  @IsOptional() @IsString() default_value?: string;
  @IsInt() derived_field!: number;
  @IsInt() unique_records!: number;
}
