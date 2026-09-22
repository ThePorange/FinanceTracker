-- Finance Tracker Database Migration Script
-- Safe / Idempotent Schema Migration Script for NAS deployment
-- This script contains all schema additions introduced for Reporting & Custom Analytics.
-- Running this script is safe and non-destructive: existing tables, transactions, rules, and categories will NOT be modified or lost.

-- 1. Create sys_report_definition table (Stores saved report configurations)
CREATE TABLE IF NOT EXISTS sys_report_definition (
    sys_report_definition_id INTEGER PRIMARY KEY,
    report_name VARCHAR(250) NOT NULL UNIQUE,
    chart_type VARCHAR(50) NOT NULL DEFAULT 'line',
    definition_json TEXT NOT NULL,
    created_date DATE DEFAULT CURRENT_TIMESTAMP,
    updated_date DATE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Performance Indexes (Safe / Idempotent)
CREATE INDEX IF NOT EXISTS idx_sys_report_definition_name ON sys_report_definition(report_name);
