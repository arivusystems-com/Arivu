<template>
  <div class="mx-auto w-full">
    <CampaignTenantSendStats class="px-6 pt-6" />

    <ModuleList
      ref="moduleListRef"
      module-key="campaigns"
      app-key="MARKETING"
      @create="goToCreate"
      @row-click="openCampaign"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <template #header-actions>
        <div class="flex gap-3 items-center">
          <router-link
            v-if="canView"
            :to="{ name: 'marketing-campaign-approvals' }"
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {{ t('marketing.campaignsApprovalsNav') }}
          </router-link>
          <ModuleActions
            module="campaigns"
            :create-label="t('marketing.campaignsNew')"
            :show-import="false"
            :show-export="false"
            @create="goToCreate"
          />
        </div>
      </template>

      <template #cell-name="{ row }">
        <div class="min-w-0">
          <p class="truncate font-semibold text-gray-900 dark:text-white">
            {{ row.name }}
          </p>
          <p v-if="row.subject" class="truncate text-sm text-gray-500 dark:text-gray-400">
            {{ row.subject }}
          </p>
        </div>
      </template>

      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant="statusVariantMap[value] || 'default'"
        />
      </template>

      <template #cell-recipientCount="{ row }">
        <span class="tabular-nums">{{ row.stats?.totalRecipients ?? 0 }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>
    </ModuleList>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ModuleList from '@/components/module-list/ModuleList.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CampaignTenantSendStats from '@/components/marketing/CampaignTenantSendStats.vue';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { captureMarketingModuleVisited } from '@/config/posthogMarketing';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();
const { deleteCampaign } = useMarketingCampaigns();

const moduleListRef = ref(null);

const canView = computed(() => authStore.can('campaigns', 'view'));

const CAMPAIGN_DELETABLE_STATUSES = new Set(['draft', 'completed', 'cancelled', 'failed', 'archived']);

const statusVariantMap = {
  draft: 'warning',
  scheduled: 'info',
  running: 'primary',
  paused: 'default',
  completed: 'success',
  cancelled: 'default',
  archived: 'default',
  failed: 'danger'
};

const statusLabelKeys = {
  draft: 'marketing.campaignsStatusDraft',
  scheduled: 'marketing.campaignsStatusScheduled',
  running: 'marketing.campaignsStatusRunning',
  paused: 'marketing.campaignsStatusPaused',
  completed: 'marketing.campaignsStatusCompleted',
  cancelled: 'marketing.campaignsStatusCancelled',
  archived: 'marketing.campaignsStatusArchived',
  failed: 'marketing.campaignsStatusFailed'
};

function formatStatus(value) {
  const key = statusLabelKeys[value];
  return key ? t(key) : String(value || 'draft');
}

function refreshList() {
  moduleListRef.value?.refresh?.();
}

function goToCreate() {
  router.push({ name: 'marketing-campaign-new' });
}

function openCampaign(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'marketing-campaign-detail', params: { id } });
}

function canDeleteCampaignRow(row) {
  return CAMPAIGN_DELETABLE_STATUSES.has(String(row?.status || ''));
}

async function handleDelete(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  if (!canDeleteCampaignRow(row)) {
    notifications.error(t('marketing.campaignsDeleteNotAllowed'));
    return;
  }
  try {
    await deleteCampaign(id);
    notifications.success(t('marketing.campaignsDeleteSuccess'));
    refreshList();
  } catch (error) {
    notifications.error(error?.message || t('states.genericFailure'));
  }
}

function resolveBulkDeleteIds(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((row) => row?._id || row?.id).filter(Boolean);
  }
  if (Array.isArray(payload.selectedIds) && payload.selectedIds.length) {
    return payload.selectedIds;
  }
  return [];
}

async function handleBulkAction(actionId, payload) {
  if (actionId !== 'bulk-delete' && actionId !== 'delete') return;
  const ids = resolveBulkDeleteIds(payload);
  if (!ids.length) return;

  const rowsById = new Map(
    (moduleListRef.value?.getCurrentRows?.() || []).map((row) => [String(row?._id || row?.id || ''), row])
  );
  const blocked = ids.filter((id) => !canDeleteCampaignRow(rowsById.get(String(id)) || {}));
  if (blocked.length > 0) {
    notifications.error(t('marketing.campaignsDeleteNotAllowed'));
    return;
  }

  try {
    const results = await Promise.allSettled(ids.map((id) => deleteCampaign(id)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      notifications.error(t('states.genericFailure'));
    } else {
      notifications.success(t('marketing.campaignsDeleteSuccess'));
    }
    refreshList();
  } catch (error) {
    notifications.error(error?.message || t('states.genericFailure'));
  }
}

onMounted(() => {
  captureMarketingModuleVisited('campaigns', {
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
});
</script>
