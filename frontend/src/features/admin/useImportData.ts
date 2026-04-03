import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useImportData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, file }: { sourceId: number, file: File }) => api.importData(sourceId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etlJobs'] });
    },
  });
}
