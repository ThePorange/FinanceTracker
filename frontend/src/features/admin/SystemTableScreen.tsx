import { useParams } from 'react-router-dom';
import { SaaSDatagrid } from '../../components/shared/SaaSDatagrid';
import type { GridColumn } from '../../components/shared/SaaSDatagrid';
import { useSystemData, useCreateSystemData, useUpdateSystemData, useDeleteSystemData } from './useSystemData';
import { TableProperties } from 'lucide-react';

const TABLE_SCHEMAS: Record<string, { pk: string, canCreate: boolean, canEdit: boolean, canDelete: boolean, columns: GridColumn[] }> = {
  'sys_import_log': { pk: 'sys_import_log_id', canCreate: false, canEdit: false, canDelete: true, columns: [
    { key: 'sys_import_log_id', label: 'sys_import_log_id', editable: false },
    { key: 'account_source_name', label: 'Source name', editable: false },
    { key: 'account_source_filename', label: 'account_source_filename', editable: false },
    { key: 'account_source_filename_checksum', label: 'account_source_filename_checksum', editable: false },
    { key: 'account_source_unique_checksum', label: 'account_source_unique_checksum', editable: false },
    { key: 'account_source_row_count', label: 'account_source_row_count', editable: false },
    { key: 'import_log_json', label: 'import_log_json', editable: false },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_transaction_type': { pk: 'sys_transaction_type_id', canCreate: false, canEdit: false, canDelete: false, columns: [
    { key: 'sys_transaction_type_id', label: 'sys_transaction_type_id', editable: false },
    { key: 'transaction_type', label: 'transaction_type', editable: false },
    { key: 'sys_account_source_id', label: 'sys_account_source_id', editable: false },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_transaction_category': { pk: 'sys_transaction_category_id', canCreate: false, canEdit: true, canDelete: false, columns: [
    { key: 'sys_transaction_category_id', label: 'sys_transaction_category_id', editable: false },
    { key: 'category_name', label: 'category_name', editable: true },
    { key: 'sys_account_source_id', label: 'sys_account_source_id', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_rules': { pk: 'sys_rules_id', canCreate: true, canEdit: true, canDelete: true, columns: [
    { key: 'sys_rules_id', label: 'sys_rules_id', editable: false },
    { key: 'rule_name', label: 'rule_name', editable: true },
    { key: 'rule_json', label: 'rule_json', editable: true },
    { key: 'sys_transaction_category_id', label: 'sys_transaction_category_id', editable: true },
    { key: 'sys_account_source_id', label: 'sys_account_source_id', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_currency': { pk: 'sys_currency_id', canCreate: true, canEdit: true, canDelete: true, columns: [
    { key: 'sys_currency_id', label: 'sys_currency_id', editable: false },
    { key: 'currency_code', label: 'currency_code', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_currency_pair': { pk: 'sys_currency_pair_id', canCreate: true, canEdit: false, canDelete: true, columns: [
    { key: 'sys_currency_pair_id', label: 'sys_currency_pair_id', editable: false },
    { key: 'from_ccy_id', label: 'from_ccy_id', editable: true },
    { key: 'to_ccy_id', label: 'to_ccy_id', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_fx_rate': { pk: 'sys_fx_rate_id', canCreate: true, canEdit: true, canDelete: true, columns: [
    { key: 'sys_fx_rate_id', label: 'sys_fx_rate_id', editable: false },
    { key: 'sys_currency_pair_id', label: 'sys_currency_pair_id', editable: true },
    { key: 'business_date', label: 'business_date', editable: true },
    { key: 'fx_rate', label: 'fx_rate', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_config': { pk: 'sys_config_id', canCreate: true, canEdit: true, canDelete: true, columns: [
    { key: 'sys_config_id', label: 'sys_config_id', editable: false },
    { key: 'config_key', label: 'config_key', editable: true },
    { key: 'config_value', label: 'config_value', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]},
  'sys_staging_fields': { pk: 'sys_staging_fields_id', canCreate: true, canEdit: true, canDelete: true, columns: [
    { key: 'sys_staging_fields_id', label: 'sys_staging_fields_id', editable: false },
    { key: 'staging_table_fieldname', label: 'staging_table_fieldname', editable: true },
    { key: 'datatype', label: 'datatype', editable: true },
    { key: 'default_value', label: 'default_value', editable: true },
    { key: 'derived_field', label: 'derived_field', editable: true },
    { key: 'unique_records', label: 'unique_records', editable: true },
    { key: 'created_date', label: 'created_date', editable: false },
  ]}
};

export function SystemTableScreen() {
  const { tableName } = useParams<{ tableName: string }>();
  const activeTable = tableName || 'sys_config';
  
  const schema = TABLE_SCHEMAS[activeTable] || { pk: 'id', canCreate: false, canEdit: false, canDelete: false, columns: [{ key: 'id', label: 'Unmapped Entity ID', editable: false }] };
  
  const { data, isLoading } = useSystemData(activeTable);
  const createMutation = useCreateSystemData(activeTable);
  const updateMutation = useUpdateSystemData(activeTable, schema.pk);
  const deleteMutation = useDeleteSystemData(activeTable, schema.pk);

  const handleSave = async (row: any, isNew: boolean) => {
    const payload = { ...row };
    delete payload._isDirty;
    if (isNew) {
      delete payload[schema.pk];
      delete payload.created_date;
    } else {
      delete payload.created_date;
    }
    
    if (isNew) {
      await createMutation.mutateAsync(payload);
    } else {
      await updateMutation.mutateAsync({ id: row[schema.pk], data: payload });
    }
  };

  const handleDelete = async (id: any) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="p-8 max-w-[100rem] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-4">
            <TableProperties className="text-blue-500 bg-blue-50 p-1.5 rounded-lg" size={36} />
            <span className="font-mono">{activeTable}</span> Data Arrays
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Direct universal spreadsheet management securely binding onto structural core backend configurations natively respecting permissions matrices.</p>
        </div>
      </div>

      <SaaSDatagrid 
        data={data?.data || []}
        columns={schema.columns}
        pk={schema.pk}
        canCreate={schema.canCreate}
        canEdit={schema.canEdit}
        canDelete={schema.canDelete}
        isLoading={isLoading}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
