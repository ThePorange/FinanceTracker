import { useState } from 'react';
import { useSystemData, useCreateSystemData, useUpdateSystemData, useDeleteSystemData } from './useSystemData';
import { DataTable } from '../../components/shared/DataTable';
import { Input } from '../../components/shared/Input';
import { useForm } from 'react-hook-form';
import { Server, Plus, Save, Trash2, Edit2 } from 'lucide-react';
import { Drawer } from '../../components/shared/Drawer';

const TABLES = [
  { id: 'sys_currency', name: 'Currencies', pk: 'sys_currency_id', editable: true, fields: ['currency_code', 'currency_name'] },
  { id: 'sys_currency_pair', name: 'Currency Pairs', pk: 'sys_currency_pair_id', editable: false, canCreate: true, fields: ['base_currency_id', 'quote_currency_id'] },
  { id: 'sys_fx_rate', name: 'FX Rates', pk: 'sys_fx_rate_id', editable: true, fields: ['sys_currency_pair_id', 'fx_rate', 'sys_account_source_id'] },
  { id: 'sys_transaction_type', name: 'Transaction Types', pk: 'sys_transaction_type_id', editable: false, canCreate: false, fields: ['transaction_type', 'sys_account_source_id'] },
  { id: 'sys_staging_fields', name: 'Staging Fields', pk: 'sys_staging_fields_id', editable: true, fields: ['staging_table_fieldname', 'datatype', 'transaction_table_fieldname', 'default_value', 'derived_field', 'unique_records'] }
];

function SystemDataFormDrawer({ tableDef, record, isOpen, onClose }: { tableDef: any, record?: any, isOpen: boolean, onClose: () => void }) {
  const createMutation = useCreateSystemData(tableDef.id);
  const updateMutation = useUpdateSystemData(tableDef.id, tableDef.pk);
  
  const { register, handleSubmit } = useForm({
    defaultValues: record || {}
  });

  const onSubmit = (data: any) => {
    if (record?.[tableDef.pk]) {
      updateMutation.mutate({ id: record[tableDef.pk], data }, { onSuccess: onClose });
    } else {
      createMutation.mutate(data, { onSuccess: onClose });
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={record?.[tableDef.pk] ? `Edit instance in ${tableDef.name}` : `Create instance in ${tableDef.name}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <div className="space-y-4">
          {tableDef.fields.map((f: string) => (
            <Input key={f} label={f} {...register(f, { required: true })} />
          ))}
        </div>

        <button 
          type="submit" 
          disabled={createMutation.isPending || updateMutation.isPending}
          className="w-full flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 tracking-wide"
        >
          <Save size={18} />
          {record?.[tableDef.pk] ? 'Commit Overrides' : 'Deploy Mapping'}
        </button>
      </form>
    </Drawer>
  );
}

export function SystemDataScreen() {
  const [activeTableIdx, setActiveTableIdx] = useState(0);
  const tableDef = TABLES[activeTableIdx];
  const { data, isLoading } = useSystemData(tableDef.id);
  const deleteMutation = useDeleteSystemData(tableDef.id, tableDef.pk);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Permanently destroy this generic mapping property array?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (r: any) => {
    setEditingRecord(r);
    setIsDrawerOpen(true);
  };

  const handleCreate = () => {
    setEditingRecord(null);
    setIsDrawerOpen(true);
  };

  const displayFields = [tableDef.pk, ...tableDef.fields];
  const headers = [...displayFields, 'Actions (CRUD)'];

  const rows = (data || []).map((r: any) => ({
    cells: [
      ...displayFields.map(f => (
        <span key={f} className="text-sm font-medium text-slate-800 tracking-tight">{String(r[f] ?? '')}</span>
      )),
      <div className="flex items-center gap-3" key="actions">
        {tableDef.editable !== false && (
          <button onClick={(e) => { e.stopPropagation(); handleEdit(r); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 hover:scale-110 active:scale-95 transition-all shadow-sm">
            <Edit2 size={16} />
          </button>
        )}
        {tableDef.editable !== false || tableDef.canCreate !== false ? (
          <button onClick={(e) => handleDelete(e, r[tableDef.pk])} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 hover:scale-110 active:scale-95 transition-all shadow-sm">
            <Trash2 size={16} />
          </button>
        ) : <span className="text-slate-400 text-xs italic tracking-wide font-medium bg-slate-100 px-2 py-1 rounded">Protected Scope</span>}
      </div>
    ],
    onClick: () => {}
  }));

  return (
    <div className="p-8 max-w-[90rem] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Server className="text-blue-500" />
            Core Dependencies Extrapolator
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Dynamically administer discrete structural SQLite primitives exposing universal table bounds internally to the frontend.</p>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-2xl overflow-x-auto shadow-inner">
        {TABLES.map((t, idx) => (
          <button 
            key={t.id}
            onClick={() => setActiveTableIdx(idx)}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl whitespace-nowrap transition-all duration-300 ${activeTableIdx === idx ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-800'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Target Map: <span className="text-blue-600 font-mono tracking-widest font-bold bg-blue-50 px-2 py-0.5 rounded text-sm border border-blue-100">{tableDef.id}</span>
          </h2>
          {tableDef.canCreate !== false && (
            <button onClick={handleCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all">
              <Plus size={16} /> Deploy Reference Node
            </button>
          )}
        </div>
        <div className="overflow-x-auto w-full">
          <DataTable headers={headers} isLoading={isLoading}>
            {rows.map((r: any, i: number) => (
              <tr key={i} onClick={r.onClick} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
                {r.cells.map((cell: any, j: number) => (
                  <td key={j} className="px-6 py-4 align-middle group-hover:bg-indigo-50/10 transition-colors first:rounded-l-lg last:rounded-r-lg max-w-[250px] truncate">{cell}</td>
                ))}
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-500 font-medium tracking-tight">No SQLite tuples exist natively in the primary partition.</td>
              </tr>
            )}
          </DataTable>
        </div>
      </div>

      {isDrawerOpen && (
        <SystemDataFormDrawer 
          tableDef={tableDef}
          record={editingRecord}
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
        />
      )}
    </div>
  );
}
