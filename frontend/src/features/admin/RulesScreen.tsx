import { useState } from 'react';
import { useSystemData } from './useSystemData';
import { Input } from '../../components/shared/Input';
import { Play, Plus, Trash2, Save, FileJson, ListChecks, Download, Copy } from 'lucide-react';
import { api } from '../../services/api';
import { TransactionSelectorModal } from './TransactionSelectorModal';

type RuleCondition = {
  id: string; // purely for UI tracking
  type: 'contains' | 'equals' | 'date_range' | 'amount_range' | 'select_transactions' | 'exclude_transactions';
  field?: string;
  value?: string;
  start?: string;
  end?: string;
  min?: number;
  max?: number;
  checksums?: string[];
  operator?: 'LIKE' | 'NOT LIKE';
  afterOperator?: 'and' | 'or'; // operator connecting this condition to the NEXT one
};

type RuleGroup = {
  id: string;
  sourceId?: number | '';
  conditions: RuleCondition[];
  afterOperator?: 'and' | 'or'; // operator connecting this block to the NEXT block
};

export function RulesScreen() {
  const { data: rulesData, refetch: refetchRules } = useSystemData('sys_rules');
  const { data: categoriesData, refetch: refetchCategories } = useSystemData('sys_transaction_category');
  const { data: sourcesData } = useSystemData('sys_account_source');

  const rules = [...(rulesData?.data || [])].sort((a: any, b: any) => (a.rule_name || '').localeCompare(b.rule_name || ''));
  const categories = categoriesData?.data || [];
  const sources = sourcesData?.data || [];

  const [selectedRuleId, setSelectedRuleId] = useState<number | null>(null);
  
  // Form State
  const [ruleName, setRuleName] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal State
  const [activeSelectorCondition, setActiveSelectorCondition] = useState<{groupId: string, condId: string, type: string, checksums: string[]} | null>(null);

  // Load into form
  const handleSelectRule = (r: any) => {
    setSelectedRuleId(r.sys_rules_id);
    setRuleName(r.rule_name || '');
    const cat = categories.find((c: any) => c.sys_transaction_category_id === r.sys_transaction_category_id);
    setCategoryInput(cat ? cat.category_name : '');
    setLastRun(r.last_run || null);
    
    let parsed: any;
    try {
       parsed = JSON.parse(r.rule_json);
    } catch(e) {}

    let loadedGroups: RuleGroup[] = [];

    if (parsed) {
       // Recursively parse a node into a RuleGroup UI structure
       function parseBlock(node: any, blockJoinOp: 'and' | 'or' = 'and'): RuleGroup {
          let sourceId: number | '' = '';
          let uiConditions: any[] = [];
          let condJoinOp: 'and' | 'or' = 'or'; // default within block

          if (node.type === 'and' || node.type === 'or') {
             condJoinOp = node.type;
             const sourceNode = node.conditions.find((c: any) => c.type === 'source');
             if (sourceNode) {
                sourceId = sourceNode.value;
                const otherNodes = node.conditions.filter((c: any) => c.type !== 'source');
                if (otherNodes.length === 1 && (otherNodes[0].type === 'and' || otherNodes[0].type === 'or')) {
                   const child = otherNodes[0];
                   condJoinOp = child.type;
                   uiConditions = child.conditions;
                } else {
                   uiConditions = otherNodes;
                }
             } else {
                uiConditions = node.conditions;
             }
          } else {
             uiConditions = [node];
          }

          // Assign afterOperator to each condition based on the block's join type
          uiConditions = uiConditions.map((c, i) => ({
             ...c,
             id: Math.random().toString(),
             afterOperator: i < uiConditions.length - 1 ? condJoinOp : undefined
          }));
          return { id: Math.random().toString(), sourceId, conditions: uiConditions, afterOperator: blockJoinOp };
       }

       // A top-level 'and' represents MULTIPLE BLOCKS only if its children are themselves
       // logical nodes (and/or). If children are all leaf conditions, it's a SINGLE BLOCK
       // with AND-joined conditions.
       const isLogicalNode = (node: any) => node.type === 'and' || node.type === 'or';

       if (parsed.type === 'and' && parsed.conditions) {
          const hasSource = parsed.conditions.some((c: any) => c.type === 'source');
          const hasNestedLogic = parsed.conditions.some((c: any) => isLogicalNode(c));
          if (hasSource || !hasNestedLogic) {
             // Single block: either source-scoped or all leaf conditions
             loadedGroups = [parseBlock(parsed)];
          } else {
             // Multiple blocks joined by AND
             loadedGroups = parsed.conditions.map((c: any) => parseBlock(c, 'and'));
          }
       } else if (parsed.type === 'or' && parsed.conditions) {
          const hasNestedLogic = parsed.conditions.some((c: any) => isLogicalNode(c));
          if (!hasNestedLogic) {
             // Single block with OR conditions
             loadedGroups = [parseBlock(parsed)];
          } else {
             // Multiple blocks joined by OR
             loadedGroups = parsed.conditions.map((c: any) => parseBlock(c, 'or'));
          }
       } else {
          loadedGroups = [parseBlock(parsed)];
       }

       if (r.sys_account_source_id) {
          loadedGroups.forEach(g => {
             if (!g.sourceId) g.sourceId = r.sys_account_source_id;
          });
       }
    }
    setGroups(loadedGroups);
  };

  const handleCreateNew = () => {
    setSelectedRuleId(null);
    setRuleName('');
    setCategoryInput('');
    setLastRun(null);
    setGroups([{ id: Math.random().toString(), sourceId: '', afterOperator: 'and', conditions: [{ id: Math.random().toString(), type: 'contains', field: 'description', value: '' }] }]);
  };

  const addGroup = (joinOp: 'and' | 'or' = 'and') => {
    const lastSourceId = groups.length > 0 ? groups[groups.length - 1].sourceId : '';
    // Set the preceding block's afterOperator
    setGroups(prev => {
      const updated = prev.map((g, i) => i === prev.length - 1 ? { ...g, afterOperator: joinOp } : g);
      return [...updated, { id: Math.random().toString(), sourceId: lastSourceId, afterOperator: 'and', conditions: [{ id: Math.random().toString(), type: 'contains', field: 'description', value: '' }] }];
    });
  };

  const toggleBlockOperator = (gId: string) => {
    setGroups(prev => prev.map(g => g.id === gId ? { ...g, afterOperator: g.afterOperator === 'and' ? 'or' : 'and' } : g));
  };

  const removeGroup = (gId: string) => {
    setGroups(groups.filter(g => g.id !== gId));
  };

  const duplicateGroup = (gId: string) => {
    const source = groups.find(g => g.id === gId);
    if (!source) return;
    const clone: typeof source = {
      ...source,
      id: Math.random().toString(),
      afterOperator: 'and',
      conditions: source.conditions.map(c => ({ ...c, id: Math.random().toString() }))
    };
    // Set the last existing block's afterOperator to AND before appending
    setGroups(prev => {
      const updated = prev.map((g, i) => i === prev.length - 1 ? { ...g, afterOperator: 'and' } : g);
      return [...updated, clone];
    });
  };

  const addConditionToGroup = (gId: string, joinOp: 'and' | 'or' = 'or') => {
    setGroups(groups.map(g => {
       if (g.id === gId) {
         const updated = g.conditions.map((c, i) => i === g.conditions.length - 1 ? { ...c, afterOperator: joinOp } : c);
         return { ...g, conditions: [...updated, { id: Math.random().toString(), type: 'contains', field: 'description', value: '', afterOperator: undefined }] };
       }
       return g;
    }));
  };

  const toggleConditionOperator = (gId: string, cId: string) => {
    setGroups(groups.map(g => {
      if (g.id === gId) {
        return { ...g, conditions: g.conditions.map(c => c.id === cId ? { ...c, afterOperator: c.afterOperator === 'and' ? 'or' : 'and' } : c) };
      }
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
    if (!ruleName || !categoryInput.trim() || groups.length === 0) return alert('Name, Target Category, and at least one condition block are required.');
    
    setIsSaving(true);
    
    let finalCategoryId: number | null = null;
    const existingCat = categories.find((c: any) => c.category_name.toLowerCase() === categoryInput.trim().toLowerCase());
    
    if (existingCat) {
       finalCategoryId = existingCat.sys_transaction_category_id;
    } else {
       try {
          const res = await fetch('/api/config/sys_transaction_category', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ category_name: categoryInput.trim() })
          });
          if (!res.ok) throw new Error('Failed to create category');
          const data = await res.json();
          finalCategoryId = data.id;
          await refetchCategories();
       } catch (e) {
          alert("Error creating new category.");
          setIsSaving(false);
          return;
       }
    }

    let finalJson: any = {};
    
    // Build JSON respecting AND/OR operators between conditions and between blocks
    const cleanGroups = groups.map(g => {
       const valid = g.conditions.filter(c => {
          if (c.type === 'contains' || c.type === 'equals') return c.value && String(c.value).trim() !== '';
          if (c.type === 'date_range') return c.start && c.end;
          if (c.type === 'amount_range') return c.min !== undefined && c.max !== undefined;
          if (c.type === 'select_transactions' || c.type === 'exclude_transactions') return true;
          return false;
       });
       const conds = valid.map(c => {
          const { id, afterOperator, ...rest } = c;
          if (rest.type === 'date_range') rest.field = 'transaction_date';
          return rest;
       });
       if (conds.length === 0) return null;

       // Build the inner condition tree respecting per-condition afterOperator
       // Group consecutive conditions sharing the same operator into nested nodes
       let blockJson: any;
       if (conds.length === 1) {
          blockJson = conds[0];
       } else {
          // Determine the dominant join operator for this block from the conditions' afterOperators
          const ops = valid.slice(0, -1).map(c => c.afterOperator || 'or');
          const hasAnd = ops.includes('and');
          const hasOr = ops.includes('or');
          let joinType: 'and' | 'or' = 'or';
          if (hasAnd && !hasOr) joinType = 'and';
          else if (hasAnd && hasOr) {
             // Mixed: build nested structure splitting on AND first (AND has higher precedence)
             // Simple approach: flatten all with OR at top level, AND groups as sub-nodes
             // For now use the first operator as the group join type
             joinType = ops[0] || 'or';
          }
          blockJson = { type: joinType, conditions: conds };
       }

       if (g.sourceId) {
          return { type: 'and', conditions: [{ type: 'source', value: g.sourceId }, blockJson], _afterOperator: g.afterOperator || 'and' };
       }
       return { ...blockJson, _afterOperator: g.afterOperator || 'and' };
    }).filter(gc => gc !== null);

    if (cleanGroups.length === 0) {
       setIsSaving(false);
       return alert('You must define at least one valid condition.');
    }

    if (cleanGroups.length === 1) {
       const { _afterOperator, ...rest } = cleanGroups[0];
       finalJson = rest;
    } else {
       // Determine top-level join operator from the blocks' afterOperators
       const blockOps = cleanGroups.slice(0, -1).map((g: any) => g._afterOperator || 'and');
       const topJoinType = blockOps.includes('or') && !blockOps.includes('and') ? 'or' : 'and';
       const cleanConds = cleanGroups.map(({ _afterOperator, ...rest }: any) => rest);
       finalJson = { type: topJoinType, conditions: cleanConds };
    }

    const payload: any = {
       rule_name: ruleName,
       sys_account_source_id: null,
       sys_transaction_category_id: finalCategoryId,
       rule_json: JSON.stringify(finalJson)
    };

    try {
      if (selectedRuleId) {
         payload.created_date = new Date().toISOString().replace('T', ' ').substring(0, 19);
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
    } catch(e) {
      alert('Failed to save rule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecute = async () => {
     setIsExecuting(true);
     try {
       await api.executeRules();
       await refetchRules();
     } catch (e: any) {
       alert(`Execution failed: ${e.message}`);
     } finally {
       setIsExecuting(false);
     }
  };

  const handleExecuteSingleRule = async (ruleId: number) => {
     try {
       await api.executeRules(undefined, ruleId);
       await refetchRules();
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

   const getRuleSourceText = (rule: any) => {
      let ruleSources = new Set<string>();
      try {
         const traverse = (node: any) => {
            if (!node) return;
            if (node.type === 'source') {
               const sName = sources.find((s: any) => s.sys_account_source_id === node.value)?.account_source_name || 'Unknown';
               ruleSources.add(sName);
            }
            if (node.conditions) node.conditions.forEach(traverse);
         };
         traverse(JSON.parse(rule.rule_json));
      } catch (e) {}

      if (ruleSources.size === 0) {
         if (rule.sys_account_source_id) {
            const sName = sources.find((s: any) => s.sys_account_source_id === rule.sys_account_source_id)?.account_source_name || 'Unknown';
            return `Source: ${sName}`;
         }
         return 'Source: Global';
      }
      if (ruleSources.size === 1) return `Source: ${Array.from(ruleSources)[0]}`;
      return 'Source: Various';
   };

   const enrichJsonWithSourceNames = (node: any): any => {
      if (!node) return node;
      const enriched = { ...node };
      if (enriched.type === 'source') {
         enriched.source_name = sourcesData?.data?.find((s: any) => s.sys_account_source_id === enriched.value)?.account_source_name || 'Unknown';
      }
      if (enriched.conditions && Array.isArray(enriched.conditions)) {
         enriched.conditions = enriched.conditions.map(enrichJsonWithSourceNames);
      }
      return enriched;
   };

  const handleExportRule = async (r: any) => {
     try {
        const catName = categoriesData?.data?.find((c: any) => c.sys_transaction_category_id === r.sys_transaction_category_id)?.category_name;
        const sourceName = sourcesData?.data?.find((s: any) => s.sys_account_source_id === r.sys_account_source_id)?.account_source_name;
        
        let ruleObj: any = {};
        try {
           ruleObj = JSON.parse(r.rule_json);
        } catch(e) {}

        // Collect all checksums from rule conditions, grouped by type
        const includeChecksums = new Set<string>();
        const excludeChecksums = new Set<string>();
        
        const traverse = (node: any) => {
           if (!node) return;
           if (node.type === 'select_transactions' && node.checksums) {
              node.checksums.forEach((c: string) => includeChecksums.add(c));
           } else if (node.type === 'exclude_transactions' && node.checksums) {
              node.checksums.forEach((c: string) => excludeChecksums.add(c));
           }
           
           if (node.conditions && Array.isArray(node.conditions)) {
              node.conditions.forEach(traverse);
           }
        };
        traverse(ruleObj);

        let checksumMetadata: any = { included: [], excluded: [] };
        const allUniqueChecksums = new Set([...Array.from(includeChecksums), ...Array.from(excludeChecksums)]);
        
        if (allUniqueChecksums.size > 0) {
           const checksumList = Array.from(allUniqueChecksums).join(',');
           const res = await fetch(`/api/transactions?limit=-1&checksums=${checksumList}`);
           const json = await res.json();
           
           if (json && json.data) {
              const txnMap = new Map();
              json.data.forEach((t: any) => txnMap.set(t.row_checksum, t));
              
              includeChecksums.forEach(c => {
                 const t = txnMap.get(c);
                 if (t) checksumMetadata.included.push({ 
                    date: t.date, 
                    description: t.description, 
                    amount: t.amount, 
                    drcr: t.drcr,
                    account: t.account,
                    checksum: c
                 });
              });
              
              excludeChecksums.forEach(c => {
                 const t = txnMap.get(c);
                 if (t) checksumMetadata.excluded.push({ 
                    date: t.date, 
                    description: t.description, 
                    amount: t.amount, 
                    drcr: t.drcr,
                    account: t.account,
                    checksum: c
                 });
              });
           }
        }

        const exportData: any = {
           rule_name: r.rule_name,
           rule_json: JSON.stringify(enrichJsonWithSourceNames(ruleObj)),
           category_name: catName || null,
           source_name: sourceName || null,
           exported_at: new Date().toISOString()
        };

        if (checksumMetadata.included.length > 0 || checksumMetadata.excluded.length > 0) {
           exportData.checksum_metadata = checksumMetadata;
        }
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        
        const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0];
        const safeRuleName = (r.rule_name || 'rule').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${safeRuleName}_${dateStr}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
     } catch (e: any) {
        alert(`Failed to export rule: ${e.message}`);
     }
  };

  const handleExportAllRules = async () => {
     try {
        const allRulesExport = [];
        const allUniqueChecksums = new Set<string>();

        for (const r of rules) {
           const catName = categoriesData?.data?.find((c: any) => c.sys_transaction_category_id === r.sys_transaction_category_id)?.category_name;
           const sourceName = sourcesData?.data?.find((s: any) => s.sys_account_source_id === r.sys_account_source_id)?.account_source_name;
           
           let ruleObj: any = {};
           try {
              ruleObj = JSON.parse(r.rule_json);
           } catch(e) {}

           const includeChecksums = new Set<string>();
           const excludeChecksums = new Set<string>();
           const traverse = (node: any) => {
              if (!node) return;
              if (node.type === 'select_transactions' && node.checksums) {
                 node.checksums.forEach((c: string) => { includeChecksums.add(c); allUniqueChecksums.add(c); });
              } else if (node.type === 'exclude_transactions' && node.checksums) {
                 node.checksums.forEach((c: string) => { excludeChecksums.add(c); allUniqueChecksums.add(c); });
              }
              if (node.conditions && Array.isArray(node.conditions)) {
                 node.conditions.forEach(traverse);
              }
           };
           traverse(ruleObj);

           allRulesExport.push({
              r,
              ruleObj,
              includeChecksums,
              excludeChecksums,
              catName,
              sourceName
           });
        }

        const txnMap = new Map();
        if (allUniqueChecksums.size > 0) {
           const checksumList = Array.from(allUniqueChecksums).join(',');
           const res = await fetch(`/api/transactions?limit=-1&checksums=${checksumList}`);
           const json = await res.json();
           if (json && json.data) {
              json.data.forEach((t: any) => txnMap.set(t.row_checksum, t));
           }
        }

        const finalExport = allRulesExport.map(({ r, ruleObj, includeChecksums, excludeChecksums, catName, sourceName }) => {
           const checksumMetadata: any = { included: [], excluded: [] };
           
           includeChecksums.forEach(c => {
              const t = txnMap.get(c);
              if (t) checksumMetadata.included.push({ date: t.date, description: t.description, amount: t.amount, drcr: t.drcr, account: t.account, checksum: c });
           });
           
           excludeChecksums.forEach(c => {
              const t = txnMap.get(c);
              if (t) checksumMetadata.excluded.push({ date: t.date, description: t.description, amount: t.amount, drcr: t.drcr, account: t.account, checksum: c });
           });

           const ruleData: any = {
              rule_name: r.rule_name,
              rule_json: JSON.stringify(enrichJsonWithSourceNames(ruleObj)),
              category_name: catName || null,
              source_name: sourceName || null
           };
           if (checksumMetadata.included.length > 0 || checksumMetadata.excluded.length > 0) {
              ruleData.checksum_metadata = checksumMetadata;
           }
           return ruleData;
        });

        const exportContainer = {
           rules: finalExport,
           exported_at: new Date().toISOString(),
           count: finalExport.length
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportContainer, null, 2));
        const downloadAnchorNode = document.createElement('a');
        const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '').split('.')[0];
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `all_rules_export_${dateStr}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
     } catch (e: any) {
        alert(`Failed to export rules: ${e.message}`);
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
             onClick={handleExportAllRules}
             className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition shadow-sm font-medium"
          >
             <Download className="w-4 h-4 text-gray-400" />
             Export All Rules
          </button>
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
             {rules.map((r: any, index: number) => (
                <div 
                   key={r.sys_rules_id}
                   className={`group relative p-3 flex justify-between items-center rounded-lg border transition ${selectedRuleId === r.sys_rules_id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-transparent hover:bg-gray-50'}`}
                >
                   <div className="cursor-pointer flex-1 min-w-0 pr-2" onClick={() => handleSelectRule(r)}>
                       <p className="font-medium text-gray-900 text-sm group-hover:text-blue-700 transition truncate">{r.rule_name || 'Unnamed Rule'}</p>
                       <p className="text-[11px] text-gray-500 mt-1 truncate" title={`${getRuleSourceText(r)} • ${r.last_run_count || 0} rows • ${new Date(r.created_date + 'Z').toLocaleString()}`}>
                           {getRuleSourceText(r)} &bull; <span className="font-medium">{r.last_run_count || 0}</span> rows &bull; {new Date(r.created_date + 'Z').toLocaleString()}
                       </p>
                   </div>
                   
                   {/* Tooltip Popup */}
                   <div className={`absolute hidden group-hover:block ${index < 2 ? 'top-full mt-2' : 'bottom-full mb-2'} left-1/2 -translate-x-1/2 w-48 bg-gray-900 text-white text-xs rounded-lg p-3 z-20 shadow-xl whitespace-nowrap pointer-events-none`}>
                       <p className="font-semibold text-gray-300 mb-1 border-b border-gray-700 pb-1">Execution Stats</p>
                       <p><span className="text-gray-400">Last Run:</span> {r.last_run ? new Date(r.last_run + 'Z').toLocaleString() : 'Never'}</p>
                       <p><span className="text-gray-400">Records Affected:</span> {r.last_run_count ?? 0}</p>
                       <div className={`absolute ${index < 2 ? 'bottom-full border-b-gray-900' : 'top-full border-t-gray-900'} left-1/2 -translate-x-1/2 border-4 border-transparent`}></div>
                   </div>

                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-200">
                      <button 
                          onClick={(e) => { e.stopPropagation(); handleExportRule(r); }}
                          title="Export Rule"
                          className="text-gray-400 hover:text-blue-600 transition p-1.5 rounded-full hover:bg-blue-50"
                      >
                          <Download className="w-3.5 h-3.5" />
                      </button>
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
                          <input 
                             list="category-options"
                             value={categoryInput} 
                             onChange={e => setCategoryInput(e.target.value)}
                             placeholder="Select or type new..."
                             className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <datalist id="category-options">
                             {categories.map((c: any) => <option key={c.sys_transaction_category_id} value={c.category_name} />)}
                          </datalist>
                       </div>
                    </div>
                 </div>

                 <div>
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileJson className="w-5 h-5 text-gray-400" /> Condition Blocks</h3>
                    </div>

                    <div className="space-y-6">
                        {groups.map((group, gIndex) => (
                           <div key={group.id}>
                              {gIndex > 0 && (
                                 <div className="flex items-center justify-center my-2">
                                    <button
                                       onClick={() => toggleBlockOperator(groups[gIndex - 1].id)}
                                       className={`px-4 py-1 rounded-full text-xs font-bold tracking-widest shadow-sm border transition-colors ${
                                          (groups[gIndex - 1].afterOperator || 'and') === 'and'
                                             ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200'
                                             : 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200'
                                       }`}
                                       title="Click to toggle between AND / OR"
                                    >
                                       {(groups[gIndex - 1].afterOperator || 'and').toUpperCase()}
                                    </button>
                                 </div>
                              )}

                              <div className="relative p-5 bg-gray-50/50 border border-gray-200 rounded-xl shadow-sm">
                              <div className="flex justify-between items-center mb-3">
                                 <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Block {gIndex + 1}</span>
                                 <div className="flex items-center gap-3">
                                    <select 
                                       value={group.sourceId || ''} 
                                       onChange={e => {
                                          const newSourceId = e.target.value ? parseInt(e.target.value) : '';
                                          setGroups(groups.map(g => g.id === group.id ? { ...g, sourceId: newSourceId } : g));
                                       }}
                                       className="bg-white border border-gray-200 text-gray-700 rounded-lg px-2 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    >
                                       <option value="">Global (All Sources)</option>
                                       {sources.map((s: any) => <option key={s.sys_account_source_id} value={s.sys_account_source_id}>{s.account_source_name}</option>)}
                                    </select>
                                     <button onClick={() => duplicateGroup(group.id)} title="Duplicate this block" className="text-gray-400 hover:text-blue-500 transition"><Copy className="w-4 h-4"/></button>
                                     <button onClick={() => removeGroup(group.id)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                                 </div>
                              </div>
                              
                              <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                                 {group.conditions.map((cond, cIndex) => (
                                    <div key={cond.id} className="relative flex flex-col gap-2">
                                       {cIndex > 0 && (
                                          <button
                                             onClick={() => toggleConditionOperator(group.id, group.conditions[cIndex - 1].id)}
                                             className={`self-start text-xs font-bold tracking-widest -ml-4 py-0.5 px-2 rounded-full border transition-colors ${
                                                (group.conditions[cIndex - 1].afterOperator || 'or') === 'or'
                                                   ? 'text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100'
                                                   : 'text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100'
                                             }`}
                                             title="Click to toggle between AND / OR"
                                          >
                                             {(group.conditions[cIndex - 1].afterOperator || 'or').toUpperCase()}
                                          </button>
                                       )}
                                      
                                      <div className="flex gap-3">
                                         <select 
                                            value={cond.type} 
                                            onChange={e => updateCondition(group.id, cond.id, { type: e.target.value as any })}
                                            className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                         >
                                            <option value="contains">Text</option>
                                            <option value="equals">Exact Match</option>
                                            <option value="amount_range">Amount Range</option>
                                            <option value="date_range">Date Range</option>
                                            <option value="select_transactions">Select Transactions</option>
                                            <option value="exclude_transactions">Exclude Transactions</option>
                                         </select>
                                         
                                         {cond.type === 'contains' && (
                                            <select
                                               value={cond.operator || 'LIKE'}
                                               onChange={e => updateCondition(group.id, cond.id, { operator: e.target.value as any })}
                                               className="w-28 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                               <option value="LIKE">LIKE</option>
                                               <option value="NOT LIKE">NOT LIKE</option>
                                            </select>
                                         )}
                                         
                                         {cond.type !== 'date_range' && cond.type !== 'select_transactions' && cond.type !== 'exclude_transactions' && (
                                            <select 
                                               value={cond.field} 
                                               onChange={e => updateCondition(group.id, cond.id, { field: e.target.value })}
                                               className="w-36 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                               <option value="description">Description</option>
                                               <option value="category_name">Category</option>
                                               <option value="base_amount">Base Amount</option>
                                               <option value="transaction_date">Date</option>
                                            </select>
                                         )}

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
                                             {(cond.type === 'select_transactions' || cond.type === 'exclude_transactions') && (
                                                <>
                                                   <button 
                                                      onClick={(e) => { e.preventDefault(); setActiveSelectorCondition({ groupId: group.id, condId: cond.id, type: cond.type, checksums: cond.checksums || [] }); }}
                                                      className={`w-full bg-white border ${cond.type === 'exclude_transactions' ? 'border-red-200 text-red-700 hover:bg-red-50 focus:ring-red-500' : 'border-blue-200 text-blue-700 hover:bg-blue-50 focus:ring-blue-500'} rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 flex justify-between items-center transition-colors`}
                                                   >
                                                      <span className="flex items-center gap-2"><ListChecks size={16} /> Manually {cond.type === 'exclude_transactions' ? 'Exclude' : 'Select'} Transactions</span>
                                                      <span className={`${cond.type === 'exclude_transactions' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'} text-xs px-2 py-0.5 rounded-full font-bold`}>{cond.checksums?.length || 0} {cond.type === 'exclude_transactions' ? 'Excluded' : 'Selected'}</span>
                                                   </button>
                                                   <button onClick={(e) => { e.preventDefault(); removeCondition(group.id, cond.id); }} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 className="w-4 h-4"/></button>
                                                </>
                                             )}
                                         </div>
                                      </div>
                                   </div>
                                 ))}
                                 <div className="flex gap-2 mt-2">
                                    <button onClick={() => addConditionToGroup(group.id, 'or')} className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition border border-transparent hover:border-blue-200">
                                       + Add OR Condition
                                    </button>
                                    <button onClick={() => addConditionToGroup(group.id, 'and')} className="text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-md transition border border-transparent hover:border-purple-200">
                                       + Add AND Condition
                                    </button>
                                 </div>
                              </div>
                              </div>
                           </div>
                        ))}
                        
                        <div className="flex justify-center gap-3 mt-2">
                           <button onClick={() => addGroup('and')} className="flex items-center gap-2 text-sm font-bold text-blue-700 bg-white hover:bg-blue-50 px-5 py-2.5 rounded-lg transition border border-blue-200 shadow-sm">
                              <Plus className="w-4 h-4" /> Add AND Block
                           </button>
                           <button onClick={() => addGroup('or')} className="flex items-center gap-2 text-sm font-bold text-purple-700 bg-white hover:bg-purple-50 px-5 py-2.5 rounded-lg transition border border-purple-200 shadow-sm">
                              <Plus className="w-4 h-4" /> Add OR Block
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

      {activeSelectorCondition && (
        <TransactionSelectorModal 
           mode={activeSelectorCondition.type === 'exclude_transactions' ? 'exclude' : 'select'}
           initialChecksums={activeSelectorCondition.checksums}
           onClose={() => setActiveSelectorCondition(null)}
           onSave={(checksums) => {
             updateCondition(activeSelectorCondition.groupId, activeSelectorCondition.condId, { checksums });
             setActiveSelectorCondition(null);
           }}
        />
      )}
    </div>
  );
}
