import { useState, useEffect } from 'react';
import { Drawer } from '../../components/shared/Drawer';
import type { Transaction } from '../../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Input } from '../../components/shared/Input';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
}

export function TransactionDetailPanel({ transaction, onClose }: Props) {
  const queryClient = useQueryClient();
  const [userCategory, setUserCategory] = useState('');

  useEffect(() => {
    if (transaction) setUserCategory(transaction.userCategory || '');
  }, [transaction]);

  const updateMutation = useMutation({
    mutationFn: (cat: string) => api.updateTransaction(transaction!.id, { userCategory: cat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    }
  });

  const handleSave = () => {
    if (transaction) {
      updateMutation.mutate(userCategory);
    }
  };

  return (
    <Drawer isOpen={!!transaction} onClose={onClose} title="Transaction Details">
      {transaction && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-100">
            <p className="text-sm font-medium text-gray-500">Raw Description</p>
            <p className="font-mono text-sm text-gray-800 break-all">{transaction.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date</p>
              <p className="font-medium text-gray-900">{formatLocalDate(transaction.date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Amount</p>
              <p className="font-medium text-lg text-gray-900">${transaction.amount?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Account</p>
              <p className="font-medium text-gray-900">{transaction.account}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Auto Category</p>
              <p className="font-medium text-blue-600">{transaction.autoCategory || 'None'}</p>
            </div>
          </div>

          <hr className="border-gray-200" />

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Categorization</h3>
            <Input 
              label="Assigned Category" 
              value={userCategory} 
              onChange={e => setUserCategory(e.target.value)} 
              placeholder="e.g. Groceries"
            />
            <button 
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
