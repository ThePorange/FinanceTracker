import { useState, useEffect } from 'react';
import { X, Check, RotateCcw, SlidersHorizontal, Info, Database } from 'lucide-react';
import {
  type TransactionFieldConfig,
  INITIAL_TRANSACTION_FIELDS,
} from './transactionFieldConfig';

interface SelectFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFields: TransactionFieldConfig[];
  onSave: (fields: TransactionFieldConfig[]) => Promise<void> | void;
  onReset?: () => Promise<void> | void;
  isSaving?: boolean;
}

export function SelectFieldsModal({
  isOpen,
  onClose,
  currentFields,
  onSave,
  onReset,
  isSaving = false,
}: SelectFieldsModalProps) {
  const [fields, setFields] = useState<TransactionFieldConfig[]>([]);
  const [showSystemFields, setShowSystemFields] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Sync internal state when modal opens or currentFields changes
  useEffect(() => {
    if (isOpen) {
      setFields(
        [...currentFields].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      );
      setNotice(null);
      setShowSystemFields(false);
    }
  }, [isOpen, currentFields]);

  if (!isOpen) return null;

  const handleToggleDisplay = (key: string, visible: boolean) => {
    setFields((prev) =>
      prev.map((f) =>
        f.key === key
          ? {
              ...f,
              visible,
              // If Display is turned No, Search Fields must also be No
              searchable: visible ? f.searchable : false,
            }
          : f
      )
    );
    setNotice(null);
  };

  const handleToggleSearch = (key: string, searchable: boolean) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        // You can only select Yes to Search if the field has a Yes in the Display column
        if (searchable && !f.visible) return f;
        return { ...f, searchable };
      })
    );
    setNotice(null);
  };

  const handleOrderChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    setFields((prev) =>
      prev.map((f) =>
        f.key === key
          ? { ...f, order: isNaN(num) ? 0 : Math.max(1, Math.min(99, num)) }
          : f
      )
    );
    setNotice(null);
  };

  const handleResetToInitial = async () => {
    // Resort to initial values
    const initialCopy = INITIAL_TRANSACTION_FIELDS.map((f) => ({ ...f }));
    initialCopy.sort((a, b) => a.order - b.order);
    setFields(initialCopy);
    if (onReset) {
      await onReset();
      setNotice('Resorted to initial default values and saved to system configuration.');
    } else {
      setNotice('Resorted to initial default values. Click "OK" to save to system configuration.');
    }
  };

  const handleOk = async () => {
    // Sort all fields by their order before saving
    const sortedFields = [...fields].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
    );
    await onSave(sortedFields);
    onClose();
  };

  // Filter fields: by default exclude "sys_" prefixed fields unless showSystemFields is true
  const displayedFields = fields.filter(
    (field) => showSystemFields || !field.key.startsWith('sys_')
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-fields-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="select-fields-title"
                className="text-lg font-bold text-gray-900 tracking-tight"
              >
                Select Fields
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure visible columns, searchable fields, and display order.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Content Table */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th scope="col" className="px-5 py-3 text-left">
                    Field Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Display (Yes/No)
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Search Fields
                  </th>
                  <th scope="col" className="px-4 py-3 text-center">
                    Field Order
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedFields.map((field) => {
                  const isSysField = field.key.startsWith('sys_');
                  return (
                    <tr
                      key={field.key}
                      className={`transition-colors ${
                        field.visible
                          ? 'hover:bg-blue-50/30'
                          : isSysField
                          ? 'bg-purple-50/20 hover:bg-purple-50/40'
                          : 'bg-gray-50/40 hover:bg-gray-100/50'
                      }`}
                    >
                      {/* Field Name */}
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              field.visible
                                ? 'bg-blue-600'
                                : isSysField
                                ? 'bg-purple-400'
                                : 'bg-gray-300'
                            }`}
                          />
                          <span className={isSysField ? 'font-mono text-purple-900 text-xs' : ''}>
                            {field.label}
                          </span>
                          {isSysField && (
                            <span className="px-1.5 py-0.5 text-3xs font-semibold bg-purple-100 text-purple-700 rounded-md border border-purple-200">
                              sys
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Display (Yes/No) Button */}
                      <td className="px-4 py-3.5 text-center">
                        <div
                          className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100/70 shadow-2xs"
                          role="group"
                          aria-label={`Display ${field.label}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleDisplay(field.key, true)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                              field.visible
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            <Check className="w-3 h-3" /> Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleDisplay(field.key, false)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                              !field.visible
                                ? 'bg-gray-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </td>

                      {/* Search Fields (Yes/No) Button */}
                      <td className="px-4 py-3.5 text-center">
                        <div
                          className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100/70 shadow-2xs"
                          role="group"
                          aria-label={`Search ${field.label}`}
                        >
                          <button
                            type="button"
                            disabled={!field.visible}
                            onClick={() => handleToggleSearch(field.key, true)}
                            title={
                              !field.visible
                                ? 'Can only select Yes if field has Yes in Display column'
                                : 'Include in search'
                            }
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                              !field.visible
                                ? 'opacity-35 cursor-not-allowed text-gray-400 bg-transparent'
                                : field.searchable
                                ? 'bg-emerald-600 text-white shadow-xs cursor-pointer'
                                : 'text-gray-500 hover:text-gray-800 cursor-pointer'
                            }`}
                          >
                            <Check className="w-3 h-3" /> Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSearch(field.key, false)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                              !field.searchable
                                ? 'bg-gray-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-800'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      </td>

                      {/* Field Order input */}
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={field.order || ''}
                          onChange={(e) => handleOrderChange(field.key, e.target.value)}
                          className="w-16 px-2.5 py-1 text-center text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg shadow-2xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          title="Display order number"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetToInitial}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Resort to initial default values"
            >
              <RotateCcw className="w-4 h-4 text-gray-500" />
              Reset
            </button>

            {/* System Fields Button */}
            <button
              type="button"
              onClick={() => setShowSystemFields((prev) => !prev)}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all border shadow-2xs cursor-pointer disabled:opacity-50 ${
                showSystemFields
                  ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200 ring-2 ring-purple-400/30 font-semibold'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
              title={showSystemFields ? 'Hide system fields' : 'Add sys_ prefixed fields to the list'}
            >
              <Database className="w-4 h-4 text-purple-600" />
              System Fields
              {showSystemFields && (
                <span className="ml-0.5 text-2xs bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-bold">
                  Active
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
