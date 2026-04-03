import { useTestRule } from './useRuleTest';
import { useForm } from 'react-hook-form';
import { FlaskConical, Play, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { Input } from '../../components/shared/Input';

export function RuleTestingScreen() {
  const testMutation = useTestRule();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { description: '', amount: 0 }
  });

  const onSubmit = (data: any) => {
    testMutation.mutate({ description: data.description, amount: Number(data.amount) || 0 });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <FlaskConical className="text-purple-500 shadow-sm rounded-full" size={32} />
            Rule Engine Pre-Flight
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Test JSON evaluation structures natively identical to backend ETL regex matching trees without applying SQLite mutations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">Input Simulation Container</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input 
              label="Transaction Description Extract" 
              {...register('description', { required: 'Description is required to test patterns.' })} 
              error={errors.description?.message as string}
              placeholder="e.g. UBER EATS NY"
            />
            <Input 
              label="Base Amount Signature (Optional)" 
              type="number"
              step="0.01"
              {...register('amount')} 
              placeholder="e.g. -14.50"
            />
            
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={testMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-xl font-bold shadow-xl shadow-purple-500/20 hover:bg-purple-700 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 tracking-wide text-sm"
              >
                {testMutation.isPending ? <Activity className="animate-spin" size={20} /> : <Play size={20} />}
                Execute Memory Inference
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl shadow-lg border border-slate-800 flex flex-col min-h-[400px]">
          <h2 className="text-lg font-bold text-white mb-6">Execution Telemetry Data</h2>
          <div className="flex-1 bg-slate-950 rounded-2xl p-6 border border-slate-800 font-mono text-sm shadow-inner relative overflow-hidden flex flex-col justify-center">
            {testMutation.isPending ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10 transition-all">
                <div className="flex flex-col items-center gap-5 text-purple-400">
                  <Activity size={40} className="animate-spin" />
                  <p className="font-sans font-bold text-xs tracking-widest uppercase">Evaluating Condition Nodes...</p>
                </div>
              </div>
            ) : testMutation.data ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                {testMutation.data.matchedRuleId ? (
                  <>
                    <div className="flex items-center gap-3 text-emerald-400 bg-emerald-400/10 p-4 rounded-xl border border-emerald-400/20 shadow-inner">
                      <CheckCircle2 size={24} className="shrink-0" />
                      <span className="font-bold tracking-tight text-base">Entity Recognized Successfully (ID: {testMutation.data.matchedRuleId})</span>
                    </div>
                    
                    <div className="space-y-5 text-slate-300 pl-2">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest font-bold">Assigned Category Map</p>
                        <p className="text-base font-bold text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-sm inline-block tracking-tight">
                          {testMutation.data.assignedCategory}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-widest font-bold">Matched String Condition</p>
                        <p className="text-emerald-400 font-bold bg-slate-900 p-3 rounded-lg border border-slate-800 break-words">{testMutation.data.matchedPattern}</p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest font-bold">Prediction Confidence Scope</p>
                        <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-lg border border-slate-800">
                          <div className="h-3 w-48 bg-slate-950 rounded-full overflow-hidden shadow-inner border border-slate-800">
                            <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000 w-0" style={{ width: `${testMutation.data.confidence * 100}%` }}></div>
                          </div>
                          <span className="text-emerald-400 font-bold tracking-widest text-lg">{(testMutation.data.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-5">
                    <AlertCircle size={48} className="text-orange-500/50" />
                    <p className="text-center font-sans font-medium">No mapping rules satisfied the condition matrix payload.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-5">
                <FlaskConical size={48} className="opacity-20 text-blue-500/50" />
                <p className="text-center font-sans tracking-tight font-medium">Inject description string simulation to evaluate pattern detection boundaries.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
