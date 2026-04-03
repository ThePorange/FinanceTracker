import { useEffect, useState } from 'react';
import { useConfig, useUpdateConfig } from './useConfig';
import { useForm, useFieldArray } from 'react-hook-form';
import { Settings, Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Input } from '../../components/shared/Input';

export function ConfigurationScreen() {
  const { data: config, isLoading } = useConfig();
  const updateMutation = useUpdateConfig();
  const [successMessage, setSuccessMessage] = useState('');

  const { register, control, handleSubmit, reset } = useForm({
    defaultValues: {
      items: [] as { key: string, value: string }[]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  useEffect(() => {
    if (config) {
      const items = Object.entries(config).map(([key, value]) => ({ 
        key, 
        value: typeof value === 'object' ? JSON.stringify(value) : String(value) 
      }));
      reset({ items });
    }
  }, [config, reset]);

  const onSubmit = (data: { items: { key: string, value: string }[] }) => {
    const payload: Record<string, any> = {};
    data.items.forEach((item) => {
      if (item.key.trim()) {
        try {
          payload[item.key] = JSON.parse(item.value);
        } catch {
          payload[item.key] = item.value;
        }
      }
    });

    updateMutation.mutate(payload, {
      onSuccess: () => {
        setSuccessMessage('Global configuration schema correctly synchronized!');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    });
  };

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse text-sm font-medium flex items-center gap-3">Resolving global system behaviors...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="text-blue-500 shadow-sm rounded-full" size={32} />
            System Global Configurations
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Manage abstract environment variables defining the structural routing behaviors of the robust backend schema pipelines.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative">
        <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
          
          {successMessage && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <span className="font-bold tracking-tight">{successMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-slate-100/80 hover:shadow-inner">
                <div className="flex-1">
                  <Input 
                    label="Unique Parameter Key" 
                    {...register(`items.${index}.key` as const, { required: true })} 
                    placeholder="e.g. mappingThreshold"
                  />
                </div>
                <div className="flex-1">
                  <Input 
                    label="Target Payload Evaluation Value" 
                    {...register(`items.${index}.value` as const, { required: true })} 
                    placeholder="e.g. 0.82"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => remove(index)}
                  className="mt-8 p-3 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-xl transition-colors shrink-0"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          <button 
            type="button" 
            onClick={() => append({ key: '', value: '' })}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 p-3 rounded-xl bg-blue-50/50 hover:bg-blue-100 transition-colors w-fit shadow-sm border border-blue-100"
          >
            <Plus size={18} /> Allocate Configuration Override
          </button>

          <div className="pt-8 mt-8 border-t border-slate-100 flex justify-end">
            <button 
              type="submit" 
              disabled={updateMutation.isPending}
              className="flex items-center justify-center gap-2 w-full md:w-auto bg-blue-600 text-white px-10 py-3.5 rounded-xl font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0 tracking-wide text-sm"
            >
              <Save size={18} />
              Merge Global Overrides
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
