<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useColorMode } from '@/composables/useColorMode';
import { useTabs } from '@/composables/useTabs';
import { hasAnySettingsAccess } from '@/utils/settingsTabAccess';
import { useUserStatus } from '@/composables/useUserStatus';
import { useReleaseNotes } from '@/composables/useReleaseNotes';
import {
  resolveAssetDownloadUrl
} from '@/modules/template/composables/useCompanyLogoAsset';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import {
  AcademicCapIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon,
  CheckIcon,
  PencilSquareIcon,
  XMarkIcon,
  ChevronDownIcon,
  CalendarDaysIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  open: { type: Boolean, default: false },
  // 'right' anchors the panel to the right edge of its containing relative wrapper.
  align: { type: String, default: 'right' }
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { colorMode, toggleColorMode } = useColorMode();
const { openTab } = useTabs();
const { showHelpBadge } = useReleaseNotes();

const helpDocsUrl = String(import.meta.env.VITE_HELP_DOCS_URL || '').trim();
const helpSupportUrl = String(import.meta.env.VITE_HELP_SUPPORT_URL || '').trim();

const userId = computed(() => authStore.user?._id || null);
const {
  state: statusState,
  presets,
  quickEmojis,
  currentPreset,
  displayLabel,
  displayEmoji,
  setType,
  setCustomStatus,
  clearCustomStatus
} = useUserStatus(userId);

const displayName = computed(() => authStore.user?.username || t('navigation.userAccountFallback'));
const email = computed(() => authStore.user?.email || '');
const role = computed(() => authStore.user?.role || '');
const workspaceName = computed(() => authStore.organization?.name || '');
const workspaceLogoBroken = ref(false);
const workspaceLogoReady = ref(false);

const workspaceLogoUrl = computed(() => {
  const raw = String(authStore.organization?.settings?.logoUrl || '').trim();
  if (!raw) return '';
  return resolveAssetDownloadUrl(raw) || raw;
});

watch(workspaceLogoUrl, () => {
  workspaceLogoBroken.value = false;
  workspaceLogoReady.value = false;
});

function onWorkspaceLogoLoad() {
  workspaceLogoReady.value = true;
  workspaceLogoBroken.value = false;
}

function onWorkspaceLogoError() {
  // Ignore abort/reload errors after a successful paint — that was the flash-then-hide.
  if (workspaceLogoReady.value) return;
  workspaceLogoBroken.value = true;
}

const canViewControlPanel = computed(() => authStore.isPlatformAdmin);

const settingsAccessCtx = computed(() => ({
  isOwner: !!authStore.user?.isOwner,
  role: authStore.user?.role,
  permissions: authStore.user?.permissions
}));

const canViewSettings = computed(() => hasAnySettingsAccess(settingsAccessCtx.value));
const canViewTrash = computed(() => authStore.can('settings', 'view'));

/** EXTERNAL + LMS: Academy is a separate surface — menu cross-link, never app rail. */
const showAcademyLink = computed(() => (
  authStore.isExternalUser
  && (authStore.hasAssignedAppAccess('LMS') || authStore.hasAppAccess('LMS'))
));

const isDark = computed(() => {
  if (colorMode.value === 'dark') return true;
  if (colorMode.value === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
});

// Status editing UI \u2014 the chip is the trigger for a dropdown that contains
// availability presets + a "Set custom status\u2026" entry. The custom-status
// editor replaces both chip and dropdown while editingCustom is true.
const statusPickerOpen = ref(false);
const editingCustom = ref(false);
const customInput = ref('');
const customEmoji = ref('\uD83D\uDCAC');
const customInputEl = ref(null);
const showEmojiQuickPick = ref(false);

watch(
  () => props.open,
  (val) => {
    if (!val) {
      statusPickerOpen.value = false;
      editingCustom.value = false;
      showEmojiQuickPick.value = false;
    }
  }
);

// Auto-focus the input whenever the editor appears. nextTick covers the case
// where Vue hasn't assigned the template ref yet; the extra requestAnimationFrame
// fallback handles browsers where layout settles a frame later (e.g. after the
// chip-to-editor swap inside the gradient header).
watch(editingCustom, async (val) => {
  if (!val) return;
  await nextTick();
  const focusNow = () => {
    const el = customInputEl.value;
    if (!el) return;
    el.focus();
    if (typeof el.select === 'function') el.select();
  };
  focusNow();
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focusNow);
  }
});

function toggleStatusPicker() {
  statusPickerOpen.value = !statusPickerOpen.value;
}

function openCustomEditor() {
  customInput.value = statusState.value.custom?.text || '';
  customEmoji.value = statusState.value.custom?.emoji || '\uD83D\uDCAC';
  statusPickerOpen.value = false;
  editingCustom.value = true;
}

function cancelCustomEditor() {
  editingCustom.value = false;
  showEmojiQuickPick.value = false;
}

function saveCustomStatus() {
  const text = customInput.value.trim();
  if (!text) {
    clearCustomStatus();
  } else {
    setCustomStatus(customEmoji.value, text);
  }
  editingCustom.value = false;
  showEmojiQuickPick.value = false;
}

function pickEmoji(e) {
  customEmoji.value = e;
  showEmojiQuickPick.value = false;
  nextTick(() => customInputEl.value?.focus());
}

function go(action) {
  action();
  emit('close');
}

function viewProfile() {
  go(() => router.push('/profile'));
}
function openAcademy() {
  go(() => router.push({ name: 'academy-home' }));
}
function openControlPanel() {
  go(() => router.push('/control'));
}
function openSettings() {
  go(() => openTab('/settings', { title: t('navigation.settings') }));
}
function openAppointments() {
  go(() => openTab('/appointments/pages', { title: t('navigation.tabBookingPages'), icon: '📅' }));
}
function openTrash() {
  go(() => router.push('/trash'));
}
function openDocumentation() {
  go(() => {
    if (helpDocsUrl) {
      window.open(helpDocsUrl, '_blank', 'noopener,noreferrer');
    }
  });
}
function openSupport() {
  go(() => {
    if (helpSupportUrl) {
      window.open(helpSupportUrl, '_blank', 'noopener,noreferrer');
    }
  });
}
function openWhatsNew() {
  go(() => {
    window.dispatchEvent(new CustomEvent('arivu:open-whats-new'));
  });
}
function toggleTheme() {
  toggleColorMode(isDark.value ? 'light' : 'dark');
}
function handleLogout() {
  go(() => {
    authStore.logout();
    router.replace('/login');
    authStore.error = null;
  });
}

function chooseStatus(typeId) {
  setType(typeId);
  statusPickerOpen.value = false;
}
</script>

<template>
  <transition
    enter-active-class="transition ease-out duration-150"
    enter-from-class="opacity-0 -translate-y-1 scale-[0.98]"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition ease-in duration-100"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-1 scale-[0.98]"
  >
    <div
      v-if="open"
      :class="[
        'absolute top-full mt-2 w-80 origin-top rounded-2xl border border-gray-200/80 dark:border-gray-700/70 bg-white dark:bg-gray-900 shadow-2xl shadow-gray-900/10 dark:shadow-black/40 ring-1 ring-black/5 dark:ring-white/5 z-[100]',
        align === 'left' ? 'left-0' : 'right-0'
      ]"
      role="menu"
      aria-orientation="vertical"
      @click.stop
    >
      <!-- Header: avatar + identity. Rounded top corners on the header itself
           (instead of overflow-hidden on the root) so the availability
           popover \u2014 absolutely positioned inside this section \u2014 can extend
           past the menu's bottom edge if needed without being clipped. -->
      <div class="relative rounded-t-2xl px-5 pt-5 pb-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/60 dark:to-gray-900">
        <div class="flex items-start gap-3">
          <div class="relative shrink-0">
            <div class="rounded-full ring-2 ring-white dark:ring-gray-900">
              <AvatarInitials
                :first-name="authStore.user?.firstName"
                :last-name="authStore.user?.lastName"
                :email="authStore.user?.email"
                :username="authStore.user?.username"
                :avatar="authStore.user?.avatar"
                size="md"
              />
            </div>
            <span
              :class="[
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-gray-900',
                currentPreset.dotClass
              ]"
              :aria-label="t('navigation.userStatusLabel', { label: displayLabel })"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {{ displayName }}
              </p>
              <span
                v-if="role"
                class="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300"
              >
                {{ role }}
              </span>
            </div>
            <p v-if="email" class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
              {{ email }}
            </p>
            <p
              v-if="workspaceName"
              class="mt-1 truncate text-[11px] text-gray-400 dark:text-gray-500"
            >
              {{ workspaceName }}
            </p>
          </div>
        </div>

        <!-- Status chip + floating availability popover.
             The wrapper is `relative` so the popover can be absolutely
             positioned over the rest of the menu without pushing nav items
             down. `z-30` keeps it above neighbouring sections. -->
        <div v-if="!editingCustom" class="relative mt-3">
          <div
            class="flex items-stretch gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 transition-colors"
            :class="statusPickerOpen
              ? 'border-indigo-300 dark:border-indigo-500/50 ring-2 ring-indigo-500/10'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800'"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-l-lg px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              :class="!statusState.custom ? 'rounded-r-lg' : ''"
              :aria-expanded="statusPickerOpen"
              aria-haspopup="listbox"
              @click="toggleStatusPicker"
            >
              <span
                v-if="displayEmoji"
                class="text-base leading-none"
                aria-hidden="true"
              >{{ displayEmoji }}</span>
              <span
                v-else
                :class="['h-2.5 w-2.5 rounded-full', currentPreset.dotClass]"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">
                {{ statusState.custom?.text || currentPreset.label }}
              </span>
              <ChevronDownIcon
                :class="[
                  'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150',
                  statusPickerOpen ? 'rotate-180' : ''
                ]"
              />
            </button>
            <button
              v-if="statusState.custom"
              type="button"
              class="flex items-center justify-center rounded-r-lg px-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              :title="t('navigation.userClearStatus')"
              @click.stop="clearCustomStatus"
            >
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>

          <transition
            enter-active-class="transition ease-out duration-150"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-100"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div
              v-if="statusPickerOpen"
              class="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 dark:ring-white/5"
              role="listbox"
              :aria-label="t('navigation.userSetAvailability')"
            >
              <div class="py-1.5">
                <button
                  v-for="preset in presets"
                  :key="preset.id"
                  type="button"
                  role="option"
                  :aria-selected="statusState.type === preset.id"
                  class="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                  @click="chooseStatus(preset.id)"
                >
                  <span
                    :class="[
                      'h-2.5 w-2.5 rounded-full ring-4 transition-all',
                      preset.dotClass,
                      statusState.type === preset.id ? preset.ringClass : 'ring-transparent'
                    ]"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm text-gray-800 dark:text-gray-100">
                      {{ preset.label }}
                    </span>
                    <span class="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                      {{ preset.description }}
                    </span>
                  </span>
                  <CheckIcon
                    v-if="statusState.type === preset.id"
                    class="h-4 w-4 text-indigo-600 dark:text-indigo-400"
                  />
                </button>
              </div>
              <div class="border-t border-gray-100 dark:border-gray-700/70" />
              <div class="py-1.5">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60"
                  @click="openCustomEditor"
                >
                  <PencilSquareIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  {{ statusState.custom ? t('navigation.userEditCustomStatus') : t('navigation.userSetCustomStatus') }}
                </button>
              </div>
            </div>
          </transition>
        </div>

        <!-- Custom status editor ------------------------------------------>
        <div
          v-if="editingCustom"
          class="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-gray-800/80 p-2 shadow-sm"
        >
          <div class="flex items-center gap-2">
            <div class="relative">
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                :title="t('navigation.userPickEmoji')"
                @click="showEmojiQuickPick = !showEmojiQuickPick"
              >
                {{ customEmoji }}
              </button>
              <div
                v-if="showEmojiQuickPick"
                class="absolute left-0 top-full z-20 mt-1 w-44 grid grid-cols-4 gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1.5 shadow-lg"
              >
                <button
                  v-for="e in quickEmojis"
                  :key="e"
                  type="button"
                  class="flex h-9 w-9 items-center justify-center rounded text-lg leading-none hover:bg-gray-100 dark:hover:bg-gray-800"
                  @click="pickEmoji(e)"
                >
                  {{ e }}
                </button>
              </div>
            </div>
            <input
              ref="customInputEl"
              v-model="customInput"
              type="text"
              maxlength="100"
              :placeholder="t('navigation.userStatusPlaceholder')"
              class="min-w-0 flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              @keydown.enter.prevent="saveCustomStatus"
              @keydown.esc.prevent="cancelCustomEditor"
            />
          </div>
          <div class="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              class="rounded-md px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              @click="cancelCustomEditor"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900"
              @click="saveCustomStatus"
            >
              {{ t('actions.save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Navigation items ------------------------------------------------->
      <div class="border-t border-gray-100 dark:border-gray-800 py-1">
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="viewProfile"
        >
          <UserCircleIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.userYourProfile') }}
        </button>
        <button
          v-if="showAcademyLink"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openAcademy"
        >
          <AcademicCapIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.goToAcademy') }}
        </button>
        <button
          v-if="canViewControlPanel"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openControlPanel"
        >
          <ShieldCheckIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.userControlPanel') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openAppointments"
        >
          <CalendarDaysIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.userBookingPages') }}
        </button>
        <button
          v-if="canViewSettings"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openSettings"
        >
          <Cog6ToothIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.settings') }}
        </button>
        <button
          v-if="canViewTrash"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openTrash"
        >
          <TrashIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.userTrash') }}
        </button>
      </div>

      <div class="border-t border-gray-100 dark:border-gray-800 py-1">
        <div class="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {{ t('navigation.helpMenu') }}
        </div>
        <button
          v-if="helpDocsUrl"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openDocumentation"
        >
          <BookOpenIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.helpDocumentation') }}
        </button>
        <button
          v-if="helpSupportUrl"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openSupport"
        >
          <ChatBubbleLeftRightIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          {{ t('navigation.helpContactSupport') }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openWhatsNew"
        >
          <SparklesIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <span class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span>{{ t('navigation.helpWhatsNew') }}</span>
            <span
              v-if="showHelpBadge"
              class="inline-flex h-2 w-2 shrink-0 rounded-full bg-indigo-500"
              :aria-label="t('releaseNotes.unseenBadge')"
            />
          </span>
        </button>
      </div>

      <!-- Theme + Sign out. `rounded-b-2xl overflow-hidden` so the last item's
           hover background respects the menu's bottom-rounded corners now that
           the menu root no longer uses overflow-hidden (so the availability
           popover can extend past the menu's bottom edge). -->
      <div class="rounded-b-2xl overflow-hidden border-t border-gray-100 dark:border-gray-800 py-1">
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center justify-between gap-3 px-5 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="toggleTheme"
        >
          <span class="flex items-center gap-3">
            <component :is="isDark ? SunIcon : MoonIcon" class="h-5 w-5 text-gray-400 dark:text-gray-500" />
            {{ isDark ? t('navigation.userSwitchToLight') : t('navigation.userSwitchToDark') }}
          </span>
          <span
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
            :class="isDark ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'"
            aria-hidden="true"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
              :class="isDark ? 'translate-x-4' : 'translate-x-0'"
            />
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 px-5 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
          @click="handleLogout"
        >
          <ArrowRightOnRectangleIcon class="h-5 w-5" />
          {{ t('navigation.signOut') }}
        </button>
        <div
          v-if="workspaceLogoUrl && !workspaceLogoBroken"
          class="flex items-center border-t border-gray-100 px-5 py-3 dark:border-gray-800"
          aria-hidden="true"
        >
          <div
            class="inline-flex h-9 max-w-[10rem] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 dark:border-gray-600"
            :class="workspaceLogoReady ? 'opacity-100' : 'opacity-0'"
          >
            <img
              :src="workspaceLogoUrl"
              :alt="t('settings.orgLogoAlt')"
              class="h-7 w-auto max-w-full object-contain"
              @load="onWorkspaceLogoLoad"
              @error="onWorkspaceLogoError"
            />
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
