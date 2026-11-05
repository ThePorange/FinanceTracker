import type { Transaction } from '../../types';

export interface TransactionFieldConfig {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  searchable: boolean;
}

export const ALL_TRANSACTION_FIELDS: TransactionFieldConfig[] = [
  // Initial 8 visible fields
  { key: 'posting_date', label: 'Posting Date', visible: true, order: 1, searchable: false },
  { key: 'transaction_date', label: 'Transaction Date', visible: true, order: 2, searchable: false },
  { key: 'description', label: 'Description', visible: true, order: 3, searchable: true },
  { key: 'amount', label: 'Amount', visible: true, order: 4, searchable: false },
  { key: 'drcr', label: 'DR/CR', visible: true, order: 5, searchable: false },
  { key: 'account', label: 'Account', visible: true, order: 6, searchable: false },
  { key: 'autoCategory', label: 'Auto Category', visible: true, order: 7, searchable: false },
  { key: 'userCategory', label: 'User Category', visible: true, order: 8, searchable: false },

  // Non-sys_ fields from sys_transaction & joined menu fields
  { key: 'transaction_type', label: 'Type', visible: false, order: 9, searchable: false },
  { key: 'reference', label: 'Reference', visible: false, order: 10, searchable: false },
  { key: 'base_amount', label: 'Base Amount', visible: false, order: 11, searchable: false },
  { key: 'base_curr_id', label: 'Base Currency ID', visible: false, order: 12, searchable: false },
  { key: 'base_curr_balance', label: 'Base Currency Balance', visible: false, order: 13, searchable: false },
  { key: 'extended_details', label: 'Extended Details', visible: false, order: 14, searchable: false },
  { key: 'statement_description', label: 'Statement Description', visible: false, order: 15, searchable: false },
  { key: 'address_line1', label: 'Address Line 1', visible: false, order: 16, searchable: false },
  { key: 'town_city', label: 'Town / City', visible: false, order: 17, searchable: false },
  { key: 'postcode', label: 'Postcode', visible: false, order: 18, searchable: false },
  { key: 'country', label: 'Country', visible: false, order: 19, searchable: false },
  { key: 'memo', label: 'Memo', visible: false, order: 20, searchable: false },
  { key: 'check_or_slip_number', label: 'Check or Slip Number', visible: false, order: 21, searchable: false },
  { key: 'account_source_type', label: 'Account Source Type', visible: false, order: 22, searchable: false },
  { key: 'account_source_row', label: 'Account Source Row', visible: false, order: 23, searchable: false },
  { key: 'created_date', label: 'Created Date', visible: false, order: 24, searchable: false },
  { key: 'record', label: 'Record', visible: false, order: 25, searchable: false },
  { key: 'records', label: 'Records', visible: false, order: 26, searchable: false },
  { key: 'row_checksum', label: 'Row Checksum', visible: false, order: 27, searchable: false },

  // System fields (prefixed with "sys_")
  { key: 'sys_transaction_id', label: 'sys_transaction_id', visible: false, order: 28, searchable: false },
  { key: 'sys_account_source_id', label: 'sys_account_source_id', visible: false, order: 29, searchable: false },
  { key: 'sys_import_log_id', label: 'sys_import_log_id', visible: false, order: 30, searchable: false },
  { key: 'sys_transaction_type_id', label: 'sys_transaction_type_id', visible: false, order: 31, searchable: false },
  { key: 'sys_rule_id', label: 'sys_rule_id', visible: false, order: 32, searchable: false },
];

export const INITIAL_TRANSACTION_FIELDS: TransactionFieldConfig[] = ALL_TRANSACTION_FIELDS.map((f) => ({
  ...f,
}));

/**
 * Normalizes field configuration loaded from sys_config JSON,
 * ensuring all known fields are present and properly formatted.
 */
export function normalizeTransactionFields(
  savedConfig?: any
): TransactionFieldConfig[] {
  if (!Array.isArray(savedConfig) || savedConfig.length === 0) {
    return ALL_TRANSACTION_FIELDS.map((f) => ({ ...f }));
  }

  const savedMap = new Map<string, any>();
  savedConfig.forEach((item) => {
    if (item && item.key) {
      savedMap.set(item.key, item);
    }
  });

  const merged: TransactionFieldConfig[] = ALL_TRANSACTION_FIELDS.map(
    (defaultField) => {
      const saved = savedMap.get(defaultField.key);
      if (!saved) return { ...defaultField };

      const visible = typeof saved.visible === 'boolean' ? saved.visible : defaultField.visible;
      // Searchable requires visible to be true
      const searchable = visible && (typeof saved.searchable === 'boolean' ? saved.searchable : defaultField.searchable);

      return {
        key: defaultField.key,
        label: typeof saved.label === 'string' && saved.label.trim() ? saved.label : defaultField.label,
        visible,
        order: typeof saved.order === 'number' && !isNaN(saved.order) ? saved.order : defaultField.order,
        searchable,
      };
    }
  );

  // Sort by order ascending
  return merged.sort((a, b) => a.order - b.order);
}

/**
 * Checks if a transaction matches the search query across all configured searchable fields.
 */
export function matchesTransactionSearch(
  txn: Transaction,
  search: string,
  fieldConfigs: TransactionFieldConfig[]
): boolean {
  if (!search || !search.trim()) return true;
  const lower = search.trim().toLowerCase();

  // Find all fields that have visible: true AND searchable: true
  const activeSearchKeys = fieldConfigs
    .filter((f) => f.visible && f.searchable)
    .map((f) => f.key);

  // Fallback to description if no fields are explicitly marked searchable
  const keysToSearch = activeSearchKeys.length > 0 ? activeSearchKeys : ['description'];

  return keysToSearch.some((key) => {
    let val: any = (txn as any)[key];

    // Fallbacks for common aliases
    if (val == null) {
      if (key === 'amount') val = (txn as any).base_amount;
      else if (key === 'base_amount') val = txn.amount;
      else if (key === 'sys_transaction_id') val = txn.id;
    }

    if (val == null) return false;
    return String(val).toLowerCase().includes(lower);
  });
}
