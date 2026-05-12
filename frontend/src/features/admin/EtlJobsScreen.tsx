import { useState } from 'react';
import { useEtlJobs, useRunEtlJob, useEtlJobDetails, useDeleteEtlJob } from './useEtlJobs';
import { DataTable } from '../../components/shared/DataTable';
import { Drawer } from '../../components/shared/Drawer';
import { Play, Activity, AlertCircle, CheckCircle2, Trash2, RotateCcw } from 'lucide-react';

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, jobName }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; jobName: string }) {
  const [confirmText, setConfirmText] = useState('');
  const isMatch = confirmText === 'Delete data';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center text-red-600 mb-6 shadow-inner border border-red-100">
            <Trash2 size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Rollback Import?</h2>
          <p className="text-slate-500 mt-3 text-sm leading-relaxed font-medium">
            This will permanently delete all transaction data associated with <span className="text-slate-900 font-bold">"{jobName}"</span>. This action cannot be undone.
          </p>

          <div className="mt-8 space-y-4">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Type "Delete data" to confirm</label>
            <input 
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Delete data"
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="bg-slate-50 p-6 flex gap-3 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            disabled={!isMatch}
            onClick={() => { onConfirm(); setConfirmText(''); }}
            className="flex-1 px-6 py-3.5 rounded-2xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 disabled:opacity-30 disabled:shadow-none transition-all text-sm"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

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
            {job.status?.toLowerCase() === 'success' ? (
              <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><CheckCircle2 size={24} /></div>
            ) : job.status?.toLowerCase() === 'failed' ? (
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
  const deleteMutation = useDeleteEtlJob();
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [deletingJob, setDeletingJob] = useState<any | null>(null);

  const headers = ['Execution ID', 'Designation Target', 'Runtime Status', 'Started At', 'Completed At', 'Actions'];

  const rows = (jobs || []).map((j: any) => {
    const isDeleted = j.status === 'Deleted';

    return {
      id: j.id,
      cells: [
        <span className={`font-mono text-xs ${isDeleted ? 'text-slate-300' : 'text-slate-500'}`}>LOG_{j.id}</span>,
        <span className={`font-semibold tracking-tight ${isDeleted ? 'text-slate-400' : 'text-slate-800'}`}>{j.name}</span>,
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm border ${
          j.status?.toLowerCase() === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          j.status?.toLowerCase() === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
          isDeleted ? 'bg-slate-100 text-slate-500 border-slate-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {j.status}
        </span>,
        <span className={`${isDeleted ? 'text-slate-300' : 'text-slate-500'} text-sm font-medium`}>{new Date(j.startedAt).toLocaleString()}</span>,
        <span className={`${isDeleted ? 'text-slate-300' : 'text-slate-500'} text-sm font-medium`}>{new Date(j.completedAt).toLocaleString()}</span>,
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
           {!isDeleted && j.status?.toLowerCase() === 'success' && (
             <button 
               onClick={() => setDeletingJob(j)}
               className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
               title="Rollback Import"
             >
               <Trash2 size={18} />
             </button>
           )}
           {isDeleted && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                 <RotateCcw size={10} /> Rolled Back
              </span>
           )}
        </div>
      ],
      onClick: () => setSelectedJob(j.id),
      isDeleted
    };
  });

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
      
      <DeleteConfirmationModal 
        isOpen={!!deletingJob}
        onClose={() => setDeletingJob(null)}
        jobName={deletingJob?.name || ''}
        onConfirm={() => {
          if (deletingJob) {
            deleteMutation.mutate(deletingJob.id);
            setDeletingJob(null);
          }
        }}
      />
    </div>
  );
}
