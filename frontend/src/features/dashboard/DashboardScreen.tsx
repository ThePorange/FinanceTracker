import { useState, useMemo } from 'react';
import { useTransactions } from '../transactions/useTransactions';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TransactionFilterPanel } from '../transactions/TransactionFilterPanel';

export function DashboardScreen() {
  const [filters, setFilters] = useState<Record<string, any>>({ limit: -1 });
  const { data: transactions, isLoading } = useTransactions(filters);

  const { categorySpend, monthlyTrend } = useMemo(() => {
    if (!transactions) return { categorySpend: [], monthlyTrend: [] };

    const catMap: Record<string, number> = {};
    const monthMap: Record<string, number> = {};

    transactions.forEach(t => {
      const cat = t.userCategory || t.autoCategory || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);

      const date = new Date(t.date);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthMap[monthStr] = (monthMap[monthStr] || 0) + Math.abs(t.amount);
    });

    const categorySpend = Object.entries(catMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7);

    const monthlyTrend = Object.entries(monthMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { categorySpend, monthlyTrend };
  }, [transactions]);

  if (isLoading) return <div className="p-8 text-gray-500 animate-pulse">Computing analytics...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">High-level financial analytics and spending trends</p>
      </div>

      <TransactionFilterPanel 
         filters={filters} 
         onFilterChange={(f) => setFilters({ ...f, limit: -1 })} 
      />

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
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Spend Total']} 
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
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
                  formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Spend Total']} 
                />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
