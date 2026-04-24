import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: api.getSources,
  });
}

export function useCreateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useSetupSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string, config: any, mappings: any[] }) => api.setupSource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useUpdateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => api.updateSource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
  });
}

export function useSourceMappings(id: number | null) {
  return useQuery({
    queryKey: ['sources', id, 'mappings'],
    queryFn: () => id ? api.getSourceMappings(id) : null,
    enabled: !!id
  });
}

export function useUpdateSourceMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number, data: { name: string, config?: any, mappings: any[] } }) => api.updateSourceMappings(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      // Invalidate system metadata in case staging schemas updated
      queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
  });
}

export function useDuplicateSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newName, config }: { id: number, newName: string, config?: any }) => {
      const mappingsRes = await api.getSourceMappings(id);
      const mappingsArr = mappingsRes.data || mappingsRes || [];
      const stagingTableName = `staging_${newName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      const payloadMappings = mappingsArr.map((m: any) => ({
        staging_tablename: stagingTableName,
        sourcefile_fieldname: m.sourcefile_fieldname,
        staging_table_fieldname: m.staging_table_fieldname,
        datatype: m.datatype,
        transaction_table_fieldname: m.transaction_table_fieldname || '',
        default_value: m.default_value || '',
        derived_field: m.derived_field === 1 || m.derived_field === 'y' ? 'y' : 'n',
        unique_records: m.unique_records === 1 || m.unique_records === 'y' ? 'y' : 'n'
      }));

      return api.setupSource({
        name: newName,
        config: config || {},
        mappings: payloadMappings
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
  });
}

export function useDeleteSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
  });
}
