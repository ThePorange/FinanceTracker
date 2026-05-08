import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, Receipt, Tags, Network, Wallet, Database, Activity, ShieldAlert, UploadCloud, TableProperties, LayoutTemplate, BookMarked, FolderGit2, Pin, PinOff } from 'lucide-react';
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
import { RuleGroupsScreen } from './features/admin/RuleGroupsScreen';
import { TransactionFilterProvider } from './features/transactions/TransactionFilterContext';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
});

function Sidebar({ isAdminMode, setIsAdminMode }: { isAdminMode: boolean, setIsAdminMode: (v: boolean) => void }) {
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem('financeTracker_sidebarPinned') !== 'false');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem('financeTracker_sidebarPinned', String(isPinned));
  }, [isPinned]);

  const expanded = isPinned || isHovered;

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
    { to: '/admin/rule-groups', icon: <FolderGit2 size={20} />, label: 'Rule Groups' },
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
    <div 
      className={`${expanded ? 'w-64' : 'w-20'} bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 shadow-xl z-20 transition-all duration-300 relative group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`p-4 border-b border-slate-800 flex items-center ${expanded ? 'justify-between' : 'justify-center'}`}>
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner transition-colors duration-300 ${isAdminMode ? 'bg-purple-600' : 'bg-blue-600'}`}>
            {isAdminMode ? <ShieldAlert size={20} /> : <Wallet size={20} />}
          </div>
          {expanded && <h1 className="text-xl font-bold text-white tracking-tight">FinanceTracker</h1>}
        </div>
        {expanded && (
          <button 
            onClick={() => setIsPinned(!isPinned)}
            className="text-slate-500 hover:text-white transition-colors p-1"
            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
          >
            {isPinned ? <Pin size={18} className="text-blue-400 fill-current" /> : <PinOff size={18} />}
          </button>
        )}
      </div>
      
      <div className={`px-5 pt-5 pb-2 text-xs font-bold text-slate-500 uppercase tracking-wider overflow-hidden whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 h-0 py-0 m-0'}`}>
        {isAdminMode ? 'System Administration' : 'User Platform'}
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-2 ${expanded ? 'p-4' : 'p-2'}`}>
        {links.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            title={!expanded ? link.label : undefined}
            className={({ isActive }) => `flex items-center gap-3 py-3 rounded-lg font-medium transition-all duration-200 overflow-hidden whitespace-nowrap ${isActive ? (isAdminMode ? 'bg-purple-600 text-white shadow-md' : 'bg-blue-600 text-white shadow-md') : 'hover:bg-slate-800 hover:text-white'} ${expanded ? 'px-4' : 'px-0 justify-center'}`}
          >
            <div className="shrink-0">{link.icon}</div>
            {expanded && <span>{link.label}</span>}
          </NavLink>
        ))}
        {isAdminMode && (
          <div className={`border-t border-slate-800/50 pt-4 ${expanded ? 'mt-6' : 'mt-4'}`}>
            <div className={`px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2 overflow-hidden whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 h-0 py-0 my-0'}`}>
              <TableProperties size={14} /> System Tables
            </div>
            {expanded ? sysTableLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden whitespace-nowrap ${isActive ? 'bg-purple-900/40 text-purple-300 pointer-events-none ring-1 ring-purple-700/50' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${link.to.includes('sys_') ? 'bg-slate-700' : 'bg-transparent'}`}></div>
                <span className="truncate">{link.label}</span>
              </NavLink>
            )) : (
              <div className="flex justify-center" title="System Tables">
                <TableProperties size={20} className="text-slate-600" />
              </div>
            )}
          </div>
        )}
      </nav>
      
      <div className={`border-t border-slate-800 ${expanded ? 'p-4' : 'p-2'}`}>
        <button 
          onClick={() => setIsAdminMode(!isAdminMode)}
          title={!expanded ? (isAdminMode ? "Exit Admin Mode" : "Enter Admin Mode") : undefined}
          className={`w-full flex items-center rounded-xl font-medium transition-all duration-200 ${expanded ? 'px-4 py-3 justify-between' : 'py-3 justify-center'} ${isAdminMode ? 'bg-purple-900/40 text-purple-300 hover:bg-purple-900/60 ring-1 ring-purple-700/50' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
        >
          <span className="flex items-center gap-2 shrink-0">
            <ShieldAlert size={18} className={isAdminMode ? 'text-purple-400' : 'text-slate-500'} />
            {expanded && "Admin Mode"}
          </span>
          {expanded && (
            <div className={`shrink-0 w-9 h-5 rounded-full relative transition-colors duration-300 ${isAdminMode ? 'bg-purple-500' : 'bg-slate-700'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-300 ${isAdminMode ? 'left-[19px]' : 'left-1'}`}></div>
            </div>
          )}
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
                  <Route path="/admin/rule-groups" element={<RuleGroupsScreen />} />
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
