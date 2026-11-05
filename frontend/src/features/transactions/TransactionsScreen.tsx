import { useState, useMemo, useEffect } from 'react';
import { useTransactions } from './useTransactions';
import { useTransactionFilters } from './TransactionFilterContext';
import { DataTable } from '../../components/shared/DataTable';
import type { Transaction } from '../../types';
import { TransactionDetailPanel } from './TransactionDetailPanel';
import { Input } from '../../components/shared/Input';
import { ChevronLeft, ChevronRight, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { TransactionFilterPanel } from './TransactionFilterPanel';
import { useSystemData } from '../admin/useSystemData';
import { formatLocalDate } from '../../utils/dateUtils';
import { useConfig, useUpdateConfig } from '../admin/useConfig';
import {
  normalizeTransactionFields,
  type TransactionFieldConfig,
  INITIAL_TRANSACTION_FIELDS,
  matchesTransactionSearch,
} from './transactionFieldConfig';
import { SelectFieldsModal } from './SelectFieldsModal';
import { MoreOptionsDropdown } from './MoreOptionsDropdown';

const PAGE_SIZE = 50;

export function TransactionsScreen() {
  const { filters, setFilters, search, setSearch } = useTransactionFilters();
  const { data: transactions, isLoading, error } = useTransactions(filters);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('posting_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isSelectFieldsOpen, setIsSelectFieldsOpen] = useState(false);

  // Read field configuration from sys_config
  const { data: appConfig } = useConfig();
  const updateConfigMutation = useUpdateConfig();

  const fieldConfig = useMemo(() => {
    return normalizeTransactionFields(appConfig?.transaction_fields);
  }, [appConfig?.transaction_fields]);

  const activeVisibleColumns = useMemo(() => {
    return [...fieldConfig]
      .filter((f) => f.visible)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [fieldConfig]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="inline ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="inline ml-1 text-blue-300" />
      : <ChevronDown size={13} className="inline ml-1 text-blue-300" />;
  };

  const th = (label: string, col: string) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-0.5 hover:text-blue-300 transition-colors font-medium whitespace-nowrap cursor-pointer">
      {label}<SortIcon col={col} />
    </button>
  );

  const filtered = useMemo(() => {
    let source: Transaction[] = Array.isArray(transactions) ? transactions : ((transactions as any)?.data || []);
    if (search) {
      source = source.filter((t: Transaction) => matchesTransactionSearch(t, search, fieldConfig));
    }
    const sorted = [...source].sort((a: any, b: any) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [transactions, search, sortKey, sortDir, fieldConfig]);

  const { totalCR, totalDR } = useMemo(() => {
    let cr = 0;
    let dr = 0;
    filtered.forEach((t) => {
      const amt = Math.abs(t.amount || 0);
      if (t.drcr === 'CR') cr += amt;
      else if (t.drcr === 'DR') dr += amt;
    });
    return { totalCR: cr, totalDR: dr };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const { data: sourcesData } = useSystemData('sys_account_source');
  const { data: groupsData } = useSystemData('sys_account_group');
  const { data: typesData } = useSystemData('sys_transaction_type');
  const { data: rulesData } = useSystemData('sys_rules');

  const sources = sourcesData?.data || sourcesData || [];
  const groups = groupsData?.data || groupsData || [];
  const types = typesData?.data || typesData || [];
  const rules = rulesData?.data || rulesData || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortKey, sortDir]);

  // Column definitions mapping key to rendering logic
  const COLUMN_DEFINITIONS: Record<
    string,
    {
      label: string;
      sortKey: string;
      renderCell: (txn: Transaction) => React.ReactNode;
      renderCsv: (txn: Transaction) => string;
    }
  > = {
    posting_date: {
      label: 'Posting Date',
      sortKey: 'posting_date',
      renderCell: (txn) => (
        <td key="posting_date" className="px-4 py-4 text-gray-600 group-hover:text-gray-900 whitespace-nowrap">
          {formatLocalDate(txn.posting_date)}
        </td>
      ),
      renderCsv: (txn) => formatLocalDate(txn.posting_date),
    },
    transaction_date: {
      label: 'Transaction Date',
      sortKey: 'transaction_date',
      renderCell: (txn) => (
        <td key="transaction_date" className="px-4 py-4 text-gray-600 group-hover:text-gray-900 whitespace-nowrap">
          {formatLocalDate(txn.transaction_date)}
        </td>
      ),
      renderCsv: (txn) => formatLocalDate(txn.transaction_date),
    },
    description: {
      label: 'Description',
      sortKey: 'description',
      renderCell: (txn) => (
        <td key="description" className="px-4 py-4 font-medium text-gray-800">
          {txn.description}
        </td>
      ),
      renderCsv: (txn) => `"${(txn.description || '').replace(/"/g, '""')}"`,
    },
    amount: {
      label: 'Amount',
      sortKey: 'amount',
      renderCell: (txn) => (
        <td key="amount" className="px-4 py-4 font-medium text-gray-900 whitespace-nowrap">
          ${txn.amount != null ? Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(txn.amount) : '0.00'}
        </td>
      ),
      renderCsv: (txn) => (txn.amount != null ? String(txn.amount) : ''),
    },
    drcr: {
      label: 'DR/CR',
      sortKey: 'drcr',
      renderCell: (txn) => (
        <td key="drcr" className="px-4 py-4 text-gray-600 font-bold">
          {txn.drcr || '-'}
        </td>
      ),
      renderCsv: (txn) => txn.drcr || '-',
    },
    account: {
      label: 'Account',
      sortKey: 'account',
      renderCell: (txn) => (
        <td key="account" className="px-4 py-4 text-gray-500">
          {txn.account}
        </td>
      ),
      renderCsv: (txn) => `"${(txn.account || '').replace(/"/g, '""')}"`,
    },
    autoCategory: {
      label: 'Auto Category',
      sortKey: 'autoCategory',
      renderCell: (txn) => (
        <td key="autoCategory" className="px-4 py-4">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
            {txn.autoCategory || 'None'}
          </span>
        </td>
      ),
      renderCsv: (txn) => `"${(txn.autoCategory || '').replace(/"/g, '""')}"`,
    },
    userCategory: {
      label: 'User Category',
      sortKey: 'userCategory',
      renderCell: (txn) => (
        <td key="userCategory" className="px-4 py-4">
          {txn.userCategory ? (
            <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
              {txn.userCategory}
            </span>
          ) : (
            <span className="text-gray-400 text-sm italic">Unassigned</span>
          )}
        </td>
      ),
      renderCsv: (txn) => `"${(txn.userCategory || '').replace(/"/g, '""')}"`,
    },
    transaction_type: {
      label: 'Type',
      sortKey: 'transaction_type',
      renderCell: (txn) => (
        <td key="transaction_type" className="px-4 py-4 text-gray-500 text-sm">
          {txn.transaction_type || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${(txn.transaction_type || '').replace(/"/g, '""')}"`,
    },
    reference: {
      label: 'Reference',
      sortKey: 'reference',
      renderCell: (txn) => (
        <td key="reference" className="px-4 py-4 text-gray-500 text-sm font-mono">
          {txn.reference || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${(txn.reference || '').replace(/"/g, '""')}"`,
    },
    base_amount: {
      label: 'Base Amount',
      sortKey: 'base_amount',
      renderCell: (txn) => (
        <td key="base_amount" className="px-4 py-4 font-medium text-gray-900 whitespace-nowrap">
          ${(txn as any).base_amount != null ? Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((txn as any).base_amount) : '0.00'}
        </td>
      ),
      renderCsv: (txn) => ((txn as any).base_amount != null ? String((txn as any).base_amount) : ''),
    },
    base_curr_id: {
      label: 'Base Currency ID',
      sortKey: 'base_curr_id',
      renderCell: (txn) => (
        <td key="base_curr_id" className="px-4 py-4 text-gray-500 text-sm">
          {(txn as any).base_curr_id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).base_curr_id ?? ''),
    },
    base_curr_balance: {
      label: 'Base Currency Balance',
      sortKey: 'base_curr_balance',
      renderCell: (txn) => (
        <td key="base_curr_balance" className="px-4 py-4 text-gray-700 text-sm whitespace-nowrap">
          {(txn as any).base_curr_balance != null ? `$${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((txn as any).base_curr_balance)}` : '-'}
        </td>
      ),
      renderCsv: (txn) => ((txn as any).base_curr_balance != null ? String((txn as any).base_curr_balance) : ''),
    },
    extended_details: {
      label: 'Extended Details',
      sortKey: 'extended_details',
      renderCell: (txn) => (
        <td key="extended_details" className="px-4 py-4 text-gray-600 text-sm max-w-xs truncate">
          {(txn as any).extended_details || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).extended_details || '').replace(/"/g, '""')}"`,
    },
    statement_description: {
      label: 'Statement Description',
      sortKey: 'statement_description',
      renderCell: (txn) => (
        <td key="statement_description" className="px-4 py-4 text-gray-600 text-sm max-w-xs truncate">
          {(txn as any).statement_description || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).statement_description || '').replace(/"/g, '""')}"`,
    },
    address_line1: {
      label: 'Address Line 1',
      sortKey: 'address_line1',
      renderCell: (txn) => (
        <td key="address_line1" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).address_line1 || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).address_line1 || '').replace(/"/g, '""')}"`,
    },
    town_city: {
      label: 'Town / City',
      sortKey: 'town_city',
      renderCell: (txn) => (
        <td key="town_city" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).town_city || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).town_city || '').replace(/"/g, '""')}"`,
    },
    postcode: {
      label: 'Postcode',
      sortKey: 'postcode',
      renderCell: (txn) => (
        <td key="postcode" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).postcode || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).postcode || '').replace(/"/g, '""')}"`,
    },
    country: {
      label: 'Country',
      sortKey: 'country',
      renderCell: (txn) => (
        <td key="country" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).country || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).country || '').replace(/"/g, '""')}"`,
    },
    memo: {
      label: 'Memo',
      sortKey: 'memo',
      renderCell: (txn) => (
        <td key="memo" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).memo || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).memo || '').replace(/"/g, '""')}"`,
    },
    check_or_slip_number: {
      label: 'Check or Slip Number',
      sortKey: 'check_or_slip_number',
      renderCell: (txn) => (
        <td key="check_or_slip_number" className="px-4 py-4 text-gray-600 text-sm font-mono">
          {(txn as any).check_or_slip_number || '-'}
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).check_or_slip_number || '').replace(/"/g, '""')}"`,
    },
    account_source_type: {
      label: 'Account Source Type',
      sortKey: 'account_source_type',
      renderCell: (txn) => (
        <td key="account_source_type" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).account_source_type || '-'}
        </td>
      ),
      renderCsv: (txn) => (txn as any).account_source_type || '-',
    },
    account_source_row: {
      label: 'Account Source Row',
      sortKey: 'account_source_row',
      renderCell: (txn) => (
        <td key="account_source_row" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).account_source_row ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).account_source_row ?? ''),
    },
    created_date: {
      label: 'Created Date',
      sortKey: 'created_date',
      renderCell: (txn) => (
        <td key="created_date" className="px-4 py-4 text-gray-600 text-sm whitespace-nowrap">
          {formatLocalDate((txn as any).created_date)}
        </td>
      ),
      renderCsv: (txn) => formatLocalDate((txn as any).created_date),
    },
    record: {
      label: 'Record',
      sortKey: 'record',
      renderCell: (txn) => (
        <td key="record" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).record ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).record ?? ''),
    },
    records: {
      label: 'Records',
      sortKey: 'records',
      renderCell: (txn) => (
        <td key="records" className="px-4 py-4 text-gray-600 text-sm">
          {(txn as any).records ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).records ?? ''),
    },
    row_checksum: {
      label: 'Row Checksum',
      sortKey: 'row_checksum',
      renderCell: (txn) => (
        <td key="row_checksum" className="px-4 py-4 text-gray-500 text-xs font-mono max-w-xs truncate" title={(txn as any).row_checksum}>
          {((txn as any).row_checksum || '-').slice(0, 12)}...
        </td>
      ),
      renderCsv: (txn) => `"${((txn as any).row_checksum || '').replace(/"/g, '""')}"`,
    },
    sys_transaction_id: {
      label: 'sys_transaction_id',
      sortKey: 'sys_transaction_id',
      renderCell: (txn) => (
        <td key="sys_transaction_id" className="px-4 py-4 font-mono text-purple-900 text-xs">
          {(txn as any).sys_transaction_id ?? txn.id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).sys_transaction_id ?? txn.id ?? ''),
    },
    sys_account_source_id: {
      label: 'sys_account_source_id',
      sortKey: 'sys_account_source_id',
      renderCell: (txn) => (
        <td key="sys_account_source_id" className="px-4 py-4 font-mono text-purple-900 text-xs">
          {(txn as any).sys_account_source_id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).sys_account_source_id ?? ''),
    },
    sys_import_log_id: {
      label: 'sys_import_log_id',
      sortKey: 'sys_import_log_id',
      renderCell: (txn) => (
        <td key="sys_import_log_id" className="px-4 py-4 font-mono text-purple-900 text-xs">
          {(txn as any).sys_import_log_id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).sys_import_log_id ?? ''),
    },
    sys_transaction_type_id: {
      label: 'sys_transaction_type_id',
      sortKey: 'sys_transaction_type_id',
      renderCell: (txn) => (
        <td key="sys_transaction_type_id" className="px-4 py-4 font-mono text-purple-900 text-xs">
          {(txn as any).sys_transaction_type_id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).sys_transaction_type_id ?? ''),
    },
    sys_rule_id: {
      label: 'sys_rule_id',
      sortKey: 'sys_rule_id',
      renderCell: (txn) => (
        <td key="sys_rule_id" className="px-4 py-4 font-mono text-purple-900 text-xs">
          {(txn as any).sys_rule_id ?? '-'}
        </td>
      ),
      renderCsv: (txn) => String((txn as any).sys_rule_id ?? ''),
    },
  };

  const exportToCsv = () => {
    if (!filtered || filtered.length === 0) return;

    const filterInfo = [];
    if (filters.startDate) filterInfo.push(`Start Date,${filters.startDate}`);
    if (filters.endDate) filterInfo.push(`End Date,${filters.endDate}`);
    
    if (filters.sourceId) {
      const s = sources.find((x: any) => x.sys_account_source_id.toString() === filters.sourceId.toString());
      filterInfo.push(`Account Source,${s ? s.account_source_name : filters.sourceId}`);
    }
    if (filters.groupId) {
      const g = groups.find((x: any) => x.sys_account_group_id.toString() === filters.groupId.toString());
      filterInfo.push(`Account Group,${g ? g.account_group_name : filters.groupId}`);
    }
    if (filters.category) filterInfo.push(`Category Lookup,${filters.category}`);
    if (filters.typeId) {
      const t = types.find((x: any) => x.sys_transaction_type_id.toString() === filters.typeId.toString());
      filterInfo.push(`Transaction Type,${t ? t.transaction_type : filters.typeId}`);
    }
    if (filters.ruleId) {
      const r = rules.find((x: any) => x.sys_rules_id.toString() === filters.ruleId.toString());
      filterInfo.push(`Applied Rule,${r ? r.rule_name : filters.ruleId}`);
    }
    if (filters.drcr) filterInfo.push(`Debit/Credit,${filters.drcr === 'DR' ? 'Debits' : 'Credits'}`);
    if (filters.amountVal) filterInfo.push(`Amount,${filters.amountOp || '='}${filters.amountVal}`);
    if (search) filterInfo.push(`Search,${search}`);
    
    if (filterInfo.length === 0) filterInfo.push("Filters,None");

    // Dynamic headers based on visible columns in order
    const headers = activeVisibleColumns.map((col) => col.label);
    const rows = filtered.map((t) =>
      activeVisibleColumns.map((col) => {
        const def = COLUMN_DEFINITIONS[col.key];
        return def ? def.renderCsv(t) : `"${String((t as any)[col.key] ?? '').replace(/"/g, '""')}"`;
      })
    );

    const csvStr = [
      ...filterInfo,
      '',
      '',
      headers.join(','), 
      ...rows.map((r) => r.join(','))
    ].join('\n');

    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveFields = async (newFields: TransactionFieldConfig[]) => {
    await updateConfigMutation.mutateAsync({
      transaction_fields: newFields,
    });
  };

  const handleResetFields = async () => {
    await updateConfigMutation.mutateAsync({
      transaction_fields: INITIAL_TRANSACTION_FIELDS,
    });
  };

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Failed to load transactions. Please check your API connection.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Transactions</h1>
          <p className="text-gray-500 mt-1">Manage and categorize your raw financial data.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-72">
            <Input 
              placeholder="Search descriptions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={exportToCsv}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          
          {/* More Options Button with 3 horizontal ellipses */}
          <MoreOptionsDropdown 
            onSelectFields={() => setIsSelectFieldsOpen(true)}
          />
        </div>
      </div>
      
      <TransactionFilterPanel 
         filters={filters} 
         onFilterChange={(f) => { setFilters(f); setCurrentPage(1); }} 
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Credits (Inflow)</span>
            <span className="text-3xl font-bold text-green-600">${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCR)}</span>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Debits (Outflow)</span>
            <span className="text-3xl font-bold text-rose-600">${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalDR)}</span>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Net Total</span>
            <span className={`text-3xl font-bold ${totalCR - totalDR >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>
               ${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCR - totalDR)}
            </span>
         </div>
      </div>
      
      <DataTable 
        headers={activeVisibleColumns.map((col) => {
          const def = COLUMN_DEFINITIONS[col.key];
          return th(col.label, def?.sortKey || col.key);
        })}
        isLoading={isLoading}
      >
        {paginated.map((txn) => (
          <tr 
            key={txn.id} 
            className="hover:bg-gray-50 cursor-pointer transition-colors group"
            onClick={() => setSelectedTxn(txn)}
          >
            {activeVisibleColumns.map((col) => {
              const def = COLUMN_DEFINITIONS[col.key];
              return def ? (
                def.renderCell(txn)
              ) : (
                <td key={col.key} className="px-4 py-4 text-gray-500">
                  {String((txn as any)[col.key] ?? '-')}
                </td>
              );
            })}
          </tr>
        ))}
        {filtered.length === 0 && !isLoading && (
          <tr>
            <td colSpan={Math.max(1, activeVisibleColumns.length)} className="text-center py-12 text-gray-500">
              No transactions found matching your search.
            </td>
          </tr>
        )}
      </DataTable>

      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between bg-white px-6 py-4 shadow-sm border border-slate-200 rounded-xl mt-4">
          <p className="text-sm font-medium text-slate-500 tracking-tight">
            Showing <span className="font-bold text-slate-900">{((currentPage - 1) * PAGE_SIZE) + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-bold text-slate-900">{filtered.length}</span> instances
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-slate-700 px-4">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      <TransactionDetailPanel 
        transaction={selectedTxn} 
        onClose={() => setSelectedTxn(null)} 
      />

      {/* Select Fields Configuration Modal */}
      <SelectFieldsModal
        isOpen={isSelectFieldsOpen}
        onClose={() => setIsSelectFieldsOpen(false)}
        currentFields={fieldConfig}
        onSave={handleSaveFields}
        onReset={handleResetFields}
        isSaving={updateConfigMutation.isPending}
      />
    </div>
  );
}
