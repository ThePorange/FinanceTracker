import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useSystemData } from './useSystemData';
import { SaaSDatagrid, type GridColumn } from '../../components/shared/SaaSDatagrid';
import { Database, FileCode2, LayoutTemplate } from 'lucide-react';
import { Drawer } from '../../components/shared/Drawer';

export function StagingDataScreen() {
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [isSchemaDrawerOpen, setIsSchemaDrawerOpen] = useState(false);

  // 1. Fetch available staging tables
  const { data: tablesRes, isLoading: loadingTables } = useQuery({
    queryKey: ['meta', 'staging-tables'],
    queryFn: () => api.getStagingTables()
  });
  
  const tables = tablesRes?.data || tablesRes || [];

  // Automatically select the first table if available
  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0].name);
    }
  }, [tables, selectedTable]);

  // 2. Fetch schema for the selected table
  const { data: schemaRes, isLoading: loadingSchema } = useQuery({
    queryKey: ['meta', 'schema', selectedTable],
    queryFn: () => selectedTable ? api.getStagingSchema(selectedTable) : null,
    enabled: !!selectedTable
  });

  const schemaColumns = schemaRes?.data || schemaRes || [];

  // 3. Fetch data for the selected table
  const { data: tableDataRes, isLoading: loadingData } = useSystemData(selectedTable, { enabled: !!selectedTable });
  const tableDataArr = tableDataRes?.data || tableDataRes || [];

  // 4. Dynamically construct GridColumns based on SQLite PRAGMA info
  const datagridColumns: GridColumn[] = schemaColumns.map((col: any) => ({
    key: col.name,
    label: col.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    type: col.type.toLowerCase().includes('int') ? 'number' : 'text',
    editable: false // Staging tables are read-only views representing immutable raw CSV extractions
  }));

  const activeTableMeta = tables.find((t: any) => t.name === selectedTable);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <LayoutTemplate className="text-indigo-500" />
            Staging Area Environments
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Verify dynamically spun-up schema environments extracting raw data prior to Transaction normalizations.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={selectedTable} 
            onChange={e => setSelectedTable(e.target.value)}
            disabled={loadingTables || tables.length === 0}
            className="border border-slate-200 bg-slate-50 font-mono text-sm px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-700 min-w-[250px]"
          >
            <option value="">-- Select Staging Table --</option>
            {tables.map((t: any) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>

          <button 
            onClick={() => setIsSchemaDrawerOpen(true)}
            disabled={!selectedTable}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-200 transition-all text-sm disabled:opacity-50"
          >
            <FileCode2 size={18} />
            View Raw Schema
          </button>
        </div>
      </div>

      {loadingSchema || loadingData ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
          <Database size={32} className="animate-pulse mb-4 text-indigo-400" />
          <p className="font-medium tracking-tight">Constructing UI architectures interpreting SQLite Pragma definitions...</p>
        </div>
      ) : !selectedTable ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
          <p className="font-medium tracking-tight">Please select a Staging Environment above to continue.</p>
        </div>
      ) : (
        <SaaSDatagrid
          data={tableDataArr}
          columns={datagridColumns}
          pk="id" // Dynamic staging tables default to 'id' as per our generation logic
          onSave={async () => {}} // Disabled read-only bindings
          onDelete={async () => {}} // Disabled read-only bindings
          isLoading={false}
          canCreate={false}
          canEdit={false}
          canDelete={false}
        />
      )}

      {/* Raw Schema Drawer */}
      <Drawer isOpen={isSchemaDrawerOpen} onClose={() => setIsSchemaDrawerOpen(false)} title={`SQL Schema: ${selectedTable}`}>
        <div className="p-6 h-full flex flex-col bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4 shrink-0">
            <h3 className="text-slate-200 font-bold tracking-tight">Explicit SQLite Create Definition</h3>
          </div>
          <div className="flex-1 overflow-auto rounded-xl bg-slate-950 p-6 border border-slate-800 shadow-inner">
            <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
              {activeTableMeta?.sql || 'No schema captured'}
            </pre>
          </div>
          <div className="pt-6 shrink-0 mt-auto">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(activeTableMeta?.sql || '');
                alert('Schema script copied to clipboard!');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-xl shadow-indigo-500/20"
            >
              Copy SQL Script to Clipboard
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
