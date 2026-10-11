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
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesSettingsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesSettingsDesc') }}</p>
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
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesGeneralTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesGeneralDesc') }}</p>

        <div class="mt-5 space-y-4">
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesPortalPublishing') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.portalPublishing"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.portalPublishing ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.portalPublishing = !form.portalPublishing; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.portalPublishing ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>

          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesCaseDeflection') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.caseDeflectionEnabled"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.caseDeflectionEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.caseDeflectionEnabled = !form.caseDeflectionEnabled; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.caseDeflectionEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesDefaultCollection') }}
            <select
              v-model="form.defaultCollectionId"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="syncDirty()"
            >
              <option :value="null">{{ t('contentStudio.noCollection') }}</option>
              <option v-for="collection in collections" :key="collection._id" :value="collection._id">
                {{ collectionLabel(collection) }}
              </option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesStaleContentDays') }}
            <input
              v-model.number="form.staleContentAlertDays"
              type="number"
              min="7"
              max="365"
              class="mt-1 w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @input="syncDirty()"
            />
          </label>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesAppearanceTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesAppearanceDesc') }}</p>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
            {{ t('settings.addonsArticlesLayoutPreset') }}
            <select
              v-model="form.appearance.layoutPreset"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="syncDirty"
            >
              <option value="classic">{{ t('settings.addonsArticlesLayoutClassic') }}</option>
              <option value="help_center">{{ t('settings.addonsArticlesLayoutHelpCenter') }}</option>
              <option value="minimal">{{ t('settings.addonsArticlesLayoutMinimal') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
            {{ t('settings.addonsArticlesPrimaryColor') }}
            <div class="mt-1 flex items-center gap-2">
              <input v-model="form.appearance.primaryColor" type="color" class="h-10 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600" @input="syncDirty" />
              <input v-model="form.appearance.primaryColor" type="text" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
            </div>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
            {{ t('settings.addonsArticlesLogoUrl') }}
            <input v-model="form.appearance.logoUrl" type="url" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
          </label>

          <label class="flex items-center justify-between gap-4 lg:col-span-2">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesShowLogoInHeader') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.appearance.showLogoInHeader"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.appearance.showLogoInHeader ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.appearance.showLogoInHeader = !form.appearance.showLogoInHeader; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.appearance.showLogoInHeader ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
        </div>

        <details class="mt-5 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
            {{ t('settings.addonsArticlesAdvancedAppearanceTitle') }}
          </summary>
          <div class="grid grid-cols-1 gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-700 lg:grid-cols-2">
            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsArticlesSecondaryColor') }}
              <div class="mt-1 flex items-center gap-2">
                <input v-model="form.appearance.secondaryColor" type="color" class="h-10 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600" @input="syncDirty" />
                <input v-model="form.appearance.secondaryColor" type="text" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
              </div>
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsArticlesBodyFont') }}
              <input v-model="form.appearance.bodyFont" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsArticlesHeadingFont') }}
              <input v-model="form.appearance.headingFont" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
              {{ t('settings.addonsArticlesContentWidth') }}
              <select v-model="form.appearance.contentWidth" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
                <option value="narrow">{{ t('settings.contentPublishingWidthNarrow') }}</option>
                <option value="standard">{{ t('settings.contentPublishingWidthStandard') }}</option>
                <option value="wide">{{ t('settings.contentPublishingWidthWide') }}</option>
              </select>
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsArticlesBorderRadius') }}
              <select v-model="form.appearance.borderRadius" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
                <option value="none">{{ t('settings.contentPublishingRadiusNone') }}</option>
                <option value="sm">{{ t('settings.contentPublishingRadiusSm') }}</option>
                <option value="md">{{ t('settings.contentPublishingRadiusMd') }}</option>
                <option value="lg">{{ t('settings.contentPublishingRadiusLg') }}</option>
              </select>
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.addonsArticlesDefaultCoverPosition') }}
              <select v-model="form.appearance.defaultCoverPosition" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
                <option value="below-title">{{ t('settings.addonsArticlesCoverBelowTitle') }}</option>
                <option value="above-title">{{ t('settings.addonsArticlesCoverAboveTitle') }}</option>
              </select>
            </label>

            <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
              {{ t('settings.addonsArticlesDefaultSubtitleSize') }}
              <select v-model="form.appearance.defaultSubtitleSize" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
                <option value="sm">{{ t('settings.addonsArticlesSubtitleSm') }}</option>
                <option value="md">{{ t('settings.addonsArticlesSubtitleMd') }}</option>
                <option value="lg">{{ t('settings.addonsArticlesSubtitleLg') }}</option>
                <option value="xl">{{ t('settings.addonsArticlesSubtitleXl') }}</option>
              </select>
            </label>
          </div>
        </details>

        <div
          class="content-studio-article mt-5 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-600"
          :class="previewClass"
          :style="previewStyle"
        >
          <div v-if="form.appearance.showLogoInHeader && form.appearance.logoUrl" class="content-studio-article__brand mb-3">
            <img :src="form.appearance.logoUrl" alt="" class="content-studio-article__logo max-h-8" />
          </div>
          <div class="content-studio-article__body">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.addonsArticlesAppearancePreviewLabel') }}</p>
            <h4 class="mt-2 text-lg font-semibold" :style="{ color: form.appearance.primaryColor, fontFamily: form.appearance.headingFont }">
              {{ t('settings.addonsArticlesAppearancePreviewTitle') }}
            </h4>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300" :style="{ fontFamily: form.appearance.bodyFont }">
              {{ t('settings.addonsArticlesAppearancePreviewBody') }}
            </p>
            <a href="#" class="mt-2 inline-block text-sm" :style="{ color: form.appearance.secondaryColor }">{{ t('settings.addonsArticlesAppearancePreviewLink') }}</a>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesCustomerSiteTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesCustomerSiteDesc') }}</p>
        <p
          v-if="integrationUrlsUnavailable"
          class="mt-2 text-sm text-amber-700 dark:text-amber-300"
        >
          {{ t('settings.addonsArticlesIntegrationUrlsUnavailable') }}
        </p>

        <label class="mt-5 block text-sm text-gray-600 dark:text-gray-300">
          {{ t('settings.addonsArticlesCustomerSiteSetupType') }}
          <select
            v-model="staticSyncHostType"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:max-w-md"
            @change="onStaticSyncHostTypeChange"
          >
            <option value="embed">{{ t('settings.addonsArticlesStaticSyncHostEmbed') }}</option>
            <option value="next">{{ t('settings.addonsArticlesStaticSyncHostNext') }}</option>
            <option value="php">{{ t('settings.addonsArticlesStaticSyncHostPhp') }}</option>
            <option value="cli">{{ t('settings.addonsArticlesStaticSyncHostCli') }}</option>
          </select>
        </label>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">{{ customerSiteSetupHint }}</p>

        <div class="mt-5 space-y-4 text-sm">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input v-model="form.headlessApiEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" @change="syncDirty" />
            {{ t('settings.contentPublishingHeadlessApiEnabled') }}
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesEmbedWebsiteDomain') }}
            <input
              v-model="form.embedWebsiteDomain"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
              placeholder="www.example.com"
              @input="onEmbedWebsiteDomainInput"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesEmbedWebsiteDomainHint') }}</span>
            <span
              v-if="embedWebsiteOrigins.length"
              class="mt-1 block text-xs text-emerald-700 dark:text-emerald-300"
            >
              {{ t('settings.addonsArticlesEmbedWebsiteOriginsAllowed', { origins: embedWebsiteOrigins.join(', ') }) }}
            </span>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesEmbedPathPrefix') }}
            <input
              v-model="embedPathPrefix"
              type="text"
              class="mt-1 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
              placeholder="/help/"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesEmbedPathPrefixHint') }}</span>
          </label>

          <template v-if="showWebhookSetup">
            <label class="block text-sm text-gray-600 dark:text-gray-300">
              {{ t('settings.contentPublishingWebhookUrl') }}
              <input
                v-model="form.publishWebhookUrl"
                type="url"
                class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                :placeholder="suggestedPublishWebhookUrl || 'https://example.com/api/arivu-webhook'"
                @input="onPublishWebhookUrlInput"
              />
              <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesWebhookDesc') }}</span>
              <span
                v-if="showSuggestedPublishWebhookHint"
                class="mt-1 block text-xs text-indigo-700 dark:text-indigo-300"
              >
                {{ t('settings.addonsArticlesWebhookAutoFilled') }}
              </span>
            </label>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                :disabled="!form.publishWebhookUrl || webhookTesting"
                @click="sendTestWebhook"
              >
                {{ webhookTesting ? t('settings.addonsArticlesWebhookTesting') : t('settings.addonsArticlesSendTestWebhook') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                :disabled="webhookSecretGenerating"
                @click="generateWebhookSecret"
              >
                {{ webhookSecretGenerating ? t('settings.addonsArticlesWebhookSecretGenerating') : t('settings.addonsArticlesGenerateWebhookSecret') }}
              </button>
            </div>

            <p
              v-if="publishWebhookSecretUnreadable"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {{ t('settings.addonsArticlesWebhookSecretUnreadable') }}
            </p>
            <p
              v-else-if="hasPublishWebhookSecret"
              class="text-xs text-emerald-700 dark:text-emerald-300"
            >
              {{ t('settings.addonsArticlesWebhookSecretConfigured') }}
            </p>
            <p
              v-if="generatedWebhookSecret"
              class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {{ t('settings.addonsArticlesWebhookSecretOnce', { secret: generatedWebhookSecret }) }}
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
                  {{ t('settings.addonsArticlesCopyUrl') }}
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesStaticSyncEnvTemplate') }}</p>
                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ staticSyncEnvTemplate }}</pre>
              </div>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(staticSyncEnvTemplate, t('settings.addonsArticlesStaticSyncEnvTemplate'))"
              >
                {{ t('settings.addonsArticlesCopyUrl') }}
              </button>
            </div>
          </div>

          <div v-if="staticSyncHostType === 'next'" class="space-y-4">
            <div class="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesVercelInstallTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesVercelInstallDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!embedOrgKey"
                  @click="copyText(vercelInstallCommand, t('settings.addonsArticlesVercelInstallTitle'))"
                >
                  {{ t('settings.addonsArticlesCopySnippet') }}
                </button>
              </div>
              <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                <li>{{ t('settings.addonsArticlesVercelInstallStep1') }}</li>
                <li>{{ t('settings.addonsArticlesVercelInstallStep2') }}</li>
                <li>{{ t('settings.addonsArticlesVercelInstallStep3') }}</li>
                <li>{{ t('settings.addonsArticlesVercelInstallStep4') }}</li>
              </ol>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelInstallCommand }}</code></pre>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesVercelUninstallTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesVercelUninstallDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  @click="copyText(vercelUninstallCommand, t('settings.addonsArticlesVercelUninstallTitle'))"
                >
                  {{ t('settings.addonsArticlesCopySnippet') }}
                </button>
              </div>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelUninstallCommand }}</code></pre>
            </div>

            <div class="rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesVercelUpdateKitTitle') }}</p>
                  <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesVercelUpdateKitDesc') }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  :disabled="!embedOrgKey"
                  @click="copyText(vercelUpdateKitCommand, t('settings.addonsArticlesVercelUpdateKitTitle'))"
                >
                  {{ t('settings.addonsArticlesCopySnippet') }}
                </button>
              </div>
              <pre class="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelUpdateKitCommand }}</code></pre>
            </div>

            <details class="rounded-lg border border-gray-200 dark:border-gray-700">
              <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                {{ t('settings.addonsArticlesVercelStandaloneTitle') }}
              </summary>
              <div class="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                <p class="text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesVercelStandaloneDesc') }}</p>
                <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ vercelCreateCommand }}</code></pre>
                <button
                  type="button"
                  class="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  :disabled="!embedOrgKey || vercelKitDownloading"
                  @click="downloadVercelStandaloneKit"
                >
                  {{ vercelKitDownloading ? t('settings.addonsArticlesVercelStandaloneDownloading') : t('settings.addonsArticlesVercelStandaloneDownload') }}
                </button>
              </div>
            </details>
          </div>

          <div v-else-if="staticSyncHostType === 'php'" class="space-y-3">
            <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
              <li>{{ t('settings.addonsArticlesPhpDeployStep1') }}</li>
              <li>{{ t('settings.addonsArticlesPhpDeployStep2') }}</li>
              <li>{{ t('settings.addonsArticlesPhpDeployStep3') }}</li>
            </ol>
            <button
              type="button"
              class="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!embedOrgKey || phpSyncDownloading"
              @click="downloadConfiguredPhpSync"
            >
              {{ phpSyncDownloading ? t('settings.addonsArticlesPhpDeployDownloading') : t('settings.addonsArticlesStaticSyncDownloadPhp') }}
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
                  {{ t('settings.addonsArticlesCopyUrl') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <template v-if="showEmbedSetup">
          <div class="mt-6 space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesDeployKitTitle') }}</p>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesDeployKitDesc') }}</p>
            </div>
            <ol class="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              <li>{{ t('settings.addonsArticlesDeployKitStep1') }}</li>
              <li>{{ t('settings.addonsArticlesDeployKitStep2') }}</li>
              <li>{{ t('settings.addonsArticlesDeployKitStep3') }}</li>
            </ol>
            <button
              type="button"
              class="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!embedOrgKey || embedKitDownloading"
              @click="downloadEmbedStarterKit"
            >
              {{ embedKitDownloading ? t('settings.addonsArticlesDeployKitDownloading') : t('settings.addonsArticlesDeployKitDownload') }}
            </button>
          </div>

          <div class="mt-6 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesUnifiedEmbedSnippetLabel') }}</p>
              <p class="mt-1 text-xs text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesUnifiedEmbedSnippetDesc') }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              @click="copyText(unifiedEmbedSnippet, t('settings.addonsArticlesUnifiedEmbedSnippetLabel'))"
            >
              {{ t('settings.addonsArticlesCopySnippet') }}
            </button>
          </div>
          <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ unifiedEmbedSnippet }}</code></pre>
          </div>

          <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {{ t('settings.addonsArticlesEmbedDemoHint') }}
            <a
              :href="headlessHomeExampleUrl"
              class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t('settings.addonsArticlesHelpCenterRouteDemo') }}
            </a>
          </p>

          <details class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
              {{ t('settings.addonsArticlesAdvancedEmbedsTitle') }}
            </summary>
            <div class="space-y-6 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
              <div class="space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesUnifiedPageSnippetLabel') }}</p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesUnifiedPageSnippetDesc') }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    @click="copyText(unifiedPageSnippet, t('settings.addonsArticlesUnifiedPageSnippetLabel'))"
                  >
                    {{ t('settings.addonsArticlesCopySnippet') }}
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
                    {{ t('settings.addonsArticlesCopySnippet') }}
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
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesEmbedPublicKeyLabel') }}</p>
            <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ embedOrgKey || t('settings.addonsArticlesEmbedPublicKeyPending') }}</p>
          </div>
          <button
            v-if="embedOrgKey"
            type="button"
            class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            @click="copyText(embedOrgKey, t('settings.addonsArticlesEmbedPublicKeyLabel'))"
          >
            {{ t('settings.addonsArticlesCopyUrl') }}
          </button>
        </div>

        <details class="mt-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
            {{ t('settings.addonsArticlesDeveloperSetupTitle') }}
          </summary>
          <div class="space-y-6 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
            <div class="space-y-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.contentPublishingIntegrationTitle') }}</p>
              <div v-for="endpoint in integrationEndpoints" :key="endpoint.key" class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ endpoint.label }}</p>
                    <p class="mt-1 break-all text-xs text-gray-600 dark:text-gray-400">{{ endpoint.value || '—' }}</p>
                  </div>
                  <button
                    v-if="endpoint.value"
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    @click="copyText(endpoint.value, endpoint.label)"
                  >
                    {{ t('settings.addonsArticlesCopyUrl') }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="showStaticSyncSetup">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesHelpCenterRoutesTitle') }}</h4>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesHelpCenterRoutesDesc') }}</p>
              <div class="mt-3 space-y-3">
                <div
                  v-for="route in helpCenterRoutes"
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
                    {{ t('settings.addonsArticlesHelpCenterRouteDemo') }}
                  </a>
                </div>
              </div>
            </div>

            <div v-if="showStaticSyncSetup">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesIntegrationExamplesTitle') }}</h4>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesIntegrationExamplesDesc') }}</p>
              <div class="mt-4 space-y-4">
                <div v-for="example in integrationExamples" :key="example.key">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">{{ example.label }}</p>
                    <button
                      type="button"
                      class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      @click="copyText(example.value, example.label)"
                    >
                      {{ t('settings.addonsArticlesCopyExample') }}
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import '@/modules/contentStudio/editor/contentStudioArticleAppearance.css';
import { buildEmbedStarterKitZip, downloadBlob } from '@/modules/contentStudio/headless/buildEmbedStarterKit';
import { buildConfiguredPhpSync } from '@/modules/contentStudio/headless/buildConfiguredPhpSync';
import { buildVercelStandaloneKitZip } from '@/modules/contentStudio/headless/buildVercelStandaloneKit';

const emit = defineEmits(['back']);

const { t } = useI18n();
const notifications = useNotifications();

const loading = ref(true);
const saving = ref(false);
const webhookTesting = ref(false);
const embedKitDownloading = ref(false);
const phpSyncDownloading = ref(false);
const vercelKitDownloading = ref(false);
const error = ref('');
const dirty = ref(false);
const initialSnapshot = ref('');
const isInitialLoad = ref(true);
const collections = ref([]);
const embedPathPrefix = ref('/help/');
const savedEmbedWebsiteOrigins = ref([]);
const integration = reactive({
  headlessApiBase: '',
  headlessPublicKey: '',
  articlesListApiUrl: '',
  collectionsApiUrl: '',
  recentArticlesApiUrl: '',
  popularArticlesApiUrl: '',
  exampleArticleApiUrl: '',
  exampleArticleExportUrl: '',
  manifestUrl: '',
  sitemapUrl: '',
});
const staticSyncHostType = ref('embed');
const showEmbedSetup = computed(() => staticSyncHostType.value === 'embed');
const showStaticSyncSetup = computed(() => staticSyncHostType.value !== 'embed');
const showWebhookSetup = computed(() => showStaticSyncSetup.value);
const customerSiteSetupHint = computed(() => {
  switch (staticSyncHostType.value) {
    case 'embed':
      return t('settings.addonsArticlesStaticSyncEmbedNote');
    case 'next':
      return t('settings.addonsArticlesStaticSyncNextHint');
    case 'php':
      return t('settings.addonsArticlesStaticSyncPhpSteps');
    case 'cli':
      return t('settings.addonsArticlesStaticSyncCliSteps');
    default:
      return t('settings.addonsArticlesStaticSyncDesc');
  }
});
const publishWebhookUrlManuallyEdited = ref(false);
const suppressPublishWebhookAutoFill = ref(false);
const hasPublishWebhookSecret = ref(false);
const publishWebhookSecretUnreadable = ref(false);
const generatedWebhookSecret = ref('');
const webhookSecretGenerating = ref(false);

const defaultAppearance = {
  layoutPreset: 'classic',
  primaryColor: '#4f46e5',
  secondaryColor: '#6366f1',
  bodyFont: 'Inter, system-ui, sans-serif',
  headingFont: 'Inter, system-ui, sans-serif',
  contentWidth: 'standard',
  borderRadius: 'md',
  defaultCoverPosition: 'below-title',
  defaultSubtitleSize: 'md',
  showLogoInHeader: false,
  logoUrl: '',
};

const form = reactive({
  portalPublishing: true,
  publishWebhookUrl: '',
  headlessApiEnabled: true,
  embedWebsiteDomain: '',
  defaultCollectionId: null,
  caseDeflectionEnabled: true,
  staleContentAlertDays: 90,
  appearance: { ...defaultAppearance },
});

const widthMap = {
  narrow: '680px',
  standard: '768px',
  wide: '960px',
};

const radiusMap = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
};

const previewClass = computed(() => [
  'content-studio-article',
  `content-studio-article--${form.appearance.layoutPreset}`,
  form.appearance.showLogoInHeader ? 'content-studio-article--with-logo' : '',
].filter(Boolean).join(' '));

const previewStyle = computed(() => ({
  '--cs-primary': form.appearance.primaryColor,
  '--cs-secondary': form.appearance.secondaryColor,
  '--cs-body-font': form.appearance.bodyFont,
  '--cs-heading-font': form.appearance.headingFont,
  '--cs-content-max-width': widthMap[form.appearance.contentWidth] || widthMap.standard,
  '--cs-border-radius': radiusMap[form.appearance.borderRadius] || radiusMap.md,
}));

const integrationEndpoints = computed(() => {
  const resolved = resolvedIntegration.value;
  return [
    {
      key: 'headlessApiBase',
      label: t('settings.contentPublishingHeadlessApiBase'),
      value: resolved.headlessApiBase,
    },
    {
      key: 'articlesListApiUrl',
      label: t('settings.contentPublishingArticlesListApi'),
      value: resolved.articlesListApiUrl,
    },
    {
      key: 'collectionsApiUrl',
      label: t('settings.contentPublishingCollectionsApi'),
      value: resolved.collectionsApiUrl,
    },
    {
      key: 'recentArticlesApiUrl',
      label: t('settings.contentPublishingRecentArticlesApi'),
      value: resolved.recentArticlesApiUrl,
    },
    {
      key: 'popularArticlesApiUrl',
      label: t('settings.contentPublishingPopularArticlesApi'),
      value: resolved.popularArticlesApiUrl,
    },
    {
      key: 'exampleArticleApiUrl',
      label: t('settings.contentPublishingExampleArticleApi'),
      value: resolved.exampleArticleApiUrl,
    },
    {
      key: 'sitemapUrl',
      label: t('settings.contentPublishingSitemapUrl'),
      value: resolved.sitemapUrl,
    },
  ];
});

const staticSyncEndpoints = computed(() => {
  const resolved = resolvedIntegration.value;
  const exportPattern = resolved.exampleArticleExportUrl || '';
  const exampleExportUrl = exportPattern.includes('{slug}')
    ? exportPattern.replace('{slug}', 'getting-started')
    : exportPattern;
  return [
    {
      key: 'manifestUrl',
      label: t('settings.addonsArticlesStaticSyncManifestUrl'),
      value: resolved.manifestUrl,
    },
    {
      key: 'exampleArticleExportUrl',
      label: t('settings.addonsArticlesStaticSyncExportUrl'),
      value: exampleExportUrl,
    },
  ];
});

const staticSyncEnvTemplate = computed(() => {
  const siteOrigin = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const webhookSecret = String(generatedWebhookSecret.value || '').trim();
  const lines = [
    `ARIVU_ORG=${embedOrgKey.value || 'art_pub_xxx'}`,
    `ARIVU_API_ORIGIN=${embedOrigin.value}`,
    `HELP_URL_PREFIX=${normalizedEmbedPathPrefix.value}`,
    'ARIVU_SYNC_DEST=./public',
    `ARIVU_WEBHOOK_SECRET=${webhookSecret}`,
    `SITE_ORIGIN=${siteOrigin}`,
  ];
  if (staticSyncHostType.value === 'next') {
    // Default curl install uses layout mode (ISR). Only set static when using standalone-html.
    lines.push('ARIVU_SYNC_MODE=layout', 'VERCEL_DEPLOY_HOOK_URL=');
  }
  return lines.join('\n');
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
  next: '/api/arivu-webhook',
  php: '/arivu-help-sync.php',
  cli: '/api/arivu-webhook',
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
  if (url.includes('arivu-help-sync.php')) return 'php';
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
  const org = embedOrgKey.value || 'art_pub_xxx';
  const origin = embedOrigin.value;
  const prefix = normalizedEmbedPathPrefix.value;
  return [
    {
      key: 'full',
      label: t('settings.addonsArticlesStaticSyncCliFull'),
      value: `npx @arivu/help-sync sync --org ${org} --api-origin ${origin} --dest ./public --path-prefix ${prefix} --full`,
    },
    {
      key: 'slug',
      label: t('settings.addonsArticlesStaticSyncCliSlug'),
      value: `npx @arivu/help-sync sync --org ${org} --api-origin ${origin} --dest ./public --path-prefix ${prefix} --slug getting-started`,
    },
    {
      key: 'webhook',
      label: t('settings.addonsArticlesStaticSyncCliWebhook'),
      value: 'cat webhook.json | npx @arivu/help-sync webhook --dest ./public',
    },
  ];
});

const vercelStandaloneDownloadUrl = computed(() => `${embedOrigin.value}/static-sync/arivu-help-vercel.zip`);

const vercelInstallCommand = computed(() => {
  const org = embedOrgKey.value || 'art_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = normalizedEmbedPathPrefix.value;
  const webhookSecret = String(generatedWebhookSecret.value || '').trim();
  const parts = [
    `curl -fsSL ${origin}/static-sync/arivu-help-install.mjs | node - install`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
  ];
  if (webhookSecret) {
    parts.push(`--webhook-secret=${webhookSecret}`);
  }
  return parts.join(' \\\n  ');
});

const vercelCreateCommand = computed(() => {
  const org = embedOrgKey.value || 'art_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = normalizedEmbedPathPrefix.value;
  const webhookSecret = String(generatedWebhookSecret.value || '').trim();
  const parts = [
    `curl -fsSL ${origin}/static-sync/arivu-help-install.mjs | node - create ./help-center`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
  ];
  if (webhookSecret) {
    parts.push(`--webhook-secret=${webhookSecret}`);
  }
  return parts.join(' \\\n  ');
});

const vercelUninstallCommand = computed(() => {
  const origin = embedOrigin.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-help-install.mjs | node - uninstall`,
    `--api-origin=${origin}`,
  ].join(' \\\n  ');
});

const vercelUpdateKitCommand = computed(() => {
  const org = embedOrgKey.value || 'art_pub_xxx';
  const origin = embedOrigin.value;
  const site = normalizeWebsiteOrigin(form.embedWebsiteDomain) || 'https://www.example.com';
  const prefix = normalizedEmbedPathPrefix.value;
  return [
    `curl -fsSL ${origin}/static-sync/arivu-help-install.mjs | node - install`,
    `--org=${org}`,
    `--api-origin=${origin}`,
    `--site-origin=${site}`,
    `--path-prefix=${prefix}`,
    '--update-kit',
  ].join(' \\\n  ');
});

const resolvedIntegration = computed(() => integration);

const embedOrgKey = computed(() => integration.headlessPublicKey || '');

const integrationUrlsUnavailable = computed(
  () => !resolvedIntegration.value.headlessApiBase && !loading.value && !error.value,
);

const exampleArticleApiUrl = computed(() => {
  const pattern = resolvedIntegration.value.exampleArticleApiUrl || '';
  return pattern.includes('{slug}') ? pattern.replace('{slug}', 'getting-started') : pattern;
});

const headlessExampleUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgKey.value) params.set('org', embedOrgKey.value);
  params.set('slug', 'getting-started');
  const query = params.toString();
  return query ? `/examples/headless-article?${query}` : '/examples/headless-article';
});

const headlessListExampleUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgKey.value) params.set('org', embedOrgKey.value);
  const query = params.toString();
  return query ? `/examples/headless-article-list?${query}` : '/examples/headless-article-list';
});

const headlessHomeExampleUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgKey.value) params.set('org', embedOrgKey.value);
  const query = params.toString();
  return query ? `/examples/headless-help-home?${query}` : '/examples/headless-help-home';
});

const headlessCategoryExampleUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgKey.value) params.set('org', embedOrgKey.value);
  params.set('collection', 'your-category-slug');
  const query = params.toString();
  return query ? `/examples/headless-help-category?${query}` : '/examples/headless-help-category';
});

const headlessSectionExampleUrl = computed(() => {
  const params = new URLSearchParams();
  if (embedOrgKey.value) params.set('org', embedOrgKey.value);
  params.set('section', 'your-section-slug');
  params.set('parent', 'your-category-slug');
  const query = params.toString();
  return query ? `/examples/headless-help-section?${query}` : '/examples/headless-help-section';
});

const embedOrigin = computed(() => (
  typeof window !== 'undefined' ? window.location.origin : 'https://app.arivu.com'
));

const embedOrgSlug = computed(() => embedOrgKey.value);

const normalizedEmbedPathPrefix = computed(() => {
  let prefix = String(embedPathPrefix.value || '/help/').trim();
  if (!prefix.startsWith('/')) prefix = `/${prefix}`;
  if (!prefix.endsWith('/')) prefix = `${prefix}/`;
  return prefix;
});

function buildUnifiedScriptAttrs() {
  return [
    `src="${embedOrigin.value}/embed/headless-help.js"`,
    `data-api-origin="${embedOrigin.value}"`,
    `data-org="${embedOrgSlug.value}"`,
    'data-target="#arivu-help"',
    `data-path-prefix="${normalizedEmbedPathPrefix.value}"`,
    'data-title="How can we help?"',
    'data-show-feedback-footer="true"',
  ].join('\n  ');
}

const embedStylesheetLink = computed(() => (
  `<link rel="preload" href="${embedOrigin.value}/embed/headless-blocks.css" as="style" />\n<link rel="stylesheet" href="${embedOrigin.value}/embed/headless-blocks.css" />`
));

// `<\u002Fscript>`: a literal closing script tag ends this SFC block; lint --fix strips `<\/script>`.
const unifiedEmbedSnippet = computed(() => (
  `${embedStylesheetLink.value}\n<div id="arivu-help"></div>\n<script\n  ${buildUnifiedScriptAttrs()}\n><\u002Fscript>`
));

const unifiedPageSnippet = computed(() => (
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Help Center</title>\n  ${embedStylesheetLink.value}\n</head>\n<body>\n  <main id="arivu-help"></main>\n  <script\n    ${buildUnifiedScriptAttrs()}\n  ><\u002Fscript>\n</body>\n</html>`
));

const homeEmbedSnippet = computed(() => {
  const pathPrefix = normalizedEmbedPathPrefix.value;
  return `${embedStylesheetLink.value}\n<div id="help-home"></div>\n<script\n  src="${embedOrigin.value}/embed/headless-help-home.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-target="#help-home"\n  data-link-prefix="${pathPrefix}"\n  data-title="How can we help?"\n><\u002Fscript>`;
});

const categoryEmbedSnippet = computed(() => {
  const pathPrefix = normalizedEmbedPathPrefix.value;
  return `${embedStylesheetLink.value}\n<div id="help-category"></div>\n<script src="${embedOrigin.value}/embed/headless-help-common.js"><\u002Fscript>\n<script\n  src="${embedOrigin.value}/embed/headless-help-category.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-collection="your-category-slug"\n  data-target="#help-category"\n  data-link-prefix="${pathPrefix}"\n  data-section-prefix="${pathPrefix}"\n  data-home-prefix="${pathPrefix}"\n  data-article-prefix="${pathPrefix}"\n><\u002Fscript>`;
});

const sectionEmbedSnippet = computed(() => {
  const pathPrefix = normalizedEmbedPathPrefix.value;
  return `${embedStylesheetLink.value}\n<div id="help-section"></div>\n<script src="${embedOrigin.value}/embed/headless-help-common.js"><\u002Fscript>\n<script\n  src="${embedOrigin.value}/embed/headless-help-section.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-section="your-section-slug"\n  data-parent="your-category-slug"\n  data-target="#help-section"\n  data-link-prefix="${pathPrefix}"\n  data-category-prefix="${pathPrefix}"\n  data-section-prefix="${pathPrefix}"\n  data-home-prefix="${pathPrefix}"\n  data-article-prefix="${pathPrefix}"\n><\u002Fscript>`;
});

const listEmbedSnippet = computed(() => {
  const pathPrefix = normalizedEmbedPathPrefix.value;
  return `${embedStylesheetLink.value}\n<div id="help-list"></div>\n<script\n  src="${embedOrigin.value}/embed/headless-article-list.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-target="#help-list"\n  data-link-prefix="${pathPrefix}"\n><\u002Fscript>`;
});

const embedSnippet = computed(() => {
  const pathPrefix = normalizedEmbedPathPrefix.value;
  return `${embedStylesheetLink.value}\n<div id="help-article"></div>\n<script\n  src="${embedOrigin.value}/embed/headless-article.js"\n  data-api-origin="${embedOrigin.value}"\n  data-org="${embedOrgSlug.value}"\n  data-slug="your-article-slug"\n  data-target="#help-article"\n  data-show-sidebar="true"\n  data-show-breadcrumbs="true"\n  data-show-feedback-footer="true"\n  data-link-prefix="${pathPrefix}"\n  data-home-prefix="${pathPrefix}"\n  data-category-prefix="${pathPrefix}"\n  data-section-prefix="${pathPrefix}"\n  data-article-prefix="${pathPrefix}"\n  data-collection="your-category-slug"\n  data-section="your-section-slug"\n><\u002Fscript>`;
});

const advancedEmbedSnippets = computed(() => [
  {
    key: 'home',
    label: t('settings.addonsArticlesHomeEmbedSnippetLabel'),
    description: t('settings.addonsArticlesHomeEmbedDesc'),
    value: homeEmbedSnippet.value,
  },
  {
    key: 'category',
    label: t('settings.addonsArticlesCategoryEmbedSnippetLabel'),
    description: t('settings.addonsArticlesCategoryEmbedDesc'),
    value: categoryEmbedSnippet.value,
  },
  {
    key: 'section',
    label: t('settings.addonsArticlesSectionEmbedSnippetLabel'),
    description: t('settings.addonsArticlesSectionEmbedDesc'),
    value: sectionEmbedSnippet.value,
  },
  {
    key: 'article',
    label: t('settings.addonsArticlesEmbedSnippetLabel'),
    description: t('settings.addonsArticlesArticleEmbedDesc'),
    value: embedSnippet.value,
  },
  {
    key: 'list',
    label: t('settings.addonsArticlesListEmbedSnippetLabel'),
    description: t('settings.addonsArticlesListEmbedDesc'),
    value: listEmbedSnippet.value,
  },
]);

const embedWebsiteOrigins = computed(() => (
  savedEmbedWebsiteOrigins.value.length
    ? savedEmbedWebsiteOrigins.value
    : []
));

const helpCenterRoutes = computed(() => {
  const siteHost = String(form.embedWebsiteDomain || 'www.example.com').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'www.example.com';
  const siteBase = `https://${siteHost.replace(/\/$/, '')}`;
  const path = normalizedEmbedPathPrefix.value;
  return [
    {
      key: 'home',
      label: t('settings.addonsArticlesHelpRouteHome'),
      customerUrl: `${siteBase}${path}`,
      demoUrl: headlessHomeExampleUrl.value,
    },
    {
      key: 'category',
      label: t('settings.addonsArticlesHelpRouteCategory'),
      customerUrl: `${siteBase}${path}{category}`,
      demoUrl: headlessCategoryExampleUrl.value,
    },
    {
      key: 'section',
      label: t('settings.addonsArticlesHelpRouteSection'),
      customerUrl: `${siteBase}${path}{category}/{section}`,
      demoUrl: headlessSectionExampleUrl.value,
    },
    {
      key: 'article',
      label: t('settings.addonsArticlesHelpRouteArticle'),
      customerUrl: `${siteBase}${path}{category}/{section}/{article}`,
      demoUrl: headlessExampleUrl.value,
    },
  ];
});

const integrationExamples = computed(() => {
  const articleUrl = exampleArticleApiUrl.value;
  const collectionsUrl = resolvedIntegration.value.collectionsApiUrl || '';
  if (!articleUrl) return [];

  const examples = [
    {
      key: 'curl',
      label: t('settings.addonsArticlesExampleCurl'),
      value: `curl "${articleUrl}"`,
    },
    {
      key: 'fetch',
      label: t('settings.addonsArticlesExampleFetch'),
      value: `const response = await fetch('${articleUrl}');\nconst { data } = await response.json();\n// data.blocks → render on your site`,
    },
  ];

  if (collectionsUrl) {
    examples.push({
      key: 'collections',
      label: t('settings.addonsArticlesExampleCollections'),
      value: `const response = await fetch('${collectionsUrl}');\nconst { data } = await response.json();\n// data → nested category tree for /help navigation`,
    });
  }

  examples.push({
    key: 'render',
    label: t('settings.addonsArticlesExampleRender'),
    value: `import { renderBlocksToHtml } from '@/modules/contentStudio/headless';\n\nconst html = renderBlocksToHtml(data.blocks, {\n  title: data.title,\n  subtitle: data.subtitle,\n  articleLinkPrefix: '${normalizedEmbedPathPrefix.value}',\n});\ndocument.querySelector('#article').innerHTML = html;`,
  });

  return examples;
});

async function copyText(value, label) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(String(value));
    notifications.success(t('settings.addonsArticlesCopied', { label }));
  } catch {
    notifications.error(t('settings.addonsArticlesCopyFailed'));
  }
}

async function downloadEmbedStarterKit() {
  if (!embedOrgKey.value || embedKitDownloading.value) return;
  embedKitDownloading.value = true;
  try {
    const blob = await buildEmbedStarterKitZip({
      apiOrigin: embedOrigin.value,
      orgKey: embedOrgKey.value,
      pathPrefix: normalizedEmbedPathPrefix.value,
      siteDomain: form.embedWebsiteDomain,
    });
    downloadBlob(blob, 'arivu-help-deploy-kit.zip');
    notifications.success(t('settings.addonsArticlesDeployKitDownloaded'));
  } catch {
    notifications.error(t('settings.addonsArticlesDeployKitDownloadFailed'));
  } finally {
    embedKitDownloading.value = false;
  }
}

async function downloadConfiguredPhpSync() {
  if (!embedOrgKey.value || phpSyncDownloading.value) return;
  phpSyncDownloading.value = true;
  try {
    const response = await fetch(`${embedOrigin.value}/static-sync/arivu-help-sync.php`);
    if (!response.ok) {
      throw new Error('Failed to load PHP template');
    }
    const templatePhp = await response.text();
    const configuredPhp = buildConfiguredPhpSync(templatePhp, {
      apiOrigin: embedOrigin.value,
      orgKey: embedOrgKey.value,
      pathPrefix: normalizedEmbedPathPrefix.value,
      siteDomain: form.embedWebsiteDomain,
    });
    downloadBlob(new Blob([configuredPhp], { type: 'application/x-php' }), 'arivu-help-sync.php');
    notifications.success(t('settings.addonsArticlesPhpDeployDownloaded'));
  } catch {
    notifications.error(t('settings.addonsArticlesPhpDeployDownloadFailed'));
  } finally {
    phpSyncDownloading.value = false;
  }
}

async function downloadVercelStandaloneKit() {
  if (!embedOrgKey.value || vercelKitDownloading.value) return;
  vercelKitDownloading.value = true;
  try {
    const blob = await buildVercelStandaloneKitZip(vercelStandaloneDownloadUrl.value, {
      apiOrigin: embedOrigin.value,
      orgKey: embedOrgKey.value,
      pathPrefix: normalizedEmbedPathPrefix.value,
      siteDomain: form.embedWebsiteDomain,
      webhookSecret: generatedWebhookSecret.value || undefined,
    });
    downloadBlob(blob, 'arivu-help-vercel.zip');
    notifications.success(t('settings.addonsArticlesVercelStandaloneDownloaded'));
  } catch {
    notifications.error(t('settings.addonsArticlesVercelStandaloneDownloadFailed'));
  } finally {
    vercelKitDownloading.value = false;
  }
}

async function sendTestWebhook() {
  if (!form.publishWebhookUrl || webhookTesting.value) return;
  webhookTesting.value = true;
  try {
    await apiClient.post('/settings/addons/articles/settings/test-webhook', {}, { cache: 'no-store' });
    notifications.success(t('settings.addonsArticlesWebhookTestSent'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsArticlesWebhookTestFailed'));
  } finally {
    webhookTesting.value = false;
  }
}

async function generateWebhookSecret() {
  if (webhookSecretGenerating.value) return;
  webhookSecretGenerating.value = true;
  generatedWebhookSecret.value = '';
  try {
    const res = await apiClient.post('/settings/addons/articles/settings/generate-webhook-secret', {}, { cache: 'no-store' });
    generatedWebhookSecret.value = res.publishWebhookSecret || '';
    hasPublishWebhookSecret.value = Boolean(res?.settings?.publishing?.hasPublishWebhookSecret);
    applySettings(res);
    notifications.success(t('settings.addonsArticlesWebhookSecretGenerated'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsArticlesWebhookSecretGenerateFailed'));
  } finally {
    webhookSecretGenerating.value = false;
  }
}

function collectionLabel(collection) {
  const depth = Number(collection.depth || 0);
  return `${'  '.repeat(depth)}${collection.name}`;
}

function snapshotForm() {
  return JSON.stringify({
    form,
    staticSyncHostType: staticSyncHostType.value,
  });
}

function syncDirty() {
  dirty.value = snapshotForm() !== initialSnapshot.value;
}

function applyAppearance(settingsAppearance = {}) {
  Object.assign(form.appearance, { ...defaultAppearance, ...settingsAppearance });
}

function buildCollectionTree(rows) {
  const byParent = new Map();
  for (const row of rows) {
    const parentId = row.parentId ? String(row.parentId) : '';
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(row);
  }
  function walk(parentId, depth = 0) {
    const children = byParent.get(parentId) || [];
    return children.flatMap((row) => [{ ...row, depth }, ...walk(String(row._id), depth + 1)]);
  }
  return walk('');
}

async function load() {
  loading.value = true;
  error.value = '';
  isInitialLoad.value = true;
  try {
    const res = await apiClient('/settings/addons/articles/settings', { method: 'GET', cache: 'no-store' });
    applySettings(res);
  } catch (err) {
    error.value = err?.message || t('settings.addonsArticlesSettingsLoadFailed');
  } finally {
    loading.value = false;
    isInitialLoad.value = false;
  }
}

function applySettings(res) {
  const settings = res?.settings || {};
  form.portalPublishing = settings.portalPublishing !== false;
  form.publishWebhookUrl = settings.publishing?.publishWebhookUrl || '';
  hasPublishWebhookSecret.value = Boolean(settings.publishing?.hasPublishWebhookSecret);
  publishWebhookSecretUnreadable.value = Boolean(settings.publishing?.publishWebhookSecretUnreadable);
  form.headlessApiEnabled = settings.publishing?.headlessApiEnabled !== false;
  form.embedWebsiteDomain = settings.publishing?.embedWebsiteDomain || '';
  staticSyncHostType.value = normalizeStoredHostType(
    settings.publishing?.staticSyncHostType,
    form.publishWebhookUrl,
  );
  publishWebhookUrlManuallyEdited.value = Boolean(
    form.publishWebhookUrl
    && !isSuggestedPublishWebhookUrl(
      form.publishWebhookUrl,
      form.embedWebsiteDomain,
      staticSyncHostType.value,
    ),
  );
  if (!form.publishWebhookUrl && form.embedWebsiteDomain && staticSyncHostType.value !== 'embed') {
    applySuggestedPublishWebhookUrl();
  }
  savedEmbedWebsiteOrigins.value = Array.isArray(settings.publishing?.embedWebsiteOrigins)
    ? settings.publishing.embedWebsiteOrigins
    : [];
  form.defaultCollectionId = settings.defaultCollectionId || null;
  form.caseDeflectionEnabled = settings.caseDeflectionEnabled !== false;
  form.staleContentAlertDays = Number(settings.staleContentAlertDays) || 90;
  applyAppearance(settings.appearance);
  integration.headlessApiBase = res?.integration?.headlessApiBase || '';
  integration.headlessPublicKey = res?.integration?.headlessPublicKey || '';
  integration.articlesListApiUrl = res?.integration?.articlesListApiUrl || '';
  integration.collectionsApiUrl = res?.integration?.collectionsApiUrl || '';
  integration.recentArticlesApiUrl = res?.integration?.recentArticlesApiUrl || '';
  integration.popularArticlesApiUrl = res?.integration?.popularArticlesApiUrl || '';
  integration.exampleArticleApiUrl = res?.integration?.exampleArticleApiUrl || '';
  integration.exampleArticleExportUrl = res?.integration?.exampleArticleExportUrl || '';
  integration.manifestUrl = res?.integration?.manifestUrl || '';
  integration.sitemapUrl = res?.integration?.sitemapUrl || '';
  collections.value = buildCollectionTree(Array.isArray(res?.collections) ? res.collections : []);
  initialSnapshot.value = snapshotForm();
  dirty.value = false;
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    const { pickDirtyFields } = await import('@/utils/pickDirtyFields');
    const current = {
      portalPublishing: form.portalPublishing,
      publishWebhookUrl: form.publishWebhookUrl,
      headlessApiEnabled: form.headlessApiEnabled,
      embedWebsiteDomain: form.embedWebsiteDomain,
      staticSyncHostType: staticSyncHostType.value,
      defaultCollectionId: form.defaultCollectionId,
      caseDeflectionEnabled: form.caseDeflectionEnabled,
      staleContentAlertDays: form.staleContentAlertDays,
      appearance: { ...form.appearance },
    };
    const snap = initialSnapshot.value ? JSON.parse(initialSnapshot.value) : {};
    const baselineForm = snap.form && typeof snap.form === 'object' ? snap.form : {};
    const baseline = {
      portalPublishing: baselineForm.portalPublishing,
      publishWebhookUrl: baselineForm.publishWebhookUrl,
      headlessApiEnabled: baselineForm.headlessApiEnabled,
      embedWebsiteDomain: baselineForm.embedWebsiteDomain,
      staticSyncHostType: snap.staticSyncHostType,
      defaultCollectionId: baselineForm.defaultCollectionId,
      caseDeflectionEnabled: baselineForm.caseDeflectionEnabled,
      staleContentAlertDays: baselineForm.staleContentAlertDays,
      appearance: baselineForm.appearance ? { ...baselineForm.appearance } : {},
    };
    const payload = pickDirtyFields(current, baseline);
    if (Object.keys(payload).length === 0) {
      saving.value = false;
      return;
    }

    const res = await apiClient.put('/settings/addons/articles/settings', payload, { cache: 'no-store' });
    applySettings(res);
    notifications.success(t('settings.addonsArticlesSettingsSaved'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsArticlesSettingsSaveFailed'));
  } finally {
    saving.value = false;
  }
}

watch(
  () => ({
    portalPublishing: form.portalPublishing,
    publishWebhookUrl: form.publishWebhookUrl,
    headlessApiEnabled: form.headlessApiEnabled,
    embedWebsiteDomain: form.embedWebsiteDomain,
    staticSyncHostType: staticSyncHostType.value,
    defaultCollectionId: form.defaultCollectionId,
    caseDeflectionEnabled: form.caseDeflectionEnabled,
    staleContentAlertDays: form.staleContentAlertDays,
    appearance: { ...form.appearance },
  }),
  () => {
    if (loading.value || isInitialLoad.value) return;
    syncDirty();
  },
  { deep: true },
);

onMounted(() => {
  void load();
});
</script>
