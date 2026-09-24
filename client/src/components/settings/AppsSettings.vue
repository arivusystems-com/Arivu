<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <!-- Header -->
    <div
      class="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 pb-3 pt-1 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 -mx-1 px-1"
    >
      <div class="flex min-w-0 items-center gap-3">
        <button @click="goBack" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div class="min-w-0">
          <h2
            class="truncate font-bold text-gray-900 dark:text-white"
            :class="showOptionsGrid ? 'text-2xl' : 'text-lg'"
          >
            {{ salesPageHeading }}
          </h2>
          <p
            v-if="showOptionsGrid || salesPageSubheading"
            class="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400"
            :class="showOptionsGrid ? 'mt-1' : ''"
          >
            {{ salesPageSubheading }}
          </p>
        </div>
      </div>
      <button
        v-if="hasSalesAccess && isSalesApp && activeSalesTab === 'schema' && !salesSelectedModule"
        @click="onCreateCustomModuleClick"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('settings.appsCreateCustomModule') }}
      </button>
    </div>

    <div v-if="showOptionsGrid" :class="['min-h-0 flex-1 overflow-y-auto overscroll-contain', SETTINGS_HEADER_CONTENT_GAP_CLASS]">
      <!-- Sales App Section (only if Sales is installed and selected) -->
      <div v-if="hasSalesAccess && isSalesApp">
        <!-- Settings Options Grid -->
        <div v-if="!activeSalesTab || activeSalesTab === 'options'" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.appsConfigOptions') }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('settings.appsChooseCategory') }}</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="option in salesOptions"
              :key="option.id"
              @click="navigateToOption(option.id)"
              class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
            >
              <div class="flex items-start gap-4">
                <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors flex-shrink-0">
                  <component :is="option.icon" class="w-6 h-6" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                    {{ optionLabel(option) }}
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {{ optionDesc(option) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Other Apps Options (when app is selected but not Sales) -->
      <div v-else-if="selectedApp && !isSalesApp">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.appsConfigOptions') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('settings.appsAvailableFor', { app: appDisplayName }) }}</p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="option in getAppOptions(selectedApp)"
            :key="option.id"
            class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group"
            :class="{ 'opacity-50 cursor-not-allowed': !option.available }"
            @click="openAppOption(option)"
          >
            <div class="flex items-start gap-4">
              <div class="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition-colors flex-shrink-0">
                <component :is="option.icon" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                  {{ optionLabel(option) }}
                  <span v-if="!option.available" class="ml-2 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.appsComingSoon') }}</span>
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {{ optionDesc(option) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State (app not found or not supported) -->
      <div v-else class="text-center py-12">
        <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {{ selectedApp ? t('settings.appsSettingsTitleNamed', { app: appDisplayName }) : t('settings.appsSettingsTitle') }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          <span v-if="selectedApp && !hasSalesAccess">
            {{ t('settings.appsNotEnabled', { app: appDisplayName }) }}
          </span>
          <span v-else>
            {{ t('settings.appsNoAppSelected') }}
          </span>
        </p>
      </div>
    </div>

    <div v-else :class="['flex min-h-0 flex-1 flex-col overflow-hidden', SETTINGS_HEADER_CONTENT_GAP_CLASS]">
      <component
        v-if="hasSalesAccess && isSalesApp && currentSalesTabComponent"
        :is="currentSalesTabComponent"
        ref="salesTabContentRef"
        class="min-h-0 flex-1"
        v-bind="currentSalesTabProps"
        @selected-module-change="salesSelectedModule = $event"
        :on-navigate-to-pipelines="() => { activeSalesTab = 'pipelines'; }"
      />
      <component
        v-else-if="selectedApp && !isSalesApp && currentAppTabComponent"
        :is="currentAppTabComponent"
        ref="appTabContentRef"
        :app-key="String(selectedApp || '').toUpperCase()"
        class="min-h-0 flex-1"
        v-bind="currentAppTabProps"
        @selected-module-change="appSelectedModule = $event"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { SETTINGS_HEADER_CONTENT_GAP_CLASS } from '@/components/settings/settingsSaveBar';
import SalesSchema from './SalesSchema.vue';
import SalesPipelines from './SalesPipelines.vue';
import SalesPlaybooks from './SalesPlaybooks.vue';
import HelpdeskSchema from './HelpdeskSchema.vue';
import InventorySchema from './InventorySchema.vue';
import PlatformAnalyticsDashboardEmbed from '@/components/analytics/PlatformAnalyticsDashboardEmbed.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const activeSalesTab = ref('options');
const activeAppTab = ref('options');
const salesTabContentRef = ref(null);
const appTabContentRef = ref(null);
const salesSelectedModule = ref(null);
const appSelectedModule = ref(null);

const APP_NAME_KEYS = {
  sales: 'settings.appsNameSales',
  helpdesk: 'settings.appsNameHelpdesk',
  inventory: 'settings.appsNameInventory',
  projects: 'settings.appsNameProjects',
  portal: 'settings.appsNamePortal',
  audit: 'settings.appsNameAudit',
  lms: 'settings.appsNameLms'
};

const APP_DESC_KEYS = {
  sales: 'settings.appsDescSales',
  helpdesk: 'settings.appsDescHelpdesk',
  inventory: 'settings.appsDescInventory',
  projects: 'settings.appsDescProjects',
  portal: 'settings.appsDescPortal',
  audit: 'settings.appsDescAudit',
  lms: 'settings.appsDescLms'
};

function optionLabel(option) {
  return option?.nameKey ? t(option.nameKey) : t('settings.appsSettingsFallback');
}

function optionDesc(option) {
  return option?.descriptionKey ? t(option.descriptionKey) : '';
}

function onCreateCustomModuleClick() {
  nextTick(() => {
    if (typeof salesTabContentRef.value?.openCreateModal === 'function') {
      salesTabContentRef.value.openCreateModal();
    }
  });
}

// Icon components
const SchemaIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
]);


const PipelineIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' })
]);

const PlaybookIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
]);

const SettingsIcon = () => h('svg', { class: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
]);

// Get app from query parameter
const selectedApp = computed(() => {
  return route.query.app || 'sales';
});

const hasSalesAccess = computed(() => {
  return authStore.hasAppAccess('SALES');
});

// Check if the selected app matches the current app
const isSalesApp = computed(() => {
  return selectedApp.value.toLowerCase() === 'sales';
});

const showOptionsGrid = computed(() => {
  if (hasSalesAccess.value && isSalesApp.value) {
    return !activeSalesTab.value || activeSalesTab.value === 'options';
  }
  if (selectedApp.value && !isSalesApp.value) {
    return activeAppTab.value === 'options';
  }
  return true;
});

const appDisplayName = computed(() => {
  const key = selectedApp.value?.toLowerCase();
  const nameKey = APP_NAME_KEYS[key];
  return nameKey ? t(nameKey) : capitalizeFirst(selectedApp.value);
});

const appDescription = computed(() => {
  const key = selectedApp.value?.toLowerCase();
  const descKey = APP_DESC_KEYS[key];
  return descKey ? t(descKey) : '';
});

// When a Sales option card is selected, show its name/description in the main header.
// When inside Sales Modules and a module (e.g. Deals) is selected, show module name like Core Modules.
const salesPageHeading = computed(() => {
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value === 'schema') {
    if (salesSelectedModule.value?.name) return salesSelectedModule.value.name;
  }
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value && activeSalesTab.value !== 'options') {
    return getOptionName(activeSalesTab.value);
  }
  if (!isSalesApp.value && activeAppTab.value === 'schema' && appSelectedModule.value?.name) {
    return appSelectedModule.value.name;
  }
  if (!isSalesApp.value && activeAppTab.value && activeAppTab.value !== 'options') {
    return getAppOptionName(selectedApp.value, activeAppTab.value);
  }
  return t('settings.appsSettingsTitleNamed', { app: appDisplayName.value });
});

const salesPageSubheading = computed(() => {
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value === 'schema') {
    if (salesSelectedModule.value?.name) return t('settings.appsModuleConfigureHint');
  }
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value && activeSalesTab.value !== 'options') {
    return getOptionDescription(activeSalesTab.value);
  }
  if (!isSalesApp.value && activeAppTab.value === 'schema' && appSelectedModule.value?.name) {
    return t('settings.appsModuleConfigureHint');
  }
  if (!isSalesApp.value && activeAppTab.value && activeAppTab.value !== 'options') {
    return getAppOptionDescription(selectedApp.value, activeAppTab.value);
  }
  return appDescription.value || t('settings.appsConfigureAppFallback', { app: appDisplayName.value });
});

// Sales app options (Sales-owned configuration only) – Sales Modules first
const salesOptions = [
  {
    id: 'schema',
    nameKey: 'settings.appsSalesModules',
    descriptionKey: 'settings.appsSalesModulesDesc',
    icon: SchemaIcon,
    available: true
  },
  {
    id: 'pipelines',
    nameKey: 'settings.appsPipelines',
    descriptionKey: 'settings.appsPipelinesDesc',
    icon: PipelineIcon,
    available: true
  },
  {
    id: 'playbooks',
    nameKey: 'settings.appsPlaybooks',
    descriptionKey: 'settings.appsPlaybooksDesc',
    icon: PlaybookIcon,
    available: true
  }
];

const salesTabs = [
  { id: 'schema', component: SalesSchema },
  { id: 'pipelines', component: SalesPipelines },
  { id: 'playbooks', component: SalesPlaybooks }
];

const currentSalesTabComponent = computed(() => {
  if (activeSalesTab.value === 'options') return null;
  const tab = salesTabs.find(t => t.id === activeSalesTab.value);
  return tab?.component || null;
});

const currentSalesTabProps = computed(() => {
  const tab = salesTabs.find(t => t.id === activeSalesTab.value);
  return tab?.props || {};
});

const navigateToOption = (optionId) => {
  activeSalesTab.value = optionId;
};

const getOptionName = (optionId) => {
  const option = salesOptions.find(o => o.id === optionId);
  return optionLabel(option);
};

const getOptionDescription = (optionId) => {
  const option = salesOptions.find(o => o.id === optionId);
  return optionDesc(option);
};

// Get options for other apps
const getAppOptions = (app) => {
  const appLower = app.toLowerCase();

  const commonOptions = [
    {
      id: 'schema',
      nameKey: 'settings.appsSchema',
      descriptionKey: 'settings.appsSchemaDesc',
      icon: SchemaIcon,
      available: false
    },
    {
      id: 'settings',
      nameKey: 'settings.appsGeneralSettings',
      descriptionKey: 'settings.appsGeneralSettingsDesc',
      icon: SettingsIcon,
      available: false
    }
  ];

  // App-specific options
  const appSpecificOptions = {
    helpdesk: [
      {
        id: 'schema',
        nameKey: 'settings.appsHelpdeskCases',
        descriptionKey: 'settings.appsHelpdeskCasesDesc',
        icon: SchemaIcon,
        available: true
      },
      {
        id: 'analytics',
        nameKey: 'settings.appsHelpdeskAnalytics',
        descriptionKey: 'settings.appsHelpdeskAnalyticsDesc',
        icon: PipelineIcon,
        available: true
      },
      {
        id: 'assignment-rules',
        nameKey: 'settings.appsHelpdeskAssignment',
        descriptionKey: 'settings.appsHelpdeskAssignmentDesc',
        icon: SettingsIcon,
        available: true,
        navigateTo: {
          path: '/settings',
          query: { tab: 'automation', automationView: 'assignment-rules', assignmentApp: 'HELPDESK', assignmentModule: 'cases' }
        }
      }
    ],
    inventory: [
      {
        id: 'schema',
        nameKey: 'settings.appsInventoryModules',
        descriptionKey: 'settings.appsInventoryModulesDesc',
        icon: SchemaIcon,
        available: true
      }
    ],
    projects: [
      {
        id: 'templates',
        nameKey: 'settings.appsProjectsTemplates',
        descriptionKey: 'settings.appsProjectsTemplatesDesc',
        icon: SettingsIcon,
        available: false
      },
      {
        id: 'workflows',
        nameKey: 'settings.appsProjectsWorkflows',
        descriptionKey: 'settings.appsProjectsWorkflowsDesc',
        icon: SettingsIcon,
        available: false
      }
    ],
    portal: [
      {
        id: 'branding',
        nameKey: 'settings.appsPortalBranding',
        descriptionKey: 'settings.appsPortalBrandingDesc',
        icon: SettingsIcon,
        available: false
      },
      {
        id: 'access',
        nameKey: 'settings.appsPortalAccess',
        descriptionKey: 'settings.appsPortalAccessDesc',
        icon: SettingsIcon,
        available: false
      }
    ],
    audit: [
      {
        id: 'checklists',
        nameKey: 'settings.appsAuditChecklists',
        descriptionKey: 'settings.appsAuditChecklistsDesc',
        icon: SettingsIcon,
        available: false
      },
      {
        id: 'compliance',
        nameKey: 'settings.appsAuditCompliance',
        descriptionKey: 'settings.appsAuditComplianceDesc',
        icon: SettingsIcon,
        available: false
      }
    ],
    lms: [
      {
        id: 'courses',
        nameKey: 'settings.appsLmsCourses',
        descriptionKey: 'settings.appsLmsCoursesDesc',
        icon: SettingsIcon,
        available: false
      },
      {
        id: 'certifications',
        nameKey: 'settings.appsLmsCertifications',
        descriptionKey: 'settings.appsLmsCertificationsDesc',
        icon: SettingsIcon,
        available: false
      }
    ]
  };

  const specificOptions = appSpecificOptions[appLower] || [];

  // Merge by id so app-specific options can override common placeholders
  // (e.g., Helpdesk "schema" should replace generic "Schema (Coming Soon)").
  const mergedById = new Map();
  for (const option of commonOptions) {
    mergedById.set(option.id, option);
  }
  for (const option of specificOptions) {
    mergedById.set(option.id, option);
  }

  // Helpdesk/Inventory have explicit options; hide generic placeholders that create noise.
  if (appLower === 'helpdesk' || appLower === 'inventory') {
    mergedById.delete('settings');
  }

  return Array.from(mergedById.values());
};

const appSettingsComponents = {
  helpdesk: {
    schema: HelpdeskSchema,
    analytics: PlatformAnalyticsDashboardEmbed
  },
  inventory: {
    schema: InventorySchema
  }
};

const currentAppTabComponent = computed(() => {
  if (isSalesApp.value || activeAppTab.value === 'options') return null;
  const appKey = String(selectedApp.value || '').toLowerCase();
  return appSettingsComponents[appKey]?.[activeAppTab.value] || null;
});

const currentAppTabProps = computed(() => ({}));

const openAppOption = (option) => {
  if (!option?.available) return;
  if (option.navigateTo) {
    router.push(option.navigateTo);
    return;
  }
  activeAppTab.value = option.id;
};

const getAppOptionById = (app, optionId) => {
  const options = getAppOptions(app);
  return options.find((option) => option.id === optionId) || null;
};

const getAppOptionName = (app, optionId) => {
  return optionLabel(getAppOptionById(app, optionId));
};

const getAppOptionDescription = (app, optionId) => {
  return optionDesc(getAppOptionById(app, optionId));
};

const goBack = () => {
  // If inside Sales Modules with a module selected, go back to module list first
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value === 'schema' && salesSelectedModule.value) {
    salesTabContentRef.value?.goBackToModuleList?.();
    salesSelectedModule.value = null;
    return;
  }
  // If on Sales Modules list (schema tab, no module) or any other Sales option, go back to application detail (sale page)
  if (hasSalesAccess.value && isSalesApp.value && activeSalesTab.value && activeSalesTab.value !== 'options') {
    const appKey = selectedApp.value.toUpperCase();
    router.push({ path: '/settings', query: { tab: 'applications', appKey: appKey } });
    activeSalesTab.value = 'options';
    return;
  }
  // Inventory (and other app schemas): leave module fields → Application Detail cards
  if (!isSalesApp.value && String(selectedApp.value || '').toLowerCase() === 'inventory' && activeAppTab.value === 'schema') {
    appSelectedModule.value = null;
    activeAppTab.value = 'options';
    router.push({ path: '/settings', query: { tab: 'applications', appKey: 'INVENTORY' } });
    return;
  }
  if (!isSalesApp.value && activeAppTab.value === 'schema' && appSelectedModule.value) {
    appTabContentRef.value?.goBackToModuleList?.();
    appSelectedModule.value = null;
    return;
  }
  if (!isSalesApp.value && activeAppTab.value !== 'options') {
    activeAppTab.value = 'options';
    return;
  }
  // Go back to application detail
  const appKey = selectedApp.value.toUpperCase();
  router.push({ path: '/settings', query: { tab: 'applications', appKey: appKey } });
};

// Helper function to capitalize first letter (fallback when no translation key)
const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Watch for app changes in query
watch(activeSalesTab, (tab) => {
  if (tab !== 'schema') salesSelectedModule.value = null;
});

watch(() => route.query.app, (newApp) => {
  if (newApp) {
    // Reset to options view when switching apps
    activeSalesTab.value = 'options';
    activeAppTab.value = 'options';
    appSelectedModule.value = null;
  }
});

watch(activeAppTab, (tab) => {
  if (tab !== 'schema') appSelectedModule.value = null;
});

// Watch for config query parameter to navigate directly to a config option
watch(() => route.query.config, (configId) => {
  if (!configId) return;

  if (configId === 'execution-settings' && String(selectedApp.value || '').toLowerCase() === 'helpdesk') {
    router.replace({ path: '/settings', query: { tab: 'automation', automationView: 'sla' } });
    return;
  }

  if (isSalesApp.value && activeSalesTab.value === 'options') {
    const configExists = salesOptions.some(opt => opt.id === configId);
    if (configExists) activeSalesTab.value = configId;
    return;
  }

  if (!isSalesApp.value && activeAppTab.value === 'options') {
    const option = getAppOptionById(selectedApp.value, String(configId));
    if (option?.available) {
      activeAppTab.value = option.id;
    }
  }
}, { immediate: true });
</script>
