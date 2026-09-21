import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import type {
  AnalyticsExecuteResult,
  AnalyticsReportRecord,
} from '@/types/analytics.types';

export interface AnalyticsCatalogField {
  key: string;
  label: string;
  type: string;
  filterable?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface AnalyticsCatalogJoinTarget {
  relationshipKey: string;
  targetModule: string;
  joinType: string;
  requiresJoin?: string | null;
  label?: string;
  joinable?: boolean;
}

export interface AnalyticsCatalogModule {
  moduleKey: string;
  appKey: string;
  label: string;
  collection?: string | null;
  defaultFields: string[];
  reportable?: boolean;
  scope?: string | null;
  fields?: AnalyticsCatalogField[];
  joinTargets?: AnalyticsCatalogJoinTarget[];
}

export interface AnalyticsReportListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function useAnalyticsReports() {
  const reports = ref<AnalyticsReportRecord[]>([]);
  const report = ref<AnalyticsReportRecord | null>(null);
  const catalogModules = ref<AnalyticsCatalogModule[]>([]);
  const previewResult = ref<AnalyticsExecuteResult | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const executing = ref(false);
  const listMeta = ref<AnalyticsReportListMeta | null>(null);

  async function fetchCatalog() {
    const response = await apiClient.get('/analytics/catalog', { cache: 'no-store' });
    if (response?.success) {
      catalogModules.value = response.data?.modules ?? [];
    }
    return response;
  }

  async function fetchReports(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/reports', {
        params,
        cache: 'no-store',
      });
      if (response?.success) {
        reports.value = response.data ?? [];
        listMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchReport(id: string, options: { silent?: boolean } = {}) {
    if (!options.silent) {
      loading.value = true;
    }
    try {
      const response = await apiClient.get(`/analytics/reports/${id}`, { cache: 'no-store' });
      if (response?.success) {
        report.value = response.data;
      }
      return response;
    } finally {
      if (!options.silent) {
        loading.value = false;
      }
    }
  }

  async function createReport(payload: Partial<AnalyticsReportRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.post('/analytics/reports', payload);
      if (response?.success) {
        report.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function updateReport(id: string, payload: Partial<AnalyticsReportRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.put(`/analytics/reports/${id}`, payload);
      if (response?.success) {
        report.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function publishReport(id: string) {
    saving.value = true;
    try {
      return await apiClient.post(`/analytics/reports/${id}/publish`, {});
    } finally {
      saving.value = false;
    }
  }

  async function executeReport(id: string, body: Record<string, unknown> = {}) {
    executing.value = true;
    try {
      return await apiClient.post(`/analytics/reports/${id}/execute`, body);
    } finally {
      executing.value = false;
    }
  }

  async function previewReport(body: Record<string, unknown>) {
    executing.value = true;
    try {
      const response = await apiClient.post('/analytics/reports/preview', body);
      if (response?.success) {
        previewResult.value = response.data;
      }
      return response;
    } finally {
      executing.value = false;
    }
  }

  async function previewMatrixDrill(body: Record<string, unknown>) {
    return apiClient.post('/analytics/reports/preview', body);
  }

  async function deleteReport(id: string) {
    return apiClient.delete(`/analytics/reports/${id}`);
  }

  async function exportReport(id: string, format: 'csv' | 'xlsx' | 'pdf' = 'csv', body: Record<string, unknown> = {}) {
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    if (!token) {
      throw new Error('Not authenticated');
    }
    const url = getApiUrlForFetch(`/analytics/reports/${id}/export`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, format }),
    });
    if (!response.ok) {
      throw new Error('Export failed');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `report-${id}.${format}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /** @deprecated use exportReport */
  async function exportReportCsv(id: string, body: Record<string, unknown> = {}) {
    return exportReport(id, 'csv', body);
  }

  async function duplicateReport(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/reports/${id}/duplicate`, {});
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function certifyReport(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/reports/${id}/certify`, {});
      if (response?.success) {
        report.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function uncertifyReport(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/reports/${id}/uncertify`, {});
      if (response?.success) {
        report.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function archiveReport(id: string) {
    return deleteReport(id);
  }

  return {
    reports,
    report,
    catalogModules,
    previewResult,
    loading,
    saving,
    executing,
    listMeta,
    fetchCatalog,
    fetchReports,
    fetchReport,
    createReport,
    updateReport,
    publishReport,
    executeReport,
    previewReport,
    previewMatrixDrill,
    deleteReport,
    duplicateReport,
    archiveReport,
    exportReport,
    exportReportCsv,
    certifyReport,
    uncertifyReport,
  };
}
