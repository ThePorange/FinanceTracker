import { useMemo } from 'react';
import { useTransactions } from '../transactions/useTransactions';
import { useTransactionFilters } from '../transactions/TransactionFilterContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { TransactionFilterPanel } from '../transactions/TransactionFilterPanel';
import { Input } from '../../components/shared/Input';

export function DashboardScreen() {
  const { filters, setFilters, search, setSearch } = useTransactionFilters();

  // Since Dashboard needs limit: -1, we can merge the context filters with the limit override
  const dashboardFilters = { ...filters, limit: -1 };
  const { data: transactions, isLoading } = useTransactions(dashboardFilters);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!search) return transactions;
    const lower = search.toLowerCase();
    return transactions.filter(t => t.description?.toLowerCase().includes(lower));
  }, [transactions, search]);

  const { categorySpend, monthlyTrend, totalCR, totalDR } = useMemo(() => {
    if (!filteredTransactions) return { categorySpend: [], monthlyTrend: [], totalCR: 0, totalDR: 0 };

    const catMap: Record<string, { dr: number, cr: number }> = {};
    const monthMap: Record<string, { dr: number, cr: number }> = {};

    let totalCR = 0;
    let totalDR = 0;

    filteredTransactions.forEach(t => {
      const cat = t.userCategory || t.autoCategory || 'Uncategorized';
      const amt = Math.abs(t.amount || 0);

      const date = new Date(t.date || t.transaction_date || t.posting_date || new Date());
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!catMap[cat]) catMap[cat] = { dr: 0, cr: 0 };
      if (!monthMap[monthStr]) monthMap[monthStr] = { dr: 0, cr: 0 };

      if (t.drcr === 'CR') {
        totalCR += amt;
        catMap[cat].cr += amt;
        monthMap[monthStr].cr += amt;
      } else if (t.drcr === 'DR') {
        totalDR += amt;
        catMap[cat].dr += amt;
        monthMap[monthStr].dr += amt;
      }
    });

    const categorySpend = Object.entries(catMap)
      .map(([name, vals]) => ({ name, dr: vals.dr, cr: vals.cr, total: vals.dr + vals.cr }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    const monthlyTrend = Object.entries(monthMap)
      .map(([month, vals]) => ({ month, dr: vals.dr, cr: vals.cr }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { categorySpend, monthlyTrend, totalCR, totalDR };
  }, [filteredTransactions]);

  if (isLoading) return <div className="p-8 text-gray-500 animate-pulse">Computing analytics...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">High-level financial analytics and spending trends</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-72">
            <Input 
              placeholder="Search descriptions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <TransactionFilterPanel 
         filters={filters} 
         onFilterChange={(f) => setFilters(f)} 
      />

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Credits (Inflow)</span>
            <span className="text-3xl font-bold text-green-600">${totalCR.toFixed(2)}</span>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
            <span className="text-sm font-medium text-gray-500">Total Debits (Outflow)</span>
            <span className="text-3xl font-bold text-rose-600">${totalDR.toFixed(2)}</span>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">Spend by Category (Top 7)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySpend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: any, name: any) => [`$${Number(v).toFixed(2)}`, name]} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="dr" name="Debits" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="cr" name="Credits" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">Monthly Splend Trend</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: any, name: any) => [`$${Number(v).toFixed(2)}`, name]} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line name="Debits" type="monotone" dataKey="dr" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line name="Credits" type="monotone" dataKey="cr" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
