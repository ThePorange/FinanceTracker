import { useState } from 'react';
import { useTransactionFilters } from '../transactions/TransactionFilterContext';
import { TransactionFilterPanel } from '../transactions/TransactionFilterPanel';
import { Input } from '../../components/shared/Input';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, CartesianGrid, Legend 
} from 'recharts';
import { 
  Trash2, Download, Save, Layers, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, 
  Sparkles, Check, RefreshCw, Filter, FolderPlus, SlidersHorizontal, Copy, ChevronDown, ChevronUp,
  GripVertical, PlusCircle
} from 'lucide-react';
import { useReportDefinitions, useSaveReportDefinition, useDeleteReportDefinition, useEvaluateReport } from './useReportDefinitions';
import type { ReportSeries, ReportFilterBundle, SeriesSummary } from './types';
import { useSystemData } from '../admin/useSystemData';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export function ReportingScreen() {
  const { filters, setFilters, search, setSearch } = useTransactionFilters();
  const { data: savedReports } = useReportDefinitions();
  const saveMutation = useSaveReportDefinition();
  const deleteMutation = useDeleteReportDefinition();

  const { data: sourcesData } = useSystemData('sys_account_source');
  const { data: groupsData } = useSystemData('sys_account_group');
  const { data: typesData } = useSystemData('sys_transaction_type');

  const sources = sourcesData?.data || sourcesData || [];
  const groups = groupsData?.data || groupsData || [];
  const types = typesData?.data || typesData || [];

  // Collapsible state for Report Builder box
  const [isBuilderOpen, setIsBuilderOpen] = useState(true);

  // Function to duplicate current report definition
  const handleDuplicateReport = () => {
    const dupName = reportName.includes('(Copy)')
      ? reportName.replace(/\(Copy\)(?:\s*\d+)?$/, (match) => {
          const numMatch = match.match(/\d+/);
          const nextNum = numMatch ? parseInt(numMatch[0]) + 1 : 2;
          return `(Copy ${nextNum})`;
        })
      : `${reportName} (Copy)`;

    setReportName(dupName);
    setSelectedReportId('new');
    setSaveSuccessMsg(`Duplicated report as "${dupName}". Click Save to persist.`);
    setTimeout(() => setSaveSuccessMsg(''), 4500);
  };

  // Currently active filter chip target loaded into top panel
  const [activeFilterTarget, setActiveFilterTarget] = useState<{ seriesId: string; filterIndex: number } | null>(null);

  // Function to load a Data Category's filter/search criteria into top filter panel
  const handleLoadFilterToTop = (filterBundle: ReportFilterBundle, seriesId: string, filterIndex: number, categoryName?: string) => {
    if (!filterBundle) return;
    const { search: searchVal, ...restFilters } = filterBundle;
    setSearch(searchVal || '');
    setFilters(restFilters || {});
    setActiveFilterTarget({ seriesId, filterIndex });
    
    if (categoryName) {
      setSaveSuccessMsg(`Loaded filter criteria from "${categoryName}" into top panel.`);
      setTimeout(() => setSaveSuccessMsg(''), 4500);
    }
  };

  // Function to update the currently loaded filter chip with top panel filter & search criteria
  const handleUpdateLoadedFilter = () => {
    if (!activeFilterTarget) return;

    const currentBundle: ReportFilterBundle = { ...filters };
    if (search && search.trim()) currentBundle.search = search.trim();

    setSeries(prev => prev.map(s => {
      if (s.id === activeFilterTarget.seriesId) {
        const nextFilters = [...s.filters];
        if (nextFilters[activeFilterTarget.filterIndex] !== undefined) {
          nextFilters[activeFilterTarget.filterIndex] = currentBundle;
        }
        return { ...s, filters: nextFilters };
      }
      return s;
    }));

    const targetSeries = series.find(s => s.id === activeFilterTarget.seriesId);
    const seriesName = targetSeries ? targetSeries.name : 'Data Category';
    setSaveSuccessMsg(`Updated filter selection in "${seriesName}" with top panel criteria!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Currently selected report definition ID from dropdown ('new' for custom)
  const [selectedReportId, setSelectedReportId] = useState<string>('new');
  const [reportName, setReportName] = useState<string>('Custom Financial Analysis');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [interval, setInterval] = useState<'monthly' | 'daily' | 'yearly'>('monthly');
  const [amountMode, setAmountMode] = useState<'net' | 'dr' | 'cr'>('net');

  // Series array
  const [series, setSeries] = useState<ReportSeries[]>([
    {
      id: 'series_1',
      name: 'Data Category 1',
      filters: [{ ...filters, search }]
    }
  ]);

  // Drag and Drop State for Data Categories / Filter Bundles
  const [draggedItem, setDraggedItem] = useState<{ seriesId: string; filterIndex: number } | null>(null);
  const [dragOverSeriesId, setDragOverSeriesId] = useState<string | null>(null);
  const [isDragOverNewZone, setIsDragOverNewZone] = useState(false);

  const handleDragStart = (e: React.DragEvent, seriesId: string, filterIndex: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ seriesId, filterIndex }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ seriesId, filterIndex });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSeriesId(null);
    setIsDragOverNewZone(false);
  };

  const handleDropOnSeries = (e: React.DragEvent, targetSeriesId: string) => {
    e.preventDefault();
    e.stopPropagation();

    let item = draggedItem;
    if (!item) {
      try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) item = JSON.parse(dataStr);
      } catch (err) {
        // ignore
      }
    }

    if (!item) return;
    const { seriesId: sourceSeriesId, filterIndex } = item;
    if (sourceSeriesId === targetSeriesId) {
      handleDragEnd();
      return;
    }

    setSeries(prev => {
      const sourceSeries = prev.find(s => s.id === sourceSeriesId);
      if (!sourceSeries || !sourceSeries.filters[filterIndex]) return prev;

      const filterToMove = sourceSeries.filters[filterIndex];

      return prev.map(s => {
        if (s.id === targetSeriesId) {
          return { ...s, filters: [...s.filters, filterToMove] };
        }
        if (s.id === sourceSeriesId) {
          const newFilters = s.filters.filter((_, idx) => idx !== filterIndex);
          return { ...s, filters: newFilters };
        }
        return s;
      }).filter(s => s.filters.length > 0);
    });

    handleDragEnd();
  };

  const handleDropOnNewSeries = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let item = draggedItem;
    if (!item) {
      try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) item = JSON.parse(dataStr);
      } catch (err) {
        // ignore
      }
    }

    if (!item) return;
    const { seriesId: sourceSeriesId, filterIndex } = item;

    setSeries(prev => {
      const sourceSeries = prev.find(s => s.id === sourceSeriesId);
      if (!sourceSeries || !sourceSeries.filters[filterIndex]) return prev;

      const filterToMove = sourceSeries.filters[filterIndex];

      // If source series only has 1 filter, dropping to blank area keeps it as standalone category
      if (sourceSeries.filters.length === 1) {
        return prev;
      }

      const tagText = formatFilterTag(filterToMove);
      const newSeriesName = tagText && tagText !== 'All Unfiltered Transactions' 
        ? (tagText.length > 25 ? tagText.substring(0, 25) + '...' : tagText)
        : `Data Category ${prev.length + 1}`;
      const newSeriesId = `series_${Date.now()}`;

      const newSeriesList = prev.map(s => {
        if (s.id === sourceSeriesId) {
          return { ...s, filters: s.filters.filter((_, idx) => idx !== filterIndex) };
        }
        return s;
      }).filter(s => s.filters.length > 0);

      return [...newSeriesList, { id: newSeriesId, name: newSeriesName, filters: [filterToMove] }];
    });

    handleDragEnd();
  };

  // Modal state for adding current filter
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTargetSeriesId, setModalTargetSeriesId] = useState<string>('new');
  const [newSeriesNameInput, setNewSeriesNameInput] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Handle selecting a saved report from dropdown
  const handleSelectReport = (idStr: string) => {
    setSelectedReportId(idStr);
    if (idStr === 'new') {
      setReportName('Custom Financial Analysis');
      setChartType('line');
      setInterval('monthly');
      setAmountMode('net');
      setSeries([
        {
          id: `series_${Date.now()}`,
          name: 'Data Category 1',
          filters: [{ ...filters, search }]
        }
      ]);
      return;
    }

    const found = (savedReports || []).find((r: any) => String(r.sys_report_definition_id) === idStr);
    if (found) {
      setReportName(found.report_name);
      setChartType(found.chart_type || 'line');
      let def: any = found.definition_json;
      if (typeof def === 'string') {
        try { def = JSON.parse(def); } catch (e) { def = {}; }
      }
      if (def) {
        if (def.series && Array.isArray(def.series)) setSeries(def.series);
        if (def.interval) setInterval(def.interval);
        if (def.amountMode) setAmountMode(def.amountMode);
      }
    }
  };

  // Evaluate dynamic chart data
  const evaluateQuery = useEvaluateReport({
    series,
    interval,
    amountMode
  }, { enabled: series.length > 0 });

  const chartData = evaluateQuery.data?.chartData || [];
  const seriesSummaries = evaluateQuery.data?.seriesSummaries || [];

  const activeTargetSeries = activeFilterTarget ? series.find(s => s.id === activeFilterTarget.seriesId) : null;
  const activeTargetExists = !!(activeTargetSeries && activeTargetSeries.filters[activeFilterTarget!.filterIndex] !== undefined);

  // Helper to describe filter tags nicely
  const formatFilterTag = (f: ReportFilterBundle) => {
    const parts: string[] = [];
    if (f.startDate || f.endDate) {
      parts.push(`${f.startDate || 'Start'} to ${f.endDate || 'Present'}`);
    }
    if (f.category) parts.push(`Cat: "${f.category}"`);
    if (f.sourceId) {
      const s = sources.find((x: any) => String(x.sys_account_source_id) === String(f.sourceId));
      parts.push(`Source: ${s ? s.account_source_name : f.sourceId}`);
    }
    if (f.groupId) {
      const g = groups.find((x: any) => String(x.sys_account_group_id) === String(f.groupId));
      parts.push(`Group: ${g ? g.account_group_name : f.groupId}`);
    }
    if (f.typeId) {
      const t = types.find((x: any) => String(x.sys_transaction_type_id) === String(f.typeId));
      parts.push(`Type: ${t ? t.transaction_type : f.typeId}`);
    }
    if (f.drcr) parts.push(f.drcr === 'DR' ? 'Debits' : 'Credits');
    if (f.amountVal) parts.push(`Amt ${f.amountOp || '='} ${f.amountVal}`);
    if (f.search) parts.push(`Search: "${f.search}"`);

    return parts.length > 0 ? parts.join(' • ') : 'All Unfiltered Transactions';
  };

  // Add current filter selection to builder
  const handleConfirmAddFilter = () => {
    const currentBundle: ReportFilterBundle = { ...filters };
    if (search && search.trim()) currentBundle.search = search.trim();

    if (modalTargetSeriesId === 'new') {
      const newName = newSeriesNameInput.trim() || `Data Category ${series.length + 1}`;
      const newSeriesObj: ReportSeries = {
        id: `series_${Date.now()}`,
        name: newName,
        filters: [currentBundle]
      };
      setSeries(prev => [...prev, newSeriesObj]);
    } else {
      // Union into existing series
      setSeries(prev => prev.map(s => {
        if (s.id === modalTargetSeriesId) {
          return {
            ...s,
            filters: [...s.filters, currentBundle]
          };
        }
        return s;
      }));
    }

    setShowAddModal(false);
    setNewSeriesNameInput('');
  };

  // Delete filter from a series
  const handleRemoveFilterFromSeries = (seriesId: string, filterIndex: number) => {
    setSeries(prev => prev.map(s => {
      if (s.id === seriesId) {
        const nextFilters = s.filters.filter((_, idx) => idx !== filterIndex);
        return { ...s, filters: nextFilters };
      }
      return s;
    }).filter(s => s.filters.length > 0)); // Remove series if no filters remain
  };

  // Delete an entire series
  const handleDeleteSeries = (seriesId: string) => {
    setSeries(prev => prev.filter(s => s.id !== seriesId));
  };

  // Update series name
  const handleUpdateSeriesName = (seriesId: string, name: string) => {
    setSeries(prev => prev.map(s => s.id === seriesId ? { ...s, name } : s));
  };

  // Save Report Definition
  const handleSaveReport = () => {
    if (!reportName.trim()) return;
    saveMutation.mutate(
      {
        id: selectedReportId !== 'new' ? Number(selectedReportId) : undefined,
        report_name: reportName.trim(),
        chart_type: chartType,
        definition_json: {
          series,
          interval,
          amountMode
        }
      },
      {
        onSuccess: (res: any) => {
          if (res?.sys_report_definition_id) {
            setSelectedReportId(String(res.sys_report_definition_id));
          }
          setSaveSuccessMsg('Report definition saved successfully!');
          setTimeout(() => setSaveSuccessMsg(''), 3000);
        }
      }
    );
  };

  // Delete Report Definition
  const handleDeleteReport = () => {
    if (selectedReportId === 'new') return;
    if (confirm(`Are you sure you want to delete "${reportName}"?`)) {
      deleteMutation.mutate(Number(selectedReportId), {
        onSuccess: () => {
          handleSelectReport('new');
        }
      });
    }
  };

  // Export underlying transactions dataset to CSV
  const exportReportToCsv = () => {
    const underlying = evaluateQuery.data?.underlyingTransactions || [];
    if (!underlying || underlying.length === 0) {
      alert('No underlying transactions found for the current report configuration.');
      return;
    }

    const headers = [
      'Data Category',
      'Transaction ID',
      'Date',
      'Account / Source',
      'Description',
      'Transaction Type',
      'Category',
      'Type (DR/CR)',
      'Amount ($)'
    ];

    const escapeCsvField = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = underlying.map((t: any) => {
      const formattedDate = t.date ? String(t.date).split('T')[0] : '';
      const formattedAmount = Number(t.amount || 0).toFixed(2);
      return [
        escapeCsvField(t.seriesName),
        escapeCsvField(t.id),
        escapeCsvField(formattedDate),
        escapeCsvField(t.account),
        escapeCsvField(t.description),
        escapeCsvField(t.transactionType),
        escapeCsvField(t.category),
        escapeCsvField(t.drcr),
        escapeCsvField(formattedAmount)
      ].join(',');
    });

    const csvContent = [
      `Report Title,${escapeCsvField(reportName)}`,
      `Chart Type,${escapeCsvField(chartType)}`,
      `Interval,${escapeCsvField(interval)}`,
      `Amount View,${escapeCsvField(amountMode)}`,
      `Total Transactions,${underlying.length}`,
      '',
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTitle = reportName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `${sanitizedTitle}_underlying_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header section with Title, Search bar, and Run Report dropdown */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-blue-600 w-8 h-8" />
            Reporting & Custom Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Build, union, and dynamically visualize multi-category financial reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Run Report Selector */}
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Run Saved Report</label>
            <select
              value={selectedReportId}
              onChange={e => handleSelectReport(e.target.value)}
              className="bg-white border border-gray-300 text-gray-800 text-sm font-semibold rounded-xl px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="new">✨ Builder Mode (Custom Report)</option>
              {savedReports && savedReports.map((r: any) => (
                <option key={r.sys_report_definition_id} value={r.sys_report_definition_id}>
                  📊 {r.report_name}
                </option>
              ))}
            </select>
          </div>

          {/* Search field */}
          <div className="w-64 self-end">
            <Input
              placeholder="Search descriptions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* CSV Export Button */}
          <button
            onClick={exportReportToCsv}
            disabled={!chartData || chartData.length === 0}
            className="self-end flex items-center gap-2 bg-slate-900 text-white font-medium text-sm px-4 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Shared Filter Panel */}
      <TransactionFilterPanel
        filters={filters}
        onFilterChange={f => setFilters(f)}
      />

      {/* Active Loaded Filter Edit Banner */}
      {activeTargetExists && activeTargetSeries && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Loaded Filter Selection</span>
                <span className="bg-amber-200/90 text-amber-950 text-xs font-bold px-2 py-0.5 rounded-md">
                  {activeTargetSeries.name} (Filter #{activeFilterTarget!.filterIndex + 1})
                </span>
              </div>
              <p className="text-xs text-amber-900/80 mt-0.5">
                Adjust search query or filter values above, then click <strong>"Update Selected Filter"</strong> to apply the new criteria.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleUpdateLoadedFilter}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} />
              Update Selected Filter
            </button>
            <button
              type="button"
              onClick={() => setActiveFilterTarget(null)}
              className="text-amber-800 hover:text-amber-950 text-xs font-semibold px-2 py-1 rounded hover:bg-amber-100 transition-colors"
              title="Deselect active filter editing"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Report Builder Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6 transition-all duration-300">
        <div 
          className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
          onClick={() => setIsBuilderOpen(!isBuilderOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">Report Definition Builder</h2>
                {series.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {series.length} {series.length === 1 ? 'Data Category' : 'Data Categories'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Configure data sources, Union categories, chart type, and persistence.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTargetExists && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpdateLoadedFilter();
                }}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 animate-in fade-in duration-200"
                title="Overwrite the selected filter chip with current top panel filter & search values"
              >
                <RefreshCw size={18} />
                Update Selected Filter
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModalTargetSeriesId(series.length > 0 ? series[0].id : 'new');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
            >
              <FolderPlus size={18} />
              Add Current Filter as Data Source
            </button>

            <div className="text-slate-400 hover:text-slate-600 transition-colors p-1">
              {isBuilderOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {isBuilderOpen && (
          <div className="p-6 pt-2 border-t border-slate-100 space-y-6">
            {/* Report Meta & Configurations */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Report Title</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={e => setReportName(e.target.value)}
                  placeholder="e.g. Dining vs Groceries 2025"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Chart Type</label>
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setChartType('line')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartType === 'line' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <LineChartIcon size={14} /> Line
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartType === 'bar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <BarChart3 size={14} /> Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartType === 'area' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <AreaChartIcon size={14} /> Area
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">X-Axis Time Bucket</label>
                <select
                  value={interval}
                  onChange={e => setInterval(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monthly">Monthly (Jan–Dec for &gt;1 sources, or First-Last Month for 1 source)</option>
                  <option value="yearly">Yearly (First Year to Last Year across sources)</option>
                  <option value="daily">Daily Timeline</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Y-Axis Amount Mode</label>
                <select
                  value={amountMode}
                  onChange={e => setAmountMode(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="net">Net Flow (Credits - Debits)</option>
                  <option value="dr">Outflows Only (Debits)</option>
                  <option value="cr">Inflows Only (Credits)</option>
                </select>
              </div>
            </div>

            {/* Data Categories & Series Filter Manager */}
            <div 
              className="space-y-4 pt-2"
              onDragOver={(e) => {
                if (draggedItem) {
                  e.preventDefault();
                  setIsDragOverNewZone(true);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragOverNewZone(false);
                }
              }}
              onDrop={handleDropOnNewSeries}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  Configured Data Categories & Union Sources
                </h3>
                {draggedItem && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg animate-pulse flex items-center gap-1.5 self-start sm:self-auto">
                    <GripVertical size={13} />
                    Drag to a Data Source to Union, or drop in blank area to split into a new Data Source
                  </span>
                )}
              </div>

              {series.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">
                  No Data Categories defined yet. Click "Add Current Filter as Data Source" above to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {series.map((s, idx) => {
                    const isTarget = dragOverSeriesId === s.id;
                    return (
                      <div 
                        key={s.id} 
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedItem && draggedItem.seriesId !== s.id) {
                            setDragOverSeriesId(s.id);
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (dragOverSeriesId === s.id) setDragOverSeriesId(null);
                        }}
                        onDrop={(e) => handleDropOnSeries(e, s.id)}
                        className={`rounded-2xl p-4 space-y-3 relative group transition-all duration-200 overflow-hidden ${
                          isTarget
                            ? 'bg-blue-50/90 border-2 border-blue-500 shadow-lg ring-4 ring-blue-500/20 scale-[1.01]'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        {isTarget && (
                          <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] rounded-2xl border-2 border-dashed border-blue-500 flex items-center justify-center pointer-events-none z-20">
                            <span className="bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
                              <Sparkles size={14} /> Drop here to Union into "{s.name}"
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            ></div>
                            <input
                              type="text"
                              value={s.name}
                              onChange={e => handleUpdateSeriesName(s.id, e.target.value)}
                              className="font-bold text-slate-800 bg-transparent hover:bg-white focus:bg-white border-none rounded px-1 text-sm flex-1 focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => s.filters.length > 0 && handleLoadFilterToTop(s.filters[0], s.id, 0, s.name)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                              title="Load this Data Category's filter/search into the top panel"
                            >
                              <SlidersHorizontal size={13} />
                              Apply Filter
                            </button>
                            <button
                              onClick={() => handleDeleteSeries(s.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                              title="Delete Data Category"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Filter bundles inside this Data Category */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                            {s.filters.length > 1 ? `Union of ${s.filters.length} Filters (Drag chips to combine or separate)` : '1 Filter Selection (Drag chip to combine with another source)'}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {s.filters.map((f, fIdx) => {
                              const isThisDragged = draggedItem?.seriesId === s.id && draggedItem?.filterIndex === fIdx;
                              const isThisActive = activeFilterTarget?.seriesId === s.id && activeFilterTarget?.filterIndex === fIdx;
                              return (
                                <div
                                  key={fIdx}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, s.id, fIdx)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => handleLoadFilterToTop(f, s.id, fIdx, s.name)}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-1.5 cursor-grab active:cursor-grabbing transition-all select-none ${
                                    isThisDragged
                                      ? 'opacity-30 border-dashed border-blue-500 scale-95 ring-2 ring-blue-400 bg-white'
                                      : isThisActive
                                      ? 'bg-amber-50 border-2 border-amber-500 text-amber-950 font-bold ring-2 ring-amber-400/30 shadow-xs'
                                      : 'bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-900 shadow-2xs'
                                  }`}
                                  title="Click to load into filter panel. Drag to Union or split."
                                >
                                  <GripVertical size={13} className={`shrink-0 cursor-grab ${isThisActive ? 'text-amber-600' : 'text-slate-400'}`} />
                                  <Filter size={12} className={`shrink-0 ${isThisActive ? 'text-amber-600' : 'text-blue-500'}`} />
                                  <span className="truncate max-w-[180px]" title={formatFilterTag(f)}>
                                    {formatFilterTag(f)}
                                  </span>

                                  {isThisActive && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateLoadedFilter();
                                      }}
                                      className="text-amber-900 hover:text-black bg-amber-200/90 hover:bg-amber-300 px-1.5 py-0.5 rounded text-[11px] font-bold transition-colors flex items-center gap-1 shrink-0 ml-0.5 shadow-2xs cursor-pointer"
                                      title="Overwrite this filter chip with current top panel criteria"
                                    >
                                      <RefreshCw size={11} /> Update
                                    </button>
                                  )}

                                  {s.filters.length > 1 && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRemoveFilterFromSeries(s.id, fIdx); }}
                                      className="text-slate-400 hover:text-rose-500 text-sm font-bold ml-1 p-0.5"
                                      title="Remove this filter from Union"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Blank Area Drop Zone indicator when dragging */}
              {draggedItem && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOverNewZone(true);
                  }}
                  onDragLeave={() => setIsDragOverNewZone(false)}
                  onDrop={handleDropOnNewSeries}
                  className={`p-6 border-2 border-dashed rounded-2xl transition-all duration-200 flex flex-col items-center justify-center text-center gap-2 cursor-pointer ${
                    isDragOverNewZone
                      ? 'bg-emerald-50/90 border-emerald-500 ring-4 ring-emerald-500/20 scale-[1.01]'
                      : 'bg-slate-50/80 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    isDragOverNewZone ? 'bg-emerald-500 text-white scale-110 shadow-md' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <span className={`font-bold text-sm ${isDragOverNewZone ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {isDragOverNewZone ? 'Release to Create New Data Source' : 'Drop filter chip here to split into a new Data Source'}
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Creates a separate Data Source category on the report chart.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Save / Delete Report Definition Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-600">
                {saveSuccessMsg && <Check size={16} />}
                <span>{saveSuccessMsg}</span>
              </div>

              <div className="flex items-center gap-3">
                {selectedReportId !== 'new' && (
                  <button
                    type="button"
                    onClick={handleDeleteReport}
                    className="flex items-center gap-2 text-rose-600 hover:bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Trash2 size={16} /> Delete Definition
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDuplicateReport}
                  className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-2xs"
                  title="Duplicate current report definition under a new title"
                >
                  <Copy size={16} /> Duplicate Definition
                </button>

                <button
                  type="button"
                  onClick={handleSaveReport}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save size={16} />
                  {saveMutation.isPending ? 'Saving...' : 'Save Report Definition'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {seriesSummaries.map((sum: SeriesSummary, idx: number) => (
          <div 
            key={sum.id} 
            onClick={() => {
              const target = series.find(s => s.id === sum.id);
              if (target && target.filters.length > 0) {
                handleLoadFilterToTop(target.filters[0], target.id, 0, target.name);
              }
            }}
            title="Click to load filter & search criteria into top panel"
            className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">{sum.name}</span>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              ></div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                ${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sum.totalAmount)}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                <span>{sum.count} dynamic matches</span>
                <span className="text-[10px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Apply filter →</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Chart Display Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{reportName}</h2>
            <p className="text-xs text-gray-500">X-Axis: Time / Dates ({interval}) • Y-Axis: Amount ($)</p>
          </div>
          {evaluateQuery.isFetching && (
            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={14} className="animate-spin" /> Evaluating dynamic transactions...
            </span>
          )}
        </div>

        <div className="h-96 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
              <BarChart3 size={40} className="mb-2 opacity-40" />
              <span>No data points found matching the selected report definition.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${Intl.NumberFormat('en-US').format(Math.abs(v))}`} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any, name: any, item: any) => {
                      const formattedVal = `$${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(v)))}`;
                      const actualDate = item?.payload?._actualDates?.[name];
                      const displayLabel = actualDate && actualDate !== name ? `${name} (${actualDate})` : name;
                      return [formattedVal, displayLabel];
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '13px' }} />
                  {series.map((s, idx) => (
                    <Line
                      key={s.id}
                      name={s.name}
                      type="monotone"
                      dataKey={s.name}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              ) : chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${Intl.NumberFormat('en-US').format(Math.abs(v))}`} dx={-10} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any, name: any, item: any) => {
                      const formattedVal = `$${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(v)))}`;
                      const actualDate = item?.payload?._actualDates?.[name];
                      const displayLabel = actualDate && actualDate !== name ? `${name} (${actualDate})` : name;
                      return [formattedVal, displayLabel];
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '13px' }} />
                  {series.map((s, idx) => (
                    <Bar
                      key={s.id}
                      name={s.name}
                      dataKey={s.name}
                      fill={COLORS[idx % COLORS.length]}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    />
                  ))}
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `$${Intl.NumberFormat('en-US').format(Math.abs(v))}`} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any, name: any, item: any) => {
                      const formattedVal = `$${Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(Number(v)))}`;
                      const actualDate = item?.payload?._actualDates?.[name];
                      const displayLabel = actualDate && actualDate !== name ? `${name} (${actualDate})` : name;
                      return [formattedVal, displayLabel];
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '13px' }} />
                  {series.map((s, idx) => (
                    <Area
                      key={s.id}
                      name={s.name}
                      type="monotone"
                      dataKey={s.name}
                      stroke={COLORS[idx % COLORS.length]}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.25}
                      strokeWidth={2.5}
                    />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Modal for Adding Current Filter Selection to Builder */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderPlus size={20} className="text-blue-600" />
                Add Current Filter Selection
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
              <span className="font-bold block">Current Filter Payload:</span>
              <p className="font-mono text-[11px] text-blue-800">
                {formatFilterTag({ ...filters, search: search || undefined })}
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                Select Destination
              </label>

              {/* Option A: Union to existing Data Category */}
              {series.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 font-medium block">
                    Option A: Union with an existing Data Category (combines data into 1 series line/bar)
                  </span>
                  <select
                    value={modalTargetSeriesId}
                    onChange={e => setModalTargetSeriesId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    {series.map(s => (
                      <option key={s.id} value={s.id}>
                        ➕ Union into: {s.name} ({s.filters.length} existing filters)
                      </option>
                    ))}
                    <option value="new">✨ Create a New Data Category (New Line/Series)</option>
                  </select>
                </div>
              )}

              {/* Option B: Create new series */}
              {modalTargetSeriesId === 'new' && (
                <div className="space-y-1 pt-2">
                  <label className="text-xs font-bold text-slate-700">New Data Category Name</label>
                  <input
                    type="text"
                    value={newSeriesNameInput}
                    onChange={e => setNewSeriesNameInput(e.target.value)}
                    placeholder={`Data Category ${series.length + 1}`}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddFilter}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
              >
                Confirm Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
