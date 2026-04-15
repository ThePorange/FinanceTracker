import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface TransactionFilterContextType {
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  search: string;
  setSearch: (search: string) => void;
}

const TransactionFilterContext = createContext<TransactionFilterContextType | undefined>(undefined);

export function TransactionFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');

  return (
    <TransactionFilterContext.Provider value={{ filters, setFilters, search, setSearch }}>
      {children}
    </TransactionFilterContext.Provider>
  );
}

export function useTransactionFilters() {
  const context = useContext(TransactionFilterContext);
  if (context === undefined) {
    throw new Error('useTransactionFilters must be used within a TransactionFilterProvider');
  }
  return context;
}
