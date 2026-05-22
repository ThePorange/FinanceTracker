import { useState, useMemo, useEffect } from 'react';
import { X, Search, AlertTriangle, CheckCircle2, Upload } from 'lucide-react';

interface RuleImportModalProps {
  onClose: () => void;
  importedRules: any[];
  existingRules: any[];
  categories: any[];
  sources: any[];
  refetchRules: () => any;
  refetchCategories: () => any;
}

type ConflictResolution = 'overwrite' | 'create_new' | 'skip';

export function RuleImportModal({
  onClose,
  importedRules,
  existingRules,
  categories,
  sources,
  refetchRules,
  refetchCategories,
}: RuleImportModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [conflictResolutions, setConflictResolutions] = useState<Map<number, ConflictResolution>>(new Map());
  const [isImporting, setIsImporting] = useState(false);

  // Initialize selected indexes and resolutions
  useEffect(() => {
    const sel = new Set<number>();
    const resMap = new Map<number, ConflictResolution>();
    importedRules.forEach((rule, idx) => {
      sel.add(idx);
      const isDuplicate = existingRules.some(r => r.rule_name?.toLowerCase() === rule.rule_name?.toLowerCase());
      resMap.set(idx, isDuplicate ? 'overwrite' : 'create_new');
    });
    setSelectedIndexes(sel);
    setConflictResolutions(resMap);
  }, [importedRules, existingRules]);

  const filteredRules = useMemo(() => {
    const lower = search.toLowerCase();
    return importedRules
      .map((rule, index) => ({ rule, index }))
      .filter(({ rule }) => (rule.rule_name || '').toLowerCase().includes(lower));
  }, [importedRules, search]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIndexes(new Set(filteredRules.map(f => f.index)));
    } else {
      setSelectedIndexes(new Set());
    }
  };

  const isAllSelected = useMemo(() => {
    if (filteredRules.length === 0) return false;
    return filteredRules.every(f => selectedIndexes.has(f.index));
  }, [filteredRules, selectedIndexes]);

  const handleToggleSelect = (index: number) => {
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleResolutionChange = (index: number, val: ConflictResolution) => {
    setConflictResolutions(prev => {
      const next = new Map(prev);
      next.set(index, val);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIndexes.size === 0) {
      alert('Please select at least one rule to import.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    // Cache existing category mapping
    const categoryMap = new Map<string, number>();
    categories.forEach((c: any) => {
      categoryMap.set(c.category_name.toLowerCase(), c.sys_transaction_category_id);
    });

    try {
      for (const index of Array.from(selectedIndexes)) {
        const rule = importedRules[index];
        const resolution = conflictResolutions.get(index) || 'create_new';

        if (resolution === 'skip') {
          continue;
        }

        // 1. Resolve category mapping (create if not exist)
        let finalCategoryId: number | null = null;
        if (rule.category_name) {
          const catNameLower = rule.category_name.trim().toLowerCase();
          if (categoryMap.has(catNameLower)) {
            finalCategoryId = categoryMap.get(catNameLower)!;
          } else {
            try {
              const res = await fetch('/api/config/sys_transaction_category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_name: rule.category_name.trim() }),
              });
              if (!res.ok) throw new Error('Failed to create category');
              const data = await res.json();
              finalCategoryId = data.id;
              categoryMap.set(catNameLower, finalCategoryId!);
            } catch (err) {
              console.error(`Failed to create category: ${rule.category_name}`, err);
            }
          }
        }

        // 2. Resolve source IDs inside rule_json tree
        let updatedRuleJson = rule.rule_json;
        if (updatedRuleJson) {
          try {
            const root = typeof updatedRuleJson === 'string' ? JSON.parse(updatedRuleJson) : updatedRuleJson;
            const traverse = (node: any) => {
              if (!node) return;
              if (node.type === 'source') {
                const sourceName = node.source_name || 'Unknown';
                const matchingSource = sources.find(
                  (s: any) => s.account_source_name.toLowerCase() === sourceName.toLowerCase()
                );
                if (matchingSource) {
                  node.value = matchingSource.sys_account_source_id;
                }
              }
              if (node.conditions && Array.isArray(node.conditions)) {
                node.conditions.forEach(traverse);
              }
            };
            traverse(root);
            updatedRuleJson = JSON.stringify(root);
          } catch (e) {
            console.error('Failed to parse/update rule_json schema', e);
          }
        }

        // 3. Determine target name and action
        let targetName = rule.rule_name;
        const existingRule = existingRules.find(
          r => r.rule_name?.toLowerCase() === rule.rule_name?.toLowerCase()
        );

        if (existingRule && resolution === 'create_new') {
          // Generate unique name
          let baseName = rule.rule_name;
          let counter = 1;
          let candidateName = `${baseName} (Imported)`;
          while (existingRules.some(r => r.rule_name?.toLowerCase() === candidateName.toLowerCase())) {
            candidateName = `${baseName} (Imported ${counter})`;
            counter++;
          }
          targetName = candidateName;
        }

        const payload: any = {
          rule_name: targetName,
          sys_account_source_id: null,
          sys_transaction_category_id: finalCategoryId,
          rule_json: updatedRuleJson,
        };

        if (existingRule && resolution === 'overwrite') {
          payload.created_date = new Date().toISOString().replace('T', ' ').substring(0, 19);
          const res = await fetch(`/api/config/sys_rules/sys_rules_id/${existingRule.sys_rules_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) successCount++;
          else failCount++;
        } else {
          const res = await fetch(`/api/config/sys_rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) successCount++;
          else failCount++;
        }
      }

      await refetchRules();
      await refetchCategories();
      alert(`Import completed! Successfully imported ${successCount} rules.${failCount > 0 ? ` Failed to import ${failCount} rules.` : ''}`);
      onClose();
    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import Rules</h2>
            <p className="text-sm text-gray-500 mt-0.5">Select the rules you want to import and resolve name conflicts.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 bg-white flex gap-4 items-center shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules in file..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            Selected: <span className="font-semibold text-gray-950">{selectedIndexes.size}</span> of {importedRules.length}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 bg-gray-50 overflow-y-auto p-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 font-semibold text-gray-700 w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={e => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Rule Name</th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Target Category</th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 font-semibold text-gray-700">Resolution / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRules.map(({ rule, index }) => {
                    const isSelected = selectedIndexes.has(index);
                    const isDuplicate = existingRules.some(
                      r => r.rule_name?.toLowerCase() === rule.rule_name?.toLowerCase()
                    );
                    const resolution = conflictResolutions.get(index) || 'create_new';

                    return (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(index)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{rule.rule_name}</td>
                        <td className="px-6 py-4">
                          {rule.category_name ? (
                            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full border border-gray-200">
                              {rule.category_name}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isDuplicate ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                              <AlertTriangle size={12} /> Duplicate Name
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200">
                              <CheckCircle2 size={12} /> Available
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isDuplicate ? (
                            <select
                              value={resolution}
                              onChange={e => handleResolutionChange(index, e.target.value as ConflictResolution)}
                              disabled={!isSelected}
                              className="bg-white border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 shadow-sm disabled:opacity-50"
                            >
                              <option value="overwrite">Overwrite Existing</option>
                              <option value="create_new">Create New (Rename)</option>
                              <option value="skip">Skip / Skip Import</option>
                            </select>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Will create new</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                        No rules found matching search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isImporting}
            className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isImporting || selectedIndexes.size === 0}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Upload size={16} />
            {isImporting ? 'Importing...' : `Import Selected (${selectedIndexes.size})`}
          </button>
        </div>

      </div>
    </div>
  );
}
