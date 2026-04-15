import { useState, useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useTransactionFilters } from './TransactionFilterContext';
import { DataTable } from '../../components/shared/DataTable';
import type { Transaction } from '../../types';
import { TransactionDetailPanel } from './TransactionDetailPanel';
import { Input } from '../../components/shared/Input';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { TransactionFilterPanel } from './TransactionFilterPanel';

const PAGE_SIZE = 50;

export function TransactionsScreen() {
  const { filters, setFilters, search, setSearch } = useTransactionFilters();
  const { data: transactions, isLoading, error } = useTransactions(filters);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    if (!search) return transactions;
    const lower = search.toLowerCase();
    return transactions.filter(t => t.description?.toLowerCase().includes(lower));
  }, [transactions, search]);

  const { totalCR, totalDR } = useMemo(() => {
    let cr = 0;
    let dr = 0;
    filtered.forEach(t => {
      const amt = Math.abs(t.amount || 0);
      if (t.drcr === 'CR') cr += amt;
      else if (t.drcr === 'DR') dr += amt;
    });
    return { totalCR: cr, totalDR: dr };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useMemo(() => setCurrentPage(1), [search]);

  const exportToCsv = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ['Posting Date', 'Transaction Date', 'Description', 'Amount', 'DR/CR', 'Account', 'Auto Category', 'User Category', 'Type'];
    const rows = filtered.map(t => [
       t.posting_date ? new Date(t.posting_date).toLocaleDateString() : '-',
       t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : '-',
       `"${(t.description || '').replace(/"/g, '""')}"`,
       t.amount,
       t.drcr || '-',
       `"${(t.account || '').replace(/"/g, '""')}"`,
       `"${(t.autoCategory || '').replace(/"/g, '""')}"`,
       `"${(t.userCategory || '').replace(/"/g, '""')}"`,
       `"${(t.transaction_type || '').replace(/"/g, '""')}"`
    ]);
    const csvStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
        <div className="flex items-center gap-4">
          <div className="w-72">
            <Input 
              placeholder="Search descriptions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={exportToCsv}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>
      
      <TransactionFilterPanel 
         filters={filters} 
         onFilterChange={(f) => { setFilters(f); setCurrentPage(1); }} 
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Credits (Inflow)</span>
            <span className="text-3xl font-bold text-green-600">${totalCR.toFixed(2)}</span>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Debits (Outflow)</span>
            <span className="text-3xl font-bold text-rose-600">${totalDR.toFixed(2)}</span>
         </div>
      </div>
      
      <DataTable 
        headers={['Posting Date', 'Transaction Date', 'Description', 'Amount', 'DR/CR', 'Account', 'Auto Category', 'User Category', 'Type']}
        isLoading={isLoading}
      >
        {paginated.map(txn => (
          <tr 
            key={txn.id} 
            className="hover:bg-gray-50 cursor-pointer transition-colors group"
            onClick={() => setSelectedTxn(txn)}
          >
            <td className="px-4 py-4 text-gray-600 group-hover:text-gray-900">{txn.posting_date ? new Date(txn.posting_date).toLocaleDateString() : '-'}</td>
            <td className="px-4 py-4 text-gray-600 group-hover:text-gray-900">{txn.transaction_date ? new Date(txn.transaction_date).toLocaleDateString() : '-'}</td>
            <td className="px-4 py-4 font-medium text-gray-800">{txn.description}</td>
            <td className="px-4 py-4 font-medium text-gray-900">${txn.amount?.toFixed(2) || '0.00'}</td>
            <td className="px-4 py-4 text-gray-600 font-bold">{txn.drcr || '-'}</td>
            <td className="px-4 py-4 text-gray-500">{txn.account}</td>
            <td className="px-4 py-4">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                {txn.autoCategory || 'None'}
              </span>
            </td>
            <td className="px-4 py-4">
              {txn.userCategory ? (
                <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                  {txn.userCategory}
                </span>
              ) : (
                <span className="text-gray-400 text-sm italic">Unassigned</span>
              )}
            </td>
            <td className="px-4 py-4 text-gray-500 text-sm">{txn.transaction_type || '-'}</td>
          </tr>
        ))}
        {filtered.length === 0 && !isLoading && (
          <tr>
            <td colSpan={9} className="text-center py-12 text-gray-500">
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
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold text-slate-700 px-4">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm"
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
    </div>
  );
}
