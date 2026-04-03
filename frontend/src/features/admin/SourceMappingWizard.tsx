import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useSetupSource, useUpdateSourceMappings, useSourceMappings, useSources } from './useSources';
import { useSystemData } from './useSystemData';
import { Drawer } from '../../components/shared/Drawer';
import { Input } from '../../components/shared/Input';
import { Upload, Save, Database, AlertCircle, Search, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface MappedField {
  sourcefile_fieldname: string;
  staging_table_fieldname: string;
  datatype: string;
  transaction_table_fieldname: string;
  default_value: string;
  derived_field: 'y' | 'n';
  unique_records: 'y' | 'n';
}

const TRANSACTION_FIELDS = [
  '',
  'posting_date',
  'transaction_date',
  'description',
  'base_curr_id',
  'base_amount',
  'base_curr_balance',
  'drcr',
  'extended_details',
  'statement_description',
  'address_line1',
  'town_city',
  'postcode',
  'country',
  'reference',
  'memo',
  'check_or_slip_number',
  'sys_account_source_id',
  'sys_import_log_id',
  'account_source_row',
  'created_date',
  'sys_transaction_type_id',
  'category_name'
];

export function SourceMappingWizard({ isOpen, onClose, editSourceId }: { isOpen: boolean, onClose: () => void, editSourceId?: number | null }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceName, setSourceName] = useState('');
  const [fields, setFields] = useState<MappedField[]>([]);
  const [fileName, setFileName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [baseCurrencyId, setBaseCurrencyId] = useState<number | ''>('');
  const [debitNegative, setDebitNegative] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setupSourceMutation = useSetupSource();
  const updateMappingsMutation = useUpdateSourceMappings();
  const { data: stagingFieldsAPI, isLoading: isLoadingStaging } = useSystemData('sys_staging_fields');
  const { data: currenciesData } = useSystemData('sys_currency');
  const currencies = useMemo(() => currenciesData?.data || currenciesData || [], [currenciesData]);
  
  const { data: existingMappings } = useSourceMappings(editSourceId || null);
  const { data: sourcesObj } = useSources();
  const sourcesArr = sourcesObj?.data || sourcesObj || [];

  const { data: transactionSchema } = useQuery({
    queryKey: ['schema', 'sys_transaction'],
    queryFn: () => api.getStagingSchema('sys_transaction')
  });

  const transactionFields = useMemo(() => {
    const rows = Array.isArray(transactionSchema) ? transactionSchema : transactionSchema?.data;
    if (!rows || !Array.isArray(rows)) return TRANSACTION_FIELDS;
    const baseFields = ['', ...rows.filter((c: any) => !c.pk && c.name !== 'sys_transaction_id').map((c: any) => c.name)];
    if (!baseFields.includes('category_name')) baseFields.push('category_name');
    if (!baseFields.includes('records')) baseFields.push('records');
    return baseFields;
  }, [transactionSchema]);

  useEffect(() => {
    if (editSourceId && existingMappings && sourcesArr.length > 0) {
      const dbSource = sourcesArr.find((s: any) => s.id === editSourceId);
      if (dbSource) {
        setSourceName(dbSource.name);
        setBaseCurrencyId(dbSource.config?.base_currency_id || '');
        setDebitNegative(dbSource.config?.debit_negative || false);
      }
      
      const mapsArr = existingMappings.data || existingMappings || [];
      if (mapsArr.length > 0) {
        setFileName('Database Configuration');
        setFields(mapsArr.map((m: any) => ({
          sourcefile_fieldname: m.sourcefile_fieldname,
          staging_table_fieldname: m.staging_table_fieldname,
          datatype: m.datatype,
          transaction_table_fieldname: m.transaction_table_fieldname || '',
          default_value: m.default_value || '',
          derived_field: m.derived_field === 1 ? 'y' : 'n',
          unique_records: m.unique_records === 1 ? 'y' : 'n'
        })));
        setStep(2);
      }
    } else if (!editSourceId) {
      setStep(1);
      setSourceName('');
      setFields([]);
      setFileName('');
    }
  }, [editSourceId, existingMappings, sourcesArr]);

  const filteredFields = useMemo(() => {
    if (!searchQuery) return fields;
    const lower = searchQuery.toLowerCase();
    return fields.filter(f => 
      f.sourcefile_fieldname.toLowerCase().includes(lower) ||
      f.staging_table_fieldname.toLowerCase().includes(lower) ||
      f.transaction_table_fieldname.toLowerCase().includes(lower)
    );
  }, [searchQuery, fields]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!sourceName.trim() || !baseCurrencyId) {
      alert("Please enter a New Institution Title and select a Base Currency before uploading a CSV target.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const firstLine = text.split('\n')[0];
      const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));

      const getSuggestedMapping = (nameToTest: string) => {
        if (transactionFields.includes(nameToTest)) return nameToTest;
        const lower = nameToTest.toLowerCase();
        if (lower.includes('date')) return lower.includes('post') ? 'posting_date' : 'transaction_date';
        if (lower.includes('desc')) return 'description';
        if (lower.includes('amount') || lower.includes('value')) return 'base_amount';
        if (lower.includes('memo')) return 'memo';
        if (lower.includes('ref')) return 'reference';
        if (lower === 'dr' || lower === 'cr' || lower === 'type' || lower.includes('drcr')) return 'drcr';
        if (lower.includes('cat')) return 'category_name';
        return '';
      };

      const initialFields: MappedField[] = headers.map(h => {
        const stagingName = h.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const txField = getSuggestedMapping(h.toLowerCase());

        return {
          sourcefile_fieldname: h,
          staging_table_fieldname: stagingName,
          datatype: txField.includes('date') ? 'date' : (txField === 'base_amount' ? 'real' : 'text'),
          transaction_table_fieldname: txField,
          default_value: '',
          derived_field: 'n',
          unique_records: 'n',
        };
      });

      // Append pre-fetched sys_staging_fields definitions implicitly mapped
      const stagingDefs = stagingFieldsAPI?.data || [];
      stagingDefs.forEach((def: any) => {
        const sg = def.staging_table_fieldname;
        const txField = getSuggestedMapping(sg);

        initialFields.push({
          sourcefile_fieldname: 'n/a',
          staging_table_fieldname: sg,
          datatype: (def.datatype || 'text').toString().toLowerCase(),
          transaction_table_fieldname: txField,
          default_value: def.default_value?.toString() || '',
          derived_field: def.derived_field ? 'y' : 'n',
          unique_records: def.unique_records ? 'y' : 'n',
        });
      });

      setFields(initialFields);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const updateField = (index: number, key: keyof MappedField, value: string) => {
    // We update the original fields array based on the index in the filtered array?
    // No, we must update by finding the exact object in the original array.
    const fieldReference = filteredFields[index];
    const originalIndex = fields.findIndex(f => f === fieldReference);
    
    if (originalIndex >= 0) {
      const newFields = [...fields];
      newFields[originalIndex] = { ...newFields[originalIndex], [key]: value };
      setFields(newFields);
    }
  };

  const handleSave = async () => {
    if (!sourceName) return alert('Source Title is required');
    
    const stagingTableName = fields.length > 0 && editSourceId 
      ? existingMappings?.[0]?.staging_tablename || `staging_${sourceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
      : `staging_${sourceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    try {
      const payloadMappings = fields.map(f => ({
        staging_tablename: stagingTableName,
        sourcefile_fieldname: f.sourcefile_fieldname,
        staging_table_fieldname: f.staging_table_fieldname,
        datatype: f.datatype,
        transaction_table_fieldname: f.transaction_table_fieldname,
        default_value: f.default_value,
        derived_field: f.derived_field,
        unique_records: f.unique_records
      }));

      if (editSourceId) {
        await updateMappingsMutation.mutateAsync({
          id: editSourceId,
          data: { 
            name: sourceName, 
            config: { base_currency_id: baseCurrencyId, debit_negative: debitNegative },
            mappings: payloadMappings 
          }
        });
      } else {
        await setupSourceMutation.mutateAsync({
          name: sourceName,
          config: { base_currency_id: baseCurrencyId, debit_negative: debitNegative },
          mappings: payloadMappings
        });
      }

      onClose();
    } catch (e: any) {
      alert(`Wizard pipeline error generating table vectors:\n${e.message}`);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="CSV Extraction Setup Wizard" defaultWidth={900}>
      {step === 1 ? (
        <div className="p-8 flex flex-col items-center justify-center min-h-[400px] space-y-8">
          <div className="w-full max-w-md flex flex-col gap-6">
            <Input 
              label="New Institution / Integration Title" 
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. AMEX Corporate Card"
            />
            
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Base Currency</label>
               <select className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" value={baseCurrencyId} onChange={e => setBaseCurrencyId(Number(e.target.value) || '')}>
                 <option value="">-- Select Currency --</option>
                 {currencies.map((c: any) => (
                   <option key={c.sys_currency_id} value={c.sys_currency_id}>{c.currency_code}</option>
                 ))}
               </select>
            </div>

            <div className="flex items-center gap-3 bg-white p-4 border border-slate-200 rounded-lg shrink-0">
               <input type="checkbox" id="debitNegative" checked={debitNegative} onChange={e => setDebitNegative(e.target.checked)} className="w-5 h-5 text-blue-600 rounded cursor-pointer" />
               <label htmlFor="debitNegative" className="text-sm font-bold text-slate-700 cursor-pointer select-none flex-1">Debit Negative (Negative amounts = DR)</label>
            </div>
          </div>

          <button 
            disabled={isLoadingStaging}
            className={`w-full max-w-md border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl p-10 flex flex-col items-center justify-center transition-colors group ${isLoadingStaging ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:bg-blue-50'}`}
            onClick={() => { if (!isLoadingStaging) fileInputRef.current?.click(); }}
          >
            <Upload size={40} className="text-blue-500 mb-4 group-hover:-translate-y-1 transition-transform" />
            <h3 className="font-bold text-slate-800 text-lg">Upload Extraction Target (.CSV)</h3>
            <p className="text-sm text-slate-500 text-center mt-2">
              {isLoadingStaging ? 'Fetching System Pre-requisites...' : 'We will automatically parse the file headers to predict your database schema parameters natively.'}
            </p>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-full bg-slate-50">
          <div className="p-6 bg-white border-b border-slate-200 shrink-0 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
                  <Database className="text-blue-500" />
                  Configure System Schema Extrapolations
                </h2>
                <p className="text-sm text-slate-500 mt-2 font-medium">Mapped {fields.length} columns from <span className="text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded">{fileName}</span></p>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter mappings..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 mb-1">Source Title / Institution</label>
                <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="e.g. Chase Checkings" />
              </div>
              <div className="w-48">
                <label className="block text-xs font-bold text-slate-500 mb-1">Base Currency</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" value={baseCurrencyId} onChange={e => setBaseCurrencyId(Number(e.target.value) || '')}>
                  <option value="">-- Select --</option>
                  {currencies.map((c: any) => (
                    <option key={c.sys_currency_id} value={c.sys_currency_id}>{c.currency_code}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                 <input type="checkbox" id="debitNegativeStep2" checked={debitNegative} onChange={e => setDebitNegative(e.target.checked)} className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                 <label htmlFor="debitNegativeStep2" className="text-sm font-bold text-slate-700 cursor-pointer select-none">Debit Negative</label>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Source Header</th>
                    <th className="px-4 py-3">Staging Table Col</th>
                    <th className="px-4 py-3">Transaction Destination</th>
                    <th className="px-4 py-3">Data Type</th>
                    <th className="px-4 py-3">
                      <div className="flex items-center gap-1.5 group relative cursor-help w-max">
                        Default / Fallback
                        <Info size={14} className="text-blue-500 hover:text-blue-600 transition-colors" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-3 rounded-lg shadow-xl whitespace-normal z-[100] pointer-events-none before:content-[''] before:absolute before:-bottom-1 before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-slate-800 font-medium leading-relaxed">
                          Values enclosed in double quotes (e.g., <b>"Missing"</b>) are raw strings.<br/><br/>Without quotes (e.g., <b>CURRENT_TIMESTAMP</b> or <b>1</b>), they execute natively as raw SQLite schema scripts row-by-row!
                        </div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Derived?</th>
                    <th className="px-4 py-3 text-center">Unique Block?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFields.length > 0 ? filteredFields.map((f, i) => (
                    <tr key={f.sourcefile_fieldname + i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 font-semibold">{f.sourcefile_fieldname}</td>
                      <td className="px-4 py-2">
                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono text-xs" value={f.staging_table_fieldname} onChange={e => updateField(i, 'staging_table_fieldname', e.target.value)} />
                      </td>
                      <td className="px-4 py-2">
                        <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-zinc-50 font-bold text-xs outline-none text-blue-700 hover:ring-2 hover:ring-blue-500/20" value={f.transaction_table_fieldname} onChange={e => updateField(i, 'transaction_table_fieldname', e.target.value)}>
                          {transactionFields.map(opt => <option key={opt} value={opt}>{opt || '-- Not Mapped --'}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20" value={f.datatype} onChange={e => updateField(i, 'datatype', e.target.value)}>
                          <option value="text">TEXT</option>
                          <option value="date">DATE</option>
                          <option value="real">REAL</option>
                          <option value="float">FLOAT</option>
                          <option value="integer">INTEGER</option>
                          <option value="int">INT</option>
                          <option value="varchar(250)">VARCHAR(250)</option>
                          <option value="varchar(10)">VARCHAR(10)</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none" placeholder="Empty..." value={f.default_value} onChange={e => updateField(i, 'default_value', e.target.value)} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select className="border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs outline-none font-bold" value={f.derived_field} onChange={e => updateField(i, 'derived_field', e.target.value as 'y'|'n')}>
                          <option value="n">N</option><option value="y">Y</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select className="border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs outline-none font-bold text-red-600" value={f.unique_records} onChange={e => updateField(i, 'unique_records', e.target.value as 'y'|'n')}>
                          <option value="n">N</option><option value="y">Y</option>
                        </select>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-slate-500">No mappings matched your filter bounds.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)]">
            <button onClick={() => { if(editSourceId) { onClose(); } else { setStep(1); } }} className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors text-sm">Cancel Extract</button>
            <button 
              onClick={handleSave}
              disabled={setupSourceMutation.isPending || updateMappingsMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all text-sm disabled:opacity-50"
            >
              {(setupSourceMutation.isPending || updateMappingsMutation.isPending) ? <AlertCircle className="animate-spin" size={18} /> : <Save size={18} />}
              Commit Schema & Deploy Table
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
