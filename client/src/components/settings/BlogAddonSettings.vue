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
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsBlogSettingsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogSettingsDesc') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="max-w-3xl space-y-6">
      <!-- General -->
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogGeneralTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogGeneralDesc') }}</p>

        <div class="mt-5 space-y-4">
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsBlogRssEnabled') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.rssEnabled"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.rssEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.rssEnabled = !form.rssEnabled; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.rssEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
          <div
            v-if="form.rssEnabled && integration.blogRssUrl"
            class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogRssFeedUrlLabel') }}</p>
                <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ integration.blogRssUrl }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogRssFeedUrlHint') }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(integration.blogRssUrl, t('settings.addonsBlogRssFeedUrlLabel'))"
              >
                {{ t('actions.copy') }}
              </button>
            </div>
            <div v-if="integration.blogCollectionRssUrlTemplate" class="min-w-0">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ t('settings.addonsBlogRssCategoryFeedLabel') }}</p>
              <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ integration.blogCollectionRssUrlTemplate }}</p>
            </div>
            <div v-if="integration.blogPostRssUrlTemplate" class="min-w-0">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ t('settings.addonsBlogRssPostFeedLabel') }}</p>
              <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ integration.blogPostRssUrlTemplate }}</p>
            </div>
            <a
              :href="integration.blogRssUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {{ t('settings.addonsBlogRssOpenFeed') }}
            </a>
          </div>

          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsBlogCommentsEnabled') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.commentsEnabled"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.commentsEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.commentsEnabled = !form.commentsEnabled; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.commentsEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsBlogDefaultCollection') }}
            <select
              v-model="form.defaultCollectionId"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="syncDirty()"
            >
              <option :value="null">{{ t('contentStudio.noCollection') }}</option>
              <option v-for="collection in collections" :key="collection._id" :value="collection._id">
                {{ collection.name }}
              </option>
            </select>
          </label>
        </div>
      </div>

      <!-- Customer website -->
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogCustomerSiteTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogCustomerSiteDesc') }}</p>
        <p
          v-if="integrationUrlsUnavailable"
          class="mt-2 text-sm text-amber-700 dark:text-amber-300"
        >
          {{ t('settings.addonsBlogIntegrationUrlsUnavailable') }}
        </p>

        <label class="mt-5 block text-sm text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsBlogCustomerSiteSetupType') }}
          <select
            v-model="staticSyncHostType"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:max-w-md"
            @change="onStaticSyncHostTypeChange"
          >
            <option value="embed">{{ t('settings.addonsBlogStaticSyncHostEmbed') }}</option>
            <option value="next">{{ t('settings.addonsBlogStaticSyncHostNext') }}</option>
            <option value="php">{{ t('settings.addonsBlogStaticSyncHostPhp') }}</option>
            <option value="cli">{{ t('settings.addonsBlogStaticSyncHostCli') }}</option>
          </select>
        </label>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ customerSiteSetupHint }}</p>

        <div class="mt-5 space-y-4 text-sm">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input v-model="form.headlessApiEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" @change="syncDirty" />
            {{ t('settings.addonsBlogHeadlessApiEnabled') }}
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsBlogEmbedWebsiteDomain') }}
            <input
              v-model="form.embedWebsiteDomain"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
              :placeholder="t('settings.addonsBlogEmbedWebsiteDomainPlaceholder')"
              @input="onEmbedWebsiteDomainInput"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.addonsBlogEmbedWebsiteDomainHint') }}
            </span>
            <span
              v-if="embedWebsiteOrigins.length"
              class="mt-1 block text-xs text-emerald-700 dark:text-emerald-300"
            >
              {{ t('settings.addonsBlogEmbedWebsiteOriginsAllowed', { origins: embedWebsiteOrigins.join(', ') }) }}
            </span>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsBlogUrlPrefix') }}
            <input
              v-model="pathPrefixDisplay"
              type="text"
              class="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
              placeholder="/blog/"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogUrlPrefixHint') }}</span>
          </label>

          <template v-if="showWebhookSetup">
            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsBlogWebhookUrl') }}
              <input
                v-model="form.publishWebhookUrl"
                type="url"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                :placeholder="suggestedPublishWebhookUrl || t('settings.addonsBlogWebhookUrlPlaceholder')"
                @input="onPublishWebhookUrlInput"
              />
              <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogWebhookDesc') }}</span>
              <span
                v-if="showSuggestedPublishWebhookHint"
                class="mt-1 block text-xs text-indigo-700 dark:text-indigo-300"
              >
                {{ t('settings.addonsBlogStaticSyncWebhookAutoFilled') }}
              </span>
            </label>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                :disabled="testingWebhook || !form.publishWebhookUrl"
                @click="sendTestWebhook"
              >
                {{ testingWebhook ? t('settings.addonsBlogWebhookTesting') : t('settings.addonsBlogSendTestWebhook') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                :disabled="generatingSecret"
                @click="generateSecret"
              >
                {{ generatingSecret ? t('states.loading') : t('settings.addonsBlogGenerateWebhookSecret') }}
              </button>
            </div>

            <p
              v-if="hasPublishWebhookSecret"
              class="text-xs text-emerald-700 dark:text-emerald-300"
            >
              {{ t('settings.addonsBlogWebhookSecretPresent') }}
            </p>
            <p
              v-if="oneTimeSecret"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {{ t('settings.addonsBlogWebhookSecretOnce', { secret: oneTimeSecret }) }}
            </p>
          </template>
        </div>

        <div v-if="showStaticSyncSetup" class="mt-6 space-y-4">
          <div class="space-y-3">
            <div
              v-for="endpoint in staticSyncEndpoints"
              :key="endpoint.key"
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ endpoint.label }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ endpoint.value || '—' }}</p>
                </div>
                <button
                  v-if="endpoint.value"
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(endpoint.value, endpoint.label)"
                >
                  {{ t('actions.copy') }}
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogStaticSyncEnvTemplate') }}</p>
                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ staticSyncEnvTemplate }}</pre>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(staticSyncEnvTemplate, t('settings.addonsBlogStaticSyncEnvTemplate'))"
              >
                {{ t('actions.copy') }}
              </button>
            </div>
          </div>

          <div v-if="staticSyncHostType === 'next'" class="space-y-4">
            <div class="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogVercelInstallTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogVercelInstallDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!embedOrgSlug || embedOrgSlug === 'your-org-slug'"
                  @click="copyText(vercelInstallCommand, t('settings.addonsBlogVercelInstallTitle'))"
                >
                  {{ t('settings.addonsBlogCopySnippet') }}
                </button>
              </div>
              <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                <li>{{ t('settings.addonsBlogVercelInstallStep1') }}</li>
                <li>{{ t('settings.addonsBlogVercelInstallStep2') }}</li>
                <li>{{ t('settings.addonsBlogVercelInstallStep3') }}</li>
                <li>{{ t('settings.addonsBlogVercelInstallStep4') }}</li>
              </ol>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelInstallCommand }}</code></pre>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogVercelUninstallTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogVercelUninstallDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(vercelUninstallCommand, t('settings.addonsBlogVercelUninstallTitle'))"
                >
                  {{ t('settings.addonsBlogCopySnippet') }}
                </button>
              </div>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelUninstallCommand }}</code></pre>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogVercelUpdateKitTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogVercelUpdateKitDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  :disabled="!embedOrgSlug || embedOrgSlug === 'your-org-slug'"
                  @click="copyText(vercelUpdateKitCommand, t('settings.addonsBlogVercelUpdateKitTitle'))"
                >
                  {{ t('settings.addonsBlogCopySnippet') }}
                </button>
              </div>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelUpdateKitCommand }}</code></pre>
            </div>

            <details class="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {{ t('settings.addonsBlogVercelStandaloneTitle') }}
              </summary>
              <div class="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogVercelStandaloneDesc') }}</p>
                <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                  <li>{{ t('settings.addonsBlogVercelStandaloneStep1') }}</li>
                  <li>{{ t('settings.addonsBlogVercelStandaloneStep2') }}</li>
                  <li>{{ t('settings.addonsBlogVercelStandaloneStep3') }}</li>
                  <li>{{ t('settings.addonsBlogVercelStandaloneStep4') }}</li>
                </ol>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelCreateCommand }}</code></pre>
                <button
                  type="button"
                  class="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  :disabled="!embedOrgSlug || embedOrgSlug === 'your-org-slug'"
                  @click="copyText(vercelCreateCommand, t('settings.addonsBlogVercelStandaloneTitle'))"
                >
                  {{ t('settings.addonsBlogCopySnippet') }}
                </button>
              </div>
            </details>

            <details class="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {{ t('settings.addonsBlogStaticSyncNextHtmlModeTitle') }}
              </summary>
              <div class="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogStaticSyncNextHtmlModeDesc') }}</p>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelStandaloneHtmlInstallCommand }}</code></pre>
                <button
                  type="button"
                  class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  :disabled="!embedOrgSlug || embedOrgSlug === 'your-org-slug'"
                  @click="copyText(vercelStandaloneHtmlInstallCommand, t('settings.addonsBlogStaticSyncNextHtmlModeTitle'))"
                >
                  {{ t('actions.copy') }}
                </button>
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogStaticSyncNextMvpNote') }}</p>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ localCliFullSyncCommand }}</code></pre>
                <button
                  type="button"
                  class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(localCliFullSyncCommand, t('settings.addonsBlogStaticSyncCliFull'))"
                >
                  {{ t('actions.copy') }}
                </button>
              </div>
            </details>
          </div>

          <div v-else-if="staticSyncHostType === 'php'" class="space-y-3">
            <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
              <li>{{ t('settings.addonsBlogStaticSyncPhpStep1') }}</li>
              <li>{{ t('settings.addonsBlogStaticSyncPhpStep2') }}</li>
              <li>{{ t('settings.addonsBlogStaticSyncPhpStep3') }}</li>
            </ol>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogStaticSyncDownloadPhp') }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ phpSyncDownloadUrl }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(phpSyncDownloadUrl, t('settings.addonsBlogStaticSyncDownloadPhp'))"
                >
                  {{ t('actions.copy') }}
                </button>
              </div>
            </div>
            <a
              :href="phpSyncDownloadUrl"
              download="arivu-blog-sync.php"
              class="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {{ t('settings.addonsBlogStaticSyncDownloadPhp') }}
            </a>
            <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ phpCurlDownloadCommand }}</code></pre>
            <button
              type="button"
              class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              @click="copyText(phpCurlDownloadCommand, t('settings.addonsBlogStaticSyncDownloadPhp'))"
            >
              {{ t('actions.copy') }}
            </button>
          </div>

          <div v-else-if="staticSyncHostType === 'cli'" class="space-y-3">
            <div
              v-for="command in staticSyncCliCommands"
              :key="command.key"
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ command.label }}</p>
                  <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ command.value }}</pre>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(command.value, command.label)"
                >
                  {{ t('actions.copy') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <template v-if="showEmbedSetup">
          <div class="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogDeployKitTitle') }}</p>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogDeployKitDesc') }}</p>
            </div>
            <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              <li>{{ t('settings.addonsBlogDeployKitStep1') }}</li>
              <li>{{ t('settings.addonsBlogDeployKitStep2') }}</li>
              <li>{{ t('settings.addonsBlogDeployKitStep3') }}</li>
            </ol>
            <button
              type="button"
              class="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!embedOrgSlug || embedOrgSlug === 'your-org-slug' || embedKitDownloading"
              @click="downloadEmbedStarterKit"
            >
              {{ embedKitDownloading ? t('settings.addonsBlogDeployKitDownloading') : t('settings.addonsBlogDeployKitDownload') }}
            </button>
          </div>

          <div class="mt-6 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogUnifiedEmbedSnippetLabel') }}</p>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsBlogUnifiedEmbedSnippetDesc') }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                @click="copyText(unifiedEmbedSnippet, t('settings.addonsBlogUnifiedEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsBlogCopySnippet') }}
              </button>
            </div>
            <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ unifiedEmbedSnippet }}</code></pre>
          </div>

          <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.addonsBlogEmbedDemoHint') }}
            <a
              :href="headlessListDemoUrl"
              class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('settings.addonsBlogOpenDemo') }}
            </a>
          </p>

          <details class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ t('settings.addonsBlogAdvancedEmbedsTitle') }}
            </summary>
            <div class="space-y-6 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogUnifiedPageSnippetLabel') }}</p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogUnifiedPageSnippetDesc') }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    @click="copyText(unifiedPageSnippet, t('settings.addonsBlogUnifiedPageSnippetLabel'))"
                  >
                    {{ t('settings.addonsBlogCopySnippet') }}
                  </button>
                </div>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ unifiedPageSnippet }}</code></pre>
              </div>

              <div v-for="snippet in advancedEmbedSnippets" :key="snippet.key">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ snippet.label }}</p>
                  <button
                    type="button"
                    class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    @click="copyText(snippet.value, snippet.label)"
                  >
                    {{ t('settings.addonsBlogCopySnippet') }}
                  </button>
                </div>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ snippet.description }}</p>
                <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ snippet.value }}</code></pre>
              </div>
            </div>
          </details>
        </template>

        <div class="mt-4 flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogEmbedPublicKeyLabel') }}</p>
            <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">
              {{ embedOrgSlug !== 'your-org-slug' ? embedOrgSlug : t('settings.addonsBlogEmbedPublicKeyPending') }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogEmbedPublicKeyHint') }}</p>
          </div>
          <button
            v-if="embedOrgSlug && embedOrgSlug !== 'your-org-slug'"
            type="button"
            class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            @click="copyText(embedOrgSlug, t('settings.addonsBlogEmbedPublicKeyLabel'))"
          >
            {{ t('actions.copy') }}
          </button>
        </div>

        <details class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
            {{ t('settings.addonsBlogDeveloperSetupTitle') }}
          </summary>
          <div class="space-y-6 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
            <div class="space-y-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsBlogIntegrationUrls') }}</p>
              <p v-if="!integrationRows.length" class="text-sm text-amber-700 dark:text-amber-300">
                {{ t('settings.addonsBlogIntegrationUrlsUnavailable') }}
              </p>
              <div
                v-for="row in integrationRows"
                :key="row.label"
                class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.label }}</p>
                    <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ row.url }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    @click="copyText(row.url, row.label)"
                  >
                    {{ t('actions.copy') }}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogRoutesTitle') }}</h4>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsBlogRoutesDesc') }}</p>
              <div class="mt-3 space-y-3">
                <div
                  v-for="route in blogRoutes"
                  :key="route.key"
                  class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ route.label }}</p>
                  <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ route.customerUrl }}</p>
                  <a
                    v-if="route.demoUrl"
                    :href="route.demoUrl"
                    class="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ t('settings.addonsBlogOpenDemo') }}
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsBlogDeveloperSetupDesc') }}</h4>
              <div class="mt-4 space-y-4">
                <div v-for="example in integrationExamples" :key="example.key">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ example.label }}</p>
                    <button
                      type="button"
                      class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      @click="copyText(example.value, example.label)"
                    >
                      {{ t('actions.copy') }}
                    </button>
                  </div>
                  <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ example.value }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </details>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { getApiOrigin } from '@/config/apiBase';
import { buildEmbedStarterKitZip, downloadBlob } from '@/modules/contentStudio/headless/buildEmbedStarterKit';

const emit = defineEmits(['back']);
const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const generatingSecret = ref(false);
const testingWebhook = ref(false);
const embedKitDownloading = ref(false);
const dirty = ref(false);
const error = ref('');
const collections = ref([]);
const hasPublishWebhookSecret = ref(false);
const oneTimeSecret = ref('');
const staticSyncHostType = ref('embed');
const publishWebhookUrlManuallyEdited = ref(false);
const suppressPublishWebhookAutoFill = ref(false);
const savedEmbedWebsiteOrigins = ref([]);

const showEmbedSetup = computed(() => staticSyncHostType.value === 'embed');
const showStaticSyncSetup = computed(() => staticSyncHostType.value !== 'embed');
const showWebhookSetup = computed(() => showStaticSyncSetup.value);

const customerSiteSetupHint = computed(() => {
  switch (staticSyncHostType.value) {
    case 'embed':
      return t('settings.addonsBlogStaticSyncEmbedNote');
    case 'next':
      return t('settings.addonsBlogStaticSyncNextHint');
    case 'php':
      return t('settings.addonsBlogStaticSyncPhpSteps');
    case 'cli':
      return t('settings.addonsBlogStaticSyncCliSteps');
    default:
      return t('settings.addonsBlogStaticSyncDesc');
  }
});

const integration = reactive({
  headlessApiBase: '',
  headlessPublicKey: '',
  headlessOrgKey: '',
  customerUrlPrefix: '/blog',
  blogListUrl: '',
  blogPostUrlTemplate: '',
  blogRssUrl: '',
  blogCollectionRssUrlTemplate: '',
  blogPostRssUrlTemplate: '',
  blogCollectionsUrl: '',
  blogRecentUrl: '',
  blogPopularUrl: '',
  blogSitemapUrl: '',
  manifestUrl: '',
  examplePostSlug: '',
  exampleBlogPostExportUrl: '',
  homeExportUrl: '',
  staticSitemapUrl: '',
  exportPathPrefix: '',
});

const form = reactive({
  urlPrefix: '/blog',
  rssEnabled: true,
  commentsEnabled: false,
  defaultCollectionId: null,
  headlessApiEnabled: true,
  embedWebsiteDomain: '',
  publishWebhookUrl: '',
});

let snapshot = '';

const embedOrigin = computed(() => getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : ''));
const embedOrgSlug = computed(() => integration.headlessPublicKey || integration.headlessOrgKey || 'your-org-slug');

function normalizePathPrefix(raw) {
  const trimmed = String(raw || '/blog').trim() || '/blog';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

const pathPrefix = computed(() => normalizePathPrefix(form.urlPrefix));

const pathPrefixDisplay = computed({
  get() {
    return normalizePathPrefix(form.urlPrefix);
  },
  set(value) {
    form.urlPrefix = normalizePathPrefix(value);
    syncDirty();
  },
});

const examplePostApiUrl = computed(() => {
  const pattern = integration.blogPostUrlTemplate || '';
  if (!pattern) return '';
  const slug = String(integration.examplePostSlug || '').trim() || 'your-post-slug';
  return pattern.includes('{slug}') ? pattern.replace('{slug}', slug) : pattern;
});

const vercelInstallCommand = computed(() => {
  const org = embedOrgSlug.value || 'blog_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = pathPrefix.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-blog-install.mjs | node - install`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
  ].join(' \\\n  ');
});

const vercelCreateCommand = computed(() => {
  const org = embedOrgSlug.value || 'blog_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = pathPrefix.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-blog-install.mjs | node - create ./blog`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
  ].join(' \\\n  ');
});

const vercelStandaloneHtmlInstallCommand = computed(() => {
  const org = embedOrgSlug.value || 'blog_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = pathPrefix.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-blog-install.mjs | node - install`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
    '--mode=standalone-html',
  ].join(' \\\n  ');
});

const vercelUninstallCommand = computed(() => {
  const origin = embedOrigin.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-blog-install.mjs | node - uninstall`,
    `--api-origin=${origin}`,
  ].join(' \\\n  ');
});

const vercelUpdateKitCommand = computed(() => {
  const org = embedOrgSlug.value || 'blog_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = pathPrefix.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-blog-install.mjs | node - install`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
    '--update-kit',
  ].join(' \\\n  ');
});

const phpSyncDownloadUrl = computed(() => {
  const origin = embedOrigin.value || 'https://your-arivu-host';
  return `${origin}/static-sync/arivu-blog-sync.php`;
});

const phpCurlDownloadCommand = computed(() => (
  `curl -fsSL "${phpSyncDownloadUrl.value}" -o arivu-blog-sync.php`
));

const localCliFullSyncCommand = computed(() => {
  const org = embedOrgSlug.value;
  const origin = embedOrigin.value || 'https://your-arivu-host';
  return `node tools/help-sync/bin/arivu-help-sync.js sync --addon blog --full --org ${org} --dest ./public/blog --api-origin ${origin}`;
});

const embedWebsiteOrigins = computed(() => (
  savedEmbedWebsiteOrigins.value.length ? savedEmbedWebsiteOrigins.value : []
));

const integrationUrlsUnavailable = computed(() => (
  !form.headlessApiEnabled || !integration.headlessApiBase
));

const staticSyncEndpoints = computed(() => {
  const exportPattern = integration.exampleBlogPostExportUrl || '';
  const exampleExportUrl = exportPattern.includes('{slug}')
    ? exportPattern.replace('{slug}', 'example-post')
    : exportPattern;
  return [
    {
      key: 'manifestUrl',
      label: t('settings.addonsBlogStaticSyncManifestUrl'),
      value: integration.manifestUrl,
    },
    {
      key: 'exampleBlogPostExportUrl',
      label: t('settings.addonsBlogStaticSyncExportUrl'),
      value: exampleExportUrl,
    },
    {
      key: 'staticSitemapUrl',
      label: t('settings.addonsBlogStaticSyncSitemapUrl'),
      value: integration.staticSitemapUrl,
    },
    {
      key: 'homeExportUrl',
      label: t('settings.addonsBlogStaticSyncHomeExportUrl'),
      value: integration.homeExportUrl,
    },
  ];
});

const staticSyncEnvTemplate = computed(() => {
  const siteOrigin = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const hostType = staticSyncHostType.value;
  if (hostType === 'next') {
    return [
      `ARIVU_ORG=${embedOrgSlug.value}`,
      `ARIVU_API_ORIGIN=${embedOrigin.value}`,
      `BLOG_URL_PREFIX=${pathPrefix.value}`,
      'ARIVU_SYNC_MODE=layout',
      'ARIVU_SYNC_DEST=./public',
      `SITE_ORIGIN=${siteOrigin}`,
      'ARIVU_BLOG_WEBHOOK_SECRET=',
      'VERCEL_DEPLOY_HOOK_URL=',
    ].join('\n');
  }
  return [
    `ARIVU_ORG=${embedOrgSlug.value}`,
    `ARIVU_API_ORIGIN=${embedOrigin.value}`,
    `BLOG_URL_PREFIX=${pathPrefix.value}`,
    'ARIVU_SYNC_DEST=./public/blog',
    'ARIVU_BLOG_WEBHOOK_SECRET=',
    `SITE_ORIGIN=${siteOrigin}`,
  ].join('\n');
});

function normalizeWebsiteOrigin(domain) {
  const raw = String(domain || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

const STATIC_SYNC_WEBHOOK_PATHS = {
  next: '/api/arivu-webhook/blog',
  php: '/arivu-blog-sync.php',
  cli: '/api/arivu-webhook/blog',
  embed: '',
};

function buildSuggestedPublishWebhookUrl(domain, hostType) {
  const origin = normalizeWebsiteOrigin(domain);
  if (!origin || hostType === 'embed') return '';
  const path = STATIC_SYNC_WEBHOOK_PATHS[hostType] || STATIC_SYNC_WEBHOOK_PATHS.next;
  return `${origin}${path}`;
}

function inferStaticSyncHostType(webhookUrl) {
  const url = String(webhookUrl || '').trim();
  if (!url) return 'embed';
  if (url.includes('arivu-blog-sync.php')) return 'php';
  if (url.includes('/api/arivu-webhook')) return 'next';
  return 'next';
}

function normalizeStoredHostType(stored, webhookUrl) {
  const allowed = new Set(['embed', 'next', 'php', 'cli']);
  const raw = String(stored || '').trim().toLowerCase();
  if (allowed.has(raw)) return raw;
  return inferStaticSyncHostType(webhookUrl);
}

function isSuggestedPublishWebhookUrl(url, domain, hostType) {
  const suggested = buildSuggestedPublishWebhookUrl(domain, hostType);
  return Boolean(suggested && String(url || '').trim() === suggested);
}

const suggestedPublishWebhookUrl = computed(() => (
  buildSuggestedPublishWebhookUrl(form.embedWebsiteDomain, staticSyncHostType.value)
));

const showSuggestedPublishWebhookHint = computed(() => (
  Boolean(suggestedPublishWebhookUrl.value)
  && isSuggestedPublishWebhookUrl(form.publishWebhookUrl, form.embedWebsiteDomain, staticSyncHostType.value)
  && staticSyncHostType.value !== 'embed'
));

function applySuggestedPublishWebhookUrl() {
  if (publishWebhookUrlManuallyEdited.value) return;
  suppressPublishWebhookAutoFill.value = true;
  form.publishWebhookUrl = suggestedPublishWebhookUrl.value;
  suppressPublishWebhookAutoFill.value = false;
}

function onPublishWebhookUrlInput() {
  if (!suppressPublishWebhookAutoFill.value) {
    publishWebhookUrlManuallyEdited.value = true;
  }
  syncDirty();
}

function onEmbedWebsiteDomainInput() {
  applySuggestedPublishWebhookUrl();
  syncDirty();
}

function onStaticSyncHostTypeChange() {
  applySuggestedPublishWebhookUrl();
  syncDirty();
}

const staticSyncCliCommands = computed(() => {
  const org = embedOrgSlug.value;
  const origin = embedOrigin.value || 'https://your-arivu-host';
  return [
    {
      key: 'npx-full',
      label: t('settings.addonsBlogStaticSyncCliNpxFull'),
      value: `npx @arivu/help-sync sync --addon blog --full --org ${org} --dest ./public/blog --api-origin ${origin}`,
    },
    {
      key: 'local-full',
      label: t('settings.addonsBlogStaticSyncCliFull'),
      value: localCliFullSyncCommand.value,
    },
    {
      key: 'slug',
      label: t('settings.addonsBlogStaticSyncCliSlug'),
      value: `npx @arivu/help-sync sync --addon blog --org ${org} --dest ./public/blog --api-origin ${origin} --slug example-post`,
    },
  ];
});

const headlessListDemoUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgSlug.value && embedOrgSlug.value !== 'your-org-slug') params.set('org', embedOrgSlug.value);
  const query = params.toString();
  return query ? `/examples/headless-blog-list?${query}` : '/examples/headless-blog-list';
});

const headlessPostDemoUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgSlug.value && embedOrgSlug.value !== 'your-org-slug') params.set('org', embedOrgSlug.value);
  const slug = String(integration.examplePostSlug || '').trim();
  if (slug) {
    params.set('slug', slug);
    return `/examples/headless-blog?${params.toString()}`;
  }
  return headlessListDemoUrl.value;
});

const blogRoutes = computed(() => {
  const siteHost = String(form.embedWebsiteDomain || 'www.example.com').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'www.example.com';
  const siteBase = `https://${siteHost.replace(/\/$/, '')}`;
  const path = pathPrefix.value;
  const exampleSlug = String(integration.examplePostSlug || 'your-post-slug').trim() || 'your-post-slug';
  return [
    {
      key: 'list',
      label: t('settings.addonsBlogRouteList'),
      customerUrl: `${siteBase}${path}`,
      demoUrl: headlessListDemoUrl.value,
    },
    {
      key: 'post',
      label: t('settings.addonsBlogRoutePost'),
      customerUrl: `${siteBase}${path}${exampleSlug}`,
      demoUrl: headlessPostDemoUrl.value,
    },
  ];
});

function buildUnifiedScriptAttrs() {
  return [
    `src="${embedOrigin.value}/embed/headless-blog.js"`,
    `data-api-origin="${embedOrigin.value}"`,
    `data-org="${embedOrgSlug.value}"`,
    'data-target="#arivu-blog"',
    `data-path-prefix="${pathPrefix.value}"`,
    `data-link-prefix="${pathPrefix.value}"`,
  ].join('\n  ');
}

const embedStylesheetLink = computed(() => (
  `<link rel="preload" href="${embedOrigin.value}/embed/headless-blocks.css" as="style" />\n<link rel="stylesheet" href="${embedOrigin.value}/embed/headless-blocks.css" />`
));

// `<\u002Fscript>`: a literal closing script tag ends this SFC block; lint --fix strips `<\/script>`.
const unifiedEmbedSnippet = computed(() => (
  `${embedStylesheetLink.value}\n<div id="arivu-blog"></div>\n<script\n  ${buildUnifiedScriptAttrs()}\n><\u002Fscript>`
));

const unifiedPageSnippet = computed(() => (
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Blog</title>\n  ${embedStylesheetLink.value}\n</head>\n<body>\n  <main id="arivu-blog"></main>\n  <script\n    ${buildUnifiedScriptAttrs()}\n  ><\u002Fscript>\n</body>\n</html>`
));

const advancedEmbedSnippets = computed(() => [
  {
    key: 'list',
    label: t('settings.addonsBlogEmbedListSnippetLabel'),
    description: t('settings.addonsBlogEmbedListSnippetDesc'),
    value: `${embedStylesheetLink.value}\n<div id="blog-list"></div>\n<script\n  src="${embedOrigin.value}/embed/headless-blog-list.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-target="#blog-list"\n  data-link-prefix="${pathPrefix.value}"\n><\u002Fscript>`,
  },
  {
    key: 'post',
    label: t('settings.addonsBlogEmbedPostSnippetLabel'),
    description: t('settings.addonsBlogEmbedPostSnippetDesc'),
    value: `${embedStylesheetLink.value}\n<div id="blog-post"></div>\n<script\n  src="${embedOrigin.value}/embed/headless-blog-post.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-slug="your-post-slug"\n  data-target="#blog-post"\n  data-show-feedback-footer="false"\n  data-link-prefix="${pathPrefix.value}"\n><\u002Fscript>`,
  },
]);

async function downloadEmbedStarterKit() {
  if (!embedOrgSlug.value || embedOrgSlug.value === 'your-org-slug' || embedKitDownloading.value) return;
  embedKitDownloading.value = true;
  try {
    const blob = await buildEmbedStarterKitZip({
      apiOrigin: embedOrigin.value,
      orgKey: embedOrgSlug.value,
      pathPrefix: pathPrefix.value,
      siteDomain: form.embedWebsiteDomain,
      title: 'Blog',
      variant: 'blog',
    });
    downloadBlob(blob, 'arivu-blog-deploy-kit.zip');
    notifications.success(t('settings.addonsBlogDeployKitDownloaded'));
  } catch {
    notifications.error(t('settings.addonsBlogDeployKitDownloadFailed'));
  } finally {
    embedKitDownloading.value = false;
  }
}

const integrationRows = computed(() => ([
  { label: t('settings.addonsBlogIntegrationList'), url: integration.blogListUrl },
  { label: t('settings.addonsBlogIntegrationPost'), url: integration.blogPostUrlTemplate },
  { label: t('settings.addonsBlogIntegrationRss'), url: integration.blogRssUrl },
  { label: t('settings.addonsBlogIntegrationRssCategory'), url: integration.blogCollectionRssUrlTemplate },
  { label: t('settings.addonsBlogIntegrationRssPost'), url: integration.blogPostRssUrlTemplate },
  { label: t('settings.addonsBlogIntegrationRecent'), url: integration.blogRecentUrl },
  { label: t('settings.addonsBlogIntegrationPopular'), url: integration.blogPopularUrl },
  { label: t('settings.addonsBlogIntegrationCollections'), url: integration.blogCollectionsUrl },
  { label: t('settings.addonsBlogIntegrationSitemap'), url: integration.blogSitemapUrl },
]).filter((row) => row.url));

const integrationExamples = computed(() => {
  const listUrl = integration.blogListUrl || `${integration.headlessApiBase}/blog`;
  const postUrl = examplePostApiUrl.value || `${integration.headlessApiBase}/blog/example-post`;
  const rssUrl = integration.blogRssUrl || '';
  const examples = [
    {
      key: 'curl-list',
      label: t('settings.addonsBlogExampleCurlList'),
      value: `curl -fsSL "${listUrl}"`,
    },
    {
      key: 'curl-post',
      label: t('settings.addonsBlogExampleCurlPost'),
      value: `curl -fsSL "${postUrl}"`,
    },
  ];
  if (rssUrl) {
    examples.push({
      key: 'curl-rss',
      label: t('settings.addonsBlogExampleCurlRss'),
      value: `curl -fsSL "${rssUrl}"`,
    });
  }
  examples.push({
    key: 'fetch',
    label: t('settings.addonsBlogExampleFetch'),
    value: `const res = await fetch('${postUrl}');\nconst json = await res.json();\nconsole.log(json.data.title, json.data.blocks);`,
  });
  return examples;
});

function formSnapshot() {
  return JSON.stringify({
    urlPrefix: form.urlPrefix,
    rssEnabled: form.rssEnabled,
    commentsEnabled: form.commentsEnabled,
    defaultCollectionId: form.defaultCollectionId,
    headlessApiEnabled: form.headlessApiEnabled,
    embedWebsiteDomain: form.embedWebsiteDomain,
    publishWebhookUrl: form.publishWebhookUrl,
    staticSyncHostType: staticSyncHostType.value,
  });
}

function syncDirty() {
  dirty.value = formSnapshot() !== snapshot;
}

function applyPayload(data) {
  const settings = data?.settings || {};
  form.urlPrefix = normalizePathPrefix(settings.urlPrefix || '/blog');
  form.rssEnabled = settings.rssEnabled !== false;
  form.commentsEnabled = settings.commentsEnabled === true;
  form.defaultCollectionId = settings.defaultCollectionId || null;
  form.headlessApiEnabled = settings.publishing?.headlessApiEnabled !== false;
  form.embedWebsiteDomain = settings.publishing?.embedWebsiteDomain || '';
  form.publishWebhookUrl = settings.publishing?.publishWebhookUrl || '';
  hasPublishWebhookSecret.value = Boolean(settings.publishing?.hasPublishWebhookSecret);
  savedEmbedWebsiteOrigins.value = Array.isArray(settings.publishing?.embedWebsiteOrigins)
    ? settings.publishing.embedWebsiteOrigins
    : [];
  staticSyncHostType.value = normalizeStoredHostType(
    settings.publishing?.staticSyncHostType,
    form.publishWebhookUrl,
  );
  collections.value = Array.isArray(data?.collections) ? data.collections : [];
  integration.headlessApiBase = data?.integration?.headlessApiBase || '';
  integration.headlessPublicKey = data?.integration?.headlessPublicKey || '';
  integration.headlessOrgKey = data?.integration?.headlessOrgKey || '';
  integration.customerUrlPrefix = data?.integration?.customerUrlPrefix || settings.urlPrefix || '/blog';
  integration.blogListUrl = data?.integration?.blogListUrl || '';
  integration.blogPostUrlTemplate = data?.integration?.blogPostUrlTemplate || '';
  integration.blogRssUrl = data?.integration?.blogRssUrl || '';
  integration.blogCollectionRssUrlTemplate = data?.integration?.blogCollectionRssUrlTemplate || '';
  integration.blogPostRssUrlTemplate = data?.integration?.blogPostRssUrlTemplate || '';
  integration.blogCollectionsUrl = data?.integration?.blogCollectionsUrl || '';
  integration.blogRecentUrl = data?.integration?.blogRecentUrl || '';
  integration.blogPopularUrl = data?.integration?.blogPopularUrl || '';
  integration.blogSitemapUrl = data?.integration?.blogSitemapUrl || '';
  integration.manifestUrl = data?.integration?.manifestUrl || '';
  integration.exampleBlogPostExportUrl = data?.integration?.exampleBlogPostExportUrl || '';
  integration.examplePostSlug = data?.integration?.examplePostSlug || '';
  integration.homeExportUrl = data?.integration?.homeExportUrl || '';
  integration.staticSitemapUrl = data?.integration?.staticSitemapUrl || '';
  integration.exportPathPrefix = data?.integration?.exportPathPrefix || '';
  publishWebhookUrlManuallyEdited.value = Boolean(form.publishWebhookUrl)
    && !isSuggestedPublishWebhookUrl(form.publishWebhookUrl, form.embedWebsiteDomain, staticSyncHostType.value);
  if (!form.publishWebhookUrl && form.embedWebsiteDomain && staticSyncHostType.value !== 'embed') {
    applySuggestedPublishWebhookUrl();
  }
  snapshot = formSnapshot();
  dirty.value = false;
}

async function copyText(value, label = '') {
  try {
    await navigator.clipboard.writeText(String(value || ''));
    notifications.success(label ? t('settings.addonsBlogCopiedNamed', { label }) : t('settings.addonsBlogCopied'));
  } catch {
    notifications.error(t('settings.addonsBlogCopyFailed'));
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/settings/addons/blog/settings', { method: 'GET', cache: 'no-store' });
    if (!res?.success) throw new Error(res?.message || t('settings.addonsBlogLoadFailed'));
    applyPayload(res);
  } catch (err) {
    error.value = err?.message || t('settings.addonsBlogLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const { pickDirtyFields } = await import('@/utils/pickDirtyFields');
    const current = {
      urlPrefix: form.urlPrefix,
      rssEnabled: form.rssEnabled,
      commentsEnabled: form.commentsEnabled,
      defaultCollectionId: form.defaultCollectionId,
      headlessApiEnabled: form.headlessApiEnabled,
      embedWebsiteDomain: form.embedWebsiteDomain,
      publishWebhookUrl: form.publishWebhookUrl,
      staticSyncHostType: staticSyncHostType.value,
    };
    const baseline = snapshot ? JSON.parse(snapshot) : {};
    const payload = pickDirtyFields(current, baseline);
    if (Object.keys(payload).length === 0) {
      saving.value = false;
      return;
    }

    const res = await apiClient.put('/settings/addons/blog/settings', payload);
    if (!res?.success) throw new Error(res?.message || t('settings.addonsBlogSaveFailed'));
    applyPayload(res);
    notifications.success(t('settings.addonsBlogSaveSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsBlogSaveFailed'));
  } finally {
    saving.value = false;
  }
}

async function sendTestWebhook() {
  testingWebhook.value = true;
  try {
    const res = await apiClient.post('/settings/addons/blog/settings/test-webhook', {}, { cache: 'no-store' });
    if (!res?.success) throw new Error(res?.message || t('settings.addonsBlogWebhookTestFailed'));
    notifications.success(t('settings.addonsBlogWebhookTestSent'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsBlogWebhookTestFailed'));
  } finally {
    testingWebhook.value = false;
  }
}

async function generateSecret() {
  generatingSecret.value = true;
  try {
    const res = await apiClient.post('/settings/addons/blog/settings/generate-webhook-secret', {}, { cache: 'no-store' });
    if (!res?.success) throw new Error(res?.message || t('settings.addonsBlogWebhookSecretGenerateFailed'));
    oneTimeSecret.value = res.publishWebhookSecret || '';
    applyPayload(res);
    notifications.success(t('settings.addonsBlogWebhookSecretGenerated'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsBlogWebhookSecretGenerateFailed'));
  } finally {
    generatingSecret.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>
