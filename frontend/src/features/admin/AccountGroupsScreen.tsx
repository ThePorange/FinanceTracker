import { useState, useMemo, useEffect } from 'react';
import { useSystemData, useCreateSystemData, useUpdateSystemData, useDeleteSystemData } from './useSystemData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Input } from '../../components/shared/Input';
import { Network, Plus, Save, Trash, X, Layers, CheckSquare, Square } from 'lucide-react';

export function AccountGroupsScreen() {
  const queryClient = useQueryClient();
  const { data: groupsData, isLoading: groupsLoading } = useSystemData('sys_account_group');
  const { data: sourcesData, isLoading: sourcesLoading } = useSystemData('sys_account_source');
  const { data: mapsData, isLoading: mapsLoading } = useSystemData('sys_account_group_map');

  const createGroup = useCreateSystemData('sys_account_group');
  const updateGroup = useUpdateSystemData('sys_account_group', 'sys_account_group_id');
  const deleteGroup = useDeleteSystemData('sys_account_group', 'sys_account_group_id');
  
  const createMap = useCreateSystemData('sys_account_group_map');
  const deleteMaps = useDeleteSystemData('sys_account_group_map', 'sys_account_group_id');

  const groups = groupsData?.data || [];
  const sources = sourcesData?.data || [];
  const mappings = mapsData?.data || [];

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Sync selected sources when a group is picked
  useEffect(() => {
    if (selectedGroup) {
      const boundSourceIds = mappings
        .filter((m: any) => m.sys_account_group_id === selectedGroup.sys_account_group_id)
        .map((m: any) => m.sys_account_source_id);
      setSelectedSourceIds(new Set(boundSourceIds));
    } else {
      setSelectedSourceIds(new Set());
    }
  }, [selectedGroup, mappings]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    await createGroup.mutateAsync({ account_group_name: newGroupName });
    setNewGroupName('');
  };

  const handleDeleteGroup = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to completely erase this Account Group?')) return;
    // Clear mappings safely first
    try { await deleteMaps.mutateAsync(id); } catch(err) {} 
    await deleteGroup.mutateAsync(id);
    if (selectedGroup?.sys_account_group_id === id) setSelectedGroup(null);
  };

  const toggleSource = (sourceId: number) => {
    const next = new Set(selectedSourceIds);
    if (next.has(sourceId)) next.delete(sourceId);
    else next.add(sourceId);
    setSelectedSourceIds(next);
  };

  const handleSaveMappings = async () => {
    if (!selectedGroup) return;
    setIsSaving(true);
    try {
      // Clear legacy
      await deleteMaps.mutateAsync(selectedGroup.sys_account_group_id);
      
      // Inject new associations consecutively
      for (const srcId of Array.from(selectedSourceIds)) {
        await createMap.mutateAsync({
          sys_account_group_id: selectedGroup.sys_account_group_id,
          sys_account_source_id: srcId
        });
      }
      
      await queryClient.invalidateQueries({ queryKey: ['systemData', 'sys_account_group_map'] });
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
            <Network className="text-purple-600" />
            Account Groups Identity Manager
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">Consolidate multiple extraction sources seamlessly binding matrix clusters iteratively mapping raw data dimensions together universally.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left Column: Groups List */}
        <div className="col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex gap-3 items-center">
             <Input 
               placeholder="Designate new group title..." 
               value={newGroupName} 
               onChange={e => setNewGroupName(e.target.value)} 
               className="flex-1"
             />
             <button 
               onClick={handleCreateGroup}
               disabled={createGroup.isPending || !newGroupName.trim()}
               className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-xl disabled:opacity-50 transition-all shadow-sm"
             >
               <Plus size={20} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {groupsLoading ? (
               <div className="p-8 text-center text-slate-400 font-medium">Loading group structural matrices...</div>
            ) : groups.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-medium">No organizational groups configured.</div>
            ) : (
               groups.map((g: any) => (
                 <div 
                   key={g.sys_account_group_id}
                   onClick={() => setSelectedGroup(g)}
                   className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${selectedGroup?.sys_account_group_id === g.sys_account_group_id ? 'bg-purple-50 border-purple-200 shadow-sm ring-1 ring-purple-500/20' : 'bg-white border-slate-100 hover:border-purple-200 hover:bg-slate-50'}`}
                 >
                   <div className="flex items-center gap-3">
                     <Layers className={selectedGroup?.sys_account_group_id === g.sys_account_group_id ? 'text-purple-600' : 'text-slate-400'} size={20} />
                     <div>
                       <h3 className="font-bold text-slate-800">{g.account_group_name}</h3>
                       <p className="text-xs font-medium text-slate-500 mt-0.5">Sys ID: {g.sys_account_group_id}</p>
                     </div>
                   </div>
                   
                   <button 
                     onClick={(e) => handleDeleteGroup(e, g.sys_account_group_id)}
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
        <div className="col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
           {selectedGroup ? (
             <>
               <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                 <div>
                   <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Association Sandbox</h3>
                   <p className="text-xs text-slate-500 mt-0.5 font-medium">Target: <span className="text-purple-700 font-bold">{selectedGroup.account_group_name}</span></p>
                 </div>
                 <button onClick={() => setSelectedGroup(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
               </div>
               
               <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/50">
                 {sourcesLoading ? (
                   <p className="text-sm font-medium text-slate-400">Resolving sources...</p>
                 ) : sources.length === 0 ? (
                   <p className="text-sm font-medium text-slate-400">System contains no active sources.</p>
                 ) : (
                   sources.map((s: any) => {
                     const isSelected = selectedSourceIds.has(s.sys_account_source_id);
                     return (
                       <label 
                         key={s.sys_account_source_id} 
                         className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${isSelected ? 'bg-white border-purple-300 shadow-sm ring-1 ring-purple-100' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                       >
                         <div className={`shrink-0 ${isSelected ? 'text-purple-600' : 'text-slate-300'}`}>
                           {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                         </div>
                         <div className="flex-1">
                           <p className={`font-bold transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>{s.account_source_name}</p>
                           <p className="text-xs font-medium text-slate-400 mt-0.5">Integration Anchor {s.sys_account_source_id}</p>
                         </div>
                         <input 
                           type="checkbox" 
                           className="hidden" 
                           checked={isSelected}
                           onChange={() => toggleSource(s.sys_account_source_id)}
                         />
                       </label>
                     );
                   })
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
                   Apply Synchronization Blueprint
                 </button>
               </div>
             </>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50">
                <Network size={48} className="text-slate-300 mb-4 stroke-1" />
                <h3 className="font-bold text-slate-700 text-lg">No Architecture Rendered</h3>
                <p className="text-slate-500 text-sm mt-2 font-medium max-w-[200px] leading-relaxed">Select any active group dynamically spanning the left matrix column generating its internal isolated binding maps properly.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
