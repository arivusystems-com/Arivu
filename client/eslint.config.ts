import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import { arivuI18nPlugin } from './eslint/plugins/arivu-i18n.js'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
import { configureVueProject } from '@vue/eslint-config-typescript'
configureVueProject({ scriptLangs: ['ts', 'tsx', 'js'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  // public/static-sync: installer/sync scripts customers download and run in their own Node projects.
  globalIgnores([
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/.vite/**',
    'public/static-sync/**',
    '**/.tsbuildinfo/**',
  ]),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  ...pluginOxlint.configs['flat/recommended'],

  {
    name: 'app/typescript-unused-vars',
    files: ['**/*.{ts,mts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  {
    name: 'app/vue-script-language',
    files: ['**/*.vue'],
    rules: {
      'vue/block-lang': [
        'error',
        {
          script: {
            lang: ['ts', 'tsx', 'js'],
            allowNoLang: true,
          },
        },
      ],
    },
  },

  {
    name: 'app/vue-unused-vars',
    files: ['**/*.vue'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  {
    name: 'app/i18n-enforcement-ui',
    files: [
      'src/components/ui/**/*.{vue,ts}',
    ],
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: {
      'arivuI18n/no-hardcoded-ui-strings': 'error',
    },
  },

  {
    name: 'app/i18n-enforcement-shared',
    files: [
      'src/layouts/**/*.{vue,ts}',
      'src/components/common/**/*.{vue,ts}',
      'src/components/modals/**/*.{vue,ts}',
      'src/components/AppSidebar.vue',
      'src/components/AppSidebarSkeleton.vue',
      'src/components/TabBar.vue',
      'src/components/notifications/**/*.{vue,ts}',
      'src/components/Nav.vue',
      'src/views/Login.vue',
      'src/components/LoginForm.vue',
      'src/views/Settings.vue',
      'src/components/settings/SettingsLandingPage.vue',
      'src/components/settings/AutomationSettings.vue',
      'src/components/settings/UsersAccessSettings.vue',
      'src/components/settings/PerformanceSettings.vue',
      'src/components/settings/ProfileSettings.vue',
      'src/components/settings/OrganizationSettings.vue',
      'src/components/settings/SecuritySettings.vue',
      'src/components/settings/UserManagement.vue',
      'src/components/settings/RolesPermissions.vue',
      'src/components/settings/RoleFormDrawer.vue',
      'src/components/settings/RoleUsersModal.vue',
      'src/components/settings/InviteUserDrawer.vue',
      'src/components/settings/EditUserModal.vue',
      'src/components/settings/GroupsSettings.vue',
      'src/components/groups/GroupFormModal.vue',
      'src/components/settings/HelpdeskExecutionSettings.vue',
      'src/components/settings/AssignmentRulesSettings.vue',
      'src/components/settings/HelpdeskSlaScheduleSection.vue',
      'src/components/settings/AppsSettings.vue',
      'src/components/settings/SalesSchema.vue',
      'src/components/settings/HelpdeskSchema.vue',
      'src/components/analytics/PlatformAnalyticsDashboardEmbed.vue',
      'src/components/settings/SalesPipelines.vue',
      'src/components/settings/SalesPlaybooks.vue',
      'src/components/settings/ModulesAndFields.vue',
      'src/components/settings/BusinessHoursSettings.vue',
      'src/components/settings/CoreModulesList.vue',
      'src/components/settings/CoreEntities.vue',
      'src/components/settings/PlatformSettings.vue',
      'src/components/settings/ApplicationsList.vue',
      'src/components/settings/SubscriptionsList.vue',
      'src/components/settings/ModuleFormModal.vue',
      'src/components/settings/OrganizationHierarchy.vue',
      'src/components/settings/HierarchyNode.vue',
      'src/components/settings/SalesPeople.vue',
      'src/components/settings/AppManagement.vue',
      'src/components/settings/SubscriptionDetail.vue',
      'src/components/settings/AddCustomFieldDrawer.vue',
      'src/components/settings/RelationshipFormDrawer.vue',
      'src/components/settings/ApplicationDetail.vue',
    ],
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: {
      'arivuI18n/no-hardcoded-ui-strings': 'error',
    },
  },

  {
    name: 'app/i18n-intl',
    files: ['src/**/*.{vue,ts}'],
    ignores: [
      'src/utils/localeFormat.ts',
      'src/utils/currencyOptions.js',
      'src/utils/appointmentFormatters.js',
      'src/utils/fieldDisplay.js',
      'src/utils/dateFilterOptions.ts',
      'src/i18n/**',
    ],
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: {
      'arivuI18n/no-direct-intl': 'warn',
    },
  },

  {
    name: 'app/i18n-module-scope',
    files: [
      'src/**/*.js',
      'src/composables/**/*.ts',
      'src/**/composables/**/*.ts',
    ],
    ignores: ['src/i18n/**', '**/*.d.ts'],
    plugins: { arivuI18n: arivuI18nPlugin },
    rules: {
      'arivuI18n/no-module-scope-use-i18n': 'error',
    },
  },
)
