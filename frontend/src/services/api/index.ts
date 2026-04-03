import type { Transaction, Category, MappingRule } from '../../types';

// API Configuration. Assumes proxy is setup in Vite or same-origin deployment.
const API_BASE = '/api'; 

export const api = {
  // --- Transactions ---
  getTransactions: async (params?: Record<string, any>): Promise<Transaction[]> => {
    let url = `${API_BASE}/transactions`;
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
         if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
      });
      const qs = q.toString();
      if (qs) url += `?${qs}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch transactions');
    const json = await response.json();
    return json.data || json;
  },
  updateTransaction: async (id: string, updates: Partial<Transaction>): Promise<Transaction> => {
    const response = await fetch(`${API_BASE}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update transaction');
    return response.json();
  },

  // --- Categories ---
  getCategories: async (): Promise<Category[]> => {
    const response = await fetch(`${API_BASE}/categories`);
    if (!response.ok) throw new Error('Failed to fetch categories');
    const json = await response.json();
    return json.data || json;
  },
  createCategory: async (data: Partial<Category>): Promise<Category> => {
    const response = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create category');
    return response.json();
  },

  // --- Mappings ---
  getMappings: async (): Promise<MappingRule[]> => {
    const response = await fetch(`${API_BASE}/mappings`);
    if (!response.ok) throw new Error('Failed to fetch mappings');
    const json = await response.json();
    return json.data || json;
  },
  createMapping: async (data: Partial<MappingRule>): Promise<MappingRule> => {
    const response = await fetch(`${API_BASE}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create mapping');
    return response.json();
  },

  // --- Rules Engine ---
  executeRules: async (sourceId?: number, ruleId?: number) => {
    const response = await fetch(`${API_BASE}/rules/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, ruleId }),
    });
    if (!response.ok) throw new Error('Failed to execute rules');
    return response.json();
  },
  deleteRule: async (id: number) => {
    const response = await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete rule');
    return response.json();
  },

  // --- ETL Jobs (Admin) ---
  runEtlJob: async (sourceId?: number) => {
    const response = await fetch(`${API_BASE}/etl/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId }),
    });
    if (!response.ok) throw new Error('Failed to run ETL Job');
    return response.json();
  },
  getEtlJobs: async () => {
    const response = await fetch(`${API_BASE}/etl/jobs`);
    if (!response.ok) throw new Error('Failed to fetch ETL Jobs');
    return response.json();
  },
  getEtlJob: async (id: number) => {
    const response = await fetch(`${API_BASE}/etl/jobs/${id}`);
    if (!response.ok) throw new Error('Failed to fetch ETL Job details');
    return response.json();
  },

  // --- Data Sources (Admin) ---
  getSources: async () => {
    const response = await fetch(`${API_BASE}/sources`);
    if (!response.ok) throw new Error('Failed to fetch Data Sources');
    return response.json();
  },
  createSource: async (data: any) => {
    const response = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create source');
    return response.json();
  },
  setupSource: async (data: { name: string, config: any, mappings: any[] }) => {
    const response = await fetch(`${API_BASE}/sources/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to setup source: ${err}`);
    }
    return response.json();
  },
  getSourceMappings: async (id: number) => {
    const response = await fetch(`${API_BASE}/sources/${id}/mappings`);
    if (!response.ok) throw new Error('Failed to fetch source mappings');
    return response.json();
  },
  updateSourceMappings: async (id: number, data: { name: string, mappings: any[] }) => {
    const response = await fetch(`${API_BASE}/sources/${id}/mappings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to update source mappings: ${err}`);
    }
    return response.json();
  },
  updateSource: async (id: number, data: any) => {
    const response = await fetch(`${API_BASE}/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update source');
    return response.json();
  },

  // --- Configuration (Admin) ---
  getConfig: async () => {
    const response = await fetch(`${API_BASE}/config`);
    if (!response.ok) throw new Error('Failed to fetch Config');
    return response.json();
  },
  updateConfig: async (data: any) => {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update Config');
    return response.json();
  },

  // --- Rule Testing (Admin) ---
  testMappingRule: async (description: string, amount: number = 0) => {
    const response = await fetch(`${API_BASE}/rules/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount }),
    });
    if (!response.ok) throw new Error('Failed to test mapping rule');
    return response.json();
  },

  // --- System Data (Generic CRUD over config/:table) ---
  getSystemData: async (table: string) => {
    const response = await fetch(`${API_BASE}/config/${table}`);
    if (!response.ok) throw new Error(`Failed to fetch ${table}`);
    return response.json();
  },
  createSystemData: async (table: string, data: any) => {
    const response = await fetch(`${API_BASE}/config/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to create in ${table}`);
    return response.json();
  },
  updateSystemData: async (table: string, idField: string, idValue: string | number, data: any) => {
    const response = await fetch(`${API_BASE}/config/${table}/${idField}/${idValue}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`Failed to update in ${table}`);
    return response.json();
  },
  deleteSystemData: async (table: string, idField: string, idValue: string | number) => {
    const response = await fetch(`${API_BASE}/config/${table}/${idField}/${idValue}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to delete from ${table}`);
    return response.json();
  },

  // --- ETL Data Import ---
  importData: async (sourceId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/etl/import/${sourceId}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ETL Engine Extraction Fault: ${errText}`);
    }
    return response.json();
  },
  // --- Raw Staging Schema Extractions ---
  getStagingTables: async () => {
    const response = await fetch(`${API_BASE}/config/meta/staging-tables`);
    if (!response.ok) throw new Error('Failed to fetch staging tables');
    return response.json();
  },
  getStagingSchema: async (tableName: string) => {
    const response = await fetch(`${API_BASE}/config/meta/schema/${tableName}`);
    if (!response.ok) throw new Error(`Failed to fetch schema for ${tableName}`);
    return response.json();
  }
};
