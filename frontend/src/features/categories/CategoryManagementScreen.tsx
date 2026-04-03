import { useState } from 'react';
import { useCategories, useCreateCategory } from './useCategories';
import { DataTable } from '../../components/shared/DataTable';
import { useForm } from 'react-hook-form';
import { Input } from '../../components/shared/Input';

interface CategoryForm {
  name: string;
  type: string;
}

export function CategoryManagementScreen() {
  const { data: categories, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>();
  const [isAdding, setIsAdding] = useState(false);

  const onSubmit = (data: CategoryForm) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        reset();
        setIsAdding(false);
      }
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Categories</h1>
          <p className="text-gray-500 mt-1">Manage and organize transaction classifications</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          {isAdding ? 'Cancel' : '+ Add Category'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-start animate-in slide-in-from-top-4">
          <div className="flex-1 w-full">
            <Input 
              label="Category Name" 
              placeholder="e.g. Utilities"
              {...register('name', { required: 'Name is required' })}
              error={errors.name?.message}
            />
          </div>
          <div className="flex-1 w-full">
            <Input 
              label="Type" 
              placeholder="e.g. Fixed, Variable, Income"
              {...register('type', { required: 'Type is required' })}
              error={errors.type?.message}
            />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="bg-green-600 text-white px-6 h-10 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium transition-colors w-full md:w-auto mt-auto">
            {createMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}

      <DataTable headers={['Name', 'Type']} isLoading={isLoading}>
        {categories?.map(c => (
          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
            <td className="px-4 py-4 font-medium text-gray-900">{c.name}</td>
            <td className="px-4 py-4 text-gray-500">{c.type}</td>
          </tr>
        ))}
        {categories?.length === 0 && !isLoading && (
          <tr><td colSpan={2} className="text-center py-12 text-gray-500">No categories found in the system.</td></tr>
        )}
      </DataTable>
    </div>
  );
}
