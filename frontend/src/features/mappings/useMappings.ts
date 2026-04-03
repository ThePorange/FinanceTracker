import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { MappingRule } from '../../types';

export function useMappings() {
  return useQuery({
    queryKey: ['mappings'],
    queryFn: api.getMappings,
  });
}

export function useCreateMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MappingRule>) => api.createMapping(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mappings'] }),
  });
}
