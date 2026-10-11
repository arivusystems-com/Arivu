<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-mailbox-title"
      @click.self="close"
    >
      <div
        class="relative flex max-h-[min(92vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        :class="legacyModalWideClass"
        @click.stop
      >
        <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <div class="flex items-start gap-3">
            <button
              v-if="showBackButton"
              type="button"
              class="mt-0.5 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.back')"
              @click="goBack"
            >
              <ArrowLeftIcon class="h-5 w-5" />
            </button>
            <div class="min-w-0 flex-1">
              <h2 id="connect-mailbox-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ headerTitle }}
              </h2>
              <p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {{ headerSubtitle }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              @click="close"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div v-if="showLegacyStepIndicator" class="mt-4 flex items-center gap-2">
            <span
              v-for="(label, idx) in legacyStepLabels"
              :key="label"
              class="flex items-center gap-2 text-[11px] font-medium"
            >
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full"
                :class="legacyStepIndex >= idx
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
              >{{ idx + 1 }}</span>
              <span
                :class="legacyStepIndex >= idx ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
              >{{ label }}</span>
              <span
                v-if="idx < legacyStepLabels.length - 1"
                class="mx-1 h-px w-6 bg-gray-200 dark:bg-gray-700"
                aria-hidden="true"
              />
            </span>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <!-- Personal mailbox: single-step forwarding (parser mode) -->
          <template v-if="isPersonalParserFlow">
            <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('inbox.connectMailboxModalYourName') }}
              <input
                v-model="personalLabel"
                type="text"
                autocomplete="name"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.connectMailboxModalYourNamePlaceholder')"
                :disabled="setupLoading"
              >
            </label>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('inbox.connectMailboxModalYourNameHelp') }}
            </p>
            <label class="mt-4 block text-sm font-medium text-gray-800 dark:text-gray-200">
              {{ t('inbox.connectMailboxModalYourWorkEmail') }}
              <input
                v-model="emailHint"
                type="email"
                autocomplete="email"
                class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.connectMailboxModalYourWorkEmailPlaceholder')"
                :disabled="setupLoading"
              >
            </label>
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('inbox.connectMailboxModalYourWorkEmailHelp') }}
            </p>

            <div
              v-if="setupLoading && !activeMailbox?.inboundParser?.routingAddress"
              class="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600 dark:border-gray-600 dark:border-t-emerald-400" />
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ t('inbox.connectMailboxModalCreatingPersonal') }}</span>
            </div>

            <div
              v-else-if="activeMailbox?.inboundParser?.routingAddress"
              class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/25"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                {{ t('inbox.connectMailboxModalYourForwardingAddress') }}
              </p>
              <p class="mt-2 break-all font-mono text-sm leading-relaxed text-emerald-950 dark:text-emerald-50 select-all">
                {{ activeMailbox.inboundParser.routingAddress }}
              </p>
              <button
                type="button"
                class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                @click="copyRoutingAddress"
              >
                {{ routingCopied ? t('inbox.connectMailboxModalCopied') : t('inbox.connectMailboxModalCopyAddress') }}
              </button>
            </div>

            <p
              v-else-if="forwardingError"
              class="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {{ forwardingError }}
            </p>

            <ol class="mt-5 space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">1</span>
                <span>{{ t('inbox.connectMailboxModalStepCopyAddress') }}</span>
              </li>
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">2</span>
                <span>{{ t('inbox.connectMailboxModalStepOpenSettings') }} <strong class="font-medium text-gray-800 dark:text-gray-200">{{ t('inbox.connectMailboxModalStepSettingsPath') }}</strong> {{ t('inbox.connectMailboxModalStepPasteAddress') }}</span>
              </li>
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">3</span>
                <span>{{ t('inbox.connectMailboxModalStepMailAppears') }}</span>
              </li>
            </ol>
          </template>

          <!-- Shared mailbox: parser mode (create + forward in one screen) -->
          <template v-else-if="isGroupParserFlow">
            <template v-if="!activeMailbox?.id && !targetMailbox?.id">
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalSharedInboxName') }}
                <input
                  v-model="groupLabel"
                  type="text"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('inbox.connectMailboxModalSharedNamePlaceholder')"
                >
              </label>
              <label class="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalTeamEmailOptional') }}
                <input
                  v-model="groupEmail"
                  type="email"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="t('inbox.connectMailboxModalSupportCompanyCom')"
                >
              </label>
            </template>
            <template v-else>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {{ t('inbox.connectMailboxModalForwardTeamMailbox') }}
              </p>
            </template>

            <div
              v-if="setupLoading && !activeMailbox?.inboundParser?.routingAddress"
              class="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-violet-600" />
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ t('inbox.connectMailboxModalSettingUpShared') }}</span>
            </div>

            <div
              v-else-if="activeMailbox?.inboundParser?.routingAddress"
              class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/25"
            >
              <p class="text-xs font-semibold text-emerald-900 dark:text-emerald-100">{{ t('inbox.connectMailboxModalForwardToThisAddress') }}</p>
              <p class="mt-2 break-all font-mono text-sm text-emerald-950 dark:text-emerald-50 select-all">
                {{ activeMailbox.inboundParser.routingAddress }}
              </p>
              <button
                type="button"
                class="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                @click="copyRoutingAddress"
              >
                {{ routingCopied ? t('inbox.connectMailboxModalCopied') : t('inbox.connectMailboxModalCopyAddress') }}
              </button>
            </div>

            <p
              v-else-if="forwardingError"
              class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {{ forwardingError }}
            </p>
          </template>

          <!-- Gmail / legacy multi-step -->
          <template v-else>
            <template v-if="legacyView === 'providers'">
              <ul
                v-if="reason !== 'inbox'"
                class="mb-5 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300"
              >
                <li class="flex gap-2">
                  <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{{ t('inbox.connectMailboxModalSendAndReceiveEmailInsideThe') }}</span>
                </li>
                <li class="flex gap-2">
                  <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{{ t('inbox.connectMailboxModalSyncThreadsToYourWorkspaceInbox') }}</span>
                </li>
              </ul>
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">
                {{ t('inbox.connectMailboxModalChooseProvider') }}
              </p>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <InboxProviderCard
                  v-for="p in inboxProviders"
                  :key="p.id"
                  :provider="providerForCard(p)"
                  :selected="selectedProviderId === p.id"
                  :disabled="p.id === 'google' && !gmailOAuthReady"
                  @select="onProviderSelect"
                />
              </div>
            </template>

            <template v-else-if="legacyView === 'create-mailbox'">
              <p class="text-sm text-gray-700 dark:text-gray-300">
                {{ t('inbox.connectMailboxModalCreateA') }} <span class="font-medium">{{ t('inbox.connectMailboxModalSharedTeamMailbox') }}</span>{{ t('inbox.connectMailboxModalThenConnectGmail') }}
              </p>
              <label class="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalDisplayName') }}
                <input v-model="groupLabel" type="text" class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white" :placeholder="t('inbox.connectMailboxModalSharedNamePlaceholder')">
              </label>
              <label class="mt-3 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalSharedEmailAddress') }}
                <input v-model="groupEmail" type="email" class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white" :placeholder="t('inbox.connectMailboxModalSupportCompanyCom')">
              </label>
              <button
                type="button"
                class="mt-4 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                :disabled="setupLoading || !groupLabel.trim()"
                @click="createGroupMailboxGmail"
              >
                {{ setupLoading ? t('inbox.connectMailboxModalCreating') : t('inbox.connectMailboxModalCreateSharedMailbox') }}
              </button>
            </template>

            <template v-else-if="legacyView === 'connect-provider' && selectedProviderId === 'google-smtp'">
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalGmailAddress') }}
                <input v-model="emailHint" type="email" class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white" :placeholder="t('inbox.connectMailboxModalYouCompanyCom')">
              </label>
              <label class="mt-4 block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalGoogleAppPassword') }}
                <input v-model="appPassword" type="password" class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white" :placeholder="t('inbox.connectMailboxModalAppPasswordPlaceholder')">
              </label>
            </template>

            <template v-else-if="legacyView === 'connect-provider' && selectedProviderId === 'google'">
              <label class="block text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ t('inbox.connectMailboxModalWorkEmailAddress') }}
                <input
                  v-model="emailHint"
                  type="email"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  :placeholder="selectedProvider?.emailPlaceholder || t('inbox.connectMailboxModalYouCompanyCom')"
                >
              </label>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ t('inbox.connectMailboxModalGoogleSignInNext') }}
              </p>
            </template>
          </template>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            @click="close"
          >
            {{ isParserFlow ? 'Cancel' : 'Not now' }}
          </button>
          <div class="flex flex-wrap gap-2">
            <button
              v-if="isPersonalParserFlow || isGroupParserFlow"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              :disabled="primaryParserDisabled"
              @click="onParserPrimaryAction"
            >
              {{ parserPrimaryLabel }}
            </button>
            <template v-else>
              <button
                v-if="legacyView === 'connect-provider' && selectedProviderId === 'google-smtp'"
                type="button"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                :disabled="smtpConnectLoading || !emailLooksValid || !appPassword.trim()"
                @click="connectGmailSmtp"
              >
                {{ smtpConnectLoading ? 'Verifying…' : 'Connect Gmail SMTP' }}
              </button>
              <button
                v-else-if="legacyView === 'connect-provider' && selectedProviderId === 'google' && gmailOAuthReady"
                type="button"
                class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                :disabled="gmailSyncLoading || !emailLooksValid"
                @click="connectGoogle"
              >
                {{ gmailSyncLoading ? 'Opening Google…' : 'Continue with Google' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useMailboxConnection } from '@/composables/useMailboxConnection';
import { useGmailInboxConnect } from '@/composables/useGmailInboxConnect';
import { useSmtpSetupWizard } from '@/composables/useSmtpSetupWizard';
import apiClient from '@/utils/apiClient';
import { getAvailableInboxProviders, getInboxProvider } from '@/constants/inboxProviders';
import InboxProviderCard from '@/components/inbox/InboxProviderCard.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reason: { type: String, default: 'send' },
  mailboxKind: { type: String, default: 'personal' },
  targetMailbox: { type: Object, default: null }
});

const emit = defineEmits(['update:modelValue', 'connected']);
const { t } = useI18n();

const authStore = useAuthStore();
const notifications = useNotifications();
const { openSmtpSetupWizard } = useSmtpSetupWizard();
const {
  flags,
  loaded,
  personalMailbox,
  groupMailboxes,
  gmailOAuthReady,
  refreshMailboxes,
  ensurePersonalMailbox,
  ensureGroupMailbox,
  provisionMailboxParser
} = useMailboxConnection();

const connectTargetMailbox = ref(null);
const { gmailSyncLoading, startGmailOAuth } = useGmailInboxConnect();

const legacyView = ref('providers');
const activeMailbox = ref(null);
const forwardingError = ref('');
const routingCopied = ref(false);
const selectedProviderId = ref('google');
const setupLoading = ref(false);
const emailHint = ref('');
const personalLabel = ref('');
const groupLabel = ref('Support');
const groupEmail = ref('');
const appPassword = ref('');
const smtpConnectLoading = ref(false);

const isParserMode = computed(() => !flags.value.gmailIntegrationEnabled);
const isPersonalParserFlow = computed(
  () => isParserMode.value && props.mailboxKind === 'personal'
);
const isGroupParserFlow = computed(
  () => isParserMode.value && props.mailboxKind === 'group'
);

const inboxProviders = computed(() => getAvailableInboxProviders(flags.value));
const selectedProvider = computed(() => getInboxProvider(selectedProviderId.value));

const emailLooksValid = computed(() => {
  const s = String(emailHint.value || '').trim();
  return s.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
});

const legacyModalWideClass = computed(() =>
  !isParserMode.value && legacyView.value === 'providers' && props.reason === 'inbox'
    ? 'max-w-3xl'
    : ''
);

const showBackButton = computed(
  () => !isParserMode.value && legacyView.value !== 'providers'
);

const showLegacyStepIndicator = computed(
  () => !isParserMode.value && legacyView.value !== 'providers'
);

const headerTitle = computed(() => {
  if (isPersonalParserFlow.value) return 'Connect your personal inbox';
  if (isGroupParserFlow.value) {
    return activeMailbox.value?.inboundParser?.routingAddress
      ? 'Shared mailbox forwarding'
      : props.targetMailbox?.id
        ? 'Connect shared mailbox'
        : 'Create shared mailbox';
  }
  if (props.mailboxKind === 'group') {
    if (legacyView.value === 'providers') return 'Connect shared mailbox';
    if (legacyView.value === 'create-mailbox') return 'Create shared inbox';
    return 'Connect Gmail';
  }
  if (legacyView.value === 'providers') return 'Connect your inbox';
  if (legacyView.value === 'create-mailbox') return 'Set up your mailbox';
  if (selectedProvider.value) return `Connect ${selectedProvider.value.name}`;
  return 'Connect inbox';
});

const headerSubtitle = computed(() => {
  if (isPersonalParserFlow.value) {
    return 'Get one forwarding address — works with Gmail, Microsoft 365, or any email provider.';
  }
  if (isGroupParserFlow.value) {
    return activeMailbox.value?.inboundParser?.routingAddress
      ? 'Add this address in your team mailbox forwarding settings.'
      : 'Set up a team inbox and forwarding address in one step.';
  }
  if (legacyView.value === 'providers') {
    return 'Link your work email to send and receive from the CRM.';
  }
  if (selectedProvider.value?.id === 'google') {
    return 'Sign in with Google to sync Gmail.';
  }
  return selectedProvider.value?.integrationLabel || '';
});

const legacyStepLabels = computed(() => {
  if (legacyView.value === 'create-mailbox') return ['Provider', 'Mailbox'];
  return ['Provider', 'Mailbox', 'Connect'];
});

const legacyStepIndex = computed(() => {
  if (legacyView.value === 'providers') return 0;
  if (legacyView.value === 'create-mailbox') return 1;
  return 2;
});

const parserPrimaryLabel = computed(() => {
  if (setupLoading.value) return 'Setting up…';
  if (activeMailbox.value?.inboundParser?.routingAddress) return 'Done';
  if (isGroupParserFlow.value && !activeMailbox.value?.id) return 'Create & get address';
  return 'Get forwarding address';
});

const primaryParserDisabled = computed(() => {
  if (setupLoading.value) return true;
  if (isGroupParserFlow.value && !activeMailbox.value?.id && !groupLabel.value.trim()) return true;
  if (isPersonalParserFlow.value && !personalLabel.value.trim()) return true;
  return false;
});

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;

    forwardingError.value = '';
    routingCopied.value = false;
    connectTargetMailbox.value = props.targetMailbox || null;

    await refreshMailboxes();

    if (isPersonalParserFlow.value) {
      personalLabel.value =
        String(props.targetMailbox?.label || '').trim()
        || String(personalMailbox.value?.label || '').trim()
        || String(authStore.user?.username || '').trim()
        || '';
      emailHint.value =
        String(props.targetMailbox?.emailAddress || '').trim()
        || String(personalMailbox.value?.emailAddress || '').trim()
        || (authStore.user?.email && String(authStore.user.email).includes('@')
          ? String(authStore.user.email).trim()
          : '');
    } else if (isGroupParserFlow.value) {
      emailHint.value = '';
      groupLabel.value =
        String(props.targetMailbox?.label || '').trim() || groupLabel.value || 'Support';
      groupEmail.value = props.targetMailbox?.emailAddress
        ? String(props.targetMailbox.emailAddress).trim()
        : '';
    } else {
      emailHint.value = props.targetMailbox?.emailAddress
        ? String(props.targetMailbox.emailAddress).trim()
        : authStore.user?.email && String(authStore.user.email).includes('@')
          ? String(authStore.user.email).trim()
          : '';
    }

    if (isPersonalParserFlow.value) {
      activeMailbox.value = personalMailbox.value || null;
      return;
    }

    if (isGroupParserFlow.value) {
      activeMailbox.value = props.targetMailbox || connectTargetMailbox.value || null;
      if (activeMailbox.value?.id && !activeMailbox.value?.inboundParser?.routingAddress) {
        void runParserSetup();
      }
      return;
    }

    activeMailbox.value = null;
    if (props.targetMailbox?.id) {
      legacyView.value = 'connect-provider';
    } else if (props.mailboxKind === 'group' && !props.targetMailbox?.id) {
      legacyView.value = 'create-mailbox';
    } else {
      legacyView.value = 'providers';
    }
    selectedProviderId.value = inboxProviders.value[0]?.id || 'google';
  }
);

function close() {
  legacyView.value = 'providers';
  appPassword.value = '';
  activeMailbox.value = null;
  forwardingError.value = '';
  emit('update:modelValue', false);
}

function goBack() {
  if (legacyView.value === 'connect-provider') {
    legacyView.value = props.mailboxKind === 'group' ? 'create-mailbox' : 'providers';
    return;
  }
  if (legacyView.value === 'create-mailbox') {
    legacyView.value = 'providers';
  }
}

function providerForCard(p) {
  if (p.id === 'google' && !gmailOAuthReady.value) {
    return { ...p, status: 'disabled' };
  }
  return p;
}

async function savePersonalMailboxDetails(mailboxId) {
  if (!mailboxId) return;
  const body = {};
  if (personalLabel.value.trim()) body.label = personalLabel.value.trim();
  if (emailHint.value.trim()) body.emailAddress = emailHint.value.trim();
  if (!Object.keys(body).length) return;
  await apiClient(`/mailboxes/${encodeURIComponent(mailboxId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  await refreshMailboxes();
  activeMailbox.value = personalMailbox.value || activeMailbox.value;
}

async function saveEmailHintOnMailbox(mailboxId) {
  if (!mailboxId || !emailHint.value.trim()) return;
  await apiClient(`/mailboxes/${encodeURIComponent(mailboxId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ emailAddress: emailHint.value.trim() })
  });
  await refreshMailboxes();
  if (isPersonalParserFlow.value) {
    activeMailbox.value = personalMailbox.value || activeMailbox.value;
  } else {
    const id = String(mailboxId);
    activeMailbox.value =
      groupMailboxes.value.find((g) => String(g.id) === id) || activeMailbox.value;
  }
}

async function saveGroupEmailOnMailbox(mailboxId) {
  if (!mailboxId || !groupEmail.value.trim()) return;
  await apiClient(`/mailboxes/${encodeURIComponent(mailboxId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ emailAddress: groupEmail.value.trim() })
  });
  await refreshMailboxes();
  const id = String(mailboxId);
  activeMailbox.value =
    groupMailboxes.value.find((g) => String(g.id) === id) || activeMailbox.value;
}

async function runParserSetup() {
  setupLoading.value = true;
  forwardingError.value = '';
  try {
    let mb = activeMailbox.value;

    if (isPersonalParserFlow.value) {
      if (!mb?.id) {
        if (!flags.value.canCreatePersonal) {
          forwardingError.value = 'You cannot create a personal mailbox. Ask your administrator.';
          return;
        }
        mb = await ensurePersonalMailbox({
          label: personalLabel.value,
          emailAddress: emailHint.value
        });
      }
    } else if (isGroupParserFlow.value) {
      if (!mb?.id) {
        if (!flags.value.canCreateGroup) {
          forwardingError.value = 'Only admins can create shared mailboxes.';
          return;
        }
        mb = await ensureGroupMailbox({
          label: groupLabel.value,
          emailAddress: groupEmail.value
        });
        if (mb?.id) connectTargetMailbox.value = mb;
      }
    }

    if (!mb?.id) {
      forwardingError.value = 'Could not set up mailbox.';
      return;
    }

    activeMailbox.value = mb;

    // Name + work email drive parser mailboxName and routing prefix — save before provisioning.
    if (isPersonalParserFlow.value) {
      await savePersonalMailboxDetails(mb.id);
      mb = personalMailbox.value || activeMailbox.value;
      activeMailbox.value = mb;
    } else if (isGroupParserFlow.value) {
      await saveGroupEmailOnMailbox(mb.id);
      const id = String(mb.id);
      mb = groupMailboxes.value.find((g) => String(g.id) === id) || mb;
      activeMailbox.value = mb;
    }

    if (!mb.inboundParser?.routingAddress) {
      if (loaded.value && !flags.value.inboundParserProvisionReady) {
        forwardingError.value =
          'Inbound parser is not ready on this server. Your platform admin must enable it in Control Plane → Inbound Parser (Parser URL + API key), then use Test parser connection.';
        return;
      }

      const result = await provisionMailboxParser(mb.id);
      if (result.ok && result.mailbox) {
        activeMailbox.value = result.mailbox;
        mb = result.mailbox;
      } else {
        forwardingError.value = result.message
          || 'Could not generate a forwarding address. Ask your platform admin to configure the inbound parser.';
        return;
      }
    }

    if (isPersonalParserFlow.value) {
      await savePersonalMailboxDetails(mb.id);
    } else if (isGroupParserFlow.value) {
      await saveGroupEmailOnMailbox(mb.id);
    }
  } catch (err) {
    forwardingError.value = err?.message || 'Setup failed';
  } finally {
    setupLoading.value = false;
  }
}

function onParserPrimaryAction() {
  if (activeMailbox.value?.inboundParser?.routingAddress) {
    finishConnected();
    return;
  }
  void runParserSetup();
}

async function copyRoutingAddress() {
  const addr = activeMailbox.value?.inboundParser?.routingAddress;
  if (!addr || typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(addr);
    routingCopied.value = true;
    notifications.success('Copied forwarding address');
    setTimeout(() => {
      routingCopied.value = false;
    }, 2000);
  } catch {
    notifications.warning('Could not copy — select the address and copy manually');
  }
}

function finishConnected() {
  emit('connected');
  close();
}

async function onProviderSelect(providerId) {
  const p = getInboxProvider(providerId);
  if (!p || p.status !== 'available') return;
  selectedProviderId.value = providerId;

  const isSmtpProvider = providerId === 'google-smtp'
    || providerId === 'outlook-smtp'
    || providerId === 'yahoo-smtp'
    || providerId === 'custom-smtp';

  if (isSmtpProvider && props.mailboxKind !== 'group') {
    setupLoading.value = true;
    let mbId = personalMailbox.value?.id || props.targetMailbox?.id || '';
    try {
      if (!mbId) {
        const mb = await ensurePersonalMailbox();
        if (!mb?.id) {
          notifications.error('Could not create personal mailbox');
          return;
        }
        mbId = mb.id;
      }
    } finally {
      setupLoading.value = false;
    }
    close();
    openSmtpSetupWizard({
      mailboxId: mbId,
      email: personalMailbox.value?.emailAddress || '',
      reason: 'inbox',
      onConnected: () => {
        emit('connected');
      }
    });
    return;
  }

  if (props.mailboxKind === 'group') {
    legacyView.value = props.targetMailbox?.id ? 'connect-provider' : 'create-mailbox';
    return;
  }
  if (!personalMailbox.value) {
    setupLoading.value = true;
    try {
      const mb = await ensurePersonalMailbox();
      if (!mb?.id) {
        notifications.error('Could not create personal mailbox');
        return;
      }
    } finally {
      setupLoading.value = false;
    }
  }
  legacyView.value = 'connect-provider';
}

async function createGroupMailboxGmail() {
  setupLoading.value = true;
  try {
    const mb = await ensureGroupMailbox({
      label: groupLabel.value,
      emailAddress: groupEmail.value
    });
    if (mb?.id) {
      connectTargetMailbox.value = mb;
      notifications.success('Shared mailbox created');
      legacyView.value = 'connect-provider';
      selectedProviderId.value = 'google';
    } else {
      notifications.error('Could not create shared mailbox');
    }
  } finally {
    setupLoading.value = false;
  }
}

function resolveConnectMailboxId() {
  if (props.targetMailbox?.id) return String(props.targetMailbox.id);
  if (connectTargetMailbox.value?.id) return String(connectTargetMailbox.value.id);
  return personalMailbox.value?.id ? String(personalMailbox.value.id) : '';
}

async function connectGoogle() {
  const mbId = resolveConnectMailboxId();
  if (!mbId || !emailLooksValid.value) return;
  await startGmailOAuth(mbId, emailHint.value, {
    onConnected: async () => {
      await refreshMailboxes();
      finishConnected();
    }
  });
}

async function connectGmailSmtp() {
  const mbId = resolveConnectMailboxId();
  if (!mbId || !emailLooksValid.value || !appPassword.value.trim()) return;
  smtpConnectLoading.value = true;
  try {
    const res = await apiClient(`/mailboxes/${encodeURIComponent(mbId)}/outbound/gmail-smtp/connect`, {
      method: 'POST',
      body: JSON.stringify({
        emailAddress: emailHint.value.trim(),
        appPassword: appPassword.value.replace(/\s/g, '')
      })
    });
    if (res?.success) {
      notifications.success('Gmail SMTP connected');
      appPassword.value = '';
      await refreshMailboxes();
      finishConnected();
    } else {
      notifications.error(res?.message || 'Could not connect Gmail SMTP');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Could not connect Gmail SMTP');
  } finally {
    smtpConnectLoading.value = false;
  }
}
</script>
