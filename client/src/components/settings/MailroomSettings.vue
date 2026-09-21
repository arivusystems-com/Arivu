<template>
  <SettingsScrollPanel :save-bar-visible="!loading && !loadError && isDirty">
    <template #header>
      <div class="flex items-start gap-3">
        <button
          type="button"
          class="mt-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          :title="t('settings.mailroomBackTitle')"
          @click="goBackToAutomation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.automationMailroom') }}</h2>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              :class="form.enabled
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ form.enabled ? t('settings.mailroomStatusEnabled') : t('settings.mailroomStatusDisabled') }}
            </span>
          </div>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.mailroomSubtitle') }}
          </p>
        </div>
      </div>
    </template>

    <template #tabs>
      <nav class="overflow-x-auto">
        <div class="flex gap-1 min-w-max -mb-px">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab.id
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="activeTab = tab.id"
          >
            {{ t(tab.labelKey) }}
            <span
              v-if="tab.badge != null"
              class="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              :class="activeTab === tab.id
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ tab.badge }}
            </span>
          </button>
        </div>
      </nav>
    </template>

    <div v-if="loadError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="loading" class="flex justify-center py-24">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div v-else class="space-y-6">
      <!-- Overview -->
      <template v-if="activeTab === 'overview'">
        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomOverviewSetupTitle') }}</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.mailroomOverviewSetupHelp') }}</p>
            </div>
            <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.mailroomEnabled') }}</span>
              <button
                type="button"
                role="switch"
                :aria-checked="form.enabled"
                class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                :class="form.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                @click="form.enabled = !form.enabled"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition"
                  :class="form.enabled ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </label>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {{ t('settings.mailroomTemplate') }}
            </label>
            <select
              v-model="selectedTemplateId"
              class="w-full max-w-lg rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option v-for="tpl in templates" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
            </select>
            <p v-if="activeTemplateDescription" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {{ activeTemplateDescription }}
            </p>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomOverviewPipelineTitle') }}</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('settings.mailroomOverviewPipelineHelp') }}</p>
          <div class="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span
              v-for="(step, idx) in pipelineSteps"
              :key="step"
              class="inline-flex items-center gap-2"
            >
              <span class="rounded-lg bg-indigo-50 px-3 py-1.5 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">{{ step }}</span>
              <span v-if="idx < pipelineSteps.length - 1" class="text-gray-400">→</span>
            </span>
          </div>
        </section>

        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            class="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-400 hover:shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
            @click="activeTab = 'routing'"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.mailroomTabRouting') }}</p>
            <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ ingestRules.length }} {{ t('settings.mailroomOverviewRules') }}</p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">{{ ingestActionLabel(ingestDefaultAction) }}</p>
          </button>
          <button
            type="button"
            class="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-400 hover:shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
            @click="activeTab = 'processing'"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.mailroomPolicyThreading') }}</p>
            <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ threadingStrategyCount }} {{ t('settings.mailroomStrategies') }}</p>
          </button>
          <button
            type="button"
            class="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-400 hover:shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
            @click="activeTab = 'processing'"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.mailroomPolicyDedup') }}</p>
            <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{{ dedupBehaviorLabel(dedupForm.onDuplicate) }}</p>
          </button>
          <button
            type="button"
            class="rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-indigo-400 hover:shadow-sm transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
            @click="activeTab = 'processing'"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('settings.mailroomPolicyCaseLink') }}</p>
            <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-white truncate">{{ caseLinkActionLabel(caseLinkForm.onNoMatch.action) }}</p>
          </button>
        </section>
      </template>

      <!-- Connectors -->
      <template v-else-if="activeTab === 'connectors'">
        <MailroomSection
          :title="t('settings.mailroomConnectorsTitle')"
          :description="t('settings.mailroomConnectorsHelp')"
        >
          <div class="space-y-6">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorsEmailGroupTitle') }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomConnectorsEmailGroupHelp') }}</p>
              <div class="mt-3 grid grid-cols-1 gap-4">
                <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <div class="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">Arivu parser</p>
                      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Inbound parser webhook → Mailroom (email).</p>
                    </div>
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {{ form.connectors.arivuParser?.enabled !== false ? t('common.enabled') : t('common.disabled') }}
                    </span>
                  </div>
                </div>
                <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                  <div class="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-gray-900 dark:text-white">Raw MIME webhook</p>
                      <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Raw email MIME → Mailroom (email).</p>
                    </div>
                    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {{ form.connectors.rawMimeWebhook?.enabled !== false ? t('common.enabled') : t('common.disabled') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorsWebGroupTitle') }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomConnectorsWebGroupHelp') }}</p>
              <div class="mt-3 grid grid-cols-1 gap-4">
            <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div class="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorPublicApiTitle') }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomConnectorPublicApiHelp') }}</p>
                </div>
                <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.enabled') }}</span>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="form.connectors.publicApi.enabled"
                    class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    :class="form.connectors.publicApi.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="form.connectors.publicApi.enabled = !form.connectors.publicApi.enabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition"
                      :class="form.connectors.publicApi.enabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </label>
              </div>
              <div class="p-4 space-y-2">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">
                  {{ t('settings.mailroomConnectorPublicApiKeyLabel') }}
                </label>
                <input
                  v-model="form.connectors.publicApi.ingestKey"
                  type="text"
                  class="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  :placeholder="t('settings.mailroomConnectorPublicApiKeyPlaceholder')"
                >
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.mailroomConnectorPublicApiCurlHint') }}
                </p>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div class="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorPortalTitle') }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomConnectorPortalHelp') }}</p>
                </div>
                <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.enabled') }}</span>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="form.connectors.portal.enabled"
                    class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    :class="form.connectors.portal.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="form.connectors.portal.enabled = !form.connectors.portal.enabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition"
                      :class="form.connectors.portal.enabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </label>
              </div>
              <div class="p-4 space-y-6">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.mailroomConnectorPortalEndpointHint') }}
                </p>

                <div>
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorPortalAudienceTitle') }}</p>
                  <label class="mt-2 block text-xs text-gray-600 dark:text-gray-400">{{ t('settings.mailroomConnectorPortalPartnerDomains') }}</label>
                  <textarea
                    v-model="portalPartnerDomainsText"
                    rows="3"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <label class="mt-3 block text-xs text-gray-600 dark:text-gray-400">{{ t('settings.mailroomConnectorPortalPartnerTypes') }}</label>
                  <input
                    v-model="portalPartnerTypesText"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                  <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorPortalCustomerRules') }}</p>
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input v-model="form.connectors.portal.customer.allowCreateCase" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                      {{ t('settings.mailroomConnectorPortalAllowCreate') }}
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input v-model="form.connectors.portal.customer.allowReply" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                      {{ t('settings.mailroomConnectorPortalAllowReply') }}
                    </label>
                    <label class="block text-xs text-gray-600 dark:text-gray-400">
                      {{ t('settings.mailroomConnectorPortalMaxAttachments') }}
                      <input v-model.number="form.connectors.portal.customer.maxAttachmentsPerMessage" type="number" min="0" max="50" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    </label>
                    <label class="block text-xs text-gray-600 dark:text-gray-400">
                      {{ t('settings.mailroomConnectorPortalMaxBytes') }}
                      <input v-model.number="form.connectors.portal.customer.maxAttachmentBytes" type="number" min="0" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    </label>
                  </div>

                  <div class="rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorPortalPartnerRules') }}</p>
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input v-model="form.connectors.portal.partner.allowCreateCase" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                      {{ t('settings.mailroomConnectorPortalAllowCreate') }}
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input v-model="form.connectors.portal.partner.allowReply" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                      {{ t('settings.mailroomConnectorPortalAllowReply') }}
                    </label>
                    <label class="block text-xs text-gray-600 dark:text-gray-400">
                      {{ t('settings.mailroomConnectorPortalMaxAttachments') }}
                      <input v-model.number="form.connectors.portal.partner.maxAttachmentsPerMessage" type="number" min="0" max="50" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    </label>
                    <label class="block text-xs text-gray-600 dark:text-gray-400">
                      {{ t('settings.mailroomConnectorPortalMaxBytes') }}
                      <input v-model.number="form.connectors.portal.partner.maxAttachmentBytes" type="number" min="0" class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    </label>
                    <label class="block text-xs text-gray-600 dark:text-gray-400">{{ t('settings.mailroomConnectorPortalAllowedMime') }}</label>
                    <textarea
                      v-model="portalPartnerMimeText"
                      rows="4"
                      class="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <div class="flex items-start justify-between gap-4 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.mailroomConnectorChatTitle') }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomConnectorChatHelp') }}</p>
                </div>
                <label class="inline-flex items-center gap-3 cursor-pointer shrink-0">
                  <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('common.enabled') }}</span>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="form.connectors.chat.enabled"
                    class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    :class="form.connectors.chat.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
                    @click="form.connectors.chat.enabled = !form.connectors.chat.enabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition"
                      :class="form.connectors.chat.enabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </label>
              </div>
              <div class="p-4 space-y-4">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.mailroomConnectorChatEndpointHint') }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ t('settings.mailroomConnectorChatMovedToAddons') }}
                </p>
                <RouterLink
                  :to="{ path: '/settings', query: { tab: 'addons', addonView: 'live-chat', liveChatView: 'settings' } }"
                  class="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {{ t('settings.mailroomConnectorChatOpenAddons') }}
                </RouterLink>
              </div>
            </div>
              </div>
            </div>
          </div>
        </MailroomSection>
      </template>

      <!-- Routing (Ingest) -->
      <template v-else-if="activeTab === 'routing'">
        <MailroomSection
          :title="t('settings.mailroomIngestTitle')"
          :description="t('settings.mailroomIngestHelp')"
        >
          <template #actions>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              @click="addIngestRule"
            >
              {{ t('settings.mailroomIngestAddRule') }}
            </button>
          </template>

          <p v-if="!ingestRules.length" class="text-sm text-gray-500 dark:text-gray-400 py-8 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            {{ t('settings.mailroomIngestNoRules') }}
          </p>
          <div v-else class="space-y-3">
            <div
              v-for="(rule, index) in ingestRules"
              :key="rule.id || index"
              class="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden"
              :class="{ 'opacity-60': rule.enabled === false }"
            >
              <div class="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                  {{ index + 1 }}
                </span>
                <input
                  v-model.trim="rule.name"
                  type="text"
                  :placeholder="t('settings.mailroomIngestRuleName')"
                  class="flex-1 min-w-0 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 shrink-0">
                  <input
                    v-model="rule.enabled"
                    type="checkbox"
                    class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    @change="syncIngestPolicy"
                  />
                  {{ t('settings.mailroomIngestEnabled') }}
                </label>
                <button
                  type="button"
                  class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 shrink-0"
                  @click="removeIngestRule(index)"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
              <div class="p-4 space-y-3">
                <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span>{{ t('settings.mailroomIngestMatch') }}</span>
                  <select v-model="rule.match" class="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="all">{{ t('settings.mailroomIngestMatchAll') }}</option>
                    <option value="any">{{ t('settings.mailroomIngestMatchAny') }}</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(condition, condIndex) in rule.conditions"
                    :key="`${index}-${condIndex}`"
                    class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2"
                  >
                    <select v-model="condition.field" class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <option v-for="field in MAILROOM_INGEST_FIELDS" :key="field" :value="field">{{ ingestFieldLabel(field) }}</option>
                    </select>
                    <select v-model="condition.operator" class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <option v-for="operator in MAILROOM_INGEST_OPERATORS" :key="operator" :value="operator">{{ ingestOperatorLabel(operator) }}</option>
                    </select>
                    <input
                      v-model.trim="condition.value"
                      type="text"
                      :placeholder="t('settings.mailroomIngestConditionValue')"
                      class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      type="button"
                      class="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                      :disabled="rule.conditions.length <= 1"
                      @click="removeIngestCondition(index, condIndex)"
                    >
                      −
                    </button>
                  </div>
                  <button
                    type="button"
                    class="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    @click="addIngestCondition(index)"
                  >
                    + {{ t('settings.mailroomIngestAddCondition') }}
                  </button>
                </div>
                <div class="max-w-md">
                  <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomIngestRuleAction') }}</label>
                  <select v-model="rule.action.type" class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option v-for="action in MAILROOM_INGEST_ACTIONS" :key="action" :value="action">{{ ingestActionLabel(action) }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomIngestDefaultAction') }}</label>
            <select v-model="ingestDefaultAction" class="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option v-for="action in MAILROOM_INGEST_ACTIONS" :key="`default-${action}`" :value="action">{{ ingestActionLabel(action) }}</option>
            </select>
          </div>
        </MailroomSection>
      </template>

      <!-- Processing -->
      <template v-else-if="activeTab === 'processing'">
        <div class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <p class="text-xs font-medium text-indigo-900 dark:text-indigo-100">{{ t('settings.mailroomProcessingOrderTitle') }}</p>
          <p class="mt-1 text-xs text-indigo-800/80 dark:text-indigo-200/80">{{ t('settings.mailroomProcessingOrderHelp') }}</p>
        </div>

        <MailroomSection :title="t('settings.mailroomThreadingTitle')" :description="t('settings.mailroomThreadingHelp')" step="1">
          <ul class="space-y-2">
            <li
              v-for="(strategy, index) in threadingStrategies"
              :key="strategy.id || strategy.signal || index"
              class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-600"
            >
              <span class="text-xs font-mono text-gray-400 w-5">{{ index + 1 }}</span>
              <input
                v-model="strategy.enabled"
                type="checkbox"
                class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                @change="syncThreadingStrategies"
              />
              <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ signalLabel(strategy.signal) }}</span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                  :disabled="index === 0"
                  @click="moveStrategy(index, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                  :disabled="index === threadingStrategies.length - 1"
                  @click="moveStrategy(index, 1)"
                >
                  ↓
                </button>
              </div>
            </li>
          </ul>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomDedupTitle')" :description="t('settings.mailroomDedupHelp')" step="2">
          <div class="max-w-md">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomDedupOnDuplicate') }}</label>
            <select
              v-model="dedupForm.onDuplicate"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              @change="syncDedupPolicy"
            >
              <option v-for="behavior in MAILROOM_DEDUP_BEHAVIORS" :key="behavior" :value="behavior">
                {{ dedupBehaviorLabel(behavior) }}
              </option>
            </select>
          </div>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomClassificationTitle')" :description="t('settings.mailroomClassificationHelp')" step="3">
          <div class="grid gap-4 sm:grid-cols-2 max-w-3xl mb-4">
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.mailroomClassificationApplyMode') }}</span>
              <select
                v-model="classificationForm.applyMode"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                @change="syncClassificationPolicy"
              >
                <option v-for="mode in MAILROOM_CLASSIFICATION_APPLY_MODES" :key="mode" :value="mode">
                  {{ classificationApplyModeLabel(mode) }}
                </option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.mailroomClassificationOnSpam') }}</span>
              <select
                v-model="classificationForm.onSpam"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                @change="syncClassificationPolicy"
              >
                <option v-for="action in MAILROOM_CLASSIFICATION_ON_SPAM" :key="action" :value="action">
                  {{ classificationOnSpamLabel(action) }}
                </option>
              </select>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.mailroomClassificationDefaultQueue') }}</span>
              <input
                v-model="classificationForm.defaultQueue"
                type="text"
                class="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                :placeholder="t('settings.mailroomClassificationDefaultQueuePlaceholder')"
                @change="syncClassificationPolicy"
              />
            </label>
          </div>

          <p v-if="!classificationRules.length" class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            {{ t('settings.mailroomClassificationEmpty') }}
          </p>
          <ul v-else class="space-y-3">
            <li
              v-for="(rule, index) in classificationRules"
              :key="rule.id || index"
              class="rounded-lg border border-gray-200 p-3 dark:border-gray-600 space-y-2"
            >
              <div class="flex flex-wrap items-center gap-2">
                <input v-model="rule.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" @change="syncClassificationPolicy" />
                <input
                  v-model="rule.name"
                  type="text"
                  class="flex-1 min-w-[8rem] rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  :placeholder="t('settings.mailroomClassificationRuleNamePlaceholder')"
                  @change="syncClassificationPolicy"
                />
                <button type="button" class="text-xs text-red-600 hover:underline" @click="removeClassificationRule(index)">
                  {{ t('actions.delete') }}
                </button>
              </div>
              <div class="grid gap-2 sm:grid-cols-3">
                <select v-model="rule.field" class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy">
                  <option v-for="field in MAILROOM_CLASSIFICATION_FIELDS" :key="field" :value="field">{{ classificationFieldLabel(field) }}</option>
                </select>
                <select v-model="rule.operator" class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy">
                  <option v-for="op in MAILROOM_CLASSIFICATION_OPERATORS" :key="op" :value="op">{{ ingestOperatorLabel(op) }}</option>
                </select>
                <input v-model="rule.value" type="text" class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy" />
              </div>
              <div class="grid gap-2 sm:grid-cols-3 text-sm">
                <select v-model="rule.suggestCaseType" class="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy">
                  <option value="">{{ t('settings.mailroomClassificationNoSuggestion') }}</option>
                  <option v-for="ct in CASE_TYPES" :key="ct" :value="ct">{{ ct }}</option>
                </select>
                <select v-model="rule.suggestPriority" class="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy">
                  <option value="">{{ t('settings.mailroomClassificationNoSuggestion') }}</option>
                  <option v-for="p in CASE_PRIORITIES" :key="p" :value="p">{{ p }}</option>
                </select>
                <input v-model="rule.suggestQueue" type="text" :placeholder="t('settings.mailroomClassificationQueuePlaceholder')" class="rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncClassificationPolicy" />
              </div>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="rule.markSpam" type="checkbox" class="rounded border-gray-300 text-indigo-600" @change="syncClassificationPolicy" />
                {{ t('settings.mailroomClassificationMarkSpam') }}
              </label>
            </li>
          </ul>
          <button
            type="button"
            class="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
            @click="addClassificationRule"
          >
            {{ t('settings.mailroomClassificationAddRule') }}
          </button>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomCaseLinkTitle')" :description="t('settings.mailroomCaseLinkHelp')" step="4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkOpenMatch') }}</label>
              <select v-model="caseLinkForm.onOpenCaseMatch.action" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                <option v-for="action in openCaseActions" :key="action" :value="action">{{ caseLinkActionLabel(action) }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkNoMatch') }}</label>
              <select v-model="caseLinkForm.onNoMatch.action" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                <option v-for="action in noMatchActions" :key="action" :value="action">{{ caseLinkActionLabel(action) }}</option>
              </select>
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 text-sm text-gray-900 dark:text-white cursor-pointer pb-2">
                <input v-model="caseLinkForm.onResolvedWithinDays.enabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" @change="syncCaseLinkPolicy" />
                {{ t('settings.mailroomCaseLinkReopenEnabled') }}
              </label>
            </div>
            <div v-if="caseLinkForm.onResolvedWithinDays.enabled">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkReopenDays') }}</label>
              <input v-model.number="caseLinkForm.onResolvedWithinDays.days" type="number" min="0" max="365" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy" />
            </div>
            <div v-if="caseLinkForm.onResolvedWithinDays.enabled">
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkReopenAction') }}</label>
              <select v-model="caseLinkForm.onResolvedWithinDays.action" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                <option v-for="action in reopenActions" :key="action" :value="action">{{ caseLinkActionLabel(action) }}</option>
              </select>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">{{ t('settings.mailroomCaseLinkDefaults') }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkDefaultType') }}</label>
                <select v-model="caseLinkForm.defaults.caseType" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                  <option v-for="ct in CASE_TYPES" :key="ct" :value="ct">{{ ct }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkDefaultPriority') }}</label>
                <select v-model="caseLinkForm.defaults.priority" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                  <option v-for="p in CASE_PRIORITIES" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{{ t('settings.mailroomCaseLinkDefaultChannel') }}</label>
                <select v-model="caseLinkForm.defaults.channel" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="syncCaseLinkPolicy">
                  <option v-for="ch in CASE_CHANNELS" :key="ch" :value="ch">{{ ch }}</option>
                </select>
              </div>
            </div>
          </div>
        </MailroomSection>
      </template>

      <!-- Monitoring -->
      <template v-else-if="activeTab === 'monitoring'">
        <MailroomSection :title="t('settings.mailroomMetricsTitle')" :description="t('settings.mailroomMetricsHelp')">
          <div v-if="mailroomMetrics" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomMetricMessages24h') }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ mailroomMetrics.tenant?.messagesLast24h ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomMetricOpenFailures') }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ mailroomMetrics.tenant?.openProcessingFailures ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomMetricDuplicateRate') }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ mailroomMetrics.runtime?.duplicateRatePercent ?? 0 }}%</p>
            </div>
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.mailroomMetricQueueFailed') }}</p>
              <p class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ mailroomMetrics.queue?.inboundEmail?.failed ?? 0 }}</p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{{ t('settings.mailroomMetricsEmpty') }}</p>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomSecurityTitle')" :description="t('settings.mailroomSecurityHelp')">
          <div class="grid gap-4 sm:grid-cols-2 text-sm">
            <label class="block">
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.mailroomSecurityEmailOnFailure') }}</span>
              <select
                v-model="form.security.email.onFailure"
                class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="monitor">{{ t('settings.mailroomSecurityModeMonitor') }}</option>
                <option value="quarantine">{{ t('settings.mailroomSecurityModeQuarantine') }}</option>
                <option value="reject">{{ t('settings.mailroomSecurityModeReject') }}</option>
              </select>
            </label>
            <div class="space-y-2">
              <label class="flex items-center gap-2">
                <input v-model="form.security.email.requireSpf" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span>{{ t('settings.mailroomSecurityRequireSpf') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <input v-model="form.security.email.requireDkim" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span>{{ t('settings.mailroomSecurityRequireDkim') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <input v-model="form.security.email.requireDmarc" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span>{{ t('settings.mailroomSecurityRequireDmarc') }}</span>
              </label>
              <label class="flex items-center gap-2">
                <input v-model="form.security.attachments.scanEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <span>{{ t('settings.mailroomSecurityAttachmentScan') }}</span>
              </label>
            </div>
          </div>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomFailuresTitle')" :description="t('settings.mailroomFailuresHelp')">
          <p v-if="!processingFailures.length" class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            {{ t('settings.mailroomFailuresEmpty') }}
          </p>
          <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <li v-for="failure in processingFailures" :key="failure._id" class="py-3 flex flex-wrap items-start gap-3 justify-between">
              <div class="space-y-1 min-w-0 flex-1">
                <p class="text-gray-900 dark:text-white">{{ failure.errorMessage || '—' }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatLogTime(failure.createdAt) }}
                  <span v-if="failure.connectorType"> · {{ failure.connectorType }}</span>
                  <span v-if="failure.retryCount"> · {{ t('settings.mailroomFailureRetries', { count: failure.retryCount }) }}</span>
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
                :disabled="replayingId === String(failure.rawPayloadId?._id || failure.rawPayloadId)"
                @click="replayFailure(failure)"
              >
                {{ replayingId === String(failure.rawPayloadId?._id || failure.rawPayloadId) ? t('settings.mailroomFailureReplaying') : t('settings.mailroomFailureReplay') }}
              </button>
            </li>
          </ul>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomThreadingLogsTitle')" :description="t('settings.mailroomThreadingLogsEmpty').split('.')[0]">
          <p v-if="!threadingLogs.length" class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            {{ t('settings.mailroomThreadingLogsEmpty') }}
          </p>
          <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <li v-for="log in threadingLogs" :key="log._id" class="py-3 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="log.matched
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'"
                >
                  {{ log.matched ? t('settings.mailroomThreadingMatched') : t('settings.mailroomThreadingNoMatch') }}
                </span>
                <span v-if="log.signal" class="text-gray-700 dark:text-gray-300">{{ signalLabel(log.signal) }}</span>
                <span v-if="log.resolution" class="text-xs text-gray-500 dark:text-gray-400">→ {{ log.resolution }}</span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatLogTime(log.createdAt) }}
                <span v-if="log.conversationId"> · conv {{ String(log.conversationId).slice(-6) }}</span>
              </p>
            </li>
          </ul>
        </MailroomSection>

        <MailroomSection :title="t('settings.mailroomRoutingLogsTitle')" :description="t('settings.mailroomRoutingLogsHelp')">
          <p v-if="!routingLogs.length" class="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
            {{ t('settings.mailroomRoutingLogsEmpty') }}
          </p>
          <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <li v-for="log in routingLogs" :key="log._id" class="py-3 space-y-1">
              <p class="font-medium text-gray-900 dark:text-white">{{ log.adapterAction || '—' }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatLogTime(log.createdAt) }}
                <span v-if="log.channel"> · {{ log.channel }}</span>
                <span v-if="log.durationMs"> · {{ log.durationMs }}ms</span>
              </p>
            </li>
          </ul>
        </MailroomSection>
      </template>

      <!-- Developer -->
      <template v-else-if="activeTab === 'developer'">
        <MailroomSection :title="t('settings.mailroomEvaluateResult')" :description="t('settings.mailroomTestPolicies')">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
            :disabled="evaluating"
            @click="runEvaluate"
          >
            {{ evaluating ? t('settings.mailroomEvaluating') : t('settings.mailroomRunSampleEval') }}
          </button>
          <pre
            v-if="evaluateResult"
            class="mt-4 text-xs overflow-auto max-h-96 rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
          >{{ evaluateResult }}</pre>
          <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.mailroomEvalEmpty') }}</p>
        </MailroomSection>
      </template>
    </div>

    <!-- Sticky save bar -->
    <SettingsSaveBar
      :visible="!loading && !loadError && isDirty"
      :saving="saving"
      :message="t('settings.mailroomSaveBarHint')"
      :show-reset="false"
      :save-label="t('actions.save')"
      @save="save"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { computed, defineComponent, h, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';
import { useNotifications } from '@/composables/useNotifications';
import { CASE_TYPES, CASE_PRIORITIES, CASE_CHANNELS } from '@/constants/caseLifecycle';
import {
  MAILROOM_DEDUP_BEHAVIORS,
  MAILROOM_DEDUP_BEHAVIOR_LABEL_KEYS,
  MAILROOM_CASE_LINK_ACTION_LABEL_KEYS,
  MAILROOM_INGEST_ACTIONS,
  MAILROOM_INGEST_ACTION_LABEL_KEYS,
  MAILROOM_INGEST_FIELDS,
  MAILROOM_INGEST_FIELD_LABEL_KEYS,
  MAILROOM_INGEST_OPERATORS,
  MAILROOM_INGEST_OPERATOR_LABEL_KEYS,
  MAILROOM_CLASSIFICATION_FIELDS,
  MAILROOM_CLASSIFICATION_OPERATORS,
  MAILROOM_CLASSIFICATION_APPLY_MODES,
  MAILROOM_CLASSIFICATION_ON_SPAM,
  MAILROOM_CLASSIFICATION_FIELD_LABEL_KEYS,
  MAILROOM_CLASSIFICATION_APPLY_MODE_LABEL_KEYS,
  MAILROOM_CLASSIFICATION_ON_SPAM_LABEL_KEYS
} from '@/constants/mailroomPolicies';

const MAILROOM_TAB_KEY = 'arivu-mailroom-settings-tab';

const MailroomSection = defineComponent({
  name: 'MailroomSection',
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    step: { type: [String, Number], default: null }
  },
  setup(props, { slots }) {
    return () => h('section', { class: 'rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden' }, [
      h('div', { class: 'flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-900/30' }, [
        h('div', { class: 'flex items-start gap-3 min-w-0' }, [
          props.step != null
            ? h('span', {
              class: 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white'
            }, String(props.step))
            : null,
          h('div', { class: 'min-w-0' }, [
            h('h3', { class: 'text-sm font-semibold text-gray-900 dark:text-white' }, props.title),
            props.description
              ? h('p', { class: 'mt-0.5 text-xs text-gray-500 dark:text-gray-400' }, props.description)
              : null
          ])
        ]),
        slots.actions ? h('div', { class: 'shrink-0' }, slots.actions()) : null
      ]),
      h('div', { class: 'p-6' }, slots.default ? slots.default() : [])
    ]);
  }
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const isDirty = ref(false);
const trackChanges = ref(false);
const evaluating = ref(false);
const loadError = ref('');
const templates = ref([]);
const threadingLogs = ref([]);
const processingFailures = ref([]);
const routingLogs = ref([]);
const mailroomMetrics = ref(null);
const replayingId = ref('');
const activeTab = ref(localStorage.getItem(MAILROOM_TAB_KEY) || 'overview');
const form = ref({
  enabled: false,
  activeTemplateId: 'helpdesk_standard_email',
  policies: {},
  connectors: {},
  security: defaultSecurity()
});

function defaultSecurity() {
  return {
    email: {
      enabled: true,
      requireSpf: false,
      requireDkim: false,
      requireDmarc: false,
      onFailure: 'monitor'
    },
    attachments: {
      scanEnabled: false,
      onInfected: 'block'
    }
  };
}

function mergeSecurityFromApi(raw) {
  const base = defaultSecurity();
  if (!raw || typeof raw !== 'object') return base;
  return {
    email: { ...base.email, ...raw.email },
    attachments: { ...base.attachments, ...raw.attachments }
  };
}
const selectedTemplateId = ref('helpdesk_standard_email');
const evaluateResult = ref('');
const threadingStrategies = ref([]);

const openCaseActions = ['append', 'flag_for_review', 'manual_review', 'no_op'];
const noMatchActions = ['create_case', 'flag_for_review', 'manual_review'];
const reopenActions = ['reopen', 'create_case', 'append'];

function defaultPortalConnector() {
  return {
    enabled: false,
    audienceDetection: {
      partnerDomains: [],
      partnerPeopleTypes: ['Partner']
    },
    customer: {
      allowCreateCase: true,
      allowReply: true,
      maxAttachmentsPerMessage: 10,
      maxAttachmentBytes: 25 * 1024 * 1024
    },
    partner: {
      allowCreateCase: false,
      allowReply: true,
      maxAttachmentsPerMessage: 5,
      maxAttachmentBytes: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
    }
  };
}

function mergePortalConnectorFromApi(raw) {
  const base = defaultPortalConnector();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    enabled: raw.enabled === true,
    audienceDetection: {
      ...base.audienceDetection,
      partnerDomains: Array.isArray(raw.audienceDetection?.partnerDomains)
        ? raw.audienceDetection.partnerDomains
        : base.audienceDetection.partnerDomains,
      partnerPeopleTypes: Array.isArray(raw.audienceDetection?.partnerPeopleTypes)
        ? raw.audienceDetection.partnerPeopleTypes
        : base.audienceDetection.partnerPeopleTypes
    },
    customer: { ...base.customer, ...raw.customer },
    partner: {
      ...base.partner,
      ...raw.partner,
      allowedMimeTypes: Array.isArray(raw.partner?.allowedMimeTypes)
        ? raw.partner.allowedMimeTypes
        : base.partner.allowedMimeTypes
    }
  };
}

function ensurePortalConnector() {
  if (!form.value.connectors) form.value.connectors = {};
  if (!form.value.connectors.portal) {
    form.value.connectors.portal = defaultPortalConnector();
  }
}

const portalPartnerDomainsText = computed({
  get() {
    ensurePortalConnector();
    return (form.value.connectors.portal.audienceDetection.partnerDomains || []).join('\n');
  },
  set(value) {
    ensurePortalConnector();
    form.value.connectors.portal.audienceDetection.partnerDomains = String(value)
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
});

const portalPartnerTypesText = computed({
  get() {
    ensurePortalConnector();
    return (form.value.connectors.portal.audienceDetection.partnerPeopleTypes || []).join(', ');
  },
  set(value) {
    ensurePortalConnector();
    form.value.connectors.portal.audienceDetection.partnerPeopleTypes = String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
});

const portalPartnerMimeText = computed({
  get() {
    ensurePortalConnector();
    return (form.value.connectors.portal.partner.allowedMimeTypes || []).join('\n');
  },
  set(value) {
    ensurePortalConnector();
    form.value.connectors.portal.partner.allowedMimeTypes = String(value)
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
});

const dedupForm = reactive({ onDuplicate: 'append_to_existing_open_case' });
const classificationForm = reactive({
  applyMode: 'auto_apply',
  onSpam: 'ignore',
  defaultQueue: ''
});
const classificationRules = ref([]);
const caseLinkForm = reactive({
  onOpenCaseMatch: { action: 'append' },
  onResolvedWithinDays: { enabled: true, days: 7, action: 'reopen' },
  onNoMatch: { action: 'create_case' },
  defaults: { caseType: 'Support Ticket', priority: 'Medium', channel: 'Email' }
});
const ingestRules = ref([]);
const ingestDefaultAction = ref('route_to_case_flow');

const pipelineSteps = computed(() => [
  t('settings.mailroomPipelineIngest'),
  t('settings.mailroomPipelineThreading'),
  t('settings.mailroomPipelineDedup'),
  t('settings.mailroomPipelineCaseLink'),
  t('settings.mailroomPipelineEvents')
]);

const tabs = computed(() => [
  { id: 'overview', labelKey: 'settings.mailroomTabOverview' },
  { id: 'connectors', labelKey: 'settings.mailroomTabConnectors' },
  { id: 'routing', labelKey: 'settings.mailroomTabRouting', badge: ingestRules.value.length || null },
  { id: 'processing', labelKey: 'settings.mailroomTabProcessing' },
  {
    id: 'monitoring',
    labelKey: 'settings.mailroomTabMonitoring',
    badge: (processingFailures.value.length || threadingLogs.value.length) || null
  },
  { id: 'developer', labelKey: 'settings.mailroomTabDeveloper' }
]);

const SIGNAL_LABEL_KEYS = {
  message_id: 'settings.mailroomThreadingSignalMessageId',
  in_reply_to: 'settings.mailroomThreadingSignalInReplyTo',
  references: 'settings.mailroomThreadingSignalReferences',
  provider_thread_id: 'settings.mailroomThreadingSignalProviderThread',
  sender_subject: 'settings.mailroomThreadingSignalSenderSubject'
};

const activeTemplateDescription = computed(() => {
  const tpl = templates.value.find((x) => x.id === selectedTemplateId.value);
  return tpl?.description || '';
});

const threadingStrategyCount = computed(() => {
  const strategies = form.value.policies?.threading?.strategies;
  return Array.isArray(strategies) ? strategies.filter((s) => s.enabled !== false).length : 0;
});

watch(activeTab, (v) => {
  localStorage.setItem(MAILROOM_TAB_KEY, v);
});

function dedupBehaviorLabel(behavior) {
  const key = MAILROOM_DEDUP_BEHAVIOR_LABEL_KEYS[behavior];
  return key ? t(key) : behavior;
}

function caseLinkActionLabel(action) {
  const key = MAILROOM_CASE_LINK_ACTION_LABEL_KEYS[action];
  return key ? t(key) : action;
}

function ingestActionLabel(action) {
  const key = MAILROOM_INGEST_ACTION_LABEL_KEYS[action];
  return key ? t(key) : action;
}

function ingestFieldLabel(field) {
  const key = MAILROOM_INGEST_FIELD_LABEL_KEYS[field];
  return key ? t(key) : field;
}

function ingestOperatorLabel(operator) {
  const key = MAILROOM_INGEST_OPERATOR_LABEL_KEYS[operator];
  return key ? t(key) : operator;
}

function classificationFieldLabel(field) {
  const key = MAILROOM_CLASSIFICATION_FIELD_LABEL_KEYS[field];
  return key ? t(key) : field;
}

function classificationApplyModeLabel(mode) {
  const key = MAILROOM_CLASSIFICATION_APPLY_MODE_LABEL_KEYS[mode];
  return key ? t(key) : mode;
}

function classificationOnSpamLabel(action) {
  const key = MAILROOM_CLASSIFICATION_ON_SPAM_LABEL_KEYS[action];
  return key ? t(key) : action;
}

function signalLabel(signal) {
  const key = SIGNAL_LABEL_KEYS[signal];
  return key ? t(key) : signal || '—';
}

function formatLogTime(value) {
  if (!value) return '';
  try {
    return formatUserDateTime(value);
  } catch {
    return String(value);
  }
}

function goBackToAutomation() {
  router.push({ path: '/settings', query: { tab: 'automation' } });
}

function hydrateThreadingStrategies() {
  const strategies = form.value.policies?.threading?.strategies;
  threadingStrategies.value = Array.isArray(strategies)
    ? strategies.map((s) => ({ ...s, enabled: s.enabled !== false }))
    : [];
}

function hydrateClassificationPolicy() {
  const cls = form.value.policies?.classification || {};
  classificationForm.applyMode = cls.applyMode || 'auto_apply';
  classificationForm.onSpam = cls.onSpam || 'ignore';
  classificationForm.defaultQueue = cls.defaultQueue || '';
  const rules = Array.isArray(cls.rules) ? cls.rules : [];
  classificationRules.value = rules.map((rule, index) => ({
    id: rule.id || `cls-${index + 1}`,
    name: rule.name || '',
    enabled: rule.enabled !== false,
    field: rule.field || 'subject',
    operator: rule.operator || 'contains',
    value: rule.value || '',
    suggestCaseType: rule.suggestCaseType || '',
    suggestPriority: rule.suggestPriority || '',
    suggestQueue: rule.suggestQueue || '',
    markSpam: rule.markSpam === true
  }));
}

function syncClassificationPolicy() {
  if (!form.value.policies) form.value.policies = {};
  form.value.policies.classification = {
    rules: classificationRules.value
      .filter((rule) => String(rule.value || '').trim() || rule.markSpam)
      .map((rule, index) => ({
        id: rule.id || `cls-${index + 1}`,
        name: String(rule.name || '').trim(),
        enabled: rule.enabled !== false,
        field: rule.field || 'subject',
        operator: rule.operator || 'contains',
        value: String(rule.value || '').trim(),
        suggestCaseType: rule.suggestCaseType || null,
        suggestPriority: rule.suggestPriority || null,
        suggestQueue: rule.suggestQueue ? String(rule.suggestQueue).trim() : null,
        markSpam: rule.markSpam === true
      })),
    defaultQueue: String(classificationForm.defaultQueue || '').trim() || null,
    applyMode: classificationForm.applyMode || 'auto_apply',
    onSpam: classificationForm.onSpam || 'ignore',
    stopOnFirstMatch: true
  };
}

function addClassificationRule() {
  classificationRules.value.push({
    id: `cls-${Date.now()}`,
    name: '',
    enabled: true,
    field: 'subject',
    operator: 'contains',
    value: '',
    suggestCaseType: '',
    suggestPriority: '',
    suggestQueue: '',
    markSpam: false
  });
}

function removeClassificationRule(index) {
  classificationRules.value.splice(index, 1);
  syncClassificationPolicy();
}

function hydrateDedupAndCaseLink() {
  const dedup = form.value.policies?.dedup || {};
  dedupForm.onDuplicate = dedup.onDuplicate || 'append_to_existing_open_case';

  const cl = form.value.policies?.caseLink || {};
  caseLinkForm.onOpenCaseMatch.action = cl.onOpenCaseMatch?.action || 'append';
  caseLinkForm.onNoMatch.action = cl.onNoMatch?.action || 'create_case';
  const reopen = cl.onResolvedWithinDays || {};
  caseLinkForm.onResolvedWithinDays.enabled = reopen.enabled !== false;
  caseLinkForm.onResolvedWithinDays.days = Number(reopen.days) || 7;
  caseLinkForm.onResolvedWithinDays.action = reopen.action || 'reopen';
  const defs = cl.defaults || {};
  caseLinkForm.defaults.caseType = defs.caseType || 'Support Ticket';
  caseLinkForm.defaults.priority = defs.priority || 'Medium';
  caseLinkForm.defaults.channel = defs.channel || 'Email';
}

function hydrateIngestPolicy() {
  const ingest = form.value.policies?.ingest || {};
  const rules = Array.isArray(ingest.rules) ? ingest.rules : [];
  ingestRules.value = rules.map((rule, index) => ({
    id: rule.id || `rule-${index + 1}`,
    name: rule.name || '',
    enabled: rule.enabled !== false,
    match: rule.match === 'any' ? 'any' : 'all',
    conditions: Array.isArray(rule.conditions) && rule.conditions.length
      ? rule.conditions.map((c) => ({
        field: c.field || 'to',
        operator: c.operator || 'contains',
        value: c.value || ''
      }))
      : [{ field: 'to', operator: 'contains', value: '' }],
    action: { type: rule.action?.type || 'route_to_case_flow' }
  }));
  ingestDefaultAction.value = ingest.defaultAction?.type || 'route_to_case_flow';
}

function syncDedupPolicy() {
  if (!form.value.policies) form.value.policies = {};
  const existing = form.value.policies.dedup || {};
  form.value.policies.dedup = {
    ...existing,
    onDuplicate: dedupForm.onDuplicate,
    onNoDuplicate: existing.onNoDuplicate || 'continue'
  };
}

function syncCaseLinkPolicy() {
  if (!form.value.policies) form.value.policies = {};
  form.value.policies.caseLink = {
    onOpenCaseMatch: { action: caseLinkForm.onOpenCaseMatch.action },
    onResolvedWithinDays: {
      enabled: caseLinkForm.onResolvedWithinDays.enabled === true,
      days: Math.max(0, Number(caseLinkForm.onResolvedWithinDays.days) || 0),
      action: caseLinkForm.onResolvedWithinDays.action
    },
    onNoMatch: { action: caseLinkForm.onNoMatch.action },
    defaults: { ...caseLinkForm.defaults }
  };
}

function syncIngestPolicy() {
  if (!form.value.policies) form.value.policies = {};
  form.value.policies.ingest = {
    rules: ingestRules.value.map((rule, index) => ({
      id: rule.id || `rule-${index + 1}`,
      name: String(rule.name || '').trim(),
      enabled: rule.enabled !== false,
      match: rule.match === 'any' ? 'any' : 'all',
      conditions: (Array.isArray(rule.conditions) ? rule.conditions : [])
        .filter((c) => String(c.value || '').trim())
        .map((c) => ({
          field: c.field || 'to',
          operator: c.operator || 'contains',
          value: String(c.value || '').trim()
        })),
      action: { type: rule.action?.type || 'route_to_case_flow' }
    })),
    defaultAction: { type: ingestDefaultAction.value || 'route_to_case_flow' }
  };
}

function syncAllPolicies() {
  syncIngestPolicy();
  syncThreadingStrategies();
  syncDedupPolicy();
  syncClassificationPolicy();
  syncCaseLinkPolicy();
}

function addIngestRule() {
  ingestRules.value.push({
    id: `rule-${Date.now()}`,
    name: '',
    enabled: true,
    match: 'all',
    conditions: [{ field: 'to', operator: 'contains', value: '' }],
    action: { type: 'route_to_case_flow' }
  });
}

function removeIngestRule(index) {
  ingestRules.value.splice(index, 1);
}

function addIngestCondition(ruleIndex) {
  const rule = ingestRules.value[ruleIndex];
  if (!rule) return;
  rule.conditions.push({ field: 'to', operator: 'contains', value: '' });
}

function removeIngestCondition(ruleIndex, conditionIndex) {
  const rule = ingestRules.value[ruleIndex];
  if (!rule) return;
  if (rule.conditions.length <= 1) return;
  rule.conditions.splice(conditionIndex, 1);
}

function syncThreadingStrategies() {
  if (!form.value.policies) form.value.policies = {};
  if (!form.value.policies.threading) form.value.policies.threading = { strategies: [], fallback: { action: 'no_match' } };
  form.value.policies.threading.strategies = threadingStrategies.value.map((s) => ({
    id: s.id || s.signal,
    signal: s.signal,
    enabled: s.enabled !== false,
    params: s.params || {}
  }));
}

function moveStrategy(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= threadingStrategies.value.length) return;
  const copy = [...threadingStrategies.value];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  threadingStrategies.value = copy;
  syncThreadingStrategies();
}

async function loadThreadingLogs() {
  try {
    const res = await apiClient.get('/settings/automation/mailroom/threading-logs?limit=15');
    if (res?.success) {
      threadingLogs.value = Array.isArray(res.data) ? res.data : [];
    }
  } catch {
    threadingLogs.value = [];
  }
}

async function loadMailroomMetrics() {
  try {
    const res = await apiClient.get('/settings/automation/mailroom/metrics');
    if (res.success) mailroomMetrics.value = res.data;
  } catch {
    mailroomMetrics.value = null;
  }
}

async function loadRoutingLogs() {
  try {
    const res = await apiClient.get('/settings/automation/mailroom/routing-logs?limit=20');
    if (res.success) routingLogs.value = Array.isArray(res.data) ? res.data : [];
  } catch {
    routingLogs.value = [];
  }
}

async function loadProcessingFailures() {
  try {
    const res = await apiClient.get('/settings/automation/mailroom/failures?limit=15&status=open');
    if (res?.success) {
      processingFailures.value = Array.isArray(res.data) ? res.data : [];
    }
  } catch {
    processingFailures.value = [];
  }
}

async function replayFailure(failure) {
  const rawPayloadId = failure.rawPayloadId?._id || failure.rawPayloadId;
  if (!rawPayloadId) return;
  replayingId.value = String(rawPayloadId);
  try {
    const res = await apiClient.post(`/settings/automation/mailroom/failures/${rawPayloadId}/replay`);
    if (!res.success) throw new Error(res.message || 'Replay failed');
    notifications.success(t('settings.mailroomFailureReplayed'));
    await loadProcessingFailures();
    await loadThreadingLogs();
  } catch (e) {
    notifications.error(e.message || t('settings.mailroomFailureReplayFailed'));
  } finally {
    replayingId.value = '';
  }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await apiClient.get('/settings/automation/mailroom');
    if (!res.success) throw new Error(res.message || 'Load failed');
    templates.value = res.meta?.templates || [];
    form.value = {
      enabled: res.data?.enabled === true,
      activeTemplateId: res.data?.activeTemplateId || 'helpdesk_standard_email',
      policies: res.data?.policies || {},
      connectors: {
        arivuParser: { enabled: res.data?.connectors?.arivuParser?.enabled !== false },
        rawMimeWebhook: { enabled: res.data?.connectors?.rawMimeWebhook?.enabled !== false },
        publicApi: {
          enabled: res.data?.connectors?.publicApi?.enabled === true,
          ingestKey: res.data?.connectors?.publicApi?.ingestKey || ''
        },
        portal: mergePortalConnectorFromApi(res.data?.connectors?.portal),
        chat: { enabled: res.data?.connectors?.chat?.enabled === true }
      },
      security: mergeSecurityFromApi(res.data?.security)
    };
    ensurePortalConnector();
    selectedTemplateId.value = form.value.activeTemplateId;
    hydrateThreadingStrategies();
    hydrateIngestPolicy();
    hydrateDedupAndCaseLink();
    hydrateClassificationPolicy();
    await Promise.all([
      loadThreadingLogs(),
      loadProcessingFailures(),
      loadRoutingLogs(),
      loadMailroomMetrics()
    ]);
  } catch (e) {
    loadError.value = e.message || t('settings.mailroomLoadFailed');
  } finally {
    loading.value = false;
    isDirty.value = false;
    trackChanges.value = true;
  }
}

async function save() {
  syncAllPolicies();
  saving.value = true;
  try {
    const payload = {
      enabled: form.value.enabled,
      activeTemplateId: selectedTemplateId.value,
      policies: form.value.policies,
      connectors: form.value.connectors,
      security: form.value.security,
    };
    if (selectedTemplateId.value !== form.value.activeTemplateId) {
      payload.applyTemplateId = selectedTemplateId.value;
    }
    const res = await apiClient.put('/settings/automation/mailroom', payload);
    if (!res.success) throw new Error(res.message || 'Save failed');
    form.value = { ...form.value, ...res.data };
    hydrateThreadingStrategies();
    hydrateIngestPolicy();
    hydrateDedupAndCaseLink();
    hydrateClassificationPolicy();
    if (res.data?.security) {
      form.value.security = mergeSecurityFromApi(res.data.security);
    }
    await Promise.all([
      loadThreadingLogs(),
      loadProcessingFailures(),
      loadRoutingLogs(),
      loadMailroomMetrics()
    ]);
    notifications.success(t('settings.mailroomSaved'));
    isDirty.value = false;
  } catch (e) {
    notifications.error(e.message || t('settings.mailroomSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function runEvaluate() {
  syncAllPolicies();
  evaluating.value = true;
  evaluateResult.value = '';
  try {
    const res = await apiClient.post('/settings/automation/mailroom/evaluate', {
      policies: form.value.policies,
      message: {
        channel: 'email',
        subject: 'Re: Printer not working',
        inReplyTo: '<parent-msg@example.com>',
        participants: {
          from: { address: 'customer@example.com' },
          to: [{ address: 'support@xyz.com' }]
        }
      }
    });
    if (!res.success) throw new Error(res.message || 'Evaluate failed');
    evaluateResult.value = JSON.stringify(res.data, null, 2);
  } catch (e) {
    evaluateResult.value = e.message || 'Error';
  } finally {
    evaluating.value = false;
  }
}

onMounted(() => {
  if (route.query.tab !== 'automation') return;
  load();
});

watch(
  [form, selectedTemplateId, threadingStrategies, dedupForm, classificationForm, classificationRules, caseLinkForm, ingestRules, ingestDefaultAction],
  () => {
    if (trackChanges.value && !loading.value) {
      isDirty.value = true;
    }
  },
  { deep: true }
);
</script>
