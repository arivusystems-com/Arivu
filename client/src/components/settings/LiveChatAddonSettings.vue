<template>
  <SettingsScrollPanel :save-bar-visible="dirty">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            :title="t('settings.addonsBackToHub')"
            @click="emit('back')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatSettingsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatSettingsDesc') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="space-y-6 max-w-3xl">
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatWidgetTitle') }}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatWidgetDesc') }}</p>
          </div>
          <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.enabled') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.widgetEnabled"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.widgetEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.widgetEnabled = !form.widgetEnabled"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.widgetEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
        </div>

        <div class="mt-6 space-y-4">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chatWidgetPrechatTitle') }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              v-for="field in captureFieldOptions"
              :key="field.id"
              class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <input
                type="checkbox"
                :checked="form.captureFields.includes(field.id)"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="toggleCaptureField(field.id, $event)"
              />
              {{ field.label }}
            </label>
          </div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.chatWidgetWelcomeMessage') }}
            <textarea
              v-model.trim="form.welcomeMessage"
              rows="3"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chatWidgetBrandColor') }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.chatWidgetBrandColorDesc') }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-3">
              <input
                v-model="form.brandColor"
                type="color"
                class="h-10 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-900"
                :aria-label="t('settings.chatWidgetBrandColor')"
              />
              <input
                v-model.trim="form.brandColor"
                type="text"
                maxlength="7"
                pattern="^#[0-9A-Fa-f]{6}$"
                class="w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm uppercase dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                placeholder="#4F46E5"
              />
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 dark:border-gray-700">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.chatWidgetConsentTitle') }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.chatWidgetConsentDesc') }}</p>
              </div>
              <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
                <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.required') }}</span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="form.consentRequired"
                  class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
                  :class="form.consentRequired ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                  @click="form.consentRequired = !form.consentRequired"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                    :class="form.consentRequired ? 'translate-x-5' : 'translate-x-0'"
                  />
                </button>
              </label>
            </div>
            <label class="mt-4 block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.chatWidgetConsentMessage') }}
              <textarea
                v-model.trim="form.consentMessage"
                rows="3"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block text-sm text-gray-600 dark:text-gray-300">
                {{ t('settings.chatWidgetPrivacyPolicyUrl') }}
                <input
                  v-model.trim="form.privacyPolicyUrl"
                  type="url"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label class="block text-sm text-gray-600 dark:text-gray-300">
                {{ t('settings.chatWidgetTermsUrl') }}
                <input
                  v-model.trim="form.termsUrl"
                  type="url"
                  class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatBotsNav') }}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatBotsDesc') }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            @click="emit('open-bots')"
          >
            {{ t('settings.addonsLiveChatBotsManage') }}
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatWebsiteContentTitle') }}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatWebsiteContentDesc') }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            @click="emit('open-website-content')"
          >
            {{ t('settings.addonsLiveChatWebsiteContentManage') }}
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatQueuesNav') }}</h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatQueuesDesc') }}</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            @click="emit('open-queues')"
          >
            {{ t('settings.addonsLiveChatQueuesManage') }}
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatSessionFieldsTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatSessionFieldsDesc') }}</p>

        <div class="mt-4 flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatAdvancedFieldsTitle') }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsLiveChatAdvancedFieldsDesc') }}</p>
          </div>
          <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.enabled') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="sessionFieldsForm.advancedEnabled"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="sessionFieldsForm.advancedEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="sessionFieldsForm.advancedEnabled = !sessionFieldsForm.advancedEnabled"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="sessionFieldsForm.advancedEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
        </div>

        <div class="mt-4">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatDefaultColumnsTitle') }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsLiveChatDefaultColumnsDesc') }}</p>
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              v-for="field in sessionFieldOptions"
              :key="field.key"
              class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <input
                type="checkbox"
                :checked="sessionFieldsForm.defaultColumns.includes(field.key)"
                :disabled="field.locked"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="toggleSessionFieldColumn(field.key, $event)"
              />
              {{ t(field.labelKey, field.key) }}
            </label>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatOutcomesTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsLiveChatOutcomesDesc') }}</p>
        <ul v-if="outcomeRows.length" class="mt-4 space-y-2">
          <li
            v-for="row in outcomeRows"
            :key="row.key"
            class="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-700"
          >
            <span class="font-medium text-gray-900 dark:text-white">{{ row.label }}</span>
            <span v-if="row.system" class="text-xs text-gray-400">{{ t('settings.addonsLiveChatOutcomeSystem') }}</span>
          </li>
        </ul>
      </div>

      <div v-if="form.publicKey" class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-4">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsLiveChatEmbedTitle') }}</h3>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">
          {{ t('settings.mailroomConnectorChatEmbedKeyLabel') }}
          <input
            :value="form.publicKey"
            readonly
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">
          {{ t('settings.mailroomConnectorChatEmbedSnippetLabel') }}
          <textarea
            :value="embedSnippet"
            readonly
            rows="4"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <button
          type="button"
          class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          @click="copySnippet"
        >
          {{ t('settings.addonsLiveChatCopySnippet') }}
        </button>
      </div>
    </div>

    <SettingsSaveBar
      :visible="dirty && !loading && !error"
      :saving="saving"
      :show-reset="false"
      @save="save"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['back', 'open-queues', 'open-bots', 'open-website-content']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const dirty = ref(false);
const initialSnapshot = ref('');
const outcomeRows = ref([]);
const sessionFieldOptions = ref([]);

const DEFAULT_BRAND_COLOR = '#4f46e5';

const form = reactive({
  widgetEnabled: true,
  publicKey: '',
  captureFields: ['name', 'email'],
  welcomeMessage: '',
  brandColor: DEFAULT_BRAND_COLOR,
  consentRequired: true,
  consentMessage: '',
  privacyPolicyUrl: '',
  termsUrl: '',
});

function normalizeBrandColor(value) {
  const raw = String(value || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) return DEFAULT_BRAND_COLOR;
  return `#${raw.slice(1).toLowerCase()}`;
}

const sessionFieldsForm = reactive({
  advancedEnabled: false,
  defaultColumns: [],
});

const sessionFieldsSnapshot = ref('');

const captureFieldOptions = computed(() => [
  { id: 'name', label: t('settings.chatWidgetFieldName') },
  { id: 'email', label: t('settings.chatWidgetFieldEmail') },
  { id: 'phone', label: t('settings.chatWidgetFieldPhone') },
  { id: 'externalId', label: t('settings.chatWidgetFieldExternalId') },
]);

const embedSnippet = computed(() => {
  if (!form.publicKey) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiOriginAttr = origin ? `\n  data-api-origin="${origin}"` : '';
  // `<\u002Fscript>`: a literal closing script tag ends this SFC block; lint --fix strips `<\/script>`.
  return `<script\n  src="${origin}/embed/chat.js"\n  data-instance="${form.publicKey}"\n  data-position="right"\n  data-theme="light"${apiOriginAttr}\n><\u002Fscript>`;
});

function snapshotForm() {
  return JSON.stringify({
    widgetEnabled: form.widgetEnabled,
    captureFields: [...form.captureFields],
    welcomeMessage: form.welcomeMessage,
    brandColor: normalizeBrandColor(form.brandColor),
    consentRequired: form.consentRequired,
    consentMessage: form.consentMessage,
    privacyPolicyUrl: form.privacyPolicyUrl,
    termsUrl: form.termsUrl,
  });
}

function snapshotSessionFields() {
  return JSON.stringify({
    advancedEnabled: sessionFieldsForm.advancedEnabled,
    defaultColumns: [...sessionFieldsForm.defaultColumns],
  });
}

function syncDirty() {
  dirty.value = snapshotForm() !== initialSnapshot.value
    || snapshotSessionFields() !== sessionFieldsSnapshot.value;
}

function toggleSessionFieldColumn(fieldKey, event) {
  const checked = event?.target?.checked === true;
  const set = new Set(sessionFieldsForm.defaultColumns);
  if (checked) set.add(fieldKey);
  else set.delete(fieldKey);
  sessionFieldsForm.defaultColumns = Array.from(set);
  syncDirty();
}

function toggleCaptureField(fieldId, event) {
  const checked = event?.target?.checked === true;
  const set = new Set(form.captureFields);
  if (checked) set.add(fieldId);
  else set.delete(fieldId);
  form.captureFields = Array.from(set);
  syncDirty();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/settings/addons/live_chat/widget', { method: 'GET' });
    const widget = res?.widget || {};
    form.widgetEnabled = widget.widgetEnabled !== false;
    form.publicKey = widget.publicKey || '';
    form.captureFields = Array.isArray(widget.captureFields) ? [...widget.captureFields] : ['name', 'email'];
    form.welcomeMessage = String(widget.welcomeMessage || '').trim();
    form.brandColor = normalizeBrandColor(widget.brandColor);
    form.consentRequired = widget.consentRequired !== false;
    form.consentMessage = String(widget.consentMessage || '').trim();
    form.privacyPolicyUrl = String(widget.privacyPolicyUrl || '').trim();
    form.termsUrl = String(widget.termsUrl || '').trim();
    initialSnapshot.value = snapshotForm();
    dirty.value = false;

    const outcomesRes = await apiClient('/settings/addons/live_chat/outcomes', { method: 'GET' });
    outcomeRows.value = Array.isArray(outcomesRes?.outcomes) ? outcomesRes.outcomes : [];

    const sessionFieldsRes = await apiClient('/settings/addons/live_chat/session-fields', { method: 'GET' });
    const sessionFieldsData = sessionFieldsRes?.data || {};
    sessionFieldOptions.value = Array.isArray(sessionFieldsData.fields) ? sessionFieldsData.fields : [];
    sessionFieldsForm.advancedEnabled = sessionFieldsData.config?.advancedEnabled === true;
    sessionFieldsForm.defaultColumns = Array.isArray(sessionFieldsData.config?.tenantDefaultColumns)
      && sessionFieldsData.config.tenantDefaultColumns.length
      ? [...sessionFieldsData.config.tenantDefaultColumns]
      : [...(sessionFieldsData.defaultColumnKeys || [])];
    sessionFieldsSnapshot.value = snapshotSessionFields();
  } catch (err) {
    error.value = err?.message || t('settings.addonsLiveChatSettingsLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const res = await apiClient.put('/settings/addons/live_chat/widget', {
      widgetEnabled: form.widgetEnabled,
      captureFields: form.captureFields,
      welcomeMessage: form.welcomeMessage,
      brandColor: normalizeBrandColor(form.brandColor),
      consentRequired: form.consentRequired,
      consentMessage: form.consentMessage,
      privacyPolicyUrl: form.privacyPolicyUrl,
      termsUrl: form.termsUrl,
    });
    const widget = res?.widget || {};
    form.widgetEnabled = widget.widgetEnabled !== false;
    form.publicKey = widget.publicKey || form.publicKey;
    form.captureFields = Array.isArray(widget.captureFields) ? [...widget.captureFields] : form.captureFields;
    form.welcomeMessage = String(widget.welcomeMessage || form.welcomeMessage).trim();
    form.brandColor = normalizeBrandColor(widget.brandColor || form.brandColor);
    form.consentRequired = widget.consentRequired !== false;
    form.consentMessage = String(widget.consentMessage || form.consentMessage).trim();
    form.privacyPolicyUrl = String(widget.privacyPolicyUrl || form.privacyPolicyUrl).trim();
    form.termsUrl = String(widget.termsUrl || form.termsUrl).trim();
    initialSnapshot.value = snapshotForm();
    dirty.value = false;

    await apiClient.put('/settings/addons/live_chat/session-fields', {
      advancedEnabled: sessionFieldsForm.advancedEnabled,
      defaultColumns: sessionFieldsForm.defaultColumns,
    });
    sessionFieldsSnapshot.value = snapshotSessionFields();
    notifications.success(t('settings.addonsLiveChatSettingsSaved'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatSettingsSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function copySnippet() {
  if (!embedSnippet.value) return;
  try {
    await navigator.clipboard.writeText(embedSnippet.value);
    notifications.success(t('settings.addonsLiveChatSnippetCopied'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsLiveChatSnippetCopyFailed'));
  }
}

onMounted(load);

watch(
  () => [
    form.widgetEnabled,
    form.captureFields,
    form.welcomeMessage,
    form.brandColor,
    form.consentRequired,
    form.consentMessage,
    form.privacyPolicyUrl,
    form.termsUrl,
    sessionFieldsForm.advancedEnabled,
    sessionFieldsForm.defaultColumns,
  ],
  () => {
    if (!loading.value) syncDirty();
  },
  { deep: true },
);
</script>
