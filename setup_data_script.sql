

INSERT INTO sys_currency (currency_code) VALUES ('USD');
INSERT INTO sys_currency (currency_code) VALUES ('GBP');
INSERT INTO sys_currency (currency_code) VALUES ('EUR');

INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'));
INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'GBP'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'GBP'));
INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'EUR'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'EUR'));


INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('sys_account_source_id', 'INT', '', -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('account_base_curr', 'VARCHAR(10)', (SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'), -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('account_source_filename', 'VARCHAR(250)', '', -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('account_source_row', 'INT', '', -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('debit_negative', 'INT', -1, -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('abs_debit_credit', 'INT', 0, -1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field ) VALUES ('created_date', 'INT', 'CURRENT_TIMESTAMP', -1);

INSERT INTO sys_account_source (sys_account_source_id, account_source_name) VALUES (-1, 'System rule');

INSERT INTO sys_config (config_key, config_value) VALUES ('reporting_currency', (SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'));
INSERT INTO sys_config (config_key, config_value) VALUES ('dark_mode', 0);

select * from sys_config;