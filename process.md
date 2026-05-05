# Process

## 1. Setup / review system config

### Objective

- To provide a web page to allow the user to perform CRUD operations on the following system tables. All tables should have a search and filter capability the expected maximum table sizes are listed in section 5.
    - sys_import_log (operations should be limited to read and delete)
    - sys_transaction_type (operations should be limited to read)
    - sys_transaction_category (operations should be limited to read and update)
    - sys_rules (all CRUD operations)
    - sys_currency (all CRUD operations)
    - sys_currency_pair (operations should be limited to create, read and delete)
    - sys_fx_rate (all CRUD operations)
    - sys_config (all CRUD operations)
    - sys_staging_fields (all CRUD operations)


## 2. Setup new account source

### Objective

- To import data from a new account source (e.g. a new bank account or credit card .csv file)
- To create a new account source for the ETL process to reference (sys_account_source). 
- This will require a single web page which will have fields to populate a new sys_account_source record and also populate the data in the sys_acount_mapping table.
- The staging_tablename will be created as a new table in the database, with a naming convention of "staging_" followed by the account source name.
- The page will provide a button to select a .csv file to import.
- The header of the .csv file will be used to populate the sys_staging_fields table, source_fieldname and the staging_table_fieldname will be updated to meet standard database naming conventions. e.g. "Account Source" will become "account_source".
- The datatype will be inferred from the data in the .csv file.
- The transaction_table_fieldname will be populated with the fieldnames from the transaction table and is used to map the source file to the transaction table. 
- For foriegn key fields, the transaction_table_fieldname will be populated with the fieldnames from the transaction table and is used to map the source file to the transaction table. The ETL process will ensure the correct foriegn key values are used.
- The web page should have the Account source name field, the staging table name field, and a table with the following fields:
    - Account Source fieldname, mapped to sys_account_mapping.source_fieldname
    - Staging table fieldname, mapped to sys_account_mapping.staging_table_fieldname
    - Datatype, mapped to sys_account_mapping.datatype
    - Transaction table fieldname, mapped to sys_account_mapping.transaction_table_fieldname
    - Default value, mapped to sys_account_mapping.default_value
    - Derived field, mapped to sys_account_mapping.derived_field
    - Unique records, mapped to sys_account_mapping.unique_records
    - Account source filename, mapped to sys_account_mapping.account_source_filename
- The web page will also append the records from the sys_staging_fields to the table.
    - source fieldname, populated with "n/a"
    - staging table fieldname, populated with the value from sys_staging_fields.staging_table_fieldname
    - datatype, populated with the value from sys_staging_fields.datatype
    - transaction table fieldname, populated with the value from sys_staging_fields.transaction_table_fieldname
    - default value, populated with the value from sys_staging_fields.default_value
    - derived field, populated with the value from sys_staging_fields.derived_field
    - unique records, populated with the value from sys_staging_fields.unique_records
- The table should have a search and filter capability.
- the number of staging tables is expected to be less than 20 and directly related to the number of account sources.

- example mapping of data from sys_account_mapping table. This data is used by the ETL process to define and create the staging table.
- note the last 2 rows are examples of data from sys_staging_fields.

|sys_account_mapping_id |account_source	| staging_tablename | sourcefile_fieldname |staging_table_fieldname	|datatype	|transaction_table_fieldname	|default_value	|deririved_field	|unique_records	|created_date|
|---|---|---|---|---|---|---|---|---|---|---|
|1|Chase Checking 7876|staging_chase_checking_7876|Details|details|text|drcr||n|n|3/20/2026|
|2|Chase Checking 7876|staging_chase_checking_7876|Posting Date|posting_date|date |posting_date||n|n|3/20/2026|
|3|Chase Checking 7876|staging_chase_checking_7876|Description|description|text|description||n|n|3/20/2026|
|4|Chase Checking 7876|staging_chase_checking_7876|Amount|amount|real|base_amount||n|n|3/20/2026|
|5|Chase Checking 7876|staging_chase_checking_7876|Type|type|text|transation_type_id||n|n|3/20/2026|
|6|Chase Checking 7876|staging_chase_checking_7876|Balance|balance|float|base_curr_balance||n|n|3/20/2026|
|7|Chase Checking 7876|staging_chase_checking_7876|Check or Slip #|check_or_slip_number|integer|check_or_slip_number||n|n|3/20/2026|
|8|Chase Checking 7876|staging_chase_checking_7876|n/a|sys_account_source_id|text|sys_account_source_id|Chase checking 7876|y|n|3/20/2026|
|9|Chase Checking 7876|staging_chase_checking_7876|n/a|account_base_curr|text|base_curr_id|USD|y|n|3/20/2026|



## 3. Import data into the staging table and then into the transaction table

### Objective

- To import data from a .csv file defined by the selected sys_account_source record.

- The web page should have the following functionality:
    - A dropdown to select the sys_account_source record.
    - A button to import the data from the .csv file into the staging table and then into the transaction table using the mapping from the sys_account_mapping table.
    - The staging table created in step 2 should be used to import the data from the .csv file.
    - The staging table should be cleared before importing the data from the .csv file. This enables review if there are issues with the import.
    - The ETL process should be run in the background and the web page should display the status of the import.
    - The account_source_filename_checksum field in the sys_import_log table should be populated with the checksum of the .csv file and compared to the checksum of the .csv file in the sys_import_log table. If the checksums are the same, the .csv file should not be imported and a message should be displayed to the user and logged in the sys_import_log table.
    - The fields in the staging table that were defined as "y" in the unique_records column of the sys_account_mapping table should be checked if they already exist in the mapped transaction table. If they do, the .csv file should not be imported and a message should be displayed to the user and logged in the sys_import_log table.
    - Any new data required for the transaction table, such as transaction types, should be created automatically.
    - if there is a sys_account_mapping.transaction_table_fieldname with a value of "category_name", the ETL process should check if the category exists in the sys_transaction_category table and if not, create it.
    - details of the import including failures or success messages should be written to the sys_import_log table.

## 3.5 Apply categorization rules

### Objective

- To populate the sys_transaction_category_map table with category assignments for each transaction.

- Categorization must support:
    - Source-derived categories (from input file fields)
    - Rule-based categorization (defined in sys_rules)
    - Future ML-based categorization

- Manual overrides (where is_auto = 0) must always take precedence and must not be overwritten.

### Processing Steps

#### Step 1: Source Field Category Mapping (Initial Categorization)

- During the ETL process (staging → transaction), if a source field is mapped to a category (e.g. transaction_table_fieldname = category_name or similar), the following must occur:
    - Extract the category value from the staging table
    - Check if a matching record exists in sys_transaction_category for the given sys_account_source_id
    - If not, create a new category record
    - Insert a record into sys_transaction_category_map with:
        - sys_transaction_id
        - sys_transaction_category_id
        - is_auto = 1
        - confidence = 1.0
        - sys_rule_id = NULL
- This represents a source-derived category assignment and is treated as a high-confidence automatic classification.

#### Step 2: Apply System Rules

- After source-based categorization, apply rules defined in sys_rules:
- For each rule:
    - Parse rule_json
    - Identify matching transactions
    - Exclude transactions that already have a manual category (is_auto = 0)
    - Insert category mappings into sys_transaction_category_map with:
        - is_auto = 1
        - confidence based on rule type
        - sys_rule_id populated

#### Step 3: Conflict Handling

- Multiple automatic category assignments are allowed
- Manual assignments (is_auto = 0) override all automatic assignments
- Final category selection must be resolved at query time using a view

#### Step 4: Idempotency

- Rule execution must be repeatable without duplicating data
- Before inserting rule-based mappings:
    - Either delete existing auto mappings for that rule
    - Or prevent duplicates via logic or constraints

#### Step 5: Extensibility

- The design must support future ML-based categorization:
    - ML outputs insert into sys_transaction_category_map
    - confidence reflects model probability
    - sys_rule_id may reference a model identifier or remain NULL

## 4. Report

### Objective

- To provide a web page to allow the user to view the transaction table with the following functionality:
    - A search and filter capability.
    - A table to display the data from an appropriate view of the transaction table including any related tables.
    - filtering and pagination decisions should be made based on the expected maximum table sizes in section 5.


## 5 Expected maximum table sizes

### this information should be used to determine the appropriate filtering and pagination for the web pages.

- sys_account_source: 20
- sys_import_log: 1000
- sys_transaction_type: 500
- sys_transaction_category: 500
- sys_rules: 200
- sys_currency: 20
- sys_currency_pair: 400
- sys_fx_rate: 5000
- sys_config: 20
- sys_staging_fields: 20
- sys_transaction: 50000
- sys_account_mapping: 100

