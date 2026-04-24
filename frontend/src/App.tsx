import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Receipt, Tags, Network, Wallet, Database, Activity, ShieldAlert, UploadCloud, TableProperties, LayoutTemplate, BookMarked } from 'lucide-react';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { CategoryManagementScreen } from './features/categories/CategoryManagementScreen';
import { MappingRulesScreen } from './features/mappings/MappingRulesScreen';
import { DashboardScreen } from './features/dashboard/DashboardScreen';
import { EtlJobsScreen } from './features/admin/EtlJobsScreen';
import { DataSourcesScreen } from './features/admin/DataSourcesScreen';
import { SystemTableScreen } from './features/admin/SystemTableScreen';
import { DataImportScreen } from './features/admin/DataImportScreen';
import { StagingDataScreen } from './features/admin/StagingDataScreen';
import { AccountGroupsScreen } from './features/admin/AccountGroupsScreen';
import { RulesScreen } from './features/admin/RulesScreen';
import { TransactionFilterProvider } from './features/transactions/TransactionFilterContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
});

function Sidebar({ isAdminMode, setIsAdminMode }: { isAdminMode: boolean, setIsAdminMode: (v: boolean) => void }) {
  const userLinks = [
    { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/transactions', icon: <Receipt size={20} />, label: 'Transactions' },
    { to: '/categories', icon: <Tags size={20} />, label: 'Categories' },
    { to: '/mappings', icon: <Network size={20} />, label: 'Mapping Rules' },
    { to: '/rules', icon: <BookMarked size={20} />, label: 'Rules Engine' },
  ];

  const adminLinks = [
    { to: '/admin/etl', icon: <Activity size={20} />, label: 'ETL Jobs' },
    { to: '/admin/import', icon: <UploadCloud size={20} />, label: 'Data Import' },
    { to: '/admin/sources', icon: <Database size={20} />, label: 'Data Sources (Wizard)' },
    { to: '/admin/groups', icon: <Network size={20} />, label: 'Account Groups' },
    { to: '/admin/staging', icon: <LayoutTemplate size={20} />, label: 'Staging Area' },
  ];

  const sysTableLinks = [
    { to: '/admin/tables/sys_import_log', label: 'Import Logs' },
    { to: '/admin/tables/sys_transaction_type', label: 'Transaction Types' },
    { to: '/admin/tables/sys_transaction_category', label: 'Categories Matrix' },
    { to: '/admin/tables/sys_currency', label: 'Currencies' },
    { to: '/admin/tables/sys_currency_pair', label: 'Currency Pairs' },
    { to: '/admin/tables/sys_fx_rate', label: 'FX Rates' },
    { to: '/admin/tables/sys_config', label: 'Global Properties' },
    { to: '/admin/tables/sys_staging_fields', label: 'Staged Fields' },
  ];

  const links = isAdminMode ? adminLinks : userLinks;

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 shadow-xl z-20 transition-all">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-inner transition-colors duration-300 ${isAdminMode ? 'bg-purple-600' : 'bg-blue-600'}`}>
            {isAdminMode ? <ShieldAlert size={20} /> : <Wallet size={20} />}
          </div>
          FinanceTracker
        </h1>
      </div>
      
      <div className="px-5 pt-5 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {isAdminMode ? 'System Administration' : 'User Platform'}
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {links.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${isActive ? (isAdminMode ? 'bg-purple-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'hover:bg-slate-800 hover:text-white'}`}
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
        {isAdminMode && (
          <div className="mt-6 border-t border-slate-800/50 pt-4">
            <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
              <TableProperties size={14} /> System Tables
            </div>
            {sysTableLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-purple-900/40 text-purple-300 pointer-events-none ring-1 ring-purple-700/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${link.to.includes('sys_') ? 'bg-slate-700' : 'bg-transparent'}`}></div>
                <span className="truncate">{link.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={() => setIsAdminMode(!isAdminMode)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isAdminMode ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60 ring-1 ring-purple-700/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
        >
          <span className="flex items-center gap-2">
            <ShieldAlert size={18} className={isAdminMode ? 'text-purple-400' : 'text-slate-500'} />
            Admin Mode
          </span>
          <div className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${isAdminMode ? 'bg-purple-500' : 'bg-slate-700'}`}>
            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-300 ${isAdminMode ? 'left-[19px]' : 'left-1'}`}></div>
          </div>
        </button>
      </div>
    </div>
  );
}

function App() {
  const [isAdminMode, setIsAdminMode] = useState(() => {
    return localStorage.getItem('financeTracker_isAdminMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('financeTracker_isAdminMode', String(isAdminMode));
  }, [isAdminMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <TransactionFilterProvider>
        <BrowserRouter>
          <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 selection:bg-blue-200">
            <Sidebar isAdminMode={isAdminMode} setIsAdminMode={setIsAdminMode} />
            <main className="flex-1 overflow-y-auto relative bg-[#f8fafc]">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
              <div className="relative z-0 min-h-full">
                <Routes>
                  <Route path="/" element={<Navigate to={isAdminMode ? "/admin/etl" : "/dashboard"} replace />} />
                  
                  {/* User Routes */}
                  <Route path="/dashboard" element={<DashboardScreen />} />
                  <Route path="/transactions" element={<TransactionsScreen />} />
                  <Route path="/categories" element={<CategoryManagementScreen />} />
                  <Route path="/mappings" element={<MappingRulesScreen />} />
                  <Route path="/rules" element={<RulesScreen />} />
                  <Route path="/admin/rules" element={<RulesScreen />} />
                  <Route path="/admin/etl" element={<EtlJobsScreen />} />
                  <Route path="/admin/import" element={<DataImportScreen />} />
                  <Route path="/admin/sources" element={<DataSourcesScreen />} />
                  <Route path="/admin/groups" element={<AccountGroupsScreen />} />
                  <Route path="/admin/staging" element={<StagingDataScreen />} />
                  <Route path="/admin/rules" element={<RulesScreen />} />
                  <Route path="/admin/tables/:tableName" element={<SystemTableScreen />} />
                </Routes>
              </div>
            </main>
          </div>
        </BrowserRouter>
      </TransactionFilterProvider>
    </QueryClientProvider>
  );
}

export default App;
