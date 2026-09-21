<template>
  <aside
    class="app-module-drawer relative flex min-h-0 flex-col overflow-hidden bg-white dark:bg-neutral-900"
    :class="fillWidth ? 'h-full w-full min-w-0' : 'h-full w-full'"
    :aria-label="title"
  >
    <div class="flex items-center gap-1 px-2 pt-3 pb-2 flex-shrink-0">
      <div class="flex min-w-0 flex-1 items-center gap-3 px-3">
        <span
          class="relative flex h-[1.125rem] w-[1.125rem] flex-shrink-0 items-center justify-center overflow-visible"
          aria-hidden="true"
        >
          <span
            class="absolute flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
          >
            <component :is="appIcon" class="h-[1.125rem] w-[1.125rem] shrink-0" />
          </span>
        </span>
        <h2 class="text-[0.875rem] font-semibold text-neutral-900 dark:text-neutral-100 truncate min-w-0">
          {{ title }}
        </h2>
      </div>
      <button
        v-if="collapsible"
        type="button"
        class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-white dark:hover:bg-neutral-800 transition-colors"
        :title="t('navigation.collapseDrawer')"
        :aria-label="t('navigation.collapseDrawer')"
        @click.stop="$emit('collapse')"
      >
        <ChevronLeftIcon class="w-5 h-5" aria-hidden="true" />
      </button>
    </div>

    <div
      class="flex-1 overflow-y-auto min-h-0 px-2 pb-3"
      :class="isCoreApp ? 'pt-3' : ''"
    >
      <div class="flex flex-col">
        <div
          v-for="(group, gi) in itemGroups"
          :key="group.id"
          class="flex flex-col gap-0.5"
          :class="gi > 0 ? 'mt-3' : ''"
        >
          <div
            v-if="group.labelKey"
            class="px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
          >
            {{ t(group.labelKey) }}
          </div>
          <a
            v-for="item in group.items"
            :key="item.id"
            :href="item.route"
            class="app-module-drawer-item w-full h-9 rounded-lg px-3 gap-3 flex items-center justify-start transition-colors duration-150"
            :class="isActive(item.route)
              ? 'bg-primary-50 text-primary-800 font-medium dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/80 dark:hover:text-white'"
            @click.prevent="onItemClick(item, $event)"
            @auxclick.prevent="onItemClick(item, $event)"
          >
            <span
              class="w-[1.125rem] h-[1.125rem] flex-shrink-0 flex items-center justify-center transition-colors"
              :class="isActive(item.route)
                ? 'text-primary-700 dark:text-white'
                : 'text-neutral-400 dark:text-neutral-500'"
            >
              <component :is="resolveIcon(item)" class="w-full h-full" />
            </span>
            <span class="text-[0.875rem] flex-1 min-w-0 truncate">
              {{ itemLabel(item) }}
            </span>
          </a>
        </div>
      </div>

      <div
        v-if="app.items.length === 0"
        class="mx-1 mt-2 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-700 px-3 py-4 text-[0.8125rem] text-neutral-500 dark:text-neutral-400"
      >
        {{ t('navigation.flyoutEmpty') }}
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AcademicCapIcon,
  ChevronLeftIcon,
  CubeIcon,
  LifebuoyIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from '@heroicons/vue/24/outline';
import type { AppFlyoutDefinition, SidebarItem } from '@/types/sidebar.types';
import { groupCoreDrawerItems, resolveSidebarItemLabel } from '@/utils/navigationLabels';
import { getNavigationIconComponent, getIconComponent } from '@/utils/navigationIcons';

const props = withDefaults(
  defineProps<{
    app: AppFlyoutDefinition;
    activePath: string;
    /** Desktop only — mobile keeps an app pinned. */
    collapsible?: boolean;
    /** Mobile — fill remaining chrome width beside the rail. */
    fillWidth?: boolean;
  }>(),
  {
    collapsible: true,
    fillWidth: false,
  }
);

const emit = defineEmits<{
  collapse: [];
  navigate: [payload: { item: SidebarItem; event?: MouseEvent }];
}>();

const { t, te } = useI18n();

const title = computed(() => {
  if (props.app.nameKey && te(props.app.nameKey)) return t(props.app.nameKey);
  return props.app.name;
});

const appIcon = computed(() => resolveAppIcon(props.app));

const isCoreApp = computed(() => String(props.app.id || '').toUpperCase() === 'CORE');

const itemGroups = computed(() => groupCoreDrawerItems(props.app.items, props.app.id));

function itemLabel(item: SidebarItem): string {
  return resolveSidebarItemLabel(item, t);
}

function isActive(routePath: string): boolean {
  const path = props.activePath || '';
  const base = String(routePath || '').replace(/\/+$/, '');
  if (!base) return false;
  return path === base || path.startsWith(base + '/');
}

function wrapHeroIcon(hero: ReturnType<typeof getNavigationIconComponent>) {
  return {
    name: 'DrawerHeroIcon',
    setup() {
      return () => h(hero, { class: 'w-full h-full' });
    },
  };
}

function resolveIcon(item: SidebarItem) {
  return wrapHeroIcon(getNavigationIconComponent(item));
}

function resolveAppIcon(app: AppFlyoutDefinition) {
  const appId = (app.id || '').toLowerCase();
  if (appId === 'core') return Squares2X2Icon;
  if (appId.includes('helpdesk')) return LifebuoyIcon;
  if (appId.includes('audit')) return ShieldCheckIcon;
  if (appId === 'lms' || appId.includes('learning')) return AcademicCapIcon;
  if (app.icon) return getIconComponent(app.icon);
  return CubeIcon;
}

function onItemClick(item: SidebarItem, event?: MouseEvent) {
  emit('navigate', { item, event });
}
</script>
