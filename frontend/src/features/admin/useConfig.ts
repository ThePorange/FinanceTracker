import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}
