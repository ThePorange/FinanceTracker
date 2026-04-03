import { useState } from 'react';
import { useEtlJobs, useRunEtlJob, useEtlJobDetails } from './useEtlJobs';
import { DataTable } from '../../components/shared/DataTable';
import { Drawer } from '../../components/shared/Drawer';
import { Play, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

function EtlJobDetailsDrawer({ jobId, onClose }: { jobId: number | null; onClose: () => void }) {
  const { data: job, isLoading } = useEtlJobDetails(jobId);

  return (
    <Drawer isOpen={!!jobId} onClose={onClose} title={`Job Telemetry #${jobId || ''}`}>
      {isLoading ? (
        <div className="p-6 text-slate-500 flex items-center gap-3 animate-pulse">
          <Activity size={20} className="animate-spin text-blue-500" /> Resolving telemetry logs...
        </div>
      ) : job ? (
        <div className="p-6 space-y-8">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-inner">
            {job.status === 'success' ? (
              <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><CheckCircle2 size={24} /></div>
            ) : job.status === 'failed' ? (
              <div className="bg-red-100 p-2 rounded-xl text-red-600"><AlertCircle size={24} /></div>
            ) : (
              <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Activity size={24} className="animate-spin" /></div>
            )}
            <div>
              <p className="text-sm font-bold text-slate-900 capitalize tracking-wide">Status: {job.status}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Execution Hash: sys_log_{job.id}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-slate-400" /> Pipeline Operations Output
            </h3>
            <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner shadow-slate-950/50 space-y-1">
              {job.logs?.length ? (
                job.logs.map((log: string, i: number) => <div key={i}><span className="text-slate-500">[{new Date().toISOString().split('T')[1].slice(0,-1)}]</span> {log}</div>)
              ) : (
                <span className="text-slate-500">No telemetry output array detected.</span>
              )}
            </div>
          </div>

          {job.errorMessages?.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-red-700 mb-4 flex items-center gap-2 border-b border-red-100 pb-2">
                <AlertCircle size={16} /> Fatal Exceptions Block
              </h3>
              <div className="bg-red-50 rounded-2xl border border-red-200 p-5 space-y-3">
                {job.errorMessages.map((err: string, i: number) => (
                  <p key={i} className="text-sm font-medium text-red-800 flex items-start gap-3 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></span>
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6 text-slate-500 font-medium text-center">Telemetry profile destroyed or not found.</div>
      )}
    </Drawer>
  );
}

export function EtlJobsScreen() {
  const { data: jobs, isLoading } = useEtlJobs();
  const runMutation = useRunEtlJob();
  const [selectedJob, setSelectedJob] = useState<number | null>(null);

  const headers = ['Execution ID', 'Designation Target', 'Runtime Status', 'Started At', 'Completed At'];

  const rows = (jobs || []).map((j: any) => ({
    cells: [
      <span className="font-mono text-xs text-slate-500">LOG_{j.id}</span>,
      <span className="font-semibold text-slate-800 tracking-tight">{j.name}</span>,
      <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm border ${
        j.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        j.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
        'bg-blue-50 text-blue-700 border-blue-200'
      }`}>
        {j.status}
      </span>,
      <span className="text-slate-500 text-sm font-medium">{new Date(j.startedAt).toLocaleString()}</span>,
      <span className="text-slate-500 text-sm font-medium">{new Date(j.completedAt).toLocaleString()}</span>
    ],
    onClick: () => setSelectedJob(j.id)
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-500" />
            ETL Engine Pipelines
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Monitor background normalization jobs and force manual synchronization executions across internal system mappings.</p>
        </div>
        
        <button 
          onClick={() => runMutation.mutate(undefined)}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 text-sm"
        >
          {runMutation.isPending ? <Activity size={18} className="animate-spin" /> : <Play size={18} />}
          Run Pipeline Event
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable headers={headers} isLoading={isLoading}>
          {rows.map((r: any, i: number) => (
            <tr key={i} onClick={r.onClick} className="hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-100 last:border-0 group">
              {r.cells.map((cell: any, j: number) => (
                <td key={j} className="px-6 py-4 align-middle group-hover:bg-blue-50/30 transition-colors first:rounded-l-lg last:rounded-r-lg">{cell}</td>
              ))}
            </tr>
          ))}
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-6 py-12 text-center text-slate-500 font-medium tracking-tight">No ETL job pipelines executed yet.</td>
            </tr>
          )}
        </DataTable>
      </div>

      <EtlJobDetailsDrawer jobId={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
