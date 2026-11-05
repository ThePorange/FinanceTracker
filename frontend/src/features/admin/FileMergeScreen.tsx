import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSources } from './useSources';
import { api } from '../../services/api';
import {
  GitMerge,
  Upload,
  UploadCloud,
  FileSpreadsheet,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  Save,
  Download,
  Plus,
  Trash2,
  HelpCircle,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MergeMapRow {
  sys_merge_map_id?: number;
  sys_account_source_id?: number;
  source: 'input.csv' | 'input.ofx' | 'derived.csv' | 'derived.ofx' | string;
  fieldname: string;
  in_output: 'y' | 'n' | string;
  output_fieldname: string;
  output_field_order: string;
  list_index: string;
  datatype: 'text' | 'date' | 'number' | string;
  format?: string;
  calculation_json?: string;
}

export function FileMergeScreen() {
  const queryClient = useQueryClient();
  const { data: sourcesObj, isLoading: isLoadingSources } = useSources();
  const sourcesArr = useMemo(() => {
    const list = sourcesObj?.data || sourcesObj || [];
    return Array.isArray(list) ? list : [];
  }, [sourcesObj]);

  const [selectedSourceId, setSelectedSourceId] = useState<number | ''>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [ofxFile, setOfxFile] = useState<File | null>(null);

  const [csvRowCount, setCsvRowCount] = useState<number | null>(null);
  const [ofxRowCount, setOfxRowCount] = useState<number | null>(null);

  const [mappings, setMappings] = useState<MergeMapRow[]>([]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingAndLoading, setIsDownloadingAndLoading] = useState(false);
  const [loadResult, setLoadResult] = useState<{
    success: boolean;
    filename: string;
    sourceName: string;
    newRecords?: number;
    ignoredRecords?: number;
    processedRules?: number;
    mappedTransactions?: number;
    message?: string;
  } | null>(null);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [mergeResult, setMergeResult] = useState<any | null>(null);
  const [showUnmatchedDetails, setShowUnmatchedDetails] = useState(false);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [tableFilter, setTableFilter] = useState('');

  const csvInputRef = useRef<HTMLInputElement>(null);
  const ofxInputRef = useRef<HTMLInputElement>(null);

  // Load existing mapping when account source is selected
  useEffect(() => {
    if (!selectedSourceId) return;

    let isMounted = true;
    api.getFileMergeMapping(Number(selectedSourceId))
      .then((existingRows) => {
        if (!isMounted) return;
        if (Array.isArray(existingRows) && existingRows.length > 0) {
          setMappings(existingRows);
        } else if (csvFile && ofxFile) {
          // If no mapping exists yet and files are uploaded, auto-inspect & map
          inspectAndPopulate(Number(selectedSourceId));
        }
      })
      .catch((err) => {
        console.warn('Could not load mapping:', err.message);
      });

    return () => { isMounted = false; };
  }, [selectedSourceId]);

  // Trigger inspection when both files are selected
  const handleFilesReady = async (newCsv: File | null, newOfx: File | null, sourceId?: number) => {
    if (!newCsv || !newOfx) return;

    setIsInspecting(true);
    setErrorMessage('');
    try {
      const data = await api.inspectMergeFiles(newCsv, newOfx, sourceId);
      setCsvRowCount(data.csvRowCount);
      setOfxRowCount(data.ofxRowCount);

      if (mappings.length === 0 && data.defaultMappings && data.defaultMappings.length > 0) {
        setMappings(data.defaultMappings);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error parsing files');
    } finally {
      setIsInspecting(false);
    }
  };

  const inspectAndPopulate = async (sourceId: number) => {
    if (!csvFile || !ofxFile) return;
    setIsInspecting(true);
    try {
      const data = await api.inspectMergeFiles(csvFile, ofxFile, sourceId);
      setCsvRowCount(data.csvRowCount);
      setOfxRowCount(data.ofxRowCount);
      if (data.defaultMappings && data.defaultMappings.length > 0) {
        setMappings(data.defaultMappings);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error generating schema mappings');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCsvFile(file);
    if (file && ofxFile) {
      handleFilesReady(file, ofxFile, selectedSourceId ? Number(selectedSourceId) : undefined);
    }
  };

  const handleOfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setOfxFile(file);
    if (file && csvFile) {
      handleFilesReady(csvFile, file, selectedSourceId ? Number(selectedSourceId) : undefined);
    }
  };

  const handleUpdateMappingField = (index: number, key: keyof MergeMapRow, value: any) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [key]: value };
      return updated;
    });
  };

  const handleAddDerivedField = (type: 'csv' | 'ofx') => {
    const newField: MergeMapRow = {
      sys_account_source_id: selectedSourceId ? Number(selectedSourceId) : undefined,
      source: `derived.${type}`,
      fieldname: '',
      in_output: 'y',
      output_fieldname: `Derived_${type.toUpperCase()}_Field`,
      output_field_order: String(mappings.length + 1),
      list_index: '',
      datatype: 'text',
      format: '',
      calculation_json: '',
    };
    setMappings((prev) => [...prev, newField]);
  };

  const handleDeleteRow = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveMapping = async () => {
    if (!selectedSourceId) {
      alert('Please select an Account Source before saving.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');
    setErrorMessage('');
    try {
      const saved = await api.saveFileMergeMapping(Number(selectedSourceId), mappings);
      setMappings(saved);
      setSaveSuccessMsg('Mapping rules successfully persisted to sys_merge_map.');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (!csvFile || !ofxFile) {
      alert('Please select both CSV and OFX files to regenerate default mappings.');
      return;
    }
    if (confirm('Are you sure you want to reset mapping definitions to defaults for these files?')) {
      inspectAndPopulate(selectedSourceId ? Number(selectedSourceId) : 0);
    }
  };

  const handleExecuteMerge = async () => {
    if (!csvFile || !ofxFile) {
      alert('Please select both a CSV file and an OFX file.');
      return;
    }
    if (mappings.length === 0) {
      alert('Please configure at least one mapping field.');
      return;
    }

    setIsMerging(true);
    setErrorMessage('');
    try {
      const currentSource = sourcesArr.find((s: any) => (s.id || s.sys_account_source_id) === Number(selectedSourceId));
      const sourceName = currentSource ? (currentSource.name || currentSource.account_source_name) : '';
      const result = await api.executeFileMerge(
        csvFile,
        ofxFile,
        mappings,
        selectedSourceId ? Number(selectedSourceId) : undefined,
        sourceName
      );
      setMergeResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Merge execution failed');
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!csvFile || !ofxFile) {
      alert('Please select both CSV and OFX files.');
      return;
    }
    setIsDownloading(true);
    try {
      const currentSource = sourcesArr.find((s: any) => (s.id || s.sys_account_source_id) === Number(selectedSourceId));
      const sourceName = currentSource ? (currentSource.name || currentSource.account_source_name) : '';
      const res = await api.downloadMergedCsv(
        csvFile,
        ofxFile,
        mappings,
        sourceName,
        selectedSourceId ? Number(selectedSourceId) : undefined
      );
      if (res?.filename) {
        setMergeResult((prev: any) => (prev ? { ...prev, filename: res.filename } : prev));
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAndLoad = async () => {
    if (!csvFile || !ofxFile) {
      alert('Please select both a CSV file and an OFX file.');
      return;
    }
    if (mappings.length === 0) {
      alert('Please configure at least one mapping field.');
      return;
    }
    if (!selectedSourceId) {
      alert('Please select an Account Source before running Download and Load.');
      return;
    }

    const currentSource = sourcesArr.find((s: any) => (s.id || s.sys_account_source_id) === Number(selectedSourceId));
    const sourceName = currentSource ? (currentSource.name || currentSource.account_source_name) : `Source #${selectedSourceId}`;

    if (currentSource && currentSource.supported_types && !currentSource.supported_types.includes('csv')) {
      alert(`Validation Error: Account source '${sourceName}' does not have a CSV mapping configured. Please configure a CSV mapping for this source in Data Sources before importing.`);
      return;
    }

    setIsDownloadingAndLoading(true);
    setErrorMessage('');
    setLoadResult(null);

    try {
      // 1. Download the merged CSV
      const { file, filename } = await api.downloadMergedCsv(
        csvFile,
        ofxFile,
        mappings,
        sourceName,
        Number(selectedSourceId)
      );

      // 2. Also ensure merge preview statistics are available on screen if not already
      if (!mergeResult) {
        try {
          const preview = await api.executeFileMerge(
            csvFile,
            ofxFile,
            mappings,
            Number(selectedSourceId),
            sourceName
          );
          setMergeResult(preview);
        } catch (e) {
          // Non-blocking
        }
      }

      // 3. Load the file using the currently selected Account Source
      const importRes = await api.importData(Number(selectedSourceId), file);

      // 4. Execute All Rules if not already returned by the import endpoint
      let processedRules = importRes.processedRules;
      let mappedTransactions = importRes.mappedTransactions;
      if (processedRules === undefined) {
        const rulesRes = await api.executeRules();
        processedRules = rulesRes?.processedRules;
        mappedTransactions = rulesRes?.mappedTransactions;
      }

      // 5. Invalidate caches so tables, ETL jobs, rules and reporting refresh
      queryClient.invalidateQueries({ queryKey: ['etlJobs'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['reporting'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['systemData', 'sys_rules'] });
      queryClient.invalidateQueries({ queryKey: ['stagingData'] });

      const newCount = importRes.newRecords !== undefined ? importRes.newRecords : 0;
      const ignoredCount = importRes.ignoredRecords !== undefined ? importRes.ignoredRecords : 0;

      setLoadResult({
        success: true,
        filename,
        sourceName,
        newRecords: newCount,
        ignoredRecords: ignoredCount,
        processedRules,
        mappedTransactions,
        message: importRes.message,
      });

      alert(
        `File Merge Download, Ingestion & Rules Execution Completed Successfully!\n\n` +
        `Target Source: ${sourceName}\n` +
        `File: ${filename}\n\n` +
        `New records added: ${newCount}\n` +
        `Duplicate records ignored: ${ignoredCount}\n` +
        `Rules executed: ${processedRules ?? 'N/A'} (${mappedTransactions ?? 'N/A'} transactions categorized)`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Download and Load failed');
      alert(`Download and Load Failed:\n\n${err.message}`);
    } finally {
      setIsDownloadingAndLoading(false);
    }
  };

  // Filter mappings table
  const filteredMappings = useMemo(() => {
    if (!tableFilter.trim()) return mappings;
    const q = tableFilter.toLowerCase();
    return mappings.filter(
      (m) =>
        m.source.toLowerCase().includes(q) ||
        m.fieldname.toLowerCase().includes(q) ||
        m.output_fieldname.toLowerCase().includes(q) ||
        (m.list_index && m.list_index.toLowerCase().includes(q)) ||
        (m.calculation_json && m.calculation_json.toLowerCase().includes(q))
    );
  }, [mappings, tableFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md">
              <GitMerge size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">File Merge Hub</h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Admin Tool
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Merge transaction records between .CSV and .OFX downloads into a consolidated format using configurable schema mappings and Excel-style formulas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormulaModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all shadow-sm"
          >
            <HelpCircle size={16} /> Formula Guide
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-300">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in duration-300">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1 & 2 & 3: Ingestion & Source Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CSV Dropzone */}
        <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${
          csvFile ? 'border-blue-400 bg-blue-50/30' : 'border-dashed border-slate-300 bg-white hover:border-blue-400'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FileSpreadsheet className="text-blue-600" size={18} />
                Step 1: CSV Statement File
              </span>
              {csvFile && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">
                  Ready
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Select the flat transaction .csv download (e.g. sample.csv).
            </p>

            <input
              type="file"
              ref={csvInputRef}
              onChange={handleCsvChange}
              accept=".csv"
              className="hidden"
            />

            {csvFile ? (
              <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-sm space-y-1">
                <div className="font-semibold text-slate-800 text-sm truncate">{csvFile.name}</div>
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>{(csvFile.size / 1024).toFixed(1)} KB</span>
                  {csvRowCount !== null && (
                    <span className="font-medium text-blue-600">{csvRowCount} rows parsed</span>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => csvInputRef.current?.click()}
                className="cursor-pointer border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors"
              >
                <Upload className="mx-auto text-slate-400 mb-1" size={24} />
                <span className="text-xs font-medium text-slate-600">Click to upload .CSV file</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => csvInputRef.current?.click()}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              {csvFile ? 'Replace CSV' : 'Browse File'}
            </button>
          </div>
        </div>

        {/* OFX Dropzone */}
        <div className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${
          ofxFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-dashed border-slate-300 bg-white hover:border-emerald-400'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FileCode2 className="text-emerald-600" size={18} />
                Step 2: OFX Financial File
              </span>
              {ofxFile && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">
                  Ready
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Select the banking/OFX download containing &lt;STMTTRN&gt; transactions.
            </p>

            <input
              type="file"
              ref={ofxInputRef}
              onChange={handleOfxChange}
              accept=".ofx,.qfx"
              className="hidden"
            />

            {ofxFile ? (
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm space-y-1">
                <div className="font-semibold text-slate-800 text-sm truncate">{ofxFile.name}</div>
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>{(ofxFile.size / 1024).toFixed(1)} KB</span>
                  {ofxRowCount !== null && (
                    <span className="font-medium text-emerald-600">{ofxRowCount} transactions</span>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => ofxInputRef.current?.click()}
                className="cursor-pointer border border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors"
              >
                <Upload className="mx-auto text-slate-400 mb-1" size={24} />
                <span className="text-xs font-medium text-slate-600">Click to upload .OFX file</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => ofxInputRef.current?.click()}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
            >
              {ofxFile ? 'Replace OFX' : 'Browse File'}
            </button>
          </div>
        </div>

        {/* Source Selection Card */}
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Layers className="text-purple-600" size={18} />
                Step 3: Account Source
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Select the account source to automatically load or associate mapping definitions in sys_merge_map.
            </p>

            <div className="space-y-3">
              <select
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : '')}
                disabled={isLoadingSources}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              >
                <option value="">-- Choose Account Source --</option>
                {sourcesArr.map((s: any) => (
                  <option key={s.id || s.sys_account_source_id} value={s.id || s.sys_account_source_id}>
                    {s.name || s.account_source_name}
                  </option>
                ))}
              </select>

              {selectedSourceId && (
                <div className="text-xs text-slate-500 flex items-center justify-between px-1">
                  <span>Source ID: <strong className="text-slate-700">{selectedSourceId}</strong></span>
                  <span>Rules configured: <strong className="text-purple-600">{mappings.length}</strong></span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {isInspecting ? 'Inspecting files...' : 'Mappings auto-sync'}
            </span>
            <button
              onClick={handleResetDefaults}
              disabled={!csvFile || !ofxFile}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 disabled:opacity-40"
              title="Reset mapping fields based on current files"
            >
              <RefreshCw size={12} /> Defaults
            </button>
          </div>
        </div>
      </div>

      {/* Step 4 & 5: Mapping Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="text-indigo-500" size={20} />
              Merge Mapping &amp; Transformation Rules
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure output fields, list comparison indexes (1.n for CSV, 2.n for OFX), output formats, and Excel-style calculations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Filter rules..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 w-40"
              />
            </div>

            <button
              onClick={() => handleAddDerivedField('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all"
            >
              <Plus size={14} /> Derived CSV
            </button>

            <button
              onClick={() => handleAddDerivedField('ofx')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all"
            >
              <Plus size={14} /> Derived OFX
            </button>

            <button
              onClick={handleSaveMapping}
              disabled={isSaving || !selectedSourceId}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              <Save size={14} /> {isSaving ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Field Name</th>
                <th className="px-3 py-3 text-center">In Output</th>
                <th className="px-4 py-3">Output Fieldname</th>
                <th className="px-3 py-3 text-center">Order</th>
                <th className="px-3 py-3 text-center">List Index</th>
                <th className="px-3 py-3">Datatype</th>
                <th className="px-3 py-3">Format</th>
                <th className="px-4 py-3">Calculation Formula</th>
                <th className="px-2 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    {mappings.length === 0
                      ? 'No mapping fields configured. Upload CSV & OFX files above or choose an Account Source.'
                      : 'No mapping fields match your filter.'}
                  </td>
                </tr>
              ) : (
                filteredMappings.map((row) => {
                  const realIndex = mappings.indexOf(row);
                  const isDerived = row.source.startsWith('derived');

                  return (
                    <tr
                      key={realIndex}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        row.in_output === 'y' ? 'bg-white' : 'bg-slate-50/30 text-slate-400'
                      }`}
                    >
                      {/* Source Badge */}
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                            row.source === 'input.csv'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : row.source === 'input.ofx'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.source === 'derived.csv'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {row.source}
                        </span>
                      </td>

                      {/* Field Name */}
                      <td className="px-4 py-2.5">
                        {isDerived ? (
                          <input
                            type="text"
                            value={row.fieldname}
                            onChange={(e) => handleUpdateMappingField(realIndex, 'fieldname', e.target.value)}
                            placeholder="Optional identifier"
                            className="w-full px-2 py-1 rounded border border-slate-200 bg-white font-mono text-[11px] focus:ring-1 focus:ring-purple-500"
                          />
                        ) : (
                          <span className="font-mono font-medium text-slate-800">{row.fieldname}</span>
                        )}
                      </td>

                      {/* In Output */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateMappingField(realIndex, 'in_output', row.in_output === 'y' ? 'n' : 'y')
                          }
                          className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all ${
                            row.in_output === 'y'
                              ? 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-300'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {row.in_output === 'y' ? 'Yes' : 'No'}
                        </button>
                      </td>

                      {/* Output Fieldname */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.output_fieldname}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'output_fieldname', e.target.value)}
                          className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-purple-500"
                        />
                      </td>

                      {/* Output Field Order */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="text"
                          value={row.output_field_order || ''}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'output_field_order', e.target.value)}
                          placeholder="—"
                          className="w-12 text-center px-1.5 py-1 rounded border border-slate-200 bg-white text-xs focus:ring-1 focus:ring-purple-500"
                        />
                      </td>

                      {/* List Index */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="text"
                          value={row.list_index || ''}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'list_index', e.target.value)}
                          placeholder="e.g. 1.1"
                          title="Composite key for matching (1.n for CSV, 2.n for OFX)"
                          className="w-16 text-center px-1.5 py-1 rounded border border-slate-200 bg-slate-50 font-mono font-bold text-indigo-700 text-xs focus:ring-1 focus:ring-purple-500"
                        />
                      </td>

                      {/* Datatype */}
                      <td className="px-3 py-2.5">
                        <select
                          value={row.datatype}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'datatype', e.target.value)}
                          className="px-2 py-1 rounded border border-slate-200 bg-white text-xs focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="text">text</option>
                          <option value="date">date</option>
                          <option value="number">number</option>
                        </select>
                      </td>

                      {/* Format */}
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          value={row.format || ''}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'format', e.target.value)}
                          placeholder={row.datatype === 'date' ? 'mm/dd/yyyy' : row.datatype === 'number' ? '0.00' : ''}
                          className="w-24 px-2 py-1 rounded border border-slate-200 bg-white text-xs font-mono focus:ring-1 focus:ring-purple-500"
                        />
                      </td>

                      {/* Calculation Formula */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.calculation_json || ''}
                          onChange={(e) => handleUpdateMappingField(realIndex, 'calculation_json', e.target.value)}
                          placeholder={
                            isDerived
                              ? 'e.g. IF input.csv.debit <> "" THEN "DR" ELSE "CR" | record | records'
                              : 'e.g. input.ofx * -1'
                          }
                          className="w-full px-2.5 py-1 rounded border border-slate-200 bg-white font-mono text-[11px] text-slate-800 focus:ring-1 focus:ring-purple-500"
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2.5 text-center">
                        {isDerived && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(realIndex)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove derived field"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 6: Execute Merge Action & Results */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="text-purple-600" size={20} />
              Merge Execution &amp; Output Hub
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Process the CSV and OFX inputs using the defined rules, preview results, and download the consolidated CSV.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExecuteMerge}
              disabled={isMerging || isDownloading || isDownloadingAndLoading || !csvFile || !ofxFile || mappings.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
            >
              <GitMerge size={16} />
              {isMerging ? 'Merging Files...' : 'Run File Merge'}
            </button>

            {mergeResult && (
              <button
                onClick={handleDownloadCsv}
                disabled={isDownloading || isDownloadingAndLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              >
                <Download size={16} />
                {isDownloading ? 'Downloading...' : 'Download Merged CSV'}
              </button>
            )}

            <button
              onClick={handleDownloadAndLoad}
              disabled={isDownloadingAndLoading || isMerging || isDownloading || !csvFile || !ofxFile || mappings.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              title={!selectedSourceId ? 'Please select an Account Source before running Download and Load' : 'Download merged CSV and load directly into the selected Account Source'}
            >
              <UploadCloud size={16} />
              {isDownloadingAndLoading ? 'Downloading & Loading...' : 'Download and Load'}
            </button>
          </div>
        </div>

        {/* Load Result Notification Banner */}
        {loadResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start justify-between gap-3 text-emerald-900 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 size={20} />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-sm text-emerald-950">
                  Merged CSV Downloaded &amp; Loaded Successfully!
                </div>
                <div className="text-xs text-emerald-800">
                  Loaded into account source <span className="font-semibold text-emerald-950">{loadResult.sourceName}</span> from file <span className="font-mono font-bold text-emerald-950">{loadResult.filename}</span>.
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold">
                  <span className="text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    +{loadResult.newRecords} new records added
                  </span>
                  <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {loadResult.ignoredRecords} duplicates ignored
                  </span>
                  {loadResult.processedRules !== undefined && (
                    <span className="text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                      {loadResult.processedRules} rules executed ({loadResult.mappedTransactions ?? 0} categorized)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLoadResult(null)}
              className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-100 transition-colors"
              title="Dismiss notification"
            >
              &times;
            </button>
          </div>
        )}

        {/* Merge Statistics */}
        {mergeResult && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            {mergeResult.filename && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900">
                <span className="font-semibold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-600" />
                  Target Output File:
                </span>
                <span className="font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm">
                  {mergeResult.filename}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">CSV Input Records</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{mergeResult.totalCsvRows}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">OFX Input Records</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{mergeResult.totalOfxRows}</div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Matched Records
                </div>
                <div className="text-2xl font-bold text-emerald-800 mt-1">{mergeResult.matchedRows}</div>
              </div>

              <div
                onClick={() => setShowUnmatchedDetails(!showUnmatchedDetails)}
                className="p-4 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100/60 transition-colors"
              >
                <div className="text-xs text-amber-700 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unmatched OFX
                  </span>
                  {showUnmatchedDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                <div className="text-2xl font-bold text-amber-800 mt-1">{mergeResult.unmatchedOfxRows}</div>
              </div>
            </div>

            {/* Unmatched OFX Drawer / Collapsible Box */}
            {showUnmatchedDetails && mergeResult.unmatchedOfxRecords && mergeResult.unmatchedOfxRecords.length > 0 && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">
                    Unmatched OFX FITIDs (Logged in import audit):
                  </span>
                  <span className="text-xs text-amber-700 font-mono">
                    {mergeResult.unmatchedOfxFitids?.join(', ') || 'None'}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-48 border border-amber-200 rounded-lg bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-amber-100/60 text-amber-900 font-semibold text-[11px]">
                      <tr>
                        <th className="px-3 py-1.5">FITID</th>
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5">Amount</th>
                        <th className="px-3 py-1.5">Name</th>
                        <th className="px-3 py-1.5">Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {mergeResult.unmatchedOfxRecords.map((r: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-1 text-amber-800 font-bold">{r.fitid}</td>
                          <td className="px-3 py-1 text-slate-600">{r.date}</td>
                          <td className="px-3 py-1 text-slate-600">{r.amount}</td>
                          <td className="px-3 py-1 text-slate-700 font-sans">{r.name}</td>
                          <td className="px-3 py-1 text-slate-500 font-sans">{r.memo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Merged Preview Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Merged Dataset Preview ({mergeResult.preview?.length || 0} Records)
                </h3>
                <span className="text-xs text-slate-500">Columns: {mergeResult.columns?.length || 0}</span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96 shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 text-[11px]">
                    <tr>
                      {mergeResult.columns?.map((col: string, idx: number) => (
                        <th key={idx} className="px-3.5 py-2.5 whitespace-nowrap bg-slate-100">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {mergeResult.preview?.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-indigo-50/30 transition-colors">
                        {mergeResult.columns?.map((col: string, cIdx: number) => (
                          <td key={cIdx} className="px-3.5 py-2 whitespace-nowrap text-slate-800 font-mono text-[11px]">
                            {row[col] !== undefined && row[col] !== null ? String(row[col]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Formula Cheat Sheet Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="text-indigo-600" size={20} />
                Calculation &amp; Formula Syntax Guide
              </h3>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">1. IF THEN ELSE Statements</h4>
                <p className="mb-1 text-slate-500">Syntax: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">IF condition THEN trueValue ELSE falseValue</code></p>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono space-y-1">
                  <div>IF input.csv.debit &lt;&gt; &quot;&quot; THEN &quot;DR&quot; ELSE &quot;CR&quot;</div>
                  <div>IF input.ofx.TRNTYPE = &quot;DEBIT&quot; THEN &quot;DR&quot; ELSE &quot;CR&quot;</div>
                  <div>IF input.csv.debit &lt;&gt; &quot;&quot; THEN input.csv.debit ELSE input.csv.credit</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">2. Basic Arithmetic &amp; Multipliers</h4>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono space-y-1">
                  <div>input.ofx * -1</div>
                  <div>input.ofx.TRNAMT * -1</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">3. De-duplication Keywords</h4>
                <p className="text-slate-500 mb-1">Used to uniquely order identical records having the same posting date, amount, and DR/CR.</p>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono space-y-1">
                  <div><strong>record</strong> or <strong>recordNumber</strong>: 1-based sequential occurrence (1, 2, ...)</div>
                  <div><strong>records</strong> or <strong>ofRecords</strong>: Total count of identical occurrences</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">4. List Index Matching (1.n vs 2.n)</h4>
                <p className="text-slate-500">
                  Assign <strong>1.1</strong>, <strong>1.2</strong>, <strong>1.3</strong> to the CSV fields, and <strong>2.1</strong>, <strong>2.2</strong>, <strong>2.3</strong> to the matching OFX fields. Comparisons are made after the specified format is applied.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium text-xs hover:bg-slate-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
