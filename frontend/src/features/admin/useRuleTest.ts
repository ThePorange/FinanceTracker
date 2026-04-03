import { useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';

export function useTestRule() {
  return useMutation({
    mutationFn: ({ description, amount }: { description: string, amount: number }) => api.testMappingRule(description, amount),
  });
}
