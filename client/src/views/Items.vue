<template>
  <div class="mx-auto w-full">
    <!-- Registry-Driven ModuleList -->
    <ModuleList
      ref="moduleListRef"
      module-key="items"
      app-key="PLATFORM"
      @create="openCreateModal"
      @export="exportItems"
      @row-click="handleRowClick"
      @edit="editItemFromList"
      @delete="handleInlineDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Item Name Cell -->
      <template #cell-item_name="{ row }">
        <div class="flex items-center gap-3">
          <div v-if="itemListThumbnail(row)" class="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            <img :src="itemListThumbnail(row)" :alt="row.item_name" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span class="text-white font-semibold text-sm">{{ getInitials(row.item_name) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="min-w-0 font-semibold text-gray-900 dark:text-white truncate">
              {{ row.item_name }}
            </div>
            <div v-if="row.item_code" class="min-w-0 text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ row.item_code }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Item Type Cell with Badge -->
      <template #cell-item_type="{ value }">
        <BadgeCell
          :value="value"
          :color="resolveItemTypeColor(value)"
        />
      </template>

      <!-- Custom Lifecycle State Cell with Badge -->
      <template #cell-lifecycle_state="{ value, row }">
        <BadgeCell
          :value="resolveLifecycleLabel(value, row)"
          :variant="resolveLifecycleVariant(value, row)"
        />
      </template>

      <!-- Legacy status cell (hidden from default columns; kept for saved views) -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Active': 'success',
            'Inactive': 'default'
          }"
        />
      </template>

      <!-- Custom Category Cell -->
      <template #cell-category="{ value }">
        <span v-if="value" class="text-sm text-gray-700 dark:text-gray-300">{{ value }}</span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Selling Price Cell — org default currency (same as record page) -->
      <template #cell-selling_price="{ value }">
        <span v-if="value != null && value !== ''" class="text-sm font-medium text-gray-900 dark:text-white">
          {{ formatCurrency(value) }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Vendor Cell -->
      <template #cell-vendor="{ row }">
        <span v-if="row.vendor" class="text-sm text-gray-700 dark:text-gray-300">
          {{ typeof row.vendor === 'object' ? row.vendor.name : row.vendor }}
        </span>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Tags Cell -->
      <template #cell-tags="{ value }">
        <div v-if="value && value.length > 0" class="flex flex-wrap gap-1">
          <span 
            v-for="tag in value.slice(0, 2)" 
            :key="tag"
            class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
          >
            {{ tag }}
          </span>
          <span v-if="value.length > 2" class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
            +{{ value.length - 2 }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Created Date Cell -->
      <template #cell-createdAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

    </ModuleList>

    <!-- Item Form Modal -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="items"
      :record="editingItem"
      @close="closeFormModal"
      @saved="handleItemSave"
    />

  </div>
</template>

<script setup>
defineOptions({ name: 'ItemsView' });
import { useI18n } from 'vue-i18n';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();

import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import { formatCurrencyValue, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import {
  CATALOG_LIFECYCLE_LABEL_KEYS,
  inferLifecycleStateFromLegacyStatus
} from '@/constants/catalogLifecycle';
import { getSemanticPicklistColor } from '@/utils/picklistColorPalette';

const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

function resolveItemTypeColor(value) {
  return getSemanticPicklistColor('item_type', value, 'items') || null;
}

// State
const moduleListRef = ref(null);
const showFormModal = ref(false);
const editingItem = ref(null);

const refreshList = () => {
  if (moduleListRef.value?.refreshAfterImport) {
    void moduleListRef.value.refreshAfterImport();
  } else {
    moduleListRef.value?.refresh?.();
  }
};

// Modal handlers
const openCreateModal = () => {
  editingItem.value = null;
  showFormModal.value = true;
};

const editItemFromList = (row) => {
  if (!row) return;
  editingItem.value = row;
  showFormModal.value = true;
};

const handleRowClick = (row) => {
  // Navigate to item detail if route exists
  openTab(`/items/${row._id}`, {
    title: row.item_name || 'Item Detail',
    icon: 'cube',
    background: false,
    insertAdjacent: true
  });
};

const handleBulkAction = async (actionId, selectedRows) => {
  const itemIds = selectedRows.map(item => item._id);
  
  try {
    if (actionId === 'delete' || actionId === 'bulk-delete') {
      await Promise.all(itemIds.map(id => 
        apiClient(`/items/${id}`, { method: 'DELETE' })
      ));
      refreshList();
    } else if (actionId === 'export' || actionId === 'bulk-export') {
      exportItemsToCSV(selectedRows);
    }
  } catch (error) {
    console.error('Error performing bulk action:', error);
    notifications.error('Error performing bulk action. Please try again.');
  }
};

const handleInlineDelete = async (row) => {
  if (!row) return;
  await handleBulkAction('delete', [row]);
};

// Export items
const exportItems = async () => {
  try {
    const response = await fetch('/api/csv/export/items', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `items_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting items:', error);
    notifications.error('Error exporting items. Please try again.');
  }
};

const exportItemsToCSV = (itemsToExport) => {
  const csv = [
    ['Item Name', 'Item Code', 'Item Type', 'Category', 'Lifecycle', 'Selling Price', 'Cost Price', 'Vendor'].join(','),
    ...itemsToExport.map(item => [
      `"${item.item_name || ''}"`,
      item.item_code || '',
      item.item_type || '',
      item.category || '',
      item.lifecycle_state || item.status || '',
      item.selling_price || 0,
      item.cost_price || 0,
      typeof item.vendor === 'object' ? item.vendor?.name || '' : item.vendor || ''
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `items-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

const handleItemSave = () => {
  showFormModal.value = false;
  editingItem.value = null;
  refreshList();
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingItem.value = null;
};

// Utility functions — catalog prices use tenant default, not per-row legacy currency
const formatCurrency = (amount) => {
  return (
    formatCurrencyValue(amount, {
      currencyCode: resolveOrgCurrencyCode(authStore.organization),
      orgCurrency: authStore.organization,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) || '—'
  );
};

const getInitials = (name) => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

/** List thumbnail: legacy product_image or primary gallery entry. */
function itemListThumbnail(row) {
  if (!row) return '';
  if (row.product_image) return row.product_image;
  const media = Array.isArray(row.media) ? row.media : [];
  const primary = media.find((m) => m.isPrimary && m.kind === 'image') || media.find((m) => m.kind === 'image');
  return primary?.url || '';
}

const resolveLifecycleLabel = (value, row) => {
  const state = value || inferLifecycleStateFromLegacyStatus(row?.status, row?.lifecycle_state);
  const labelKey = CATALOG_LIFECYCLE_LABEL_KEYS[state];
  return labelKey ? t(labelKey) : state;
};

const resolveLifecycleVariant = (value, row) => {
  const state = value || inferLifecycleStateFromLegacyStatus(row?.status, row?.lifecycle_state);
  const variants = {
    Draft: 'default',
    Active: 'success',
    Discontinued: 'warning',
    Archived: 'default'
  };
  return variants[state] || 'default';
};
</script>

