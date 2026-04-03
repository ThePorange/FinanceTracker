import { useState } from 'react';
import { useSources, useUpdateSource, useDuplicateSource } from './useSources';
import { DataTable } from '../../components/shared/DataTable';
import { Database, Plus, Copy } from 'lucide-react';
import { SourceMappingWizard } from './SourceMappingWizard';

export function DataSourcesScreen() {
  const { data: sources, isLoading } = useSources();
  const updateMutation = useUpdateSource();
  const duplicateMutation = useDuplicateSource();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editSourceId, setEditSourceId] = useState<number | null>(null);

  const handleDuplicate = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    const newName = window.prompt(`Enter new title to duplicate '${s.name}':`, `${s.name} (Copy)`);
    if (!newName) return;
    duplicateMutation.mutate({ id: s.id, newName });
  };

  const toggleStatus = (e: React.MouseEvent, s: any) => {
    e.stopPropagation();
    updateMutation.mutate({ id: s.id, data: { status: s.status === 'active' ? 'disabled' : 'active' } });
  };

  const headers = ['Platform Code', 'Entity Registry', 'Extraction Engine', 'Pipeline Toggle', 'Raw Parameter Blobs', 'Actions'];

  const rows = (sources || []).map((s: any) => ({
    cells: [
      <span className="font-mono text-xs font-semibold text-slate-500">ID_{s.id.toString().padStart(4, '0')}</span>,
      <span className="font-bold text-slate-800 tracking-tight">{s.name}</span>,
      <span className="uppercase text-[10px] tracking-widest font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">{s.type}</span>,
      <button 
        onClick={(e) => toggleStatus(e, s)}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm border transition-all ${
          s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:scale-105 active:scale-95' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:scale-105 active:scale-95'
        }`}
      >
        {s.status}
      </button>,
      <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate max-w-[200px] inline-block shadow-inner">
        {JSON.stringify(s.config)}
      </span>,
      <div className="flex items-center gap-2">
        <button 
          onClick={(e) => handleDuplicate(e, s)}
          disabled={duplicateMutation.isPending}
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
          title="Duplicate Source"
        >
          <Copy size={16} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setEditSourceId(s.id); setIsDrawerOpen(true); }}
          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"
        >
          Edit Mappings
        </button>
      </div>
    ],
    onClick: () => {}
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Database className="text-blue-500" />
            Integration Sources
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Manage abstract integration mappings assigning core schema bounds onto raw inbound transactional records natively.</p>
        </div>
        
        <button 
          onClick={() => { setEditSourceId(null); setIsDrawerOpen(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all text-sm"
        >
          <Plus size={18} />
          Create Mapping Scope
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable headers={headers} isLoading={isLoading}>
          {rows.map((r: any, i: number) => (
            <tr key={i} onClick={r.onClick} className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
              {r.cells.map((cell: any, j: number) => (
                <td key={j} className="px-6 py-4 align-middle group-hover:bg-indigo-50/20 transition-colors first:rounded-l-lg last:rounded-r-lg">{cell}</td>
              ))}
            </tr>
          ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-500 font-medium tracking-tight">No abstract data sources recognized across environment.</td>
            </tr>
          )}
        </DataTable>
      </div>

      {isDrawerOpen && (
        <SourceMappingWizard 
          isOpen={isDrawerOpen} 
          onClose={() => { setIsDrawerOpen(false); setEditSourceId(null); }} 
          editSourceId={editSourceId}
        />
      )}
    </div>
  );
}
