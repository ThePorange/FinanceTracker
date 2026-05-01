import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSystemData } from '../admin/useSystemData';

interface TransactionFilterPanelProps {
  filters: Record<string, any>;
  onFilterChange: (newFilters: Record<string, any>) => void;
  defaultExpanded?: boolean;
}

export function TransactionFilterPanel({ filters, onFilterChange, defaultExpanded = false }: TransactionFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [localFilters, setLocalFilters] = useState<Record<string, any>>(filters);
  
  // Sync when filters are explicitly cleared or changed from the outside
  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debounce the push to the parent context
  React.useEffect(() => {
    const timer = setTimeout(() => {
      // Only push if there's a difference to prevent infinite render loops if references change
      if (JSON.stringify(localFilters) !== JSON.stringify(filters)) {
        onFilterChange(localFilters);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localFilters, filters, onFilterChange]);

  const { data: sourcesData } = useSystemData('sys_account_source');
  const { data: groupsData } = useSystemData('sys_account_group');
  const { data: typesData } = useSystemData('sys_transaction_type');
  const { data: rulesData } = useSystemData('sys_rules');
  const { data: ruleGroupsData } = useSystemData('sys_rule_group');

  const sources = sourcesData?.data || sourcesData || [];
  const groups = groupsData?.data || groupsData || [];
  const types = typesData?.data || typesData || [];
  const rules = rulesData?.data || rulesData || [];
  const ruleGroups = ruleGroupsData?.data || ruleGroupsData || [];

  const handleUpdate = (key: string, value: any) => {
    setLocalFilters(prev => {
      const next = { ...prev, [key]: value };
      
      // Mutually exclusive rule filtering
      if (key === 'ruleGroupId' && value) {
        delete next['ruleId'];
      } else if (key === 'ruleId' && value) {
        delete next['ruleGroupId'];
      }

      if (value === undefined || value === null || value === '') {
        delete next[key];
      }
      return next;
    });
  };

  const clearAll = () => onFilterChange({});

  // We explicitly ignore limit/page from the active filter count since those are pagination/system config values.
  const activeCount = Object.keys(filters).filter(k => k !== 'limit' && k !== 'page').length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 transition-all duration-300">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-800">Advanced Filters</h3>
          {activeCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {activeCount} Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {activeCount > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
            >
              Clear All
            </button>
          )}
          {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Dates */}
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={localFilters.startDate || ''} 
                onChange={e => handleUpdate('startDate', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0"
              />
              <span className="text-gray-400 self-center">to</span>
              <input 
                type="date" 
                value={localFilters.endDate || ''} 
                onChange={e => handleUpdate('endDate', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-0"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <div className="flex gap-2">
              <select 
                value={localFilters.amountOp || '='} 
                onChange={e => handleUpdate('amountOp', e.target.value)}
                className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="=">=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
              </select>
              <input 
                type="number" 
                placeholder="0.00"
                value={localFilters.amountVal || ''} 
                onChange={e => handleUpdate('amountVal', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Account Group */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Account Group</label>
             <select 
                value={localFilters.groupId || ''} 
                onChange={e => handleUpdate('groupId', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Groups</option>
                {groups.map((g: any) => <option key={g.sys_account_group_id} value={g.sys_account_group_id}>{g.account_group_name}</option>)}
              </select>
          </div>

          {/* Account Source */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Account Source</label>
             <select 
                value={localFilters.sourceId || ''} 
                onChange={e => handleUpdate('sourceId', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sources</option>
                {sources.map((s: any) => <option key={s.sys_account_source_id} value={s.sys_account_source_id}>{s.account_source_name}</option>)}
              </select>
          </div>

          {/* Category */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Category Lookup</label>
             <input 
                type="text" 
                placeholder="e.g. Dining"
                value={localFilters.category || ''} 
                onChange={e => handleUpdate('category', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
          </div>

          {/* Transaction Type */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
             <select 
                value={localFilters.typeId || ''} 
                onChange={e => handleUpdate('typeId', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {types.map((t: any) => <option key={t.sys_transaction_type_id} value={t.sys_transaction_type_id}>{t.transaction_type}</option>)}
              </select>
          </div>

          {/* Rule Group */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Rule Group</label>
             <select 
                value={localFilters.ruleGroupId || ''} 
                onChange={e => handleUpdate('ruleGroupId', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Rule Group</option>
                {ruleGroups.map((rg: any) => <option key={rg.sys_rule_group_id} value={rg.sys_rule_group_id}>{rg.rule_group_name}</option>)}
              </select>
          </div>

          {/* Binding Rules */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Applied Rule</label>
             <select 
                value={localFilters.ruleId || ''} 
                onChange={e => handleUpdate('ruleId', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Rule</option>
                {rules.map((r: any) => <option key={r.sys_rules_id} value={r.sys_rules_id}>{r.rule_name}</option>)}
              </select>
          </div>
          
          {/* DRCR */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Debit / Credit</label>
             <select 
                value={localFilters.drcr || ''} 
                onChange={e => handleUpdate('drcr', e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Streams</option>
                <option value="DR">Debits (Outflow)</option>
                <option value="CR">Credits (Inflow)</option>
              </select>
          </div>
        </div>
      )}
    </div>
  );
}
