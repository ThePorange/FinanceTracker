import { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '../transactions/useTransactions';
import { TransactionFilterPanel } from '../transactions/TransactionFilterPanel';
import { DataTable } from '../../components/shared/DataTable';
import type { Transaction } from '../../types';
import { ChevronLeft, ChevronRight, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface TransactionSelectorModalProps {
  onClose: () => void;
  onSave: (checksums: string[]) => void;
  initialChecksums?: string[];
  mode?: 'select' | 'exclude';
}

const PAGE_SIZE = 50;

export function TransactionSelectorModal({ onClose, onSave, initialChecksums = [], mode = 'select' }: TransactionSelectorModalProps) {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // We keep a map of selected transactions by row_checksum so we can display them
  // even if they are not on the current page.
  const [selectedMap, setSelectedMap] = useState<Map<string, Transaction>>(() => {
    const map = new Map<string, Transaction>();
    initialChecksums.forEach(c => {
      // Create a dummy transaction to satisfy the map; it will be overwritten if actually rendered
      map.set(c, { row_checksum: c, id: '', date: '', description: 'Pre-selected Transaction', amount: 0, account: '', autoCategory: '', userCategory: null });
    });
    return map;
  });

  // We only fetch transactions based on filters
  const { data: transactions, isLoading } = useTransactions(filters);

  // Fetch true data for pre-selected checksums
  const initialChecksumString = initialChecksums.join(',');
  const { data: preSelectedTransactions } = useTransactions(
    { checksums: initialChecksumString },
    { enabled: initialChecksums.length > 0 }
  );

  useEffect(() => {
    if (preSelectedTransactions && preSelectedTransactions.length > 0) {
      setSelectedMap(prev => {
        const nextMap = new Map(prev);
        let changed = false;
        preSelectedTransactions.forEach((t: Transaction) => {
          if (t.row_checksum && nextMap.has(t.row_checksum)) {
            const existing = nextMap.get(t.row_checksum);
            if (existing && existing.amount === 0 && existing.description === 'Pre-selected Transaction') {
               nextMap.set(t.row_checksum, t);
               changed = true;
            }
          }
        });
        return changed ? nextMap : prev;
      });
    }
  }, [preSelectedTransactions]);

  const filtered = useMemo(() => {
    let source = transactions || [];
    if (showSelectedOnly) {
      source = Array.from(selectedMap.values());
    }
    if (search) {
      const lower = search.toLowerCase();
      source = source.filter(t => t.description?.toLowerCase().includes(lower));
    }
    // Sort
    const sorted = [...source].sort((a: any, b: any) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === 'date') {
        av = a.transaction_date || a.date || '';
        bv = b.transaction_date || b.date || '';
      }
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
  }, [transactions, search, showSelectedOnly, selectedMap, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronsUpDown size={13} className="inline ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="inline ml-1 text-blue-500" />
      : <ChevronDown size={13} className="inline ml-1 text-blue-500" />;
  };

  const th = (label: string, col: string) => (
    <button onClick={() => handleSort(col)} className="flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
      {label}<SortIcon col={col} />
    </button>
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters, showSelectedOnly, sortKey, sortDir]);

  const handleToggle = (txn: Transaction) => {
    if (!txn.row_checksum) return;
    const newMap = new Map(selectedMap);
    if (newMap.has(txn.row_checksum)) {
      newMap.delete(txn.row_checksum);
    } else {
      newMap.set(txn.row_checksum, txn);
    }
    setSelectedMap(newMap);
  };

  const handleRemoveSelected = (checksum: string) => {
    const newMap = new Map(selectedMap);
    newMap.delete(checksum);
    setSelectedMap(newMap);
  };

  const handleSave = () => {
    onSave(Array.from(selectedMap.keys()));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{mode === 'exclude' ? 'Exclude Transactions' : 'Select Transactions'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Filter and manually pick transactions to {mode === 'exclude' ? 'exclude from' : 'attach to'} this rule.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 flex flex-col gap-4 bg-gray-50">
          
          <div className="shrink-0">
            <TransactionFilterPanel 
              filters={filters} 
              onFilterChange={(f) => { setFilters(f); setCurrentPage(1); }} 
              defaultExpanded={true}
            />
          </div>

          {selectedMap.size > 0 && (
             <div className="bg-white border border-blue-200 rounded-xl shadow-sm p-4 shrink-0">
                <h3 className="text-sm font-bold text-blue-900 mb-3 flex justify-between items-center">
                   <span>Currently Selected ({selectedMap.size})</span>
                   <div className="flex items-center gap-4">
                       <button 
                          onClick={() => setShowSelectedOnly(!showSelectedOnly)} 
                          className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors border ${showSelectedOnly ? 'bg-blue-600 text-white border-blue-700 shadow-inner' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}
                       >
                          {showSelectedOnly ? 'Show All Results' : 'View Selected Only'}
                       </button>
                       <button onClick={() => setSelectedMap(new Map())} className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline decoration-transparent hover:decoration-blue-800 transition-all">Clear All</button>
                   </div>
                </h3>
                <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2 pr-2">
                   {Array.from(selectedMap.values()).map(t => (
                      <div key={t.row_checksum} className="bg-blue-50 border border-blue-100 text-blue-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                         <span className="truncate max-w-[200px] font-medium" title={t.description}>{t.description}</span>
                         <span className="font-bold font-mono text-xs opacity-70">${t.amount?.toFixed(2)}</span>
                         <button onClick={() => t.row_checksum && handleRemoveSelected(t.row_checksum)} className="text-blue-400 hover:text-red-500 transition-colors ml-1">
                            <X size={14} />
                         </button>
                      </div>
                   ))}
                </div>
             </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[200px]">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <input 
                  type="text"
                  placeholder="Search current results..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:ring-2 focus:ring-blue-500"
                />
             </div>
             
             <div className="flex-1 overflow-auto">
               <DataTable 
                 headers={[
                   '',
                   th('Date', 'date'),
                   th('Description', 'description'),
                   th('Amount', 'amount'),
                   th('Account', 'account'),
                   th('Category', 'autoCategory'),
                 ]}
                 isLoading={isLoading}
               >
                 {paginated.map(txn => {
                   const isSelected = txn.row_checksum ? selectedMap.has(txn.row_checksum) : false;
                   const isSelectable = !!txn.row_checksum;
                   const displayDate = txn.transaction_date || (txn as any).date || null;
                   
                   return (
                     <tr 
                       key={txn.id || txn.row_checksum} 
                       className={`hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50' : ''} ${!isSelectable ? 'opacity-50 grayscale' : ''}`}
                       onClick={() => isSelectable && handleToggle(txn)}
                     >
                       <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                         <input 
                           type="checkbox" 
                           checked={isSelected}
                           disabled={!isSelectable}
                           onChange={() => isSelectable && handleToggle(txn)}
                           className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                         />
                       </td>
                       <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{displayDate ? new Date(displayDate).toLocaleDateString() : '—'}</td>
                       <td className="px-4 py-3 text-sm font-medium text-gray-900">{txn.description}</td>
                       <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">${txn.amount?.toFixed(2) || '0.00'}</td>
                       <td className="px-4 py-3 text-sm text-gray-500">{txn.account}</td>
                       <td className="px-4 py-3">
                         <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
                           {txn.userCategory || txn.autoCategory || 'None'}
                         </span>
                       </td>
                     </tr>
                   );
                 })}
                 {filtered.length === 0 && !isLoading && (
                   <tr>
                     <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                       No transactions found matching your filters.
                     </td>
                   </tr>
                 )}
               </DataTable>
             </div>

             {!isLoading && filtered.length > 0 && (
               <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-t border-gray-200 mt-auto">
                 <p className="text-sm text-gray-500">
                   Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                 </p>
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                   >
                     <ChevronLeft size={16} />
                   </button>
                   <span className="text-sm font-medium text-gray-700 px-2">Page {currentPage} of {totalPages}</span>
                   <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="p-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                   >
                     <ChevronRight size={16} />
                   </button>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3">
           <button 
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200"
           >
              Cancel
           </button>
           <button 
              onClick={handleSave}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
           >
              Save Selection ({selectedMap.size})
           </button>
        </div>

      </div>
    </div>
  );
}
