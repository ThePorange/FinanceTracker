-- =========================================================================
-- Script: Delete all transactions for a specific sys_import_log_id
-- =========================================================================
-- Instructions: 
-- Replace all instances of '?' below with the actual sys_import_log_id
-- you want to delete (e.g., 1).
-- =========================================================================

-- Use a transaction to ensure atomicity 
-- (If any step fails, the whole deletion is reverted)
BEGIN TRANSACTION;

-- 1. First, delete associated category mappings for these transactions.
--    This is required because sys_transaction_category_map has a foreign key 
--    referencing sys_transaction(sys_transaction_id) and we are not using
--    ON DELETE CASCADE.
DELETE FROM sys_transaction_category_map
WHERE sys_transaction_id IN (
    SELECT sys_transaction_id
    FROM sys_transaction
    WHERE sys_import_log_id = ?
);

-- 2. Next, delete the transactions themselves.
DELETE FROM sys_transaction
WHERE sys_import_log_id = ?;

-- 3. (Optional) Uncomment the lines below if you also want to delete the 
--    import log record itself after removing its transactions.
-- DELETE FROM sys_import_log
-- WHERE sys_import_log_id = ?;

-- Commit the changes to the database
COMMIT;
