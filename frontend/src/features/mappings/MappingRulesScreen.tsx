import { useState } from 'react';
import { useMappings, useCreateMapping } from './useMappings';
import { useCategories } from '../categories/useCategories';
import { DataTable } from '../../components/shared/DataTable';
import { useForm } from 'react-hook-form';
import { Input } from '../../components/shared/Input';

interface MappingForm {
  pattern: string;
  categoryId: string;
  priority: number;
}

export function MappingRulesScreen() {
  const { data: mappings, isLoading } = useMappings();
  const { data: categories } = useCategories();
  const createMutation = useCreateMapping();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MappingForm>();
  const [isAdding, setIsAdding] = useState(false);

  const onSubmit = (data: MappingForm) => {
    createMutation.mutate({ ...data, priority: Number(data.priority) }, {
      onSuccess: () => {
        reset();
        setIsAdding(false);
      }
    });
  };

  const getCategoryName = (id: string) => categories?.find((c: any) => c.id === id)?.name || id;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mapping Rules</h1>
          <p className="text-gray-500 mt-1">Configure auto-categorization intelligence</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          {isAdding ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in slide-in-from-top-4">
          <div className="md:col-span-2">
            <Input 
              label="Match Pattern (Regex / String)" 
              placeholder="e.g. AMZN Mktp"
              {...register('pattern', { required: 'Pattern is required' })}
              error={errors.pattern?.message}
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select 
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('categoryId', { required: 'Category is required' })}
            >
              <option value="">Select category...</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.categoryId?.message && <span className="text-xs text-red-500">{errors.categoryId.message}</span>}
          </div>
          <div className="flex items-end gap-3 w-full">
            <div className="flex-1 w-full">
              <Input 
                label="Priority" 
                type="number"
                placeholder="100"
                {...register('priority', { required: 'Priority is required', min: 1 })}
                error={errors.priority?.message}
              />
            </div>
            <button type="submit" disabled={createMutation.isPending} className="bg-green-600 text-white px-6 h-10 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium transition-colors shrink-0">
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <DataTable headers={['Pattern', 'Assigned Category', 'Priority']} isLoading={isLoading}>
        {mappings?.map(m => (
          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-4 font-mono text-sm text-gray-800">{m.pattern}</td>
            <td className="px-4 py-4 text-blue-600 font-medium">{getCategoryName(m.categoryId)}</td>
            <td className="px-4 py-4 text-gray-500">{m.priority}</td>
          </tr>
        ))}
        {mappings?.length === 0 && !isLoading && (
          <tr><td colSpan={3} className="text-center py-12 text-gray-500">No mapping rules configured yet.</td></tr>
        )}
      </DataTable>
    </div>
  );
}
