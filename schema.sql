PRAGMA foreign_keys = ON;

CREATE TABLE sys_account_source (
    sys_account_source_id INTEGER PRIMARY KEY,
    account_source_name VARCHAR(250) NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_import_log (
    sys_import_log_id INTEGER PRIMARY KEY,
    sys_account_source_id INTEGER,
    account_source_filename VARCHAR(250) NOT NULL,
    account_source_filename_checksum VARCHAR(250) NOT NULL,
    account_source_row_count INTEGER NOT NULL,
    import_log_json TEXT NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id)
);

CREATE TABLE sys_transaction_type (
    sys_transaction_type_id INTEGER PRIMARY KEY,
    transaction_type VARCHAR(250) NOT NULL,
    sys_account_source_id INTEGER,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id),
    UNIQUE(transaction_type, sys_account_source_id)
);

CREATE TABLE sys_transaction (
    sys_transaction_id INTEGER PRIMARY KEY,
    posting_date DATE,
    transaction_date DATE,
    description VARCHAR(250) NOT NULL,
    base_curr_id INTEGER,
    base_amount REAL,
    base_curr_balance REAL,
    drcr VARCHAR(10) CHECK (drcr IN ('DR', 'CR')),
    extended_details VARCHAR(250),
    statement_description VARCHAR(250),
    address_line1 VARCHAR(250),
    town_city VARCHAR(250),
    postcode VARCHAR(250),
    country VARCHAR(250),
    reference VARCHAR(250),
    memo VARCHAR(250),
    check_or_slip_number VARCHAR(250),
    sys_account_source_id INTEGER,
    sys_import_log_id INTEGER,
    account_source_row INTEGER NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    sys_transaction_type_id INTEGER,
    FOREIGN KEY(sys_import_log_id) REFERENCES sys_import_log(sys_import_log_id),
    FOREIGN KEY(sys_transaction_type_id) REFERENCES sys_transaction_type(sys_transaction_type_id),
    FOREIGN KEY(base_curr_id) REFERENCES sys_currency(sys_currency_id),   
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id)
);

CREATE INDEX idx_transaction_source 
ON sys_transaction(sys_account_source_id);

CREATE INDEX idx_transaction_import 
ON sys_transaction(sys_import_log_id);

CREATE TABLE sys_account_mapping (
    sys_account_mapping_id INTEGER PRIMARY KEY,
    sys_account_source_id INTEGER,
    staging_tablename VARCHAR(250) NOT NULL,
    sourcefile_fieldname VARCHAR(250) NOT NULL,
    staging_table_fieldname VARCHAR(250) NOT NULL,
    datatype VARCHAR(250) NOT NULL,
    transaction_table_fieldname VARCHAR(250) NOT NULL,
    default_value VARCHAR(250),
    derived_field INT NOT NULL,
    unique_records INT,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id)
);

CREATE TABLE sys_transaction_category (
    sys_transaction_category_id INTEGER PRIMARY KEY,
    category_name VARCHAR(250) NOT NULL,
    sys_account_source_id INTEGER,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id),
    UNIQUE(category_name, sys_account_source_id)
);


CREATE TABLE sys_transaction_category_map (
    sys_transaction_category_map_id INTEGER PRIMARY KEY,
    sys_transaction_id INTEGER,
    sys_transaction_category_id INTEGER,
    is_auto INTEGER NOT NULL DEFAULT 1,
    confidence REAL DEFAULT 1.0 
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
    sys_rule_id INTEGER,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(sys_transaction_id) 
        REFERENCES sys_transaction(sys_transaction_id),

    FOREIGN KEY(sys_transaction_category_id) 
        REFERENCES sys_transaction_category(sys_transaction_category_id),

    FOREIGN KEY(sys_rule_id) 
        REFERENCES sys_rules(sys_rules_id),

    CHECK (
        (is_auto = 0 AND sys_rule_id IS NULL) OR
        (is_auto = 1)
    ),
    
    CHECK (is_auto IN (0,1))
);

CREATE INDEX idx_category_map_txn 
ON sys_transaction_category_map(sys_transaction_id);

CREATE INDEX idx_category_map_category 
ON sys_transaction_category_map(sys_transaction_category_id);


-- Only ONE manual assignment per transaction/category
CREATE UNIQUE INDEX ux_manual_category
    ON sys_transaction_category_map(sys_transaction_id, sys_transaction_category_id)
    WHERE is_auto = 0;


CREATE TABLE sys_rules (
    sys_rules_id INTEGER PRIMARY KEY,
    rule_name VARCHAR(250) NOT NULL,
    rule_json TEXT NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    sys_transaction_category_id INTEGER,
    sys_account_source_id INTEGER,
    FOREIGN KEY(sys_transaction_category_id) REFERENCES sys_transaction_category(sys_transaction_category_id),
    FOREIGN KEY(sys_account_source_id) REFERENCES sys_account_source(sys_account_source_id)
);

CREATE TABLE sys_currency (
    sys_currency_id INTEGER PRIMARY KEY,
    currency_code VARCHAR(10) NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(currency_code)
);

CREATE TABLE sys_currency_pair (
    sys_currency_pair_id INTEGER PRIMARY KEY,
    from_ccy_id INTEGER,
    to_ccy_id INTEGER,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_ccy_id) REFERENCES sys_currency(sys_currency_id),
    FOREIGN KEY(to_ccy_id) REFERENCES sys_currency(sys_currency_id),
    UNIQUE(from_ccy_id, to_ccy_id)
);

CREATE TABLE sys_fx_rate (
    sys_fx_rate_id INTEGER PRIMARY KEY,
    sys_currency_pair_id INTEGER,
    business_date DATE,
    fx_rate REAL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sys_currency_pair_id) REFERENCES sys_currency_pair(sys_currency_pair_id),
    UNIQUE(sys_currency_pair_id, business_date)

);

CREATE TABLE sys_config (
    sys_config_id INTEGER PRIMARY KEY,
    config_key VARCHAR(250) NOT NULL,
    config_value VARCHAR(250) NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_key)
);

CREATE TABLE sys_staging_fields (
    sys_staging_fields_id INTEGER PRIMARY KEY,
    staging_table_fieldname VARCHAR(250) NOT NULL,
    datatype VARCHAR(250) NOT NULL,
    default_value VARCHAR(250),
    derived_field INT NOT NULL,
    unique_records INT NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(staging_table_fieldname)
);


CREATE VIEW vw_transaction_final_category AS
SELECT t.sys_transaction_id,
       t.description,
       c.category_name,
       m.is_auto,
       m.confidence
FROM sys_transaction t
JOIN sys_transaction_category_map m 
    ON t.sys_transaction_id = m.sys_transaction_id
JOIN sys_transaction_category c 
    ON m.sys_transaction_category_id = c.sys_transaction_category_id
WHERE m.is_auto = 0

UNION

SELECT t.sys_transaction_id,
       t.description,
       c.category_name,
       m.is_auto,
       m.confidence
FROM sys_transaction t
JOIN sys_transaction_category_map m 
    ON t.sys_transaction_id = m.sys_transaction_id
JOIN sys_transaction_category c 
    ON m.sys_transaction_category_id = c.sys_transaction_category_id
WHERE m.is_auto = 1
AND NOT EXISTS (
    SELECT 1
    FROM sys_transaction_category_map m2
    WHERE m2.sys_transaction_id = m.sys_transaction_id
    AND m2.is_auto = 0
);

INSERT INTO sys_currency (currency_code) VALUES ('USD');
INSERT INTO sys_currency (currency_code) VALUES ('GBP');
INSERT INTO sys_currency (currency_code) VALUES ('EUR');

INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'));
INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'GBP'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'GBP'));
INSERT INTO sys_currency_pair (from_ccy_id, to_ccy_id) VALUES ((SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'EUR'),(SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'EUR'));


INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('sys_account_source_id', 'INT', '', 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('account_base_curr', 'VARCHAR(10)', (SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'), 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('account_source_filename', 'VARCHAR(250)', '', 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('account_source_row', 'INT', '', 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('debit_negative', 'INT', -1, 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('abs_debit_credit', 'INT', 0, 1, 1);
INSERT INTO sys_staging_fields (staging_table_fieldname, datatype , default_value, derived_field, unique_records ) VALUES ('created_date', 'INT', 'CURRENT_TIMESTAMP', 1, 1);

INSERT INTO sys_account_source (sys_account_source_id, account_source_name) VALUES (1, 'System rule');

INSERT INTO sys_config (config_key, config_value) VALUES ('reporting_currency', (SELECT sys_currency_id FROM sys_currency WHERE currency_code = 'USD'));
INSERT INTO sys_config (config_key, config_value) VALUES ('dark_mode', 0);