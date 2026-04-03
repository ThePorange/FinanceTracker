import { useState } from 'react';
import { useSystemData } from './useSystemData';
import { Input } from '../../components/shared/Input';
import { Play, Plus, Trash2, Save, FileJson } from 'lucide-react';
import { api } from '../../services/api';

type RuleCondition = {
  id: string; // purely for UI tracking
  type: 'contains' | 'equals' | 'date_range' | 'amount_range';
  field: string;
  value?: string;
  start?: string;
  end?: string;
  min?: number;
  max?: number;
};

type RuleGroup = {
  id: string;
  conditions: RuleCondition[];
};

export function RulesScreen() {
  const { data: rulesData, refetch: refetchRules } = useSystemData('sys_rules');
  const { data: categoriesData } = useSystemData('sys_transaction_category');
  const { data: sourcesData } = useSystemData('sys_account_source');

  const rules = rulesData?.data || [];
  const categories = categoriesData?.data || [];
  const sources = sourcesData?.data || [];

  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  
  // Form State
  const [ruleName, setRuleName] = useState('');
  const [sourceId, setSourceId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load into form
  const handleSelectRule = (r: any) => {
    setSelectedRuleId(r.sys_rules_id);
    setRuleName(r.rule_name || '');
    setSourceId(r.sys_account_source_id || '');
    setCategoryId(r.sys_transaction_category_id || '');
    setLastRun(r.last_run || null);
    
    let parsed: any;
    try {
       parsed = JSON.parse(r.rule_json);
    } catch(e) {}

    let loadedGroups: RuleGroup[] = [];

    if (parsed) {
       if (parsed.type === 'and' && parsed.conditions) {
          loadedGroups = parsed.conditions.map((c: any) => {
             if (c.type === 'or' && c.conditions) {
                return { id: Math.random().toString(), conditions: c.conditions.map((cc: any) => ({...cc, id: Math.random().toString()})) };
             } else {
                return { id: Math.random().toString(), conditions: [{...c, id: Math.random().toString()}] };
             }
          });
       } else if (parsed.type === 'or' && parsed.conditions) {
          loadedGroups = [{ id: Math.random().toString(), conditions: parsed.conditions.map((cc: any) => ({...cc, id: Math.random().toString()})) }];
       } else {
          loadedGroups = [{ id: Math.random().toString(), conditions: [{...parsed, id: Math.random().toString()}] }];
       }
    }
    setGroups(loadedGroups);
  };

  const handleCreateNew = () => {
    setSelectedRuleId(null);
    setRuleName('');
    setSourceId('');
    setCategoryId('');
    setLastRun(null);
    setGroups([{ id: Math.random().toString(), conditions: [{ id: Math.random().toString(), type: 'contains', field: 'description', value: '' }] }]);
  };

  const addGroup = () => {
    setGroups([...groups, { id: Math.random().toString(), conditions: [{ id: Math.random().toString(), type: 'contains', field: 'description', value: '' }] }]);
  };

  const removeGroup = (gId: string) => {
    setGroups(groups.filter(g => g.id !== gId));
  };

  const addConditionToGroup = (gId: string) => {
    setGroups(groups.map(g => {
       if (g.id === gId) return { ...g, conditions: [...g.conditions, { id: Math.random().toString(), type: 'contains', field: 'description', value: '' }] };
       return g;
    }));
  };

  const removeCondition = (gId: string, cId: string) => {
    setGroups(groups.map(g => {
       if (g.id === gId) {
          const newConds = g.conditions.filter(c => c.id !== cId);
          return { ...g, conditions: newConds };
       }
       return g;
    }).filter(g => g.conditions.length > 0));
  };

  const updateCondition = (gId: string, cId: string, updates: Partial<RuleCondition>) => {
    setGroups(groups.map(g => {
       if (g.id === gId) {
          return { ...g, conditions: g.conditions.map(c => c.id === cId ? { ...c, ...updates } : c) };
       }
       return g;
    }));
  };

  const handleSave = async () => {
    if (!ruleName || !categoryId || groups.length === 0) return alert('Name, Target Category, and at least one condition block are required.');
    
    setIsSaving(true);
    let finalJson: any = {};
    
    // Build JSON securely preventing empty strings parsing natively
    const cleanGroups = groups.map(g => {
       return g.conditions.map(c => {
          const { id, ...rest } = c;
          if (rest.type === 'date_range') rest.field = 'transaction_date';
          return rest;
       });
    }).filter(gc => gc.length > 0);

    if (cleanGroups.length === 0) {
       setIsSaving(false);
       return alert('You must define at least one valid condition.');
    }

    const mappedGroups = cleanGroups.map(groupConds => {
       if (groupConds.length === 1) return groupConds[0];
       return { type: 'or', conditions: groupConds };
    });

    if (mappedGroups.length === 1) {
       finalJson = mappedGroups[0];
    } else {
       finalJson = { type: 'and', conditions: mappedGroups };
    }

    const payload = {
       rule_name: ruleName,
       sys_account_source_id: sourceId || null,
       sys_transaction_category_id: categoryId,
       rule_json: JSON.stringify(finalJson)
    };

    try {
      if (selectedRuleId) {
         await fetch(`/api/config/sys_rules/sys_rules_id/${selectedRuleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         });
      } else {
         await fetch(`/api/config/sys_rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         });
      }
      await refetchRules();
      alert('Rule saved successfully!');
    } catch(e) {
      alert('Failed to save rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
     setIsExecuting(true);
     try {
       const res = await api.executeRules();
       alert(`Successfully executed! Mapped ${res.mappedTransactions} transactions across ${res.processedRules} rules.`);
     } catch (e: any) {
       alert(`Execution failed: ${e.message}`);
     } finally {
       setIsExecuting(false);
     }
  };

  const handleExecuteSingleRule = async (ruleId: number) => {
     try {
       const res = await api.executeRules(undefined, ruleId);
       alert(`Successfully executed! Mapped ${res.mappedTransactions} transactions.`);
     } catch (e: any) {
       alert(`Execution failed: ${e.message}`);
     }
  };

  const handleDeleteRule = async (ruleId: number) => {
     if (!confirm('Are you sure you want to delete this rule and all its categorizations?')) return;
     try {
       await api.deleteRule(ruleId);
       await refetchRules();
       if (selectedRuleId === ruleId) handleCreateNew();
       alert('Rule deleted successfully!');
     } catch (e: any) {
       alert(`Failed to delete rule: ${e.message}`);
     }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500 flex flex-col h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Rules Engine</h1>
          <p className="text-gray-500 mt-1">Configure deterministic categorizations natively resolving pipelines securely.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={handleExecute}
             disabled={isExecuting}
             className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 transition shadow-sm font-medium disabled:opacity-50"
          >
             <Play className="w-4 h-4" />
             {isExecuting ? 'Running Engine...' : 'Execute All Rules'}
          </button>
        </div>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Left pane: Rule List */}
        <div className="w-1/3 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <h3 className="font-semibold text-gray-700">Active Rules</h3>
             <button onClick={handleCreateNew} className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition">
                <Plus className="w-4 h-4" />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
             {rules.map((r: any) => (
                <div 
                   key={r.sys_rules_id}
                   className={`p-3 flex justify-between items-center rounded-lg border transition ${selectedRuleId === r.sys_rules_id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
                >
                   <div className="cursor-pointer flex-1" onClick={() => handleSelectRule(r)}>
                       <p className="font-medium text-gray-900 text-sm">{r.rule_name || 'Unnamed Rule'}</p>
                       <p className="text-xs text-gray-500 mt-1 truncate">{r.sys_account_source_id ? 'Source-Specific' : 'Global'}</p>
                   </div>
                   <div className="flex items-center gap-1">
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleExecuteSingleRule(r.sys_rules_id); }}
                          title="Run this rule only"
                          className="text-gray-400 hover:text-green-600 transition p-1.5 rounded-full hover:bg-green-50"
                      >
                          <Play className="w-3.5 h-3.5" />
                      </button>
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteRule(r.sys_rules_id); }}
                          title="Delete Rule"
                          className="text-gray-400 hover:text-red-500 transition p-1.5 rounded-full hover:bg-red-50"
                      >
                          <Trash2 className="w-3.5 h-3.5" />
                      </button>
                   </div>
                </div>
             ))}
             {rules.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No rules configured.</p>}
          </div>
        </div>

        {/* Right pane: Rule Builder */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-y-auto p-8">
           {selectedRuleId !== null || groups.length > 0 ? (
              <div className="space-y-8 max-w-2xl">
                 <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">{selectedRuleId ? 'Edit Rule' : 'Create New Rule'}</h2>
                      {lastRun && (
                        <p className="text-xs text-gray-400 mt-1 font-medium">Last Executed: {new Date(lastRun + 'Z').toLocaleString()}</p>
                      )}
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name</label>
                       <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Starbucks Transactions" />
                    </div>
                    <div className="flex gap-4">
                       <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Target Category</label>
                          <select 
                             value={categoryId} 
                             onChange={e => setCategoryId(Number(e.target.value))}
                             className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          >
                             <option value="" disabled>Select Target</option>
                             {categories.map((c: any) => <option key={c.sys_transaction_category_id} value={c.sys_transaction_category_id}>{c.category_name}</option>)}
                          </select>
                       </div>
                       <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scoped Source (Optional)</label>
                          <select 
                             value={sourceId} 
                             onChange={e => setSourceId(Number(e.target.value))}
                             className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          >
                             <option value="">Global (All Sources)</option>
                             {sources.map((s: any) => <option key={s.sys_account_source_id} value={s.sys_account_source_id}>{s.account_source_name}</option>)}
                          </select>
                       </div>
                    </div>
                 </div>

                 <div>
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileJson className="w-5 h-5 text-gray-400" /> Condition Blocks</h3>
                    </div>

                    <div className="space-y-6">
                       {groups.map((group, gIndex) => (
                          <div key={group.id} className="relative p-5 bg-gray-50/50 border border-gray-200 rounded-xl shadow-sm">
                             {gIndex > 0 && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold tracking-widest shadow-sm border border-blue-200">
                                   AND
                                </div>
                             )}
                             
                             <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Block {gIndex + 1} (Match ANY of these)</span>
                                <button onClick={() => removeGroup(group.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                             </div>
                             
                             <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                                {group.conditions.map((cond, cIndex) => (
                                   <div key={cond.id} className="relative flex flex-col gap-2">
                                      {cIndex > 0 && <div className="text-xs font-bold text-blue-500 tracking-widest -ml-4 py-1">OR</div>}
                                      
                                      <div className="flex gap-3">
                                         <select 
                                            value={cond.type} 
                                            onChange={e => updateCondition(group.id, cond.id, { type: e.target.value as any })}
                                            className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                         >
                                            <option value="contains">Text Contains</option>
                                            <option value="equals">Exact Match</option>
                                            <option value="amount_range">Amount Range</option>
                                            <option value="date_range">Date Range</option>
                                         </select>
                                         
                                         {cond.type !== 'date_range' && (
                                            <select 
                                               value={cond.field} 
                                               onChange={e => updateCondition(group.id, cond.id, { field: e.target.value })}
                                               className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                               <option value="description">Description</option>
                                               <option value="base_amount">Base Amount</option>
                                               <option value="transaction_date">Date</option>
                                            </select>
                                         )}

                                         {/* Dynamic Value Inputs based on Type */}
                                         <div className="flex-1 flex gap-2">
                                            {(cond.type === 'contains' || cond.type === 'equals') && (
                                               <>
                                                  <input 
                                                     type="text" placeholder="Value..." value={cond.value || ''}
                                                     onChange={e => updateCondition(group.id, cond.id, { value: e.target.value })}
                                                     className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                                  />
                                                  <button onClick={() => removeCondition(group.id, cond.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-4 h-4"/></button>
                                               </>
                                            )}
                                            {cond.type === 'amount_range' && (
                                               <>
                                                  <input type="number" placeholder="Min" value={cond.min || ''} onChange={e => updateCondition(group.id, cond.id, { min: Number(e.target.value) })} className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"/>
                                                  <input type="number" placeholder="Max" value={cond.max || ''} onChange={e => updateCondition(group.id, cond.id, { max: Number(e.target.value) })} className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"/>
                                                  <button onClick={() => removeCondition(group.id, cond.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-4 h-4"/></button>
                                               </>
                                            )}
                                            {cond.type === 'date_range' && (
                                               <>
                                                  <input type="date" value={cond.start || ''} onChange={e => updateCondition(group.id, cond.id, { start: e.target.value })} className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"/>
                                                  <input type="date" value={cond.end || ''} onChange={e => updateCondition(group.id, cond.id, { end: e.target.value })} className="w-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"/>
                                                  <button onClick={() => removeCondition(group.id, cond.id)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-4 h-4"/></button>
                                               </>
                                            )}
                                         </div>
                                      </div>
                                   </div>
                                ))}
                                <button onClick={() => addConditionToGroup(group.id)} className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition border border-transparent hover:border-blue-200">
                                   + Add OR Condition
                                </button>
                             </div>
                          </div>
                       ))}
                       
                       <div className="flex justify-center mt-2">
                          <button onClick={addGroup} className="flex items-center gap-2 text-sm font-bold text-blue-700 bg-white hover:bg-blue-50 px-5 py-2.5 rounded-lg transition border border-blue-200 shadow-sm">
                             <Plus className="w-4 h-4" /> Add AND Block
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-gray-100 flex justify-end">
                    <button 
                       onClick={handleSave}
                       disabled={isSaving}
                       className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium disabled:opacity-50"
                    >
                       <Save className="w-4 h-4"/> Save Rule
                    </button>
                 </div>
              </div>
           ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                 <FileJson className="w-12 h-12 mb-4 opacity-20" />
                 <p>Select a rule from the sidebar, or create a new one.</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
