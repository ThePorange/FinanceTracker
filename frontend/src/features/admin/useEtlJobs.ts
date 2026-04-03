import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useEtlJobs() {
  return useQuery({
    queryKey: ['etlJobs'],
    queryFn: api.getEtlJobs,
  });
}

export function useRunEtlJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId?: number) => api.runEtlJob(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etlJobs'] });
    },
  });
}

export function useEtlJobDetails(id: number | null) {
  return useQuery({
    queryKey: ['etlJob', id],
    queryFn: () => api.getEtlJob(id!),
    enabled: !!id,
  });
}
