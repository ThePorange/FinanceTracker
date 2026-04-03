import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useSystemData(table: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['systemData', table],
    queryFn: () => api.getSystemData(table),
    enabled: options?.enabled !== false && !!table,
  });
}

export function useCreateSystemData(table: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createSystemData(table, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemData', table] });
    },
  });
}

export function useUpdateSystemData(table: string, idField: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number, data: any }) => api.updateSystemData(table, idField, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemData', table] });
    },
  });
}

export function useDeleteSystemData(table: string, idField: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => api.deleteSystemData(table, idField, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemData', table] });
    },
  });
}
