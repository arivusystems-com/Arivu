<template>
  <SettingsScrollPanel :save-bar-visible="!loading && !error && hasProfileChanges">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.profileHeading') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.profileSubtitle') }}
        </p>
      </div>
    </template>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <div class="flex flex-col items-center gap-3">
        <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400"></div>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.profileLoading') }}</p>
      </div>
    </div>

    <!-- Error state -->
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
        <h3 class="text-sm font-semibold text-red-900 dark:text-red-200">{{ t('settings.profileLoadFailed') }}</h3>
        <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error.message || t('settings.pleaseTryAgain') }}</p>
        <button
          type="button"
          @click="fetchProfile"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ t('actions.retry') }}
        </button>
      </div>
    </div>

    <form v-else @submit.prevent="saveProfile" class="space-y-6">
      <!-- Identity Hero -->
      <section
        class="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <div
          aria-hidden="true"
          class="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 dark:from-indigo-950/40 dark:via-gray-800 dark:to-fuchsia-950/40"
        ></div>
        <div
          aria-hidden="true"
          class="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-indigo-200/40 dark:bg-indigo-500/10 blur-3xl"
        ></div>
        <div
          aria-hidden="true"
          class="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-fuchsia-200/40 dark:bg-fuchsia-500/10 blur-3xl"
        ></div>

        <div class="relative p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-center gap-6">
            <!-- Avatar with edit/remove controls -->
            <div class="relative flex-shrink-0 group">
              <button
                type="button"
                @click="triggerAvatarPicker"
                @keydown.enter.prevent="triggerAvatarPicker"
                @keydown.space.prevent="triggerAvatarPicker"
                @dragenter.prevent="isAvatarDragging = true"
                @dragover.prevent="isAvatarDragging = true"
                @dragleave.prevent="isAvatarDragging = false"
                @drop.prevent="handleAvatarDrop"
                :title="form.avatar ? t('settings.profileChangeAvatar') : t('settings.profileUploadAvatar')"
                :class="[
                  'relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 transition-transform',
                  isAvatarDragging ? 'scale-[1.03] ring-2 ring-indigo-400' : 'hover:scale-[1.02]'
                ]"
              >
                <img
                  v-if="form.avatar && !avatarBroken"
                  :src="resolvedAvatarUrl"
                  :alt="t('settings.profileAvatarAlt')"
                  class="w-full h-full object-cover"
                  @error="avatarBroken = true"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white text-3xl font-bold"
                >
                  {{ initials }}
                </div>
                <span
                  v-if="avatarUploading"
                  class="absolute inset-0 bg-black/50 flex items-center justify-center text-white"
                >
                  <svg class="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                <!-- Hover overlay -->
                <span
                  v-else
                  class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                >
                  <span class="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium inline-flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {{ t('settings.profileChange') }}
                  </span>
                </span>
              </button>
              <input
                ref="avatarInputRef"
                type="file"
                class="sr-only"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                @change="handleAvatarSelected"
              />
              <!-- Status dot -->
              <span
                class="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-gray-800"
                :class="statusDotClass"
                :aria-label="t('settings.profileStatusAria', { status: statusLabel })"
              />
            </div>

            <!-- Identity Summary -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {{ t('settings.profileHeading') }}
              </p>
              <h3 class="mt-1 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                {{ fullName || form.username || t('settings.profileAddName') }}
              </h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-300 truncate">
                {{ profile?.email || '—' }}
              </p>

              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-if="profile?.role"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur capitalize"
                >
                  <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ profile.role }}
                  <span v-if="profile?.isOwner" class="ml-0.5 text-[10px] uppercase tracking-wider text-indigo-700 dark:text-indigo-300">{{ t('settings.profileOwner') }}</span>
                </span>
                <span
                  v-if="organizationName"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {{ organizationName }}
                </span>
                <span
                  v-if="memberSinceLabel"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 backdrop-blur"
                >
                  <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {{ t('settings.profileJoined', { date: memberSinceLabel }) }}
                </span>
              </div>

              <!-- Avatar actions -->
              <div class="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  @click="triggerAvatarPicker"
                  :disabled="avatarUploading"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {{ form.avatar ? t('settings.profileChangePhoto') : t('settings.profileUploadPhoto') }}
                </button>
                <button
                  v-if="form.avatar"
                  type="button"
                  @click="removeAvatar"
                  :disabled="avatarUploading"
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                  {{ t('settings.profileRemovePhoto') }}
                </button>
                <p v-if="avatarError" class="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ avatarError }}
                </p>
                <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.profileAvatarHint') }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- User Information -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileUserInfo') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileUserInfoDesc') }}</p>
          </div>
        </header>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileUsername') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="form.username"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed font-mono text-sm"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileAccessType') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="accessTypeLabel"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileRole') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="roleDisplayName"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileReportsTo') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="reportsToLabel"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileLanguage') }}</label>
            <HeadlessSelect v-model="form.language" :options="languageOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileTimeZone') }}</label>
            <HeadlessSelect v-model="form.timeZone" :options="timeZoneOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileDateFormat') }}</label>
            <HeadlessSelect v-model="form.dateFormat" :options="dateFormatOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileTimeFormat') }}</label>
            <HeadlessSelect v-model="form.timeFormat" :options="timeFormatOptions" />
          </div>
        </div>
      </section>

      <!-- Employee Information -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileEmployeeInfo') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileEmployeeInfoDesc') }}</p>
          </div>
        </header>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label for="profile-first-name" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileFirstName') }}</label>
            <input
              id="profile-first-name"
              v-model="form.firstName"
              type="text"
              maxlength="60"
              autocomplete="given-name"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
              :placeholder="t('settings.profileFirstNamePh')"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-last-name" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileLastName') }}</label>
            <input
              id="profile-last-name"
              v-model="form.lastName"
              type="text"
              maxlength="60"
              autocomplete="family-name"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
              :placeholder="t('settings.profileLastNamePh')"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profilePrimaryGroup') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="primaryGroupLabel"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profilePrimaryEmail') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="profile?.email"
              type="email"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-secondary-email" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileSecondaryEmail') }}</label>
            <input
              id="profile-secondary-email"
              v-model="form.secondaryEmail"
              type="email"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-office-phone" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileOfficePhone') }}</label>
            <input
              id="profile-office-phone"
              v-model="form.officePhone"
              type="tel"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-home-phone" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileHomePhone') }}</label>
            <input
              id="profile-home-phone"
              v-model="form.homePhone"
              type="tel"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-mobile-phone" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileMobilePhone') }}</label>
            <input
              id="profile-mobile-phone"
              v-model="form.mobilePhone"
              type="tel"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
            />
          </div>
          <div class="space-y-2">
            <label for="profile-fax" class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileFax') }}</label>
            <input
              id="profile-fax"
              v-model="form.fax"
              type="tel"
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileCreatedAt') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="formatDateTime(profile?.createdAt)"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileSuspendedOn') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="formatDateTime(profile?.suspendedAt)"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">
              {{ t('settings.profileReactivatedOn') }}
              <span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">{{ t('settings.profileReadOnly') }}</span>
            </label>
            <input
              :value="formatDateTime(profile?.reactivatedAt)"
              type="text"
              readonly
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      <!-- My Groups -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileMyGroups') }}</h3>
              <span
                v-if="myGroups.length"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-800/60"
              >
                {{ myGroups.length }}
              </span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileMyGroupsDesc') }}</p>
          </div>
        </header>

        <div v-if="myGroups.length === 0" class="px-6 py-10 text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700">
            <svg class="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.profileMyGroupsEmptyTitle') }}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">{{ t('settings.profileMyGroupsEmptyBody') }}</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-100 dark:divide-gray-700/60">
            <thead>
              <tr class="bg-gray-50/80 dark:bg-gray-900/40">
                <th scope="col" class="w-14 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.profileMyGroupsColIndex') }}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.profileMyGroupsColName') }}
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ t('settings.profileMyGroupsColDescription') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <tr
                v-for="(group, index) in myGroups"
                :key="group._id || index"
                class="hover:bg-gray-50/70 dark:hover:bg-gray-900/30 transition-colors"
              >
                <td class="px-6 py-3.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {{ index + 1 }}
                </td>
                <td class="px-6 py-3.5">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span
                      class="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-800"
                      :style="{ backgroundColor: group.color || '#10B981' }"
                      aria-hidden="true"
                    />
                    <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ group.name }}
                    </span>
                    <span
                      v-if="isPrimaryGroup(group)"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50"
                    >
                      {{ t('settings.profileMyGroupsPrimaryBadge') }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  <span v-if="group.description" class="line-clamp-2">{{ group.description }}</span>
                  <span v-else class="text-gray-400 dark:text-gray-500">{{ t('settings.profileMyGroupsNoDescription') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Currency & Number Preferences -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileCurrencyPrefs') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileCurrencyPrefsDesc') }}</p>
          </div>
        </header>
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profilePreferredCurrency') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.preferredCurrency" :options="currencyOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileShowPreferredCurrency') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.showAmountsInPreferredCurrency" :options="yesNoOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileDigitGroupingPattern') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.digitGroupingPattern" :options="digitGroupingPatternOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileDecimalSeparator') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.decimalSeparator" :options="decimalSeparatorOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileDigitGroupingSeparator') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.digitGroupingSeparator" :options="digitGroupingSeparatorOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileCurrencyDecimals') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.currencyDecimalPlaces" :options="decimalPlacesOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileTruncateZeros') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.truncateTrailingZeros" :options="yesNoOptions" />
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileAggregatedFormat') }}</label>
            <HeadlessSelect v-model="form.displayPreferences.aggregatedNumberFormat" :options="aggregatedFormatOptions" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('settings.profileAggregatedFormatHelp') }}</p>
          </div>
        </div>
      </section>

      <!-- Business hours -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileBusinessHours') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileBusinessHoursDesc') }}</p>
          </div>
        </header>
        <div class="p-6">
          <AvailabilitySourceCard
            :label="t('settings.profileBusinessHoursAssigned')"
            :show-settings-link="false"
          />
        </div>
      </section>

      <!-- Appearance & Preferences -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileAppearance') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileAppearanceDesc') }}</p>
          </div>
        </header>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-900 dark:text-gray-200 mb-3">{{ t('settings.profileTheme') }}</label>
            <div class="grid grid-cols-3 gap-3 max-w-xl">
              <button
                v-for="opt in themeOptions"
                :key="opt.id"
                type="button"
                @click="setTheme(opt.id)"
                :class="[
                  'group relative overflow-hidden rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
                  colorMode === opt.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900/40'
                ]"
              >
                <!-- Preview swatch -->
                <div
                  class="h-16 rounded-lg overflow-hidden ring-1 ring-black/5 dark:ring-white/10 mb-3 flex"
                  :class="opt.swatchClass"
                >
                  <div class="w-1/3 h-full" :class="opt.previewLeft"></div>
                  <div class="flex-1 h-full p-1.5 flex flex-col gap-1">
                    <span class="block h-1.5 rounded-full" :class="opt.previewBar1"></span>
                    <span class="block h-1.5 w-1/2 rounded-full" :class="opt.previewBar2"></span>
                    <span class="block h-1.5 w-2/3 rounded-full mt-auto" :class="opt.previewBar3"></span>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ opt.label }}</span>
                  <span
                    v-if="colorMode === opt.id"
                    class="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300"
                  >{{ t('settings.profileThemeActive') }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ opt.description }}</p>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Security -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center justify-between gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileSignInSecurity') }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileSignInSecurityDesc') }}</p>
            </div>
          </div>
          <button
            v-if="!showPasswordEditor"
            type="button"
            @click="openPasswordEditor"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0-1.105.895-2 2-2h.5a2.5 2.5 0 010 5H10v3m2-9V4m0 0L9 7m3-3l3 3" />
            </svg>
            {{ t('settings.profileChangePassword') }}
          </button>
        </header>

        <div class="p-6">
          <div v-if="!showPasswordEditor" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profilePasswordLabel') }}</p>
              <p class="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">••••••••••••</p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profilePasswordHint') }}</p>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profileLastSignIn') }}</p>
              <p class="mt-1.5 text-sm font-medium text-gray-900 dark:text-white">{{ lastLoginLabel || t('settings.profileJustNow') }}</p>
              <p v-if="lastLoginAbsolute" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ lastLoginAbsolute }}</p>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-4">
              <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profileAccountStatus') }}</p>
              <p class="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 capitalize">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                {{ statusLabel }}
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {{ profile?.userType ? t('settings.profileUserType', { type: profile.userType.toLowerCase() }) : t('settings.profileStandardAccount') }}
              </p>
            </div>
          </div>

          <!-- Password Editor -->
          <div v-else class="space-y-4 max-w-xl">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileCurrentPassword') }}</label>
              <div class="relative">
                <input
                  v-model="passwordForm.current"
                  :type="passwordVisibility.current ? 'text' : 'password'"
                  autocomplete="current-password"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                  :placeholder="t('settings.profileCurrentPasswordPh')"
                />
                <button type="button" @click="passwordVisibility.current = !passwordVisibility.current" class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg v-if="passwordVisibility.current" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileNewPassword') }}</label>
              <div class="relative">
                <input
                  v-model="passwordForm.next"
                  :type="passwordVisibility.next ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none"
                  :placeholder="t('settings.profileNewPasswordPh')"
                />
                <button type="button" @click="passwordVisibility.next = !passwordVisibility.next" class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg v-if="passwordVisibility.next" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>

              <!-- Strength meter -->
              <div class="flex items-center gap-2 mt-1">
                <div class="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    :class="passwordStrength.barClass"
                    :style="{ width: passwordStrength.percent + '%' }"
                  ></div>
                </div>
                <span class="text-xs font-medium" :class="passwordStrength.labelClass">{{ passwordStrength.label }}</span>
              </div>
              <ul class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <li v-for="rule in passwordRules" :key="rule.id" class="flex items-center gap-1.5">
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0"
                    :class="rule.met ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-600'"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path v-if="rule.met" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    <circle v-else cx="12" cy="12" r="4" stroke-width="2" />
                  </svg>
                  {{ rule.label }}
                </li>
              </ul>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-900 dark:text-gray-200">{{ t('settings.profileConfirmPassword') }}</label>
              <div class="relative">
                <input
                  v-model="passwordForm.confirm"
                  :type="passwordVisibility.confirm ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="w-full px-3.5 py-2.5 pr-10 rounded-lg border bg-white dark:bg-gray-900/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/30 outline-none transition-colors"
                  :class="passwordMismatch ? 'border-red-400 dark:border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400'"
                  :placeholder="t('settings.profileConfirmPasswordPh')"
                />
                <button type="button" @click="passwordVisibility.confirm = !passwordVisibility.confirm" class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg v-if="passwordVisibility.confirm" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>
              <p v-if="passwordMismatch" class="text-xs text-red-600 dark:text-red-400">
                {{ t('settings.profilePasswordMismatch') }}
              </p>
            </div>

            <p v-if="passwordError" class="text-sm text-red-600 dark:text-red-400">{{ passwordError }}</p>

            <div class="flex items-center gap-2 pt-1">
              <button
                type="button"
                @click="changePassword"
                :disabled="!canSubmitPassword || changingPassword"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg v-if="changingPassword" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ changingPassword ? t('settings.profileUpdating') : t('settings.profileUpdatePassword') }}
              </button>
              <button
                type="button"
                @click="cancelPasswordEditor"
                :disabled="changingPassword"
                class="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
              >
                {{ t('actions.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Workspace access -->
      <section class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <header class="flex items-center gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-700/60">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.profileWorkspace') }}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.profileWorkspaceDesc') }}</p>
          </div>
        </header>

        <div class="p-6">
          <div v-if="appAccessList.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="entry in appAccessList"
              :key="entry.appKey"
              class="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30"
            >
              <div
                class="flex items-center justify-center w-10 h-10 rounded-lg text-white shadow-sm"
                :class="entry.color"
              >
                <span class="text-sm font-bold">{{ entry.short }}</span>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ entry.label }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  <span v-if="entry.roleKey">{{ entry.roleKey.toLowerCase() }}</span>
                  <span v-else>{{ t('settings.profileStandardAccess') }}</span>
                </p>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-10 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.profileNoApps') }}</p>
          </div>

          <!-- Account meta -->
          <dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profileMetaOrg') }}</dt>
              <dd class="mt-1 text-gray-900 dark:text-white truncate">{{ organizationName || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profileMetaMemberSince') }}</dt>
              <dd class="mt-1 text-gray-900 dark:text-white">{{ memberSinceLabel || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{{ t('settings.profileMetaLastLogin') }}</dt>
              <dd class="mt-1 text-gray-900 dark:text-white">{{ lastLoginAbsolute || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                {{ t('settings.profileMetaUserId') }}
                <button
                  type="button"
                  @click="copyToClipboard(profile?._id, t('settings.profileMetaUserId'))"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  :title="t('settings.profileCopyUserId')"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </dt>
              <dd class="mt-1 text-xs font-mono text-gray-700 dark:text-gray-200 break-all">{{ profile?._id || '—' }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </form>

    <I18nDeveloperSettings class="mt-6" />

    <SettingsSaveBar
      :visible="!loading && !error && hasProfileChanges"
      :saving="saving"
      @reset="resetProfileForm"
      @save="saveProfile"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import AvailabilitySourceCard from '@/components/business-hours/AvailabilitySourceCard.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useColorMode } from '@/composables/useColorMode';
import { useNotifications } from '@/composables/useNotifications';
import I18nDeveloperSettings from '@/components/settings/I18nDeveloperSettings.vue';
import { buildCurrencyOptions, getAllTimezones, normalizeIanaTimezone } from '@/utils/orgRegionalOptions';
import { getEnabledCurrencyOptions, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { formatDate, formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const authStore = useAuthStore();
const { colorMode, toggleColorMode } = useColorMode();
const { success: notifySuccess, error: notifyError } = useNotifications();

const ACCEPTED_AVATAR_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const MAX_AVATAR_SIZE = 10 * 1024 * 1024;

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
  ko: 'orgLangKo',
};

const PROFILE_LANGUAGES = Object.keys(LANGUAGE_I18N_KEYS);

function defaultDisplayPreferences(orgCurrency) {
  return {
    preferredCurrency: orgCurrency || 'USD',
    showAmountsInPreferredCurrency: 'false',
    digitGroupingPattern: 'international',
    decimalSeparator: '.',
    digitGroupingSeparator: ',',
    currencyDecimalPlaces: 2,
    truncateTrailingZeros: 'false',
    aggregatedNumberFormat: 'none',
  };
}

function emptyForm(orgCurrency) {
  return {
    firstName: '',
    lastName: '',
    avatar: '',
    username: '',
    secondaryEmail: '',
    officePhone: '',
    homePhone: '',
    mobilePhone: '',
    fax: '',
    language: '',
    timeZone: '',
    dateFormat: '',
    timeFormat: '12h',
    displayPreferences: defaultDisplayPreferences(orgCurrency),
  };
}

const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const profile = ref(null);

const form = ref(emptyForm());
const originalForm = ref(emptyForm());
const orgGroups = ref([]);

async function fetchOrgGroups() {
  try {
    const res = await apiClient.get('/groups?limit=200');
    const rows = Array.isArray(res?.data) ? res.data : (res?.data?.groups || []);
    orgGroups.value = rows.filter((g) => g?.isActive !== false);
  } catch {
    orgGroups.value = [];
  }
}

const avatarInputRef = ref(null);
const avatarUploading = ref(false);
const avatarBroken = ref(false);
const avatarError = ref('');
const isAvatarDragging = ref(false);

const showPasswordEditor = ref(false);
const changingPassword = ref(false);
const passwordError = ref('');
const passwordForm = reactive({ current: '', next: '', confirm: '' });
const passwordVisibility = reactive({ current: false, next: false, confirm: false });

const languageOptions = computed(() =>
  PROFILE_LANGUAGES.map((code) => ({
    value: code,
    label: t(`settings.${LANGUAGE_I18N_KEYS[code]}`),
  }))
);

const timeZoneOptions = computed(() =>
  getAllTimezones().map((tz) => ({
    value: tz.value,
    label: `${tz.sublabel || tz.text} (${tz.offset})`,
  }))
);

const dateFormatOptions = computed(() => [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY' },
]);

const timeFormatOptions = computed(() => [
  { value: '12h', label: t('settings.modFieldsTime12h') },
  { value: '24h', label: t('settings.modFieldsTime24h') },
]);

const currencyOptions = computed(() =>
  buildCurrencyOptions(getEnabledCurrencyOptions(authStore.organization))
);

// Picking a non-base preferred currency turns on converted display automatically.
watch(
  () => form.value.displayPreferences?.preferredCurrency,
  (preferred) => {
    if (!form.value?.displayPreferences) return;
    const orgBase = resolveOrgCurrencyCode(authStore.organization);
    if (preferred && preferred !== orgBase) {
      form.value.displayPreferences.showAmountsInPreferredCurrency = 'true';
    }
  }
);

const yesNoOptions = computed(() => [
  { value: 'true', label: t('settings.profileYes') },
  { value: 'false', label: t('settings.profileNo') },
]);

const digitGroupingPatternOptions = computed(() => [
  { value: 'international', label: t('settings.profileGroupingInternational') },
  { value: 'indian', label: t('settings.profileGroupingIndian') },
]);

const decimalSeparatorOptions = computed(() => [
  { value: '.', label: '.' },
  { value: ',', label: ',' },
]);

const digitGroupingSeparatorOptions = computed(() => [
  { value: ',', label: ',' },
  { value: '.', label: '.' },
  { value: ' ', label: t('settings.profileGroupingSpace') },
  { value: "'", label: "'" },
]);

const decimalPlacesOptions = computed(() =>
  [0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))
);

const aggregatedFormatOptions = computed(() => [
  { value: 'none', label: t('settings.profileAggNone') },
  { value: 'thousands', label: t('settings.profileAggThousands') },
  { value: 'millions', label: t('settings.profileAggMillions') },
  { value: 'billions', label: t('settings.profileAggBillions') },
]);

function formatDateTime(value) {
  if (!value) return t('settings.profileEmptyValue');
  return formatUserDateTime(value) || t('settings.profileEmptyValue');
}

const accessTypeLabel = computed(() => {
  const p = profile.value;
  if (!p) return t('settings.profileEmptyValue');
  const legacy = String(p.role || '').toLowerCase();
  if (p.isOwner || legacy === 'owner' || legacy === 'admin') {
    return t('settings.profileAccessAdmin');
  }
  return t('settings.profileAccessStandard');
});

const roleDisplayName = computed(() => {
  const p = profile.value;
  if (!p) return t('settings.profileEmptyValue');
  return p.roleId?.name || p.role || t('settings.profileEmptyValue');
});

const reportsToLabel = computed(() => {
  const r = profile.value?.reportsTo;
  if (!r) return t('settings.profileEmptyValue');
  if (typeof r === 'object') {
    const name = `${r.firstName || ''} ${r.lastName || ''}`.trim();
    return name || r.email || r.username || t('settings.profileEmptyValue');
  }
  return t('settings.profileEmptyValue');
});

const primaryGroupLabel = computed(() => {
  const g = profile.value?.primaryGroupId;
  if (!g) return t('settings.profileEmptyValue');
  if (typeof g === 'object') {
    return g.name || t('settings.profileEmptyValue');
  }
  const match = orgGroups.value.find((row) => String(row._id) === String(g));
  return match?.name || t('settings.profileEmptyValue');
});

const myGroups = computed(() => {
  const rows = profile.value?.groups;
  return Array.isArray(rows) ? rows : [];
});

const primaryGroupIdKey = computed(() => {
  const g = profile.value?.primaryGroupId;
  if (!g) return '';
  if (typeof g === 'object') return String(g._id || '');
  return String(g);
});

function isPrimaryGroup(group) {
  if (!group?._id || !primaryGroupIdKey.value) return false;
  return String(group._id) === primaryGroupIdKey.value;
}

function snapshotFromProfile(data) {
  const orgSettings = data?.organizationId?.settings || {};
  const orgCurrency = orgSettings.currency || 'USD';
  const rawPrefs = data.displayPreferences || {};
  const prefs = {
    ...defaultDisplayPreferences(orgCurrency),
    ...rawPrefs,
    preferredCurrency: rawPrefs.preferredCurrency || orgCurrency,
    showAmountsInPreferredCurrency: rawPrefs.showAmountsInPreferredCurrency ? 'true' : 'false',
    truncateTrailingZeros: rawPrefs.truncateTrailingZeros ? 'true' : 'false',
    currencyDecimalPlaces: Number(rawPrefs.currencyDecimalPlaces ?? 2),
  };
  return {
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    avatar: data.avatar || '',
    username: data.username || '',
    secondaryEmail: data.secondaryEmail || '',
    officePhone: data.officePhone || '',
    homePhone: data.homePhone || '',
    mobilePhone: data.mobilePhone || data.phoneNumber || '',
    fax: data.fax || '',
    language: data.language || orgSettings.language || 'en',
    timeZone: normalizeIanaTimezone(data.timeZone || orgSettings.timeZone || 'UTC') || 'UTC',
    dateFormat: data.dateFormat || orgSettings.dateFormat || 'MM/DD/YYYY',
    timeFormat: data.timeFormat === '24h' ? '24h' : '12h',
    displayPreferences: prefs,
  };
}

function serializeForm(f) {
  return JSON.stringify({
    firstName: f.firstName,
    lastName: f.lastName,
    secondaryEmail: f.secondaryEmail,
    officePhone: f.officePhone,
    homePhone: f.homePhone,
    mobilePhone: f.mobilePhone,
    fax: f.fax,
    language: f.language,
    timeZone: f.timeZone,
    dateFormat: f.dateFormat,
    timeFormat: f.timeFormat,
    displayPreferences: f.displayPreferences,
  });
}

const THEME_SWATCHES = [
  {
    id: 'light',
    labelKey: 'profileThemeLight',
    descKey: 'profileThemeLightDesc',
    swatchClass: 'bg-white',
    previewLeft: 'bg-gray-100',
    previewBar1: 'bg-indigo-500',
    previewBar2: 'bg-gray-300',
    previewBar3: 'bg-gray-300',
  },
  {
    id: 'dark',
    labelKey: 'profileThemeDark',
    descKey: 'profileThemeDarkDesc',
    swatchClass: 'bg-gray-900',
    previewLeft: 'bg-gray-800',
    previewBar1: 'bg-indigo-400',
    previewBar2: 'bg-gray-600',
    previewBar3: 'bg-gray-600',
  },
  {
    id: 'system',
    labelKey: 'profileThemeSystem',
    descKey: 'profileThemeSystemDesc',
    swatchClass: 'bg-gradient-to-r from-white to-gray-900',
    previewLeft: 'bg-gradient-to-b from-gray-100 to-gray-800',
    previewBar1: 'bg-indigo-500',
    previewBar2: 'bg-gray-400',
    previewBar3: 'bg-gray-400',
  },
];

const themeOptions = computed(() =>
  THEME_SWATCHES.map((meta) => ({
    id: meta.id,
    label: t(`settings.${meta.labelKey}`),
    description: t(`settings.${meta.descKey}`),
    swatchClass: meta.swatchClass,
    previewLeft: meta.previewLeft,
    previewBar1: meta.previewBar1,
    previewBar2: meta.previewBar2,
    previewBar3: meta.previewBar3,
  }))
);

function themeModeLabel(mode) {
  const keys = { light: 'profileThemeLight', dark: 'profileThemeDark', system: 'profileThemeSystem' };
  return t(`settings.${keys[mode] || keys.system}`);
}

const fullName = computed(() => {
  const parts = [form.value.firstName, form.value.lastName].filter(Boolean).map((s) => s.trim());
  return parts.join(' ').trim();
});

const initials = computed(() => {
  const f = (form.value.firstName || '').trim();
  const l = (form.value.lastName || '').trim();
  if (f || l) return ((f[0] || '') + (l[0] || '')).toUpperCase() || 'U';
  const name = form.value.username || profile.value?.email || '';
  if (!name) return 'U';
  const seg = name.split(/[^a-z0-9]/i).filter(Boolean);
  if (seg.length >= 2) return (seg[0][0] + seg[1][0]).toUpperCase();
  return (seg[0]?.slice(0, 2) || 'U').toUpperCase();
});

const resolvedAvatarUrl = computed(() => {
  const url = form.value.avatar || '';
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return getApiUrlForFetch(url);
});

const organizationName = computed(() => {
  return authStore.organization?.name || profile.value?.organizationId?.name || '';
});

const statusLabel = computed(() => {
  const s = profile.value?.status;
  if (s === 'active') return t('settings.profileThemeActive');
  return s || t('settings.profileThemeActive');
});
const statusDotClass = computed(() => {
  const s = profile.value?.status;
  if (s === 'suspended') return 'bg-rose-500';
  if (s === 'inactive') return 'bg-gray-400';
  return 'bg-emerald-500';
});

function formatRelative(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function formatAbsolute(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(d, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const memberSinceLabel = computed(() => {
  const d = profile.value?.createdAt;
  if (!d) return '';
  return formatDate(d, { month: 'short', year: 'numeric' });
});

const lastLoginLabel = computed(() => formatRelative(profile.value?.lastLogin));
const lastLoginAbsolute = computed(() => formatAbsolute(profile.value?.lastLogin));

// Map appKey to colors and short labels for the access cards
const APP_PRESENTATION = {
  SALES: { labelKey: 'navigation.appSales', short: 'S', color: 'bg-gradient-to-br from-indigo-500 to-violet-600' },
  HELPDESK: { labelKey: 'navigation.appHelpdesk', short: 'H', color: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  PROJECTS: { labelKey: 'navigation.appProjects', short: 'P', color: 'bg-gradient-to-br from-amber-500 to-orange-600' },
  AUDIT: { labelKey: 'navigation.appAudit', short: 'A', color: 'bg-gradient-to-br from-sky-500 to-blue-600' },
  PORTAL: { labelKey: 'navigation.appPortal', short: 'Po', color: 'bg-gradient-to-br from-rose-500 to-pink-600' },
  LMS: { labelKey: 'navigation.appLearning', short: 'L', color: 'bg-gradient-to-br from-fuchsia-500 to-purple-600' },
};

const appAccessList = computed(() => {
  const direct = Array.isArray(profile.value?.appAccess) ? profile.value.appAccess : [];
  if (direct.length) {
    return direct
      .filter((a) => String(a?.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((a) => {
        const key = String(a.appKey || '').toUpperCase();
        const meta = APP_PRESENTATION[key] || { label: key || 'App', short: (key[0] || 'A').toUpperCase(), color: 'bg-gradient-to-br from-gray-500 to-gray-700' };
        return {
          appKey: key,
          roleKey: a.roleKey || '',
          label: meta.labelKey ? t(meta.labelKey) : meta.label,
          short: meta.short,
          color: meta.color,
        };
      });
  }
  const allowed = Array.isArray(profile.value?.allowedApps) ? profile.value.allowedApps : [];
  return allowed.map((k) => {
    const key = String(k).toUpperCase();
    const meta = APP_PRESENTATION[key] || { label: key, short: (key[0] || 'A').toUpperCase(), color: 'bg-gradient-to-br from-gray-500 to-gray-700' };
    return { appKey: key, roleKey: '', label: meta.labelKey ? t(meta.labelKey) : meta.label, short: meta.short, color: meta.color };
  });
});

// --- Password rules ---
const passwordRules = computed(() => {
  const p = passwordForm.next || '';
  return [
    { id: 'len', label: t('settings.profilePwdRuleLen'), met: p.length >= 8 },
    { id: 'upper', label: t('settings.profilePwdRuleUpper'), met: /[A-Z]/.test(p) },
    { id: 'lower', label: t('settings.profilePwdRuleLower'), met: /[a-z]/.test(p) },
    { id: 'num', label: t('settings.profilePwdRuleNum'), met: /\d/.test(p) },
    { id: 'sym', label: t('settings.profilePwdRuleSym'), met: /[^A-Za-z0-9]/.test(p) },
    { id: 'diff', label: t('settings.profilePwdRuleDiff'), met: p.length > 0 && p !== passwordForm.current },
  ];
});

const passwordStrength = computed(() => {
  const met = passwordRules.value.filter((r) => r.met).length;
  const total = passwordRules.value.length;
  const percent = (met / total) * 100;
  if (met <= 1) return { percent, label: t('settings.profilePwdWeak'), barClass: 'bg-rose-500', labelClass: 'text-rose-600 dark:text-rose-400' };
  if (met <= 2) return { percent, label: t('settings.profilePwdWeak2'), barClass: 'bg-amber-500', labelClass: 'text-amber-600 dark:text-amber-400' };
  if (met <= 4) return { percent, label: t('settings.profilePwdOkay'), barClass: 'bg-yellow-500', labelClass: 'text-yellow-600 dark:text-yellow-400' };
  if (met < total) return { percent, label: t('settings.profilePwdStrong'), barClass: 'bg-emerald-500', labelClass: 'text-emerald-600 dark:text-emerald-400' };
  return { percent, label: t('settings.profilePwdExcellent'), barClass: 'bg-emerald-500', labelClass: 'text-emerald-600 dark:text-emerald-400' };
});

const passwordMismatch = computed(() => Boolean(passwordForm.confirm) && passwordForm.confirm !== passwordForm.next);

const canSubmitPassword = computed(() => {
  if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) return false;
  if (passwordMismatch.value) return false;
  // Require at least the length rule + one of upper/lower/number/symbol.
  const met = passwordRules.value.filter((r) => r.met).length;
  return met >= 3 && passwordForm.next.length >= 8;
});

const hasProfileChanges = computed(() => {
  return serializeForm(form.value) !== serializeForm(originalForm.value);
});

// --- Fetch ---
async function fetchProfile() {
  loading.value = true;
  error.value = null;
  try {
    const result = await apiClient('/users/profile');
    if (!result?.success || !result?.data) {
      throw new Error(result?.message || t('settings.profileUnableLoad'));
    }
    profile.value = result.data;
    const snapshot = snapshotFromProfile(result.data);
    form.value = {
      ...snapshot,
      displayPreferences: { ...snapshot.displayPreferences },
    };
    originalForm.value = {
      ...snapshot,
      displayPreferences: { ...snapshot.displayPreferences },
    };
    avatarBroken.value = false;
  } catch (err) {
    console.error('Load profile failed', err);
    error.value = err;
  } finally {
    loading.value = false;
  }
}

// --- Save profile ---
async function saveProfile() {
  if (!hasProfileChanges.value) return;
  saving.value = true;
  try {
    const payload = {
      firstName: form.value.firstName?.trim() || '',
      lastName: form.value.lastName?.trim() || '',
      secondaryEmail: form.value.secondaryEmail?.trim() || '',
      officePhone: form.value.officePhone?.trim() || '',
      homePhone: form.value.homePhone?.trim() || '',
      mobilePhone: form.value.mobilePhone?.trim() || '',
      fax: form.value.fax?.trim() || '',
      language: form.value.language || null,
      timeZone: form.value.timeZone || null,
      dateFormat: form.value.dateFormat || null,
      timeFormat: form.value.timeFormat || '12h',
      displayPreferences: {
        ...form.value.displayPreferences,
        preferredCurrency: form.value.displayPreferences.preferredCurrency || null,
        showAmountsInPreferredCurrency: (() => {
          const preferred = form.value.displayPreferences.preferredCurrency || null;
          const orgBase = resolveOrgCurrencyCode(authStore.organization);
          // Selecting a non-base preferred currency implies display conversion.
          if (preferred && preferred !== orgBase) return true;
          return form.value.displayPreferences.showAmountsInPreferredCurrency === 'true';
        })(),
        truncateTrailingZeros: form.value.displayPreferences.truncateTrailingZeros === 'true',
        currencyDecimalPlaces: Number(form.value.displayPreferences.currencyDecimalPlaces),
      },
    };
    const result = await apiClient.put('/users/profile', payload);
    if (!result?.success) {
      throw new Error(result?.message || t('settings.profileUpdateFailed'));
    }
    originalForm.value = {
      ...form.value,
      displayPreferences: { ...form.value.displayPreferences },
    };
    if (profile.value) {
      Object.assign(profile.value, payload);
    }
    await authStore.refreshUser({ force: true });
    notifySuccess(t('settings.profileUpdated'));
  } catch (err) {
    console.error('Save profile failed', err);
    notifyError(err?.message || t('settings.profileUpdateFailed'));
  } finally {
    saving.value = false;
  }
}

function resetProfileForm() {
  form.value = {
    ...originalForm.value,
    displayPreferences: { ...originalForm.value.displayPreferences },
  };
}

// --- Avatar upload ---
function triggerAvatarPicker() {
  if (avatarUploading.value) return;
  avatarInputRef.value?.click();
}

function handleAvatarSelected(e) {
  const file = e.target.files?.[0];
  if (file) uploadAvatar(file);
  if (avatarInputRef.value) avatarInputRef.value.value = '';
}

function handleAvatarDrop(e) {
  isAvatarDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) uploadAvatar(file);
}

async function uploadAvatar(file) {
  avatarError.value = '';
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
    avatarError.value = t('settings.profileAvatarUnsupported');
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    avatarError.value = t('settings.profileAvatarTooLarge');
    return;
  }

  avatarUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = authStore.user?.token;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch('/users/profile/avatar'), {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401) {
      authStore.logout();
      throw new Error(t('settings.profileSessionExpired'));
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Upload failed (${response.status})`);
    }
    const newUrl = result.data?.avatar;
    if (newUrl) {
      form.value.avatar = newUrl;
      originalForm.value.avatar = newUrl;
      avatarBroken.value = false;
      // Reflect new avatar in the global auth user immediately.
      if (authStore.user) {
        authStore.user = { ...authStore.user, avatar: newUrl };
        try {
          localStorage.setItem('user', JSON.stringify(authStore.user));
        } catch (_) {
          // localStorage may be unavailable in private modes — non-fatal.
        }
      }
      notifySuccess(t('settings.profileAvatarUpdated'));
    }
  } catch (err) {
    console.error('Avatar upload failed', err);
    avatarError.value = err?.message || t('settings.profileAvatarUploadFailed');
    notifyError(avatarError.value);
  } finally {
    avatarUploading.value = false;
  }
}

async function removeAvatar() {
  if (avatarUploading.value) return;
  avatarUploading.value = true;
  try {
    const result = await apiClient.delete('/users/profile/avatar');
    if (result?.success) {
      form.value.avatar = '';
      originalForm.value.avatar = '';
      if (authStore.user) {
        authStore.user = { ...authStore.user, avatar: '' };
        try {
          localStorage.setItem('user', JSON.stringify(authStore.user));
        } catch (_) {
          // localStorage may be unavailable; non-fatal.
        }
      }
      notifySuccess(t('settings.profileAvatarRemoved'));
    } else {
      throw new Error(result?.message || t('settings.profileAvatarRemoveFailed'));
    }
  } catch (err) {
    console.error('Remove avatar failed', err);
    notifyError(err?.message || t('settings.profileAvatarRemoveFailed'));
  } finally {
    avatarUploading.value = false;
  }
}

// --- Password change ---
function openPasswordEditor() {
  showPasswordEditor.value = true;
  passwordError.value = '';
  passwordForm.current = '';
  passwordForm.next = '';
  passwordForm.confirm = '';
}

function cancelPasswordEditor() {
  showPasswordEditor.value = false;
  passwordError.value = '';
  passwordForm.current = '';
  passwordForm.next = '';
  passwordForm.confirm = '';
  passwordVisibility.current = false;
  passwordVisibility.next = false;
  passwordVisibility.confirm = false;
}

async function changePassword() {
  if (!canSubmitPassword.value) return;
  passwordError.value = '';
  changingPassword.value = true;
  try {
    const result = await apiClient.put('/users/profile/password', {
      currentPassword: passwordForm.current,
      newPassword: passwordForm.next,
    });
    if (!result?.success) {
      throw new Error(result?.message || t('settings.profilePasswordChangeFailed'));
    }
    notifySuccess(t('settings.profilePasswordUpdated'));
    cancelPasswordEditor();
  } catch (err) {
    console.error('Change password failed', err);
    passwordError.value = err?.message || t('settings.profilePasswordChangeFailed');
  } finally {
    changingPassword.value = false;
  }
}

// --- Theme ---
function setTheme(mode) {
  if (mode === colorMode.value) return;
  toggleColorMode(mode);
  notifySuccess(t('settings.profileThemeSet', { mode: themeModeLabel(mode) }));
}

// --- Misc ---
async function copyToClipboard(value, label) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(String(value));
    notifySuccess(t('settings.profileCopied', { label }));
  } catch (_e) {
    notifyError(t('settings.profileCopyFailed', { label: String(label).toLowerCase() }));
  }
}

onMounted(() => {
  void fetchOrgGroups();
  void fetchProfile();
});
</script>
