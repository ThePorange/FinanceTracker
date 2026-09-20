import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { ReportDefinitionJson } from './types';

export function useReportDefinitions() {
  return useQuery({
    queryKey: ['reportDefinitions'],
    queryFn: () => api.getReportDefinitions(),
  });
}

export function useSaveReportDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, report_name, chart_type, definition_json }: { id?: number; report_name: string; chart_type: string; definition_json: ReportDefinitionJson }) => {
      if (id) {
        return api.updateReportDefinition(id, { report_name, chart_type, definition_json });
      }
      return api.createReportDefinition({ report_name, chart_type, definition_json });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] });
    },
  });
}

export function useDeleteReportDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteReportDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportDefinitions'] });
    },
  });
}

export function useEvaluateReport(params: {
  series: Array<{ id: string; name: string; filters: Array<Record<string, any>> }>;
  interval?: 'monthly' | 'daily' | 'yearly' | 'comparative_monthly';
  amountMode?: 'net' | 'dr' | 'cr';
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['evaluateReport', params],
    queryFn: () => api.evaluateReport(params),
    enabled: options?.enabled !== false && params.series.length > 0,
  });
}
