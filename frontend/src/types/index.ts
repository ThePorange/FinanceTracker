export interface Transaction {
  id: string;
  date: string;
  posting_date?: string;
  transaction_date?: string;
  description: string;
  amount: number;
  drcr?: string;
  account: string;
  autoCategory: string;
  userCategory: string | null;
  transaction_type?: string;
  row_checksum?: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
}

export interface MappingRule {
  id: string;
  pattern: string;
  categoryId: string;
  priority: number;
}
