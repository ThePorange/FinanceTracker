import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Drawer } from './Drawer';

export interface GridColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'boolean';
  editable?: boolean;
}

interface SaaSDatagridProps {
  data: any[];
  columns: GridColumn[];
  pk: string;
  isLoading?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  onSave: (row: any, isNew: boolean) => Promise<void>;
  onDelete?: (id: any) => Promise<void>;
  onCustomEdit?: (row: any) => void;
}

export function SaaSDatagrid({ data, columns, pk, isLoading, canCreate = true, canDelete = true, canEdit = true, onSave, onDelete, onCustomEdit }: SaaSDatagridProps) {
  const [search, setSearch] = useState('');
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
  
  const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set());

  // Filtering
  const filteredData = useMemo(() => {
    if (!search) return data || [];
    const lower = search.toLowerCase();
    return (data || []).filter(row => columns.some(c => String(row[c.key] || '').toLowerCase().includes(lower)));
  }, [data, search, columns]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filteredData, currentPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(r => r[pk])));
    }
  };

  const toggleSelect = (id: any) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleEdit = (row: any) => {
    if (onCustomEdit) {
      onCustomEdit(row);
      return;
    }
    setEditingRow(row);
    setIsDrawerOpen(true);
  };

  const handleCreate = () => {
    setEditingRow(null);
    setIsDrawerOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: any = {};
    columns.forEach(c => {
      payload[c.key] = formData.get(c.key) as string;
    });
    if (editingRow) {
      payload[pk] = editingRow[pk]; // retain PK
    }
    try {
      await onSave(payload, !editingRow);
      setIsDrawerOpen(false);
    } catch (e: any) {
      alert(`Invalid configuration payload rejected by constraints:\n${e.message}`);
    }
  };

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col pt-5">
      {/* Header Toolbar */}
      <div className="px-6 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search all columns..." 
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm active:scale-95">
            <Filter size={16} className="text-gray-500" /> Filters
          </button>
          {canCreate && (
            <button onClick={handleCreate} className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-indigo-500/50 active:scale-95">
              <Plus size={16} /> Add Record
            </button>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="overflow-x-auto w-full min-h-[500px]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                />
              </th>
              {columns.map(c => (
                <th key={c.key} className="px-6 py-4 tracking-wide text-xs uppercase">{c.label}</th>
              ))}
              <th className="px-6 py-4 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {isLoading && paginatedData.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="px-6 py-16 text-center text-gray-400 font-medium tracking-tight">Loading records...</td></tr>
            ) : paginatedData.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="px-6 py-16 text-center text-gray-400 font-medium tracking-tight">No data available matching criteria.</td></tr>
            ) : paginatedData.map((row) => (
              <tr key={row[pk]} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4 text-center">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(row[pk])}
                    onChange={() => toggleSelect(row[pk])}
                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </td>
                {columns.map(c => (
                  <td key={c.key} className="px-6 py-4">
                    {c.key === pk ? (
                      <span className="font-semibold text-gray-900 bg-gray-100/80 px-2.5 py-1 rounded-md border border-gray-200/50 text-xs font-mono">{row[c.key]}</span>
                    ) : (
                      <span className="text-gray-600 font-medium">{row[c.key]?.toString() || <span className="text-gray-300 italic">-</span>}</span>
                    )}
                  </td>
                ))}
                <td className="px-6 py-4 flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && (
                    <button onClick={() => handleEdit(row)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100">
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => { if(confirm('Delete record?')) onDelete?.(row[pk]) }} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-100">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-gray-50/50 rounded-b-2xl">
        <span className="text-sm text-gray-500 font-medium">
          Showing <span className="font-bold text-gray-900">{paginatedData.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * PAGE_SIZE, filteredData.length)}</span> of <span className="font-bold text-gray-900">{filteredData.length}</span> results
        </span>
        <div className="flex items-center gap-1">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 text-sm font-semibold text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-transparent transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Editing Drawer */}
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title={editingRow ? 'Modify Record Parameter' : 'Create Sandbox Registration'}>
        <form onSubmit={handleSaveForm} className="p-6 space-y-6">
          <div className="space-y-5">
            {columns.map(c => {
              if (c.key === pk && !editingRow) return null; // skip PK on create
              return (
                <div key={c.key} className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-slate-700 tracking-tight">{c.label}</label>
                  <input 
                    type={c.type === 'number' ? 'number' : 'text'}
                    name={c.key}
                    defaultValue={editingRow ? editingRow[c.key] : ''}
                    readOnly={!canEdit || c.editable === false || (c.key === pk)}
                    className={`w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 border transition-all ${(!canEdit || c.editable === false || c.key === pk) ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed shadow-inner' : 'bg-white border-slate-300 text-slate-900 shadow-sm'}`}
                    placeholder={`Enter explicit mapping logic for ${c.key}...`}
                  />
                </div>
              );
            })}
          </div>
          <div className="pt-6 border-t border-slate-100">
            <button type="submit" className="w-full flex justify-center py-3.5 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0">
              {editingRow ? 'Commit Mutated Payload' : 'Authorize New Node'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
