import React, { useState, useRef } from 'react';
import { useSources } from './useSources';
import { useImportData } from './useImportData';
import { useEtlJobs } from './useEtlJobs';
import { UploadCloud, CheckCircle2, Activity, FileDown } from 'lucide-react';
import { DataTable } from '../../components/shared/DataTable';

export function DataImportScreen() {
  const { data: sources, isLoading: isLoadingSources } = useSources();
  const { data: jobs, isLoading: isLoadingJobs } = useEtlJobs();
  const importMutation = useImportData();
  
  const [selectedSourceId, setSelectedSourceId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSources = (sources || []).filter((s: any) => s.status === 'active');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (uploaded) setFile(uploaded);
  };

  const handleImport = async () => {
    if (!selectedSourceId || !file) return;
    try {
      await importMutation.mutateAsync({ sourceId: Number(selectedSourceId), file });
      alert('Data import successfully queued inside the ETL pipeline.');
      setFile(null);
    } catch (err: any) {
      alert(`Pipeline Fault Exception Output:\n\n${err.message}`);
    }
  };

  const headers = ['Target Signature', 'Pipeline Status', 'Invoked Date', 'Operations Block'];
  const recentJobs = (jobs || []).slice(0, 10);
  
  const rows = recentJobs.map((j: any) => ({
    cells: [
      <span className="font-bold text-slate-800 tracking-tight">{j.name} <span className="text-xs text-slate-400 font-mono ml-2">sys_log_{j.id}</span></span>,
      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm border ${
        j.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        j.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
        'bg-blue-50 text-blue-700 border-blue-200'
      }`}>
        {j.status}
      </span>,
      <span className="text-slate-500 text-sm font-medium">{new Date(j.startedAt).toLocaleString()}</span>,
      <span className="font-mono text-xs text-slate-400 truncate max-w-[200px] inline-block">{j.logs?.[j.logs.length - 1] || 'Executing operations...'}</span>
    ]
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <UploadCloud className="text-blue-500 shadow-sm rounded-full" size={28} />
            Data Ingestion Hub
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Initiate discrete flat file extractions mapping explicit external structures natively through system pipelines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form Box */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center">
            
            <div className="w-full mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Target ETL Integration Source</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : '')}
                disabled={isLoadingSources}
              >
                <option value="">-- Assign Integration Node --</option>
                {activeSources.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} (ID: {s.id})</option>
                ))}
              </select>
            </div>

            <div 
              className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? <FileDown size={40} className="text-emerald-500 mb-4" /> : <UploadCloud size={40} className="text-blue-500 mb-4 group-hover:-translate-y-1 transition-transform" /> }
              
              <h3 className={`font-bold text-lg text-center ${file ? 'text-emerald-800' : 'text-slate-800'}`}>
                {file ? 'File Mounted Array' : 'Select Target Extract'}
              </h3>
              
              <p className="text-xs font-mono text-slate-500 text-center mt-2 bg-white px-2 py-1 rounded border border-slate-100 shadow-sm break-all max-w-[200px] truncate">
                {file ? file.name : 'Click to bind .csv document'}
              </p>
              
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
            </div>

            <button 
              onClick={handleImport}
              disabled={!selectedSourceId || !file || importMutation.isPending}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all text-sm disabled:opacity-50 disabled:hover:translate-y-0 tracking-wide"
            >
              {importMutation.isPending ? <Activity className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
              Initialize Bulk Integration
            </button>
          </div>
        </div>

        {/* Live Active Pipelines Logs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Activity size={18} className="text-slate-400" />
                Live Extraction Telemetry
              </h2>
            </div>
            <div className="flex-1 p-0 overflow-auto">
              <DataTable headers={headers} isLoading={isLoadingJobs}>
                {rows.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
                    {r.cells.map((cell: any, j: number) => (
                      <td key={j} className="px-6 py-4 align-middle group-hover:bg-blue-50/10 transition-colors">{cell}</td>
                    ))}
                  </tr>
                ))}
                {!isLoadingJobs && rows.length === 0 && (
                  <tr>
                    <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-500 font-medium tracking-tight">No ETL job extractions processed natively.</td>
                  </tr>
                )}
              </DataTable>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
