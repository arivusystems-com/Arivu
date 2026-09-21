<template>
  <form
    v-if="inline"
    class="space-y-6"
    @submit.prevent="handleSubmit"
  >
    <p
      v-if="error"
      ref="errorBannerEl"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
    >
      {{ error }}
    </p>

    <section class="space-y-4">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {{ t('settings.inviteSectionProfile') }}
      </h4>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="space-y-1">
          <label for="onboarding-invite-first-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.inviteFirstName') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="onboarding-invite-first-name"
            v-model="form.firstName"
            type="text"
            required
            :placeholder="t('settings.inviteFirstNamePh')"
            class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>
        <div class="space-y-1">
          <label for="onboarding-invite-last-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.inviteLastName') }} <span class="text-red-500">*</span>
          </label>
          <input
            id="onboarding-invite-last-name"
            v-model="form.lastName"
            type="text"
            required
            :placeholder="t('settings.inviteLastNamePh')"
            class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>
      <div class="space-y-1">
        <label for="onboarding-invite-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('settings.inviteEmail') }} <span class="text-red-500">*</span>
        </label>
        <input
          id="onboarding-invite-email"
          v-model="form.email"
          type="email"
          required
          :placeholder="t('settings.inviteEmailPh')"
          class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        />
      </div>
    </section>

    <section class="space-y-4">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {{ t('settings.inviteSectionAccess') }}
      </h4>

      <div v-if="inviteRoles.length > 0" class="space-y-1">
        <label for="onboarding-invite-role" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('settings.inviteRole') }} <span class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          id="onboarding-invite-role"
          v-model="form.roleId"
          :options="roleSelectOptions"
          :invalid="Boolean(validationErrors.roleId)"
        />
        <p v-if="validationErrors.roleId" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ validationErrors.roleId }}
        </p>
      </div>

      <div class="space-y-1">
        <label for="onboarding-invite-business-hours" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('settings.inviteBusinessHours') }} <span class="text-red-500">*</span>
        </label>
        <HeadlessSelect
          id="onboarding-invite-business-hours"
          v-model="form.businessHourSetId"
          :options="businessHoursSelectOptions"
          :invalid="Boolean(validationErrors.businessHourSetId)"
        />
        <p v-if="validationErrors.businessHourSetId" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ validationErrors.businessHourSetId }}
        </p>
      </div>

      <div v-if="!rbacV2Enabled" class="space-y-3">
        <span class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('settings.inviteAppAccess') }} <span class="text-red-500">*</span>
        </span>
        <div v-if="loadingCapabilities" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.inviteLoadingApps') }}
        </div>
        <div v-else-if="availableApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.inviteNoApps') }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="app in availableApps"
            :key="app.appKey"
            class="rounded-lg border transition-colors"
            :class="[
              isAppSelected(app.appKey)
                ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-900/20'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50',
              !isAppEnabled(app) && 'opacity-60'
            ]"
          >
            <div class="flex items-start gap-3 p-3">
              <HeadlessCheckbox
                :id="`onboarding-app-${app.appKey}`"
                :checked="isAppSelected(app.appKey)"
                :disabled="!isAppEnabled(app)"
                checkbox-class="mt-0.5"
                @change="toggleApp(app)"
              />
              <div class="min-w-0 flex-1 space-y-2">
                <label
                  :for="`onboarding-app-${app.appKey}`"
                  class="block cursor-pointer text-sm font-medium text-gray-900 dark:text-white"
                  :class="{ 'cursor-not-allowed': !isAppEnabled(app) }"
                >
                  {{ getAppDisplayName(app.appKey) }}
                </label>
                <div v-if="isAppSelected(app.appKey)" class="space-y-1">
                  <label :for="`onboarding-app-role-${app.appKey}`" class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {{ t('settings.inviteRoleForApp', { app: getAppDisplayName(app.appKey) }) }}
                  </label>
                  <HeadlessSelect
                    :id="`onboarding-app-role-${app.appKey}`"
                    :model-value="selectedAppRoles[app.appKey]"
                    :options="getAppRoleOptions(app)"
                    @update:model-value="updateAppRole(app.appKey, $event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p v-if="validationErrors.appAccess" class="text-xs text-red-600 dark:text-red-400">
          {{ validationErrors.appAccess }}
        </p>
        <div
          v-if="inviteCostPreview && (form.userType === 'STANDARD' || form.userType === 'ADMIN' || form.userType === 'INTERNAL')"
          class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/40"
        >
          <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {{ t('settings.inviteCostPreviewHeading') }}
          </p>
          <ul class="mt-2 space-y-1">
            <li
              v-for="line in inviteCostPreview.lines"
              :key="line.productCode"
              class="flex justify-between gap-3 tabular-nums text-slate-700 dark:text-slate-300"
            >
              <span>{{ line.label }}</span>
              <span>{{ formatInviteCost(line.amountMinor) }}</span>
            </li>
          </ul>
          <p class="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold tabular-nums dark:border-slate-700">
            <span>{{ t('settings.inviteCostPreviewTotal') }}</span>
            <span>{{ formatInviteCost(inviteCostPreview.totalMinor) }}{{ t('settings.inviteCostPreviewPerMonth') }}</span>
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
        <div class="flex items-start gap-3">
          <HeadlessCheckbox
            v-model="form.sendEmail"
            id="onboarding-send-email"
            checkbox-class="mt-0.5"
          />
          <div class="min-w-0">
            <label for="onboarding-send-email" class="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">
              {{ t('settings.inviteSendEmail') }}
            </label>
            <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {{ form.sendEmail ? t('settings.inviteSendEmailOnInvite') : t('settings.inviteSendEmailOffLink') }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        :disabled="saving || !isFormValid"
      >
        {{ submitButtonLabel }}
      </button>
      <slot name="secondary-action" />
    </div>
  </form>

  <TransitionRoot v-else as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleDialogClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto h-full flex">
                <DialogPanel
                  class="rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[min(92vw,42rem)]"
                >
                  <form @submit.prevent="handleSubmit" class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-5 sm:px-6">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0">
                          <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 shadow-none flex-shrink-0">
                            <UserPlusIcon class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white truncate">
                              {{ t('settings.inviteTitle') }}
                            </DialogTitle>
                            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {{ t('settings.inviteDrawerSubtitle') }}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer flex-shrink-0"
                          @click="requestClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div ref="formBodyScrollEl" class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6 space-y-8">
                        <div v-if="successMessage" class="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3">
                          <p class="text-sm text-green-800 dark:text-green-300">{{ successMessage }}</p>
                          <p v-if="successDetail" class="mt-1 text-xs text-green-700 dark:text-green-400">{{ successDetail }}</p>
                        </div>

                        <div
                          v-if="error"
                          ref="errorBannerEl"
                          class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3"
                        >
                          <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
                        </div>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {{ t('settings.inviteSectionProfile') }}
                          </h4>

                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div class="space-y-1">
                              <label for="invite-first-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ t('settings.inviteFirstName') }} <span class="text-red-500">*</span>
                              </label>
                              <input
                                id="invite-first-name"
                                v-model="form.firstName"
                                type="text"
                                required
                                :placeholder="t('settings.inviteFirstNamePh')"
                                class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                              />
                            </div>

                            <div class="space-y-1">
                              <label for="invite-last-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ t('settings.inviteLastName') }} <span class="text-red-500">*</span>
                              </label>
                              <input
                                id="invite-last-name"
                                v-model="form.lastName"
                                type="text"
                                required
                                :placeholder="t('settings.inviteLastNamePh')"
                                class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                              />
                            </div>
                          </div>

                          <div class="space-y-1">
                            <label for="invite-email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteEmail') }} <span class="text-red-500">*</span>
                            </label>
                            <input
                              id="invite-email"
                              v-model="form.email"
                              type="email"
                              required
                              :placeholder="t('settings.inviteEmailPh')"
                              class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                            />
                          </div>
                        </section>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {{ t('settings.inviteSectionAccess') }}
                          </h4>

                          <div v-if="!rbacV2Enabled" class="space-y-1">
                            <span class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteUserType') }} <span class="text-red-500">*</span>
                            </span>
                            <div class="mt-2 flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-1">
                              <button
                                v-for="option in userTypeOptions"
                                :key="option.value"
                                type="button"
                                :class="[
                                  form.userType === option.value
                                    ? 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                                  'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors'
                                ]"
                                @click="selectUserType(option.value)"
                              >
                                {{ option.label }}
                              </button>
                            </div>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteUserTypeHint') }}
                            </p>
                          </div>

                          <div v-if="availableRoles.length > 0" class="space-y-1">
                            <label for="invite-role" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteRole') }} <span class="text-red-500">*</span>
                            </label>
                            <HeadlessSelect
                              id="invite-role"
                              v-model="form.roleId"
                              :options="roleSelectOptions"
                              :invalid="Boolean(validationErrors.roleId)"
                            />
                            <p v-if="validationErrors.roleId" class="text-xs text-red-600 dark:text-red-400 mt-1">
                              {{ validationErrors.roleId }}
                            </p>
                            <p v-if="rbacV2Enabled" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2RoleHint') }}
                            </p>
                          </div>

                          <div class="space-y-1">
                            <label for="invite-business-hours" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteBusinessHours') }} <span class="text-red-500">*</span>
                            </label>
                            <HeadlessSelect
                              id="invite-business-hours"
                              v-model="form.businessHourSetId"
                              :options="businessHoursSelectOptions"
                              :invalid="Boolean(validationErrors.businessHourSetId)"
                            />
                            <p v-if="validationErrors.businessHourSetId" class="text-xs text-red-600 dark:text-red-400 mt-1">
                              {{ validationErrors.businessHourSetId }}
                            </p>
                          </div>

                          <div
                            v-if="rbacV2Enabled && selectedRole"
                            class="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 p-4 space-y-3"
                          >
                            <p class="text-xs font-semibold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider">
                              {{ t('settings.inviteRbacV2PreviewTitle') }}
                            </p>
                            <p v-if="selectedRole.description" class="text-sm text-gray-700 dark:text-gray-300">
                              {{ selectedRole.description }}
                            </p>
                            <p v-if="selectedRoleProfileName" class="text-xs text-gray-600 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2Profile', { profile: selectedRoleProfileName }) }}
                            </p>
                            <div v-if="selectedRoleAppPreview.length" class="flex flex-wrap gap-2">
                              <span
                                v-for="chip in selectedRoleAppPreview"
                                :key="chip.appKey"
                                class="inline-flex items-center rounded-full bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:text-indigo-200"
                              >
                                {{ chip.label }}
                              </span>
                            </div>
                            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2NoApps') }}
                            </p>
                          </div>

                          <div v-if="!rbacV2Enabled && form.userType" class="space-y-3">
                            <span class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteAppAccess') }} <span class="text-red-500">*</span>
                            </span>

                            <div v-if="loadingCapabilities" class="text-sm text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteLoadingApps') }}
                            </div>
                            <div v-else-if="availableApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteNoApps') }}
                            </div>
                            <div v-else class="space-y-2">
                              <div
                                v-for="app in availableApps"
                                :key="app.appKey"
                                class="rounded-lg border transition-colors"
                                :class="[
                                  isAppSelected(app.appKey)
                                    ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50',
                                  !isAppEnabled(app) && 'opacity-60'
                                ]"
                              >
                                <div class="flex items-start gap-3 p-3">
                                  <HeadlessCheckbox
                                    :id="`app-${app.appKey}`"
                                    :checked="isAppSelected(app.appKey)"
                                    :disabled="!isAppEnabled(app)"
                                    checkbox-class="mt-0.5"
                                    @change="toggleApp(app)"
                                  />
                                  <div class="min-w-0 flex-1 space-y-2">
                                    <label
                                      :for="`app-${app.appKey}`"
                                      class="block cursor-pointer"
                                      :class="{ 'cursor-not-allowed': !isAppEnabled(app) }"
                                    >
                                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                                        {{ getAppDisplayName(app.appKey) }}
                                      </span>
                                      <span
                                        v-if="app.seatInfo && app.seatInfo.limit !== null"
                                        class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400"
                                      >
                                        <template v-if="app.seatInfo.available !== null">
                                          {{ t('settings.inviteSeatsUsed', { used: app.seatInfo.used, limit: app.seatInfo.limit }) }}
                                          <span v-if="app.seatInfo.available === 0" class="text-red-600 dark:text-red-400 font-medium">
                                            {{ t('settings.inviteNoSeats') }}
                                          </span>
                                          <span v-else class="text-green-600 dark:text-green-400">
                                            {{ t('settings.inviteSeatsAvailable', { count: app.seatInfo.available }) }}
                                          </span>
                                        </template>
                                        <template v-else>
                                          {{ t('settings.inviteUnlimitedSeats') }}
                                        </template>
                                      </span>
                                    </label>

                                    <div v-if="isAppSelected(app.appKey)" class="space-y-1">
                                      <label :for="`app-role-${app.appKey}`" class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {{ t('settings.inviteRoleForApp', { app: getAppDisplayName(app.appKey) }) }}
                                      </label>
                                      <HeadlessSelect
                                        :id="`app-role-${app.appKey}`"
                                        :model-value="selectedAppRoles[app.appKey]"
                                        :options="getAppRoleOptions(app)"
                                        @update:model-value="updateAppRole(app.appKey, $event)"
                                      />
                                    </div>

                                    <p
                                      v-if="!isAppEnabled(app) && app.seatInfo && !app.seatInfo.canAdd"
                                      class="text-xs text-red-600 dark:text-red-400"
                                    >
                                      {{ app.seatInfo.reason }}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p v-if="validationErrors.appAccess" class="text-xs text-red-600 dark:text-red-400">
                              {{ validationErrors.appAccess }}
                            </p>
                            <div
                              v-if="inviteCostPreview && (form.userType === 'STANDARD' || form.userType === 'ADMIN' || form.userType === 'INTERNAL')"
                              class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/40"
                            >
                              <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {{ t('settings.inviteCostPreviewHeading') }}
                              </p>
                              <ul class="mt-2 space-y-1">
                                <li
                                  v-for="line in inviteCostPreview.lines"
                                  :key="line.productCode"
                                  class="flex justify-between gap-3 tabular-nums text-slate-700 dark:text-slate-300"
                                >
                                  <span>{{ line.label }}</span>
                                  <span>{{ formatInviteCost(line.amountMinor) }}</span>
                                </li>
                              </ul>
                              <p class="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold tabular-nums dark:border-slate-700">
                                <span>{{ t('settings.inviteCostPreviewTotal') }}</span>
                                <span>{{ formatInviteCost(inviteCostPreview.totalMinor) }}{{ t('settings.inviteCostPreviewPerMonth') }}</span>
                              </p>
                            </div>
                          </div>
                        </section>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {{ t('settings.inviteSectionOnboarding') }}
                          </h4>

                          <div class="space-y-1">
                            <label for="invite-welcome-note" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteWelcomeNote') }}
                            </label>
                            <textarea
                              id="invite-welcome-note"
                              v-model="form.welcomeNote"
                              rows="3"
                              maxlength="500"
                              :placeholder="t('settings.inviteWelcomeNotePh')"
                              class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                            />
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteWelcomeNoteHint') }}
                            </p>
                          </div>

                          <div class="space-y-2">
                            <label for="invite-suggested-task" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteSuggestedTask') }}
                            </label>
                            <div class="flex flex-wrap gap-2">
                              <button
                                v-for="preset in suggestedTaskPresets"
                                :key="preset.key"
                                type="button"
                                class="rounded-full border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                @click="applySuggestedTaskPreset(preset.message)"
                              >
                                {{ preset.label }}
                              </button>
                            </div>
                            <input
                              id="invite-suggested-task"
                              v-model="form.suggestedTask"
                              type="text"
                              maxlength="200"
                              :placeholder="t('settings.inviteSuggestedTaskPh')"
                              class="block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                            />
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteSuggestedTaskHint') }}
                            </p>
                          </div>
                        </section>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {{ t('settings.inviteSectionDelivery') }}
                          </h4>

                          <p class="text-xs text-gray-500 dark:text-gray-400">
                            {{ t('settings.inviteLinkOnlyHint') }}
                          </p>

                          <div class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
                            <div class="flex items-start gap-3">
                              <HeadlessCheckbox
                                v-model="form.sendEmail"
                                id="sendEmail"
                                checkbox-class="mt-0.5"
                              />
                              <div class="min-w-0">
                                <label for="sendEmail" class="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                                  {{ t('settings.inviteSendEmail') }}
                                </label>
                                <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                                  {{ sendEmailHelp }}
                                </p>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        @click="requestClose"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        :disabled="saving || !isFormValid"
                        class="inline-flex items-center gap-2 rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{{ saving ? t('settings.inviteSubmitting') : t('settings.inviteSubmit') }}</span>
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { ref, watch, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { UserPlusIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { isRbacV2Enabled } from '@/utils/rbacFeatureFlags';
import { captureInviteSent } from '@/config/posthogOnboarding';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { formatInrFromPaise } from '@/utils/commercialPricingApi';

const { t } = useI18n();
const authStore = useAuthStore();
const { fetchSets } = useBusinessHours();
const rbacV2Enabled = computed(() => isRbacV2Enabled(authStore.organization));

const APP_KEY_TO_BILLING_PRODUCT = {
  SALES: 'sales_app',
  HELPDESK: 'helpdesk_app',
  AUDIT: 'audit_app',
  INVENTORY: 'inventory_app',
  MARKETING: 'marketing_app',
};

const inviteCostPreview = ref(null);
let inviteCostTimer = null;

function formatInviteCost(amountMinor) {
  return formatInrFromPaise(amountMinor);
}

const props = defineProps({
  isOpen: Boolean,
  inline: Boolean,
  initialRoleId: {
    type: String,
    default: ''
  },
  initialAppKey: {
    type: String,
    default: ''
  },
  submitLabel: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'user-invited']);

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  userType: 'STANDARD',
  roleId: '',
  businessHourSetId: '',
  sendEmail: true,
  welcomeNote: '',
  suggestedTask: ''
});

const saving = ref(false);
const error = ref('');
const formBodyScrollEl = ref(null);
const errorBannerEl = ref(null);

async function scrollFormToMessage() {
  await nextTick();
  if (formBodyScrollEl.value) {
    formBodyScrollEl.value.scrollTo({ top: 0, behavior: 'smooth' });
  }
  errorBannerEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}
const successMessage = ref('');
const successDetail = ref('');
const availableRoles = ref([]);
const businessHourSets = ref([]);
const capabilities = ref([]);
const loadingCapabilities = ref(false);
const selectedAppRoles = ref({});
const validationErrors = ref({});

const userTypeOptions = computed(() => [
  { value: 'STANDARD', label: t('settings.userTypeStandard') },
  { value: 'ADMIN', label: t('settings.userTypeAdmin') },
  { value: 'EXTERNAL', label: t('settings.inviteExternal') }
]);

function isStaffInviteRole(role) {
  const userType = String(role?.userType || '').toUpperCase();
  return userType !== 'EXTERNAL' && userType !== 'PORTAL';
}

const inviteRoles = computed(() => (
  props.inline
    ? availableRoles.value.filter(isStaffInviteRole)
    : availableRoles.value
));

const roleSelectOptions = computed(() => [
  { value: '', label: t('settings.inviteSelectRole') },
  ...inviteRoles.value.map((role) => ({
    value: role._id,
    label: rbacV2Enabled.value ? role.name : `${role.name} — ${role.description}`
  }))
]);

const businessHoursSelectOptions = computed(() => [
  { value: '', label: t('settings.inviteSelectBusinessHours') },
  ...businessHourSets.value.map((set) => ({
    value: set._id,
    label: set.isDefault ? `${set.name} (${t('settings.settingsBhBadgeDefault')})` : set.name
  }))
]);

const selectedRole = computed(() =>
  availableRoles.value.find((r) => r._id === form.value.roleId) || null
);

const selectedRoleAppPreview = computed(() => {
  const role = selectedRole.value;
  if (!role || !Array.isArray(role.appEntitlements)) return [];
  return role.appEntitlements
    .filter((e) => e.enabled !== false)
    .map((e) => ({
      appKey: e.appKey,
      appRoleKey: e.appRoleKey,
      label: `${getAppDisplayName(e.appKey)} · ${getRoleDisplayName(e.appKey, e.appRoleKey)}`
    }));
});

const selectedRoleProfileName = computed(() => {
  const role = selectedRole.value;
  if (!role || role.privilegeMode !== 'profile') return '';
  const profile = role.profileId;
  if (profile && typeof profile === 'object') return profile.name;
  return '';
});

const sendEmailHelp = computed(() =>
  form.value.sendEmail
    ? t('settings.inviteSendEmailOnInvite')
    : t('settings.inviteSendEmailOffLink')
);

const suggestedTaskPresets = computed(() => [
  { key: 'profile', label: t('settings.inviteSuggestedTaskPresetProfile'), message: t('settings.inviteSuggestedTaskPresetProfileMessage') },
  { key: 'pipeline', label: t('settings.inviteSuggestedTaskPresetPipeline'), message: t('settings.inviteSuggestedTaskPresetPipelineMessage') },
  { key: 'cases', label: t('settings.inviteSuggestedTaskPresetCases'), message: t('settings.inviteSuggestedTaskPresetCasesMessage') }
]);

const applySuggestedTaskPreset = (message) => {
  form.value.suggestedTask = message;
};

const submitButtonLabel = computed(() =>
  props.submitLabel || (saving.value ? t('settings.inviteSubmitting') : t('settings.inviteSubmit'))
);

const appDisplayNames = {
  SALES: 'Sales',
  CRM: 'Sales',
  HELPDESK: 'Helpdesk',
  MARKETING: 'Marketing',
  PROJECTS: 'Projects',
  INVENTORY: 'Inventory',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  LMS: 'Learning'
};

const roleDisplayNames = {
  SALES: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  CRM: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  AUDIT: {
    AUDITOR: 'Auditor'
  },
  HELPDESK: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User',
    AGENT: 'Agent'
  },
  MARKETING: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  PROJECTS: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  INVENTORY: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  PORTAL: {
    CUSTOMER: 'Customer',
    VIEWER: 'Viewer'
  },
  LMS: {
    ADMIN: 'Admin',
    AUTHOR: 'Author',
    LEARNER: 'Learner'
  }
};
const availableApps = computed(() => {
  if (!form.value.userType) return [];
  const t = String(form.value.userType || '').toUpperCase();
  return capabilities.value.filter((app) => {
    const allowed = (app.userTypesAllowed || []).map((x) => String(x).toUpperCase());
    if (allowed.includes(t)) return true;
    if (allowed.includes('INTERNAL') && (t === 'STANDARD' || t === 'ADMIN' || t === 'INTERNAL')) return true;
    if ((allowed.includes('STANDARD') || allowed.includes('ADMIN')) && t === 'INTERNAL') return true;
    return false;
  });
});

const selectedApps = computed(() => Object.keys(selectedAppRoles.value));

async function refreshInviteCostPreview() {
  if (form.value.userType !== 'STANDARD' && form.value.userType !== 'ADMIN' && form.value.userType !== 'INTERNAL') {
    inviteCostPreview.value = null;
    return;
  }
  const applicationProductCodes = selectedApps.value
    .map((key) => APP_KEY_TO_BILLING_PRODUCT[key])
    .filter(Boolean);
  try {
    const data = await apiClient.post('/billing/preview-user-cost', {
      includeInternalUserLicense: true,
      userTypeProductCode: form.value.userType === 'ADMIN' ? 'admin_user' : 'standard_user',
      applicationProductCodes,
      billingPeriod: 'monthly',
    });
    inviteCostPreview.value = data?.data || data || null;
  } catch {
    inviteCostPreview.value = null;
  }
}

function scheduleInviteCostPreview() {
  if (inviteCostTimer) clearTimeout(inviteCostTimer);
  inviteCostTimer = setTimeout(() => {
    refreshInviteCostPreview();
  }, 200);
}

watch([selectedApps, () => form.value.userType], scheduleInviteCostPreview);

const isFormValid = computed(() => {
  if (!form.value.firstName || !form.value.lastName || !form.value.email) {
    return false;
  }

  if (!form.value.roleId) {
    return false;
  }

  if (!form.value.businessHourSetId) {
    return false;
  }

  if (rbacV2Enabled.value) {
    return true;
  }

  if (form.value.userType) {
    if (selectedApps.value.length === 0) {
      return false;
    }
    for (const appKey of selectedApps.value) {
      const app = availableApps.value.find((a) => a.appKey === appKey);
      if (app && !isAppEnabled(app)) {
        return false;
      }
    }
  }

  return true;
});

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    // Ensure org.settings has effective RBAC flags (env may differ from stored org flag).
    try {
      await authStore.refreshOrganization();
    } catch {
      // ignore; fall back to cached organization
    }
    initializeForm();
  }
});

onMounted(async () => {
  if (props.inline) {
    try {
      await authStore.refreshOrganization();
    } catch {
      // ignore
    }
    initializeForm();
  }
});

watch(
  [() => props.initialAppKey, () => capabilities.value],
  () => {
    if (!props.initialAppKey || capabilities.value.length === 0) return;
    if (Object.keys(selectedAppRoles.value).length > 0) return;
    const appKey = String(props.initialAppKey).toUpperCase();
    const app = capabilities.value.find((entry) => entry.appKey === appKey);
    if (!app || !isAppEnabled(app)) return;
    selectedAppRoles.value = {
      [appKey]: app.defaultRole || app.roles?.[0] || 'USER'
    };
  },
  { deep: true }
);

watch(inviteRoles, (roles) => {
  if (!props.inline || form.value.roleId || !Array.isArray(roles) || roles.length === 0) return;
  const defaultRole = roles.find((role) =>
    String(role.name || '').toLowerCase() === 'user'
    || String(role.name || '').toLowerCase() === 'sales executive'
    || String(role.key || '').toLowerCase() === 'user'
  ) || roles.find((role) => !role.isSystemRole && !role.isSystem) || roles[0];
  if (defaultRole?._id) {
    form.value.roleId = defaultRole._id;
  }
});

function initializeForm() {
  resetForm();
  if (props.initialRoleId) {
    form.value.roleId = props.initialRoleId;
  }
  fetchRoles();
  fetchBusinessHourSets();
  if (!rbacV2Enabled.value) {
    fetchCapabilities();
  }
}

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data;
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

const fetchBusinessHourSets = async () => {
  try {
    const sets = await fetchSets();
    businessHourSets.value = Array.isArray(sets)
      ? sets.filter((s) => s.status !== 'inactive')
      : [];
    if (!form.value.businessHourSetId) {
      const defaultSet = businessHourSets.value.find((s) => s.isDefault) || businessHourSets.value[0];
      if (defaultSet?._id) {
        form.value.businessHourSetId = defaultSet._id;
      }
    }
  } catch (err) {
    console.error('Error fetching business hours:', err);
    businessHourSets.value = [];
  }
};

const fetchCapabilities = async () => {
  loadingCapabilities.value = true;
  try {
    const response = await apiClient.get('/users/add-capabilities');
    if (response.success) {
      capabilities.value = response.data.apps || [];
    }
  } catch (err) {
    console.error('Error fetching capabilities:', err);
    error.value = t('settings.inviteLoadAppsFailed');
  } finally {
    loadingCapabilities.value = false;
  }
};

const resetForm = () => {
  form.value = {
    firstName: '',
    lastName: '',
    email: '',
    userType: 'STANDARD',
    roleId: '',
    businessHourSetId: '',
    sendEmail: true,
    welcomeNote: '',
    suggestedTask: ''
  };
  error.value = '';
  successMessage.value = '';
  successDetail.value = '';
  selectedAppRoles.value = {};
  validationErrors.value = {};
};

const requestClose = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleDialogClose = () => {
  requestClose();
};

const selectUserType = (userType) => {
  form.value.userType = userType;
  onUserTypeChange();
};

const onUserTypeChange = () => {
  selectedAppRoles.value = {};
  validationErrors.value = {};
};

const isAppSelected = (appKey) => appKey in selectedAppRoles.value;

const isAppEnabled = (app) => {
  if (!app.seatInfo) return true;
  return app.seatInfo.canAdd;
};

const toggleApp = (app) => {
  const appKey = app.appKey;

  if (isAppSelected(appKey)) {
    delete selectedAppRoles.value[appKey];
  } else {
    const defaultRole = app.defaultRole || app.roles[0];
    selectedAppRoles.value[appKey] = defaultRole;
  }

  validationErrors.value.appAccess = null;
};

const updateAppRole = (appKey, roleKey) => {
  selectedAppRoles.value[appKey] = roleKey;
};

const getAppRoleOptions = (app) =>
  (app.roles || []).map((roleKey) => ({
    value: roleKey,
    label: getRoleDisplayName(app.appKey, roleKey)
  }));

const getAppDisplayName = (appKey) => getAppLabel(appKey) || appDisplayNames[appKey] || appKey;

const getRoleDisplayName = (appKey, roleKey) => roleDisplayNames[appKey]?.[roleKey] || roleKey;

const validateForm = () => {
  validationErrors.value = {};

  if (!form.value.roleId) {
    validationErrors.value.roleId = t('settings.inviteRoleRequired');
    return false;
  }

  if (!form.value.businessHourSetId) {
    validationErrors.value.businessHourSetId = t('settings.inviteBusinessHoursRequired');
    return false;
  }

  if (rbacV2Enabled.value) {
    return true;
  }

  if (form.value.userType) {
    if (selectedApps.value.length === 0) {
      validationErrors.value.appAccess = t('settings.inviteAppAccessRequired');
      return false;
    }

    for (const appKey of selectedApps.value) {
      const app = availableApps.value.find((a) => a.appKey === appKey);
      if (app && !isAppEnabled(app)) {
        validationErrors.value.appAccess = app.seatInfo?.reason || `Cannot add user to ${getAppDisplayName(appKey)}`;
        return false;
      }
    }

    for (const appKey of selectedApps.value) {
      const app = availableApps.value.find((a) => a.appKey === appKey);
      if (app && !app.userTypesAllowed.includes(form.value.userType)) {
        validationErrors.value.appAccess = `${getAppDisplayName(appKey)} does not support ${form.value.userType} users`;
        return false;
      }
    }
  }

  return true;
};

const handleSubmit = async () => {
  error.value = '';
  successMessage.value = '';
  successDetail.value = '';
  validationErrors.value = {};

  if (!validateForm()) {
    return;
  }

  saving.value = true;

  try {
    let payload;

    if (rbacV2Enabled.value) {
      payload = {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        roleId: form.value.roleId,
        businessHourSetId: form.value.businessHourSetId,
        sendEmail: form.value.sendEmail,
        welcomeNote: form.value.welcomeNote || undefined,
        suggestedTask: form.value.suggestedTask || undefined
      };
    } else if (form.value.userType && selectedApps.value.length > 0) {
      payload = {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        roleId: form.value.roleId,
        businessHourSetId: form.value.businessHourSetId,
        userType: form.value.userType,
        appAccess: selectedApps.value.map((appKey) => ({
          appKey,
          roleKey: selectedAppRoles.value[appKey]
        })),
        sendEmail: form.value.sendEmail,
        welcomeNote: form.value.welcomeNote || undefined,
        suggestedTask: form.value.suggestedTask || undefined
      };
    } else {
      payload = {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        email: form.value.email,
        roleId: form.value.roleId,
        businessHourSetId: form.value.businessHourSetId,
        userType: form.value.userType,
        sendEmail: form.value.sendEmail,
        welcomeNote: form.value.welcomeNote || undefined,
        suggestedTask: form.value.suggestedTask || undefined
      };
    }

    const response = await apiClient.post('/users', payload);

    if (response.success) {
      captureInviteSent({
        source: props.inline ? 'founder_wizard' : 'settings_drawer',
        send_email: form.value.sendEmail,
        has_welcome_note: Boolean(form.value.welcomeNote?.trim()),
        has_suggested_task: Boolean(form.value.suggestedTask?.trim()),
      });
      const data = response.data || {};
      if (form.value.sendEmail && data.emailSent) {
        successMessage.value = t('settings.inviteSuccessEmailSent', { email: form.value.email });
        successDetail.value = t('settings.inviteSuccessEmailVerifyHint');
      } else if (data.inviteUrl) {
        successMessage.value = t('settings.inviteSuccessCreated');
        successDetail.value = form.value.sendEmail
          ? t('settings.inviteSuccessEmailFailedWithLink', {
              reason: data.emailError || t('settings.inviteSuccessEmailFailedGeneric'),
              link: data.inviteUrl
            })
          : t('settings.inviteSuccessShareLink', { link: data.inviteUrl });
      } else if (form.value.sendEmail && !data.emailSent) {
        successMessage.value = t('settings.inviteSuccessCreated');
        successDetail.value = t('settings.inviteSuccessEmailFailed', {
          reason: data.emailError || t('settings.inviteSuccessEmailFailedGeneric')
        });
      } else {
        successMessage.value = t('settings.inviteSuccessCreated');
        successDetail.value = t('settings.inviteSuccessResendHint');
      }
      if (props.inline) {
        emit('user-invited');
        resetForm();
      } else {
        emit('user-invited');
        setTimeout(() => {
          resetForm();
          emit('close');
        }, 2500);
      }
    } else {
      error.value = response.message || t('settings.inviteFailed');
      if (response.errors && Array.isArray(response.errors)) {
        error.value += ': ' + response.errors.join(', ');
      }
      await scrollFormToMessage();
    }
  } catch (err) {
    console.error('Error inviting user:', err);
    error.value = err.response?.data?.message || err.message || t('settings.inviteFailed');
    if (err.response?.data?.errors) {
      error.value += ': ' + err.response.data.errors.join(', ');
    }
    await scrollFormToMessage();
  } finally {
    saving.value = false;
  }
};
</script>
