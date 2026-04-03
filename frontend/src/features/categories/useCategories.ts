import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Category } from '../../types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Category>) => api.createCategory(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}
