<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 overflow-y-auto"
      @keydown.esc="close"
    >
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm"
        @click="close"
      />

      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('settings.usersImportTitle') }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {{ t('settings.usersImportSubtitle') }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('common.closePanel')"
              @click="close"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="border-b border-gray-100 px-6 py-3 dark:border-gray-700/80">
            <ol class="flex items-center gap-2 text-xs font-medium">
              <li
                v-for="(step, idx) in steps"
                :key="step.id"
                class="flex items-center gap-2"
                :class="idx <= stepIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'"
              >
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                  :class="idx < stepIndex
                    ? 'bg-indigo-600 text-white'
                    : idx === stepIndex
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700'"
                >
                  {{ idx + 1 }}
                </span>
                <span class="hidden sm:inline">{{ step.label }}</span>
                <span
                  v-if="idx < steps.length - 1"
                  class="mx-1 text-gray-300"
                >/</span>
              </li>
            </ol>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <p
              v-if="error"
              class="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {{ error }}
            </p>

            <!-- Step: Upload -->
            <div
              v-if="stepIndex === 0"
              class="space-y-5"
            >
              <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                <p>{{ t('settings.usersImportHelp') }}</p>
                <button
                  type="button"
                  class="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  @click="downloadTemplate"
                >
                  {{ t('settings.usersImportDownloadTemplate') }}
                </button>
              </div>

              <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('settings.usersImportCsvLabel') }} <span class="text-red-500">*</span>
                </label>
                <input
                  ref="fileInputEl"
                  type="file"
                  accept=".csv,text/csv"
                  class="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-gray-300 dark:file:bg-indigo-900/40 dark:file:text-indigo-300"
                  @change="onFileSelected"
                >
                <p
                  v-if="fileName"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ fileName }}
                </p>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('settings.inviteRole') }} <span class="text-red-500">*</span>
                  </label>
                  <HeadlessSelect
                    v-model="defaultRoleId"
                    :options="roleSelectOptions"
                  />
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.usersImportDefaultRoleHint') }}
                  </p>
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('settings.inviteBusinessHours') }} <span class="text-red-500">*</span>
                  </label>
                  <HeadlessSelect
                    v-model="businessHourSetId"
                    :options="businessHoursSelectOptions"
                  />
                </div>
              </div>

              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  v-model="sendEmail"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                >
                {{ t('settings.inviteSendEmail') }}
              </label>
            </div>

            <!-- Step: Preview -->
            <div
              v-else-if="stepIndex === 1"
              class="space-y-4"
            >
              <div
                v-if="previewSummary"
                class="flex flex-wrap gap-2 text-xs"
              >
                <span class="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  {{ t('settings.usersImportSummaryTotal', { count: previewSummary.total }) }}
                </span>
                <span class="rounded-full bg-green-50 px-2.5 py-1 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {{ t('settings.usersImportSummaryValid', { count: previewSummary.valid }) }}
                </span>
                <span
                  v-if="previewSummary.invalid"
                  class="rounded-full bg-red-50 px-2.5 py-1 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                >
                  {{ t('settings.usersImportSummaryInvalid', { count: previewSummary.invalid }) }}
                </span>
                <span
                  v-if="previewSummary.alreadyMember"
                  class="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  {{ t('settings.usersImportSummaryAlreadyMember', { count: previewSummary.alreadyMember }) }}
                </span>
                <span
                  v-if="previewSummary.duplicateInFile"
                  class="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  {{ t('settings.usersImportSummaryDuplicate', { count: previewSummary.duplicateInFile }) }}
                </span>
              </div>

              <div
                v-if="seatWarnings.length"
                class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
              >
                <p class="font-medium">{{ t('settings.usersImportSeatWarningTitle') }}</p>
                <ul class="mt-1 list-inside list-disc space-y-0.5">
                  <li
                    v-for="(w, idx) in seatWarnings"
                    :key="idx"
                  >
                    {{ w.message }}
                  </li>
                </ul>
              </div>

              <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColRow') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.inviteEmail') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.inviteRole') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColStatus') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColMessage') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr
                      v-for="row in previewRows"
                      :key="`${row.rowNumber}-${row.email}`"
                    >
                      <td class="px-3 py-2 text-gray-500">{{ row.rowNumber }}</td>
                      <td class="px-3 py-2 text-gray-900 dark:text-white">{{ row.email }}</td>
                      <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ row.roleName || '—' }}</td>
                      <td class="px-3 py-2">
                        <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
                      </td>
                      <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ row.message || '' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Step: Results -->
            <div
              v-else
              class="space-y-4"
            >
              <div
                v-if="commitSummary"
                class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
              >
                {{ t('settings.usersImportCommitSummary', {
                  invited: commitSummary.invited,
                  failed: commitSummary.failed,
                  skipped: commitSummary.skipped
                }) }}
              </div>

              <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColRow') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.inviteEmail') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColStatus') }}</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-500">{{ t('settings.usersImportColMessage') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr
                      v-for="row in commitRows"
                      :key="`${row.rowNumber}-${row.email}`"
                    >
                      <td class="px-3 py-2 text-gray-500">{{ row.rowNumber }}</td>
                      <td class="px-3 py-2 text-gray-900 dark:text-white">{{ row.email }}</td>
                      <td class="px-3 py-2">
                        <span :class="statusBadgeClass(row.status)">{{ statusLabel(row.status) }}</span>
                      </td>
                      <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ row.message || '' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              type="button"
              class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="close"
            >
              {{ stepIndex === 2 ? t('actions.close') : t('actions.cancel') }}
            </button>
            <button
              v-if="stepIndex === 0"
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              :disabled="previewing || !csvText || !defaultRoleId || !businessHourSetId"
              @click="runPreview"
            >
              {{ previewing ? t('settings.usersImportPreviewing') : t('settings.usersImportPreview') }}
            </button>
            <template v-else-if="stepIndex === 1">
              <button
                type="button"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                :disabled="committing"
                @click="stepIndex = 0"
              >
                {{ t('actions.back') }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                :disabled="committing || !canCommit"
                @click="runCommit"
              >
                {{ committing ? t('settings.usersImportInviting') : t('settings.usersImportConfirm') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'imported']);

const { t } = useI18n();
const { fetchSets } = useBusinessHours();
const { success: notifySuccess, error: notifyError } = useNotifications();

const stepIndex = ref(0);
const error = ref('');
const csvText = ref('');
const fileName = ref('');
const fileInputEl = ref(null);
const defaultRoleId = ref('');
const businessHourSetId = ref('');
const sendEmail = ref(true);
const roles = ref([]);
const businessHourSets = ref([]);
const previewing = ref(false);
const committing = ref(false);
const previewRows = ref([]);
const previewSummary = ref(null);
const seatWarnings = ref([]);
const commitRows = ref([]);
const commitSummary = ref(null);

const steps = computed(() => [
  { id: 'upload', label: t('settings.usersImportStepUpload') },
  { id: 'preview', label: t('settings.usersImportStepPreview') },
  { id: 'done', label: t('settings.usersImportStepDone') }
]);

const roleSelectOptions = computed(() => [
  { value: '', label: t('settings.inviteSelectRole') },
  ...roles.value.map((role) => ({
    value: role._id,
    label: role.name
  }))
]);

const businessHoursSelectOptions = computed(() => [
  { value: '', label: t('settings.inviteSelectBusinessHours') },
  ...businessHourSets.value.map((set) => ({
    value: set._id,
    label: set.name
  }))
]);

const canCommit = computed(() => {
  if (!previewSummary.value) return false;
  if (seatWarnings.value.length) return false;
  return previewSummary.value.valid > 0;
});

const CSV_TEMPLATE = 'email,firstName,lastName,role\njane.doe@example.com,Jane,Doe,Standard\n';

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arivu-user-invite-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function onFileSelected(event) {
  error.value = '';
  const file = event.target?.files?.[0];
  if (!file) {
    csvText.value = '';
    fileName.value = '';
    return;
  }
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => {
    csvText.value = String(reader.result || '');
  };
  reader.onerror = () => {
    error.value = t('settings.usersImportFileReadError');
    csvText.value = '';
  };
  reader.readAsText(file);
}

function statusLabel(status) {
  const key = {
    valid: 'settings.usersImportStatusValid',
    reinvite: 'settings.usersImportStatusReinvite',
    invalid: 'settings.usersImportStatusInvalid',
    duplicate_in_file: 'settings.usersImportStatusDuplicate',
    already_member: 'settings.usersImportStatusAlreadyMember',
    invited: 'settings.usersImportStatusInvited',
    failed: 'settings.usersImportStatusFailed',
    skipped: 'settings.usersImportStatusSkipped'
  }[status];
  return key ? t(key) : status;
}

function statusBadgeClass(status) {
  const base = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium';
  if (status === 'valid' || status === 'invited' || status === 'reinvite') {
    return `${base} bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
  }
  if (status === 'failed' || status === 'invalid') {
    return `${base} bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
  }
  return `${base} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`;
}

async function loadOptions() {
  try {
    const [rolesRes, sets] = await Promise.all([
      apiClient.get('/roles'),
      fetchSets()
    ]);
    roles.value = Array.isArray(rolesRes?.data)
      ? rolesRes.data.filter((r) => r.isActive !== false && r.userType !== 'EXTERNAL')
      : [];
    businessHourSets.value = Array.isArray(sets)
      ? sets.filter((s) => s.status !== 'inactive')
      : [];
    if (!defaultRoleId.value) {
      const preferred = roles.value.find((r) => /standard/i.test(r.name)) || roles.value[0];
      if (preferred?._id) defaultRoleId.value = preferred._id;
    }
    if (!businessHourSetId.value) {
      const defaultSet = businessHourSets.value.find((s) => s.isDefault) || businessHourSets.value[0];
      if (defaultSet?._id) businessHourSetId.value = defaultSet._id;
    }
  } catch (err) {
    console.error('User import options load failed:', err);
  }
}

async function runPreview() {
  error.value = '';
  if (!csvText.value || !defaultRoleId.value || !businessHourSetId.value) {
    error.value = t('settings.usersImportMissingFields');
    return;
  }
  previewing.value = true;
  try {
    const response = await apiClient.post('/users/bulk-invite/preview', {
      csvText: csvText.value,
      businessHourSetId: businessHourSetId.value,
      defaultRoleId: defaultRoleId.value
    });
    if (!response.success) {
      error.value = response.message || t('settings.usersImportPreviewFailed');
      return;
    }
    previewRows.value = response.data?.rows || [];
    previewSummary.value = response.data?.summary || null;
    seatWarnings.value = response.data?.seatWarnings || [];
    stepIndex.value = 1;
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('settings.usersImportPreviewFailed');
  } finally {
    previewing.value = false;
  }
}

async function runCommit() {
  error.value = '';
  if (!canCommit.value) {
    error.value = t('settings.usersImportCannotCommit');
    return;
  }
  committing.value = true;
  try {
    const response = await apiClient.post('/users/bulk-invite', {
      csvText: csvText.value,
      businessHourSetId: businessHourSetId.value,
      defaultRoleId: defaultRoleId.value,
      sendEmail: sendEmail.value
    });
    if (!response.success) {
      error.value = response.message || t('settings.usersImportCommitFailed');
      if (response.data?.rows) {
        previewRows.value = response.data.rows;
        previewSummary.value = response.data.summary;
        seatWarnings.value = response.data.seatWarnings || [];
      }
      return;
    }
    commitRows.value = response.data?.results || [];
    commitSummary.value = response.data?.summary || null;
    stepIndex.value = 2;
    const invited = commitSummary.value?.invited || 0;
    notifySuccess(t('settings.usersImportCommitToast', { count: invited }));
    emit('imported');
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('settings.usersImportCommitFailed');
    notifyError(error.value);
  } finally {
    committing.value = false;
  }
}

function resetState() {
  stepIndex.value = 0;
  error.value = '';
  csvText.value = '';
  fileName.value = '';
  sendEmail.value = true;
  previewRows.value = [];
  previewSummary.value = null;
  seatWarnings.value = [];
  commitRows.value = [];
  commitSummary.value = null;
  if (fileInputEl.value) fileInputEl.value.value = '';
}

function close() {
  emit('close');
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetState();
      loadOptions();
    }
  }
);
</script>
