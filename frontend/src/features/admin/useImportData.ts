import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useImportData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceId, file }: { sourceId: number, file: File }) => {
      const importRes = await api.importData(sourceId, file);
      if (importRes.processedRules === undefined) {
        const rulesRes = await api.executeRules();
        return {
          ...importRes,
          processedRules: rulesRes?.processedRules,
          mappedTransactions: rulesRes?.mappedTransactions,
        };
      }
      return importRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etlJobs'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['systemData', 'sys_rules'] });
      queryClient.invalidateQueries({ queryKey: ['stagingData'] });
    },
  });
}
