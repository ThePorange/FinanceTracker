import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useTransactions(filters?: Record<string, any>, options?: any) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.getTransactions({ limit: 0, ...filters }),
    placeholderData: keepPreviousData,
    ...options,
  });
}
