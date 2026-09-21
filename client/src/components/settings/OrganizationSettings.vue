<template>
  <SettingsScrollPanel :save-bar-visible="!loading && !error && hasChanges">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabCompany') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.orgPageSubtitle') }}
        </p>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400"></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.orgLoading') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3"
    >
      <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-semibold text-red-900 dark:text-red-200">{{ t('settings.orgLoadFailed') }}</h3>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error.message || t('settings.pleaseTryAgain') }}</p>
        <button
          type="button"
          @click="fetchOrganizationSettings"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ t('actions.retry') }}
        </button>
      </div>
    </div>

    <!-- Settings Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Brand Identity Hero -->
      <section
        class="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <!-- Gradient backdrop -->
        <div
          aria-hidden="true"
          class="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-950/40 dark:via-gray-800 dark:to-purple-950/40"
        ></div>
        <div
          aria-hidden="true"
          class="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-200/40 dark:bg-indigo-500/10 blur-3xl"
        ></div>
        <div
          aria-hidden="true"
          class="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-purple-200/40 dark:bg-purple-500/10 blur-3xl"
        ></div>

        <div class="relative p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-center gap-6">
            <!-- Logo Preview Avatar -->
            <div class="relative flex-shrink-0">
              <div
                class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-gray-900 shadow-lg ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="form.logoUrl && !logoBroken"
                  :src="resolvedLogoUrl"
                  :alt="t('settings.orgLogoAlt')"
                  class="w-full h-full object-contain p-2"
                  @error="logoBroken = true"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-3xl font-bold"
                >
                  {{ companyInitials }}
                </div>
              </div>
              <span
                v-if="logoUploading"
                class="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center text-white"
              >
                <svg class="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            </div>

            <!-- Identity summary -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {{ t('settings.orgIdentity') }}
              </p>
              <h3 class="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                {{ form.name || t('settings.orgDefaultName') }}
              </h3>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ timezoneShortLabel }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ form.currency }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  {{ languageLabel }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ form.dataRegion }}
                </span>
              </div>
              <p class="mt-3 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                {{ t('settings.orgIdentityDesc') }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Branding Section -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.orgBranding') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgBrandingDesc') }}</p>
          </div>
        </header>

        <div class="p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
          <!-- Company Name -->
          <div class="lg:col-span-2 space-y-2">
            <label for="company-name" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgCompanyName') }}
              <span class="text-red-500">*</span>
            </label>
            <input
              id="company-name"
              v-model="form.name"
              type="text"
              required
              maxlength="120"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              :placeholder="t('settings.orgCompanyNamePh')"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.orgCompanyNameHint') }}
            </p>

            <div class="space-y-2 pt-2">
              <label for="primary-color" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
                {{ t('settings.orgPrimaryColor') }}
              </label>
              <div class="flex items-center gap-3">
                <input
                  id="primary-color"
                  v-model="form.primaryColor"
                  type="text"
                  maxlength="7"
                  class="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
                  placeholder="#3a1f8a"
                />
                <input
                  v-model="form.primaryColor"
                  type="color"
                  class="h-11 w-12 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer bg-white dark:bg-gray-900"
                  :aria-label="t('settings.orgPrimaryColor')"
                />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('settings.orgPrimaryColorHint') }}
              </p>
            </div>
          </div>

          <!-- Logo Upload -->
          <div class="lg:col-span-3 space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.orgLogo') }}</label>
              <button
                v-if="form.logoUrl"
                type="button"
                @click="removeLogo"
                class="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 inline-flex items-center gap-1"
                :disabled="logoUploading"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                </svg>
                {{ t('settings.orgRemoveLogo') }}
              </button>
            </div>

            <!-- Drop zone -->
            <div
              @click="triggerFilePicker"
              @keydown.enter.prevent="triggerFilePicker"
              @keydown.space.prevent="triggerFilePicker"
              @dragenter.prevent="isDragging = true"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
              role="button"
              tabindex="0"
              :aria-disabled="logoUploading"
              :class="[
                'group relative flex flex-col items-center justify-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed transition-all cursor-pointer outline-none',
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
                  : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-900/30',
                logoUploading && 'pointer-events-none opacity-70'
              ]"
            >
              <div
                v-if="form.logoUrl && !logoBroken"
                class="w-16 h-16 rounded-xl bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center overflow-hidden"
              >
                <img :src="resolvedLogoUrl" :alt="t('settings.orgLogoPreviewAlt')" class="w-full h-full object-contain p-1.5" @error="logoBroken = true" />
              </div>
              <div
                v-else
                class="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400"
              >
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              <div class="text-center">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  <span class="text-indigo-600 dark:text-indigo-400">{{ t('settings.orgUploadClick') }}</span> {{ t('settings.orgUploadDrag') }}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.orgUploadHint') }}
                </p>
              </div>

              <span
                v-if="logoUploading"
                class="absolute inset-0 rounded-xl bg-white/70 dark:bg-gray-900/60 flex items-center justify-center"
              >
                <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow text-sm text-gray-700 dark:text-gray-200">
                  <svg class="animate-spin h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ t('settings.orgUploading') }}
                </span>
              </span>

              <input
                ref="fileInputRef"
                type="file"
                class="sr-only"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                @change="handleFileSelected"
              />
            </div>

            <!-- Manual URL fallback -->
            <details class="group">
              <summary class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                <svg class="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                {{ t('settings.orgPasteLogoUrl') }}
              </summary>
              <input
                v-model="form.logoUrl"
                type="url"
                class="mt-2 w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
                :placeholder="t('settings.orgLogoUrlPh')"
                @input="logoBroken = false"
              />
            </details>

            <p v-if="logoError" class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ logoError }}
            </p>
          </div>
        </div>
      </section>

      <!-- Contact & legal -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.orgContactLegal') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgContactLegalDesc') }}</p>
          </div>
        </header>

        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="md:col-span-2 space-y-2">
            <label for="company-address" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgAddress') }}
            </label>
            <input
              id="company-address"
              v-model="form.companyAddress.line1"
              type="text"
              maxlength="200"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              :placeholder="t('settings.orgAddressPh')"
            />
          </div>

          <div class="space-y-2">
            <label for="company-city" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgCity') }}
            </label>
            <input
              id="company-city"
              v-model="form.companyAddress.city"
              type="text"
              maxlength="100"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
            />
          </div>

          <div class="space-y-2">
            <label for="company-postal" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgPostalCode') }}
            </label>
            <input
              id="company-postal"
              v-model="form.companyAddress.postalCode"
              type="text"
              maxlength="32"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgCountry') }}
            </label>
            <HeadlessSelect
              v-model="form.companyAddress.country"
              :options="countryOptions"
              :placeholder="t('settings.orgCountryPh')"
            />
          </div>

          <div class="space-y-2">
            <label for="company-phone" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgPhone') }}
            </label>
            <input
              id="company-phone"
              v-model="form.phone"
              type="tel"
              maxlength="40"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
            />
          </div>

          <div class="space-y-2">
            <label for="company-website" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgWebsite') }}
            </label>
            <input
              id="company-website"
              v-model="form.website"
              type="url"
              maxlength="200"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              placeholder="https://"
            />
          </div>

          <div class="space-y-2">
            <label for="company-tax" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgTaxId') }}
            </label>
            <input
              id="company-tax"
              v-model="form.taxId"
              type="text"
              maxlength="64"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              :placeholder="t('settings.orgTaxIdPh')"
            />
          </div>

          <div class="space-y-2">
            <label for="company-gstin" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgGstin') }}
            </label>
            <input
              id="company-gstin"
              v-model="form.gstin"
              type="text"
              maxlength="15"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white uppercase font-mono text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              :placeholder="t('settings.orgGstinPh')"
              @blur="normalizeGstinField"
            />
          </div>

          <div class="space-y-2">
            <label for="company-facebook" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgFacebook') }}
            </label>
            <input
              id="company-facebook"
              v-model="form.social.facebook"
              type="url"
              maxlength="200"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              placeholder="https://"
            />
          </div>

          <div class="space-y-2">
            <label for="company-twitter" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgTwitter') }}
            </label>
            <input
              id="company-twitter"
              v-model="form.social.twitter"
              type="url"
              maxlength="200"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              placeholder="https://"
            />
          </div>

          <div class="space-y-2">
            <label for="company-linkedin" class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgLinkedin') }}
            </label>
            <input
              id="company-linkedin"
              v-model="form.social.linkedin"
              type="url"
              maxlength="200"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
              placeholder="https://"
            />
          </div>
        </div>
      </section>

      <!-- Financial calendar -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.orgFinancialCalendar') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgFinancialCalendarDesc') }}</p>
          </div>
        </header>

        <div class="p-6 space-y-6">
          <div class="max-w-sm space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.orgFyStartMonth') }}
            </label>
            <HeadlessSelect
              v-model.number="form.fiscalYearStartMonth"
              :options="fyMonthOptions"
            />
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              {{ t('settings.orgFyQuartersPreview') }}
            </p>
            <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <li
                v-for="row in fyQuarterPreview"
                :key="row.quarter"
                class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {{ t('settings.orgFyQuarterLabel', { quarter: row.quarter, range: row.range }) }}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Regional Settings -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.orgRegional') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgRegionalDesc') }}</p>
          </div>
        </header>

        <div
          v-if="regionalMismatch.hasMismatch && !regionalAlignDismissed"
          class="mx-6 mt-5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-medium text-amber-900 dark:text-amber-100">
                {{ t('settings.orgRegionalMismatchTitle') }}
              </p>
              <p class="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                {{ t('settings.orgRegionalMismatchBody', {
                  market: regionalMismatch.bundle?.marketLabel,
                  locale: regionalMismatch.bundle?.locale,
                  currency: regionalMismatch.bundle?.currency,
                }) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                @click="applyRegionalAlign"
              >
                {{ t('settings.orgRegionalAlign') }}
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100/80 dark:hover:bg-amber-900/30"
                @click="regionalAlignDismissed = true"
              >
                {{ t('settings.orgRegionalDismiss') }}
              </button>
            </div>
          </div>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Timezone -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
                {{ t('settings.orgTimezone') }}
              </label>
              <button
                v-if="detectedTimezone && detectedTimezone !== form.timeZone"
                type="button"
                @click="useDetectedTimezone"
                class="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 5.876A12.074 12.074 0 0014.81 9M2 12a10 10 0 0118-6m2 4a10 10 0 01-8 9.776" />
                </svg>
                {{ t('settings.orgUseBrowserTz') }}
              </button>
            </div>
            <div class="relative" data-tz-root>
              <input
                v-model="timezoneSearch"
                @focus="timezoneOpen = true"
                @input="timezoneOpen = true"
                @keydown.escape="timezoneOpen = false"
                type="text"
                class="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
                :placeholder="selectedTimezoneLabel || t('settings.orgTimezoneSearchPh')"
              />
              <button
                type="button"
                @click="timezoneOpen = !timezoneOpen"
                class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                :aria-label="t('settings.orgToggleTimezoneList')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown -->
              <div
                v-if="timezoneOpen"
                class="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                @click.stop
              >
                <div v-if="filteredTimezoneGroups.length === 0" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  {{ t('settings.orgNoTimezoneMatch', { query: timezoneSearch }) }}
                </div>
                <div
                  v-for="group in filteredTimezoneGroups"
                  :key="group.region"
                  class="py-1"
                >
                  <div class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                    {{ group.region }}
                  </div>
                  <button
                    v-for="tz in group.items"
                    :key="tz.value"
                    type="button"
                    @click="selectTimezone(tz.value)"
                    :class="[
                      'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors',
                      tz.value === form.timeZone
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    ]"
                  >
                    <span class="flex flex-col">
                      <span>{{ tz.text }}</span>
                      <span v-if="tz.sublabel" class="text-xs text-gray-500 dark:text-gray-400">{{ tz.sublabel }}</span>
                    </span>
                    <span class="text-xs font-mono text-gray-500 dark:text-gray-400 ml-3 flex-shrink-0">{{ tz.offset }}</span>
                  </button>
                </div>
              </div>
            </div>
            <p v-if="detectedTimezone && detectedTimezone !== form.timeZone" class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ t('settings.orgDetectedTz', { label: detectedTimezoneLabel }) }}
            </p>
            <p v-if="showTimezoneWarning" class="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ t('settings.orgTzWarning') }}
            </p>
          </div>

          <!-- Currency -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.orgCurrency') }}</label>
            <HeadlessSelect
              v-model="form.currency"
              :options="currencyOptions"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgCurrencyHint') }}</p>
          </div>

          <!-- Language -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.orgLanguage') }}</label>
            <HeadlessSelect
              v-model="form.language"
              :options="languageOptions"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.orgLanguageHint') }}</p>
          </div>

          <!-- Default phone country -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.orgPhoneCountry') }}</label>
            <HeadlessSelect
              v-model="form.defaultPhoneCountry"
              :options="phoneCountryOptions"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ form.defaultPhoneCountry
                ? t('settings.orgPhoneCountryHintExplicit')
                : t('settings.orgPhoneCountryHintAuto', { country: resolvedPhoneCountryLabel }) }}
            </p>
          </div>

          <!-- Locale -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.orgLocale') }}</label>
            <input
              v-model="form.locale"
              type="text"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none font-mono"
              :placeholder="t('settings.orgLocalePh')"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.orgLocaleHint') }}
            </p>
          </div>
        </div>
      </section>

      <!-- Data Region (read-only) -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
        <div class="p-6 flex items-start gap-4">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-200/70 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.orgDataRegion') }}</h3>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {{ t('settings.orgLocked') }}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ t('settings.orgDataRegionDesc', { region: form.dataRegion || 'us-east-1' }) }}
            </p>
          </div>
        </div>
      </section>
    </form>

    <SettingsSaveBar
      :visible="!loading && !error && hasChanges"
      :saving="saving"
      @reset="resetForm"
      @save="handleSubmit"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  invalidateCompanyLogoCache,
  resolveAssetDownloadUrl
} from '@/modules/template/composables/useCompanyLogoAsset';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { PHONE_COUNTRIES, getPhoneCountry, resolveDefaultPhoneCountry } from '@/utils/phoneInput';
import {
  ORG_CURRENCIES,
  buildCurrencyOptions,
  filterTimezoneGroups,
  getAllTimezones,
  normalizeIanaTimezone,
} from '@/utils/orgRegionalOptions';
import {
  applyRegionalBundleToForm,
  detectRegionalMismatch,
} from '@/utils/regionalSettings';
import { isValidGstin } from '@/utils/gstin';
import { getQuarterMonthLabels } from '@/utils/targetDisplayUtils';

const { t } = useI18n();
const authStore = useAuthStore();
const { success: notifySuccess, error: notifyError } = useNotifications();

const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const showTimezoneWarning = ref(false);
const regionalAlignDismissed = ref(false);
const originalForm = ref({});
const logoUploading = ref(false);
const logoBroken = ref(false);
const logoError = ref('');
const isDragging = ref(false);
const fileInputRef = ref(null);

const timezoneOpen = ref(false);
const timezoneSearch = ref('');

// Detect the browser's IANA timezone (e.g. "Asia/Kolkata") once on load.
// Falls back to empty string if the API is unavailable.
const detectedTimezone = ref('');
try {
  detectedTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
} catch (_) {
  detectedTimezone.value = '';
}

const form = ref({
  name: '',
  logoUrl: '',
  primaryColor: '#3a1f8a',
  timeZone: 'UTC',
  currency: 'USD',
  locale: 'en-US',
  language: 'en',
  defaultPhoneCountry: '',
  dataRegion: 'us-east-1',
  phone: '',
  website: '',
  taxId: '',
  gstin: '',
  companyAddress: {
    line1: '',
    city: '',
    postalCode: '',
    country: '',
  },
  social: {
    facebook: '',
    twitter: '',
    linkedin: '',
  },
  fiscalYearStartMonth: 1,
});

// -------- Timezones (grouped, comprehensive, with offsets) --------

const allTimezones = computed(() => getAllTimezones());

const filteredTimezoneGroups = computed(() => filterTimezoneGroups(timezoneSearch.value));

const selectedTimezoneMeta = computed(() => {
  return allTimezones.value.find((tz) => tz.value === form.value.timeZone) || null;
});

const selectedTimezoneLabel = computed(() => {
  const tz = selectedTimezoneMeta.value;
  if (!tz) return form.value.timeZone || '';
  return `${tz.sublabel || tz.text} (${tz.offset})`;
});

const timezoneShortLabel = computed(() => {
  const tz = selectedTimezoneMeta.value;
  if (!tz) return form.value.timeZone || 'UTC';
  return `${tz.sublabel || tz.text.replace(/^.*\//, '')} · ${tz.offset}`;
});

const selectTimezone = (value) => {
  form.value.timeZone = normalizeIanaTimezone(value);
  timezoneSearch.value = '';
  timezoneOpen.value = false;
  regionalAlignDismissed.value = false;
  handleTimezoneChange();
};

const detectedTimezoneLabel = computed(() => {
  if (!detectedTimezone.value) return '';
  const known = allTimezones.value.find((tz) => tz.value === detectedTimezone.value);
  return known ? `${known.sublabel || known.text} (${known.offset})` : detectedTimezone.value;
});

const useDetectedTimezone = () => {
  if (!detectedTimezone.value) return;
  selectTimezone(detectedTimezone.value);
};

const closeTimezoneOnOutside = (e) => {
  if (!timezoneOpen.value) return;
  // Close if click is outside the search input dropdown container.
  const target = e.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-tz-root]')) return;
  timezoneOpen.value = false;
};

onBeforeUnmount(() => {
  document.removeEventListener('click', closeTimezoneOnOutside);
});

// -------- Currencies --------
const currencies = ORG_CURRENCIES;

const currencyOptions = computed(() => buildCurrencyOptions(currencies));

const phoneCountryOptions = computed(() => [
  { value: '', label: t('settings.orgPhoneCountryAuto') },
  ...PHONE_COUNTRIES.map((country) => ({
    value: country.iso2,
    label: `${country.name} (+${country.dialCode})`,
  })),
]);

const countryOptions = computed(() => [
  { value: '', label: t('settings.orgCountryPh') },
  ...PHONE_COUNTRIES.map((country) => ({
    value: country.iso2,
    label: country.name,
  })),
]);

const fyMonthOptions = computed(() => {
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: fmt.format(new Date(2000, i, 1)),
  }));
});

const fyQuarterPreview = computed(() => {
  const startMonth = Number(form.value.fiscalYearStartMonth) || 1;
  return [1, 2, 3, 4].map((quarter) => ({
    quarter,
    range: getQuarterMonthLabels(quarter, startMonth),
  }));
});

const resolvedPhoneCountryLabel = computed(() => {
  const iso2 = resolveDefaultPhoneCountry({
    orgDefaultPhoneCountry: form.value.defaultPhoneCountry,
    orgLocale: form.value.locale,
    orgTimeZone: form.value.timeZone,
    orgCurrency: form.value.currency,
  });
  return getPhoneCountry(iso2).name;
});

const effectivePhoneCountryIso2 = computed(() =>
  resolveDefaultPhoneCountry({
    orgDefaultPhoneCountry: form.value.defaultPhoneCountry,
    orgLocale: form.value.locale,
    orgTimeZone: form.value.timeZone,
    orgCurrency: form.value.currency,
  })
);

const regionalMismatch = computed(() =>
  detectRegionalMismatch({
    timeZone: form.value.timeZone,
    currency: form.value.currency,
    locale: form.value.locale,
    defaultPhoneCountry: form.value.defaultPhoneCountry,
    effectivePhoneCountry: effectivePhoneCountryIso2.value,
  })
);

function applyRegionalAlign() {
  if (!regionalMismatch.value.bundle) return;
  form.value = applyRegionalBundleToForm(form.value, regionalMismatch.value.bundle);
  regionalAlignDismissed.value = true;
}

// -------- Languages --------
const LANGUAGE_I18N_KEYS = {
  en: 'orgLangEn',
  es: 'orgLangEs',
  fr: 'orgLangFr',
  de: 'orgLangDe',
  it: 'orgLangIt',
  pt: 'orgLangPt',
  nl: 'orgLangNl',
  ru: 'orgLangRu',
  ar: 'orgLangAr',
  hi: 'orgLangHi',
  ja: 'orgLangJa',
  zh: 'orgLangZh',
  ko: 'orgLangKo'
};

const languages = [
  { code: 'en' },
  { code: 'es' },
  { code: 'fr' },
  { code: 'de' },
  { code: 'it' },
  { code: 'pt' },
  { code: 'nl' },
  { code: 'ru' },
  { code: 'ar' },
  { code: 'hi' },
  { code: 'ja' },
  { code: 'zh' },
  { code: 'ko' }
];

const languageOptions = computed(() =>
  languages.map((l) => ({
    value: l.code,
    label: t(`settings.${LANGUAGE_I18N_KEYS[l.code]}`)
  }))
);

const languageLabel = computed(() => {
  const code = form.value.language;
  const key = LANGUAGE_I18N_KEYS[code];
  if (key) return t(`settings.${key}`);
  return code || t('settings.orgLangEn');
});

// -------- Derived --------
const companyInitials = computed(() => {
  const name = (form.value.name || 'Company').trim();
  if (!name) return 'C';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

const resolvedLogoUrl = computed(() => {
  const url = form.value.logoUrl || '';
  if (!url) return '';
  return resolveAssetDownloadUrl(url) || (
    url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')
      ? url
      : getApiUrlForFetch(url)
  );
});

const hasChanges = computed(() => {
  return JSON.stringify(form.value) !== JSON.stringify(originalForm.value);
});

// -------- Lifecycle / API --------
const fetchOrganizationSettings = async () => {
  loading.value = true;
  error.value = null;
  logoBroken.value = false;

  try {
    const data = await apiClient('/settings/organization', { method: 'GET', cache: 'no-store' });

    if (data && data.success && data.data) {
      const savedTimeZone = data.data.timeZone || 'UTC';
      const addr = data.data.companyAddress || {};
      const social = data.data.social || {};
      form.value = {
        name: data.data.name || '',
        logoUrl: data.data.logoUrl || '',
        primaryColor: data.data.primaryColor || '#3a1f8a',
        timeZone: savedTimeZone,
        currency: data.data.currency || 'USD',
        locale: data.data.locale || 'en-US',
        language: data.data.language || 'en',
        defaultPhoneCountry: data.data.defaultPhoneCountry || '',
        dataRegion: data.data.dataRegion || 'us-east-1',
        phone: data.data.phone || '',
        website: data.data.website || '',
        taxId: data.data.taxId || '',
        gstin: data.data.gstin || '',
        companyAddress: {
          line1: addr.line1 || '',
          city: addr.city || '',
          postalCode: addr.postalCode || '',
          country: addr.country || '',
        },
        social: {
          facebook: social.facebook || '',
          twitter: social.twitter || '',
          linkedin: social.linkedin || '',
        },
        fiscalYearStartMonth: Number(data.data.fiscalYearStartMonth) || 1,
      };
      // Capture the server-saved state as the baseline used for "unsaved changes" detection.
      originalForm.value = JSON.parse(JSON.stringify(form.value));

      if (authStore.organization) {
        authStore.organization = {
          ...authStore.organization,
          name: form.value.name || authStore.organization.name,
          phone: form.value.phone,
          website: form.value.website,
          taxId: form.value.taxId,
          gstin: form.value.gstin,
          settings: {
            ...(authStore.organization.settings || {}),
            logoUrl: form.value.logoUrl || null,
            primaryColor: form.value.primaryColor,
            fiscalYearStartMonth: form.value.fiscalYearStartMonth,
            companyAddress: { ...form.value.companyAddress },
            social: { ...form.value.social },
          }
        };
        localStorage.setItem('organization', JSON.stringify(authStore.organization));
      }

      // Smart default: if the org has never explicitly chosen a timezone (still on
      // the UTC fallback) and the browser reports a different zone, pre-fill the
      // form with the detected zone. This shows up as an unsaved change so the
      // admin can confirm by saving — we never silently mutate persisted data.
      if (
        savedTimeZone === 'UTC' &&
        detectedTimezone.value &&
        detectedTimezone.value !== 'UTC'
      ) {
        form.value.timeZone = detectedTimezone.value;
        showTimezoneWarning.value = true;
      }
    } else {
      error.value = new Error('Invalid response from server');
    }
  } catch (err) {
    console.error('Failed to fetch organization settings:', err);
    error.value = err;
  } finally {
    loading.value = false;
  }
};

const handleTimezoneChange = () => {
  showTimezoneWarning.value = form.value.timeZone !== originalForm.value.timeZone;
};

const resetForm = () => {
  form.value = JSON.parse(JSON.stringify(originalForm.value));
  showTimezoneWarning.value = false;
  logoBroken.value = false;
  logoError.value = '';
};

const normalizeGstinField = () => {
  form.value.gstin = String(form.value.gstin || '').trim().toUpperCase().replace(/\s+/g, '');
};

const handleSubmit = async () => {
  saving.value = true;
  try {
    normalizeGstinField();
    if (form.value.gstin && !isValidGstin(form.value.gstin)) {
      notifyError(t('settings.orgGstinInvalid'));
      saving.value = false;
      return;
    }

    // Send only fields the user actually changed so audit log stays precise.
    const payload = {};
    const scalarKeys = [
      'name',
      'logoUrl',
      'primaryColor',
      'timeZone',
      'currency',
      'locale',
      'language',
      'defaultPhoneCountry',
      'phone',
      'website',
      'taxId',
      'gstin',
      'fiscalYearStartMonth',
    ];
    for (const key of scalarKeys) {
      const nextVal = key === 'defaultPhoneCountry' || key === 'phone' || key === 'website' || key === 'taxId' || key === 'gstin'
        ? (form.value[key] || '')
        : form.value[key];
      const prevVal = key === 'defaultPhoneCountry' || key === 'phone' || key === 'website' || key === 'taxId' || key === 'gstin'
        ? (originalForm.value[key] || '')
        : originalForm.value[key];
      if (JSON.stringify(nextVal ?? null) !== JSON.stringify(prevVal ?? null)) {
        payload[key] = nextVal;
      }
    }
    if (JSON.stringify(form.value.companyAddress) !== JSON.stringify(originalForm.value.companyAddress)) {
      payload.companyAddress = { ...form.value.companyAddress };
    }
    if (JSON.stringify(form.value.social) !== JSON.stringify(originalForm.value.social)) {
      payload.social = { ...form.value.social };
    }

    if (Object.keys(payload).length === 0) {
      saving.value = false;
      return;
    }

    const data = await apiClient('/settings/organization', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (data && data.success) {
      if (data.data?.gstin != null) {
        form.value.gstin = data.data.gstin || '';
      }
      originalForm.value = JSON.parse(JSON.stringify(form.value));
      showTimezoneWarning.value = false;
      if (authStore.organization) {
        authStore.organization = {
          ...authStore.organization,
          ...(payload.name !== undefined ? { name: form.value.name } : {}),
          phone: form.value.phone,
          website: form.value.website,
          taxId: form.value.taxId,
          gstin: form.value.gstin,
          settings: {
            ...(authStore.organization.settings || {}),
            timeZone: form.value.timeZone,
            currency: form.value.currency,
            locale: form.value.locale,
            language: form.value.language,
            defaultPhoneCountry: form.value.defaultPhoneCountry || '',
            fiscalYearStartMonth: form.value.fiscalYearStartMonth,
            companyAddress: { ...form.value.companyAddress },
            social: { ...form.value.social },
            ...(payload.logoUrl !== undefined ? { logoUrl: form.value.logoUrl || null } : {}),
            ...(payload.primaryColor !== undefined ? { primaryColor: form.value.primaryColor } : {})
          },
        };
        localStorage.setItem('organization', JSON.stringify(authStore.organization));
      }
      if (typeof authStore.syncI18nFromOrganization === 'function') {
        await authStore.syncI18nFromOrganization();
      }
      notifySuccess(t('settings.orgSaveSuccess'));
    } else {
      const msg = data?.message || t('settings.orgUpdateFailed');
      notifyError(msg);
    }
  } catch (err) {
    console.error('Failed to update organization settings:', err);
    notifyError(err?.message || t('settings.orgUpdateFailed'));
  } finally {
    saving.value = false;
  }
};

// -------- Logo upload --------
const MAX_LOGO_SIZE = 10 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'
];

const triggerFilePicker = () => {
  if (logoUploading.value) return;
  fileInputRef.value?.click();
};

const handleFileSelected = (e) => {
  const file = e.target.files?.[0];
  if (file) uploadLogo(file);
  // Reset input so the same file can be selected again.
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleDrop = (e) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) uploadLogo(file);
};

const uploadLogo = async (file) => {
  logoError.value = '';
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    logoError.value = t('settings.orgLogoUnsupportedType');
    return;
  }
  if (file.size > MAX_LOGO_SIZE) {
    logoError.value = t('settings.orgLogoTooLarge');
    return;
  }

  logoUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('logo', file);

    const token = authStore.user?.token;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch('/settings/organization/logo'), {
      method: 'POST',
      headers,
      body: formData
    });

    if (response.status === 401) {
      authStore.logout();
      throw new Error(t('errors.auth_token_invalid'));
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Upload failed (${response.status})`);
    }

    const newUrl = result.data?.logoUrl;
    if (newUrl) {
      form.value.logoUrl = newUrl;
      // Server has already persisted this URL — keep originalForm in sync to avoid
      // appearing as a pending change just because of the logo.
      originalForm.value.logoUrl = newUrl;
      logoBroken.value = false;
      if (authStore.organization) {
        authStore.organization = {
          ...authStore.organization,
          settings: {
            ...(authStore.organization.settings || {}),
            logoUrl: newUrl
          }
        };
        localStorage.setItem('organization', JSON.stringify(authStore.organization));
      }
      invalidateCompanyLogoCache();
      notifySuccess(t('settings.orgLogoUploaded'));
    }
  } catch (err) {
    console.error('Logo upload failed:', err);
    logoError.value = err?.message || t('settings.orgLogoUploadFailed');
    notifyError(logoError.value);
  } finally {
    logoUploading.value = false;
  }
};

const removeLogo = async () => {
  if (logoUploading.value) return;
  // If the current URL is server-managed, call DELETE to remove the file reference.
  // Otherwise just clear locally (it'll persist via the main Save action).
  const isServerManaged = form.value.logoUrl && (
    form.value.logoUrl.startsWith('/api/uploads/') ||
    form.value.logoUrl.startsWith('/api/files/download')
  );
  if (isServerManaged) {
    logoUploading.value = true;
    try {
      const result = await apiClient('/settings/organization/logo', { method: 'DELETE' });
      if (result?.success) {
        form.value.logoUrl = '';
        originalForm.value.logoUrl = '';
        if (authStore.organization) {
          authStore.organization = {
            ...authStore.organization,
            settings: {
              ...(authStore.organization.settings || {}),
              logoUrl: null
            }
          };
          localStorage.setItem('organization', JSON.stringify(authStore.organization));
        }
        invalidateCompanyLogoCache();
        notifySuccess(t('settings.orgLogoRemoved'));
      } else {
        notifyError(result?.message || t('settings.orgLogoRemoveFailed'));
      }
    } catch (err) {
      notifyError(err?.message || t('settings.orgLogoRemoveFailed'));
    } finally {
      logoUploading.value = false;
    }
  } else {
    form.value.logoUrl = '';
    logoBroken.value = false;
  }
};

onMounted(() => {
  fetchOrganizationSettings();
  document.addEventListener('click', closeTimezoneOnOutside);
});
</script>
