import { useState, useEffect } from 'react';
import { useSystemData, useCreateSystemData, useUpdateSystemData, useDeleteSystemData } from './useSystemData';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '../../components/shared/Input';
import { FolderGit2, Plus, Save, Trash, X, Layers, CheckSquare, Square, ToggleLeft, ToggleRight } from 'lucide-react';

export function RuleGroupsScreen() {
  const queryClient = useQueryClient();
  const { data: groupsData, isLoading: groupsLoading } = useSystemData('sys_rule_group');
  const { data: rulesData, isLoading: rulesLoading } = useSystemData('sys_rules');
  const { data: mapsData, isLoading: mapsLoading } = useSystemData('sys_rule_group_map');

  const createGroup = useCreateSystemData('sys_rule_group');
  const deleteGroup = useDeleteSystemData('sys_rule_group', 'sys_rule_group_id');
  
  const createMap = useCreateSystemData('sys_rule_group_map');
  const deleteMaps = useDeleteSystemData('sys_rule_group_map', 'sys_rule_group_id');

  const groups = groupsData?.data || [];
  const rules = rulesData?.data || [];
  const mappings = mapsData?.data || [];

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  
  // Maps sys_rule_id -> { exclude_rules: 0 | 1 }
  const [selectedRuleMap, setSelectedRuleMap] = useState<Record<number, { exclude_rules: number }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sync selected rules when a group is picked
  useEffect(() => {
    if (selectedGroup) {
      const boundRules: Record<number, { exclude_rules: number }> = {};
      mappings
        .filter((m: any) => m.sys_rule_group_id === selectedGroup.sys_rule_group_id)
        .forEach((m: any) => {
          boundRules[m.sys_rule_id] = { exclude_rules: m.exclude_rules || 0 };
        });
      setSelectedRuleMap(boundRules);
    } else {
      setSelectedRuleMap({});
    }
  }, [selectedGroup, mappings]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await createGroup.mutateAsync({ rule_group_name: newGroupName });
    setNewGroupName('');
  };

  const handleDeleteGroup = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to completely erase this Rule Group?')) return;
    // Clear mappings safely first
    try { await deleteMaps.mutateAsync(id); } catch(err) {} 
    await deleteGroup.mutateAsync(id);
    if (selectedGroup?.sys_rule_group_id === id) setSelectedGroup(null);
  };

  const toggleRule = (ruleId: number) => {
    const next = { ...selectedRuleMap };
    if (next[ruleId]) {
      delete next[ruleId]; // unmap
    } else {
      next[ruleId] = { exclude_rules: 0 }; // map with default include
    }
    setSelectedRuleMap(next);
  };

  const toggleExclude = (e: React.MouseEvent, ruleId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const next = { ...selectedRuleMap };
    if (next[ruleId]) {
      next[ruleId].exclude_rules = next[ruleId].exclude_rules === 1 ? 0 : 1;
      setSelectedRuleMap(next);
    }
  };

  const handleSaveMappings = async () => {
    if (!selectedGroup) return;
    setIsSaving(true);
    try {
      // Clear legacy
      await deleteMaps.mutateAsync(selectedGroup.sys_rule_group_id);
      
      // Inject new associations consecutively
      for (const [ruleId, meta] of Object.entries(selectedRuleMap)) {
        await createMap.mutateAsync({
          sys_rule_group_id: selectedGroup.sys_rule_group_id,
          sys_rule_id: Number(ruleId),
          exclude_rules: meta.exclude_rules
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['systemData', 'sys_rule_group_map'] });
      setSelectedGroup(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FolderGit2 className="text-emerald-600" />
            Rule Groups Manager
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Bundle multiple independent rules into powerful, cohesive transaction filter groups.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left Column: Groups List */}
        <div className="col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex gap-3 items-center">
             <Input 
               placeholder="Enter new rule group name..." 
               value={newGroupName} 
               onChange={e => setNewGroupName(e.target.value)} 
               className="flex-1"
             />
             <button 
               onClick={handleCreateGroup}
               disabled={createGroup.isPending || !newGroupName.trim()}
               className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl disabled:opacity-50 transition-all shadow-sm"
             >
               <Plus size={20} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {groupsLoading ? (
               <div className="p-8 text-center text-slate-400 font-medium">Loading rule groups...</div>
            ) : groups.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-medium">No rule groups configured.</div>
            ) : (
               groups.map((g: any) => (
                 <div 
                   key={g.sys_rule_group_id}
                   onClick={() => setSelectedGroup(g)}
                   className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${selectedGroup?.sys_rule_group_id === g.sys_rule_group_id ? 'bg-emerald-50 border-emerald-200 shadow-sm ring-1 ring-emerald-500/20' : 'bg-white border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}
                 >
                   <div className="flex items-center gap-3">
                     <Layers className={selectedGroup?.sys_rule_group_id === g.sys_rule_group_id ? 'text-emerald-600' : 'text-slate-400'} size={20} />
                     <div>
                       <h3 className="font-bold text-slate-800">{g.rule_group_name}</h3>
                       <p className="text-xs font-medium text-slate-500 mt-0.5">ID: {g.sys_rule_group_id}</p>
                     </div>
                   </div>
                   
                   <button 
                     onClick={(e) => handleDeleteGroup(e, g.sys_rule_group_id)}
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                   >
                     <Trash size={16} />
                   </button>
                 </div>
               ))
            )}
          </div>
        </div>

        {/* Right Column: Mapping Bindings */}
        <div className="col-span-6 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[650px]">
           {selectedGroup ? (
             <>
               <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                 <div>
                   <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Rule Mappings</h3>
                   <p className="text-xs text-slate-500 mt-0.5 font-medium">Group: <span className="text-emerald-700 font-bold">{selectedGroup.rule_group_name}</span></p>
                 </div>
                 <button onClick={() => setSelectedGroup(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
               </div>
               
               <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50">
                 {rulesLoading ? (
                   <p className="text-sm font-medium text-slate-400">Loading rules...</p>
                 ) : rules.length === 0 ? (
                   <p className="text-sm font-medium text-slate-400">No rules available.</p>
                 ) : (
                   <>
                     {/* Selected Rules Section */}
                     {rules.filter((r: any) => !!selectedRuleMap[r.sys_rules_id]).length > 0 && (
                       <div className="mb-8 space-y-3">
                         <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 border-b border-slate-200 pb-2">Selected Rules</h4>
                         {rules.filter((r: any) => !!selectedRuleMap[r.sys_rules_id]).map((r: any) => {
                           const isExcluded = selectedRuleMap[r.sys_rules_id].exclude_rules === 1;

                           return (
                             <label 
                               key={r.sys_rules_id} 
                               className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${isExcluded ? 'bg-red-50 border-red-300 shadow-sm ring-1 ring-red-100' : 'bg-white border-emerald-300 shadow-sm ring-1 ring-emerald-100'}`}
                             >
                               <div className={`shrink-0 ${isExcluded ? 'text-red-500' : 'text-emerald-600'}`}>
                                 <CheckSquare size={20} />
                               </div>
                               
                               <div className="flex-1 min-w-0">
                                 <p className={`font-bold truncate transition-colors ${isExcluded ? 'text-red-900' : 'text-slate-900'}`}>{r.rule_name || 'Unnamed Rule'}</p>
                                 <p className="text-xs font-medium text-slate-400 mt-0.5">Matches: <span className="font-bold">{r.last_run_count || 0}</span> transactions</p>
                               </div>

                               <div 
                                 className="shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 transition-colors"
                                 onClick={(e) => toggleExclude(e, r.sys_rules_id)}
                               >
                                 <span className={`text-[10px] font-bold uppercase tracking-wider ${isExcluded ? 'text-red-600' : 'text-slate-400'}`}>
                                   {isExcluded ? 'Exclude' : 'Include'}
                                 </span>
                                 {isExcluded ? (
                                   <ToggleRight size={20} className="text-red-500" />
                                 ) : (
                                   <ToggleLeft size={20} className="text-slate-400" />
                                 )}
                               </div>

                               <input 
                                 type="checkbox" 
                                 className="hidden" 
                                 checked={true}
                                 onChange={() => toggleRule(r.sys_rules_id)}
                               />
                             </label>
                           );
                         })}
                       </div>
                     )}

                     {/* Available Rules Section */}
                     {rules.filter((r: any) => !selectedRuleMap[r.sys_rules_id]).length > 0 && (
                       <div className="space-y-3">
                         <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1 border-b border-slate-200 pb-2">Available Rules</h4>
                         {rules.filter((r: any) => !selectedRuleMap[r.sys_rules_id]).map((r: any) => (
                           <label 
                             key={r.sys_rules_id} 
                             className="flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                           >
                             <div className="shrink-0 text-slate-300">
                               <Square size={20} />
                             </div>
                             
                             <div className="flex-1 min-w-0">
                               <p className="font-bold truncate transition-colors text-slate-600">{r.rule_name || 'Unnamed Rule'}</p>
                               <p className="text-xs font-medium text-slate-400 mt-0.5">Matches: <span className="font-bold">{r.last_run_count || 0}</span> transactions</p>
                             </div>

                             <input 
                               type="checkbox" 
                               className="hidden" 
                               checked={false}
                               onChange={() => toggleRule(r.sys_rules_id)}
                             />
                           </label>
                         ))}
                       </div>
                     )}
                   </>
                 )}
               </div>

               <div className="p-5 border-t border-slate-100 bg-white">
                 <button
                   onClick={handleSaveMappings}
                   disabled={isSaving}
                   className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                 >
                   {isSaving ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   ) : (
                     <Save size={18} />
                   )}
                   Save Rule Group Mappings
                 </button>
               </div>
             </>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
                <FolderGit2 size={48} className="text-slate-300 mb-4 stroke-1" />
                <h3 className="font-bold text-slate-700 text-lg">No Group Selected</h3>
                <p className="text-slate-500 text-sm mt-2 font-medium max-w-[250px] leading-relaxed">Select a rule group from the left panel to configure its rule mappings and exclusion logic.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
