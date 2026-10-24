<template>
  <div class="mx-auto max-w-4xl">
    <!-- Ambiguous App Context Warning -->
    <div v-if="appContextResult?.isAmbiguous && !resolvedAppKey" class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{{ t('people.peopleCreateAmbiguousAppContext') }}</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            {{ appContextResult?.reason }}
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-3">{{ t('people.peopleCreatePleaseSelectAnAppContextTo') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="candidate in appContextResult?.candidates || []"
              :key="candidate"
              @click="selectAppContext(candidate)"
              class="px-3 py-1.5 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
            >
              {{ candidate }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Type Ownership Ambiguity Warning -->
    <div v-if="quickCreateResult?.requiresUserChoice" class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{{ t('people.peopleCreateTypeOwnershipAmbiguity') }}</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
            {{ quickCreateResult?.reason }}
          </p>
          <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-3">{{ t('people.peopleCreatePleaseSelectWhichAppToUse') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="candidate in quickCreateResult?.candidates || []"
              :key="candidate"
              @click="selectAppForType(candidate)"
              class="px-3 py-1.5 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors"
            >
              {{ candidate }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleCreateResolvingAppContext') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('people.peopleCreateError') }}</h3>
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Intent Selection UI (optional, for backward compatibility) -->
    <!-- ARCHITECTURAL INTENT: Drawer opens immediately in Quick Create mode -->
    <!-- This intent selection can pre-select intent for Full Form, but is not required -->
    <div v-if="!showCreateDrawer" class="py-12">
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('people.peopleCreateSelectIntent') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('people.peopleCreateChooseHowYouWantToAdd') }}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          v-for="intent in availableIntents"
          :key="intent.id"
          @click="selectIntent(intent)"
          class="px-4 py-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors"
        >
          <div class="font-medium text-gray-900 dark:text-white">
            {{ intent.label }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ intent.description }}
          </div>
        </button>
      </div>
    </div>

    <!-- Create Person Drawer (context-aware: ALL | SALES | HELPDESK) -->
    <PeopleQuickCreateDrawer
      :isOpen="showCreateDrawer"
      :context-app-key="resolvedAppKey || intentContext?.participatingApps?.[0] || null"
      @close="handleDrawerClose"
      @saved="handleDrawerSaved"
    />

  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onActivated, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { toAttachRole } from '@/utils/getParticipation';
import PeopleQuickCreateDrawer from '@/components/people/PeopleQuickCreateDrawer.vue';
import { buildIntentContext, type IntentMapping } from '@/utils/personCreationUtils';
import type { CreatePersonIntentContext } from '@/types/personCreation.types';

type AppContextResult = {
  isAmbiguous?: boolean;
  reason?: string;
  candidates?: string[];
};

type AggregatedType = {
  typeKey: string;
  owningApps: string[];
};

type TypesResult = {
  aggregated: AggregatedType[];
};

type QuickCreateResult = {
  appKey?: string;
  requiresUserChoice?: boolean;
  reason?: string;
  confidence?: string;
  candidates?: string[];
};

interface PeopleCreateApiError {
  response?: {
    data?: {
      errors?: Record<string, string>;
      message?: string;
    };
  };
}

type PeopleCreateFormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  mobile: string;
  source: string;
  sales_type: string;
  lead_status: string;
  lead_score: number | null;
  contact_status: string;
  role: string;
  [key: string]: string | number | null;
};

const route = useRoute();
const router = useRouter();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const appContextResult = ref<AppContextResult | null>(null);
const resolvedAppKey = ref<string | null>(null);
const typesResult = ref<TypesResult | null>(null);
const selectedType = ref<string | null>(null);
const quickCreateResult = ref<QuickCreateResult | null>(null);
const finalAppKey = ref<string | null>(null);
const submitting = ref(false);
const validationErrors = ref<Record<string, string>>({});
const selectedIntent = ref<IntentMapping | null>(null);

// Form data
const formData = ref<PeopleCreateFormData>({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  source: '',
  // Sales app fields (canonical key; role still sent separately as `role` on create)
  sales_type: '',
  lead_status: '',
  lead_score: null,
  contact_status: '',
  role: ''
});

// Intent mappings (explicit, deterministic)
const intentMappings: IntentMapping[] = [
  { id: 'sales-lead', label: 'Add Sales Lead', description: 'Add as a Sales Lead', appKey: 'SALES', participationType: 'LEAD' },
  { id: 'sales-contact', label: 'Add Sales Contact', description: 'Add as a Sales Contact', appKey: 'SALES', participationType: 'CONTACT' },
  { id: 'support-contact', label: 'Add Support Contact', description: 'Add as a Support Contact', appKey: 'HELPDESK', participationType: 'CONTACT' },
  { id: 'audit-member', label: 'Add Audit Member', description: 'Add as an Audit Member', appKey: 'AUDIT', participationType: 'MEMBER' },
  { id: 'portal-user', label: 'Add Portal User', description: 'Add as a Portal User', appKey: 'PORTAL', participationType: 'USER' },
  { id: 'project-member', label: 'Add Project Member', description: 'Add as a Project Member', appKey: 'PROJECTS', participationType: 'MEMBER' }
];

// Drawer state
const showCreateDrawer = ref(false);
const intentContext = ref<CreatePersonIntentContext | null>(null);

// Computed
const availableIntents = computed(() => {
  return intentMappings;
});

const availableTypes = computed(() => {
  const appKey = finalAppKey.value;
  if (!typesResult.value?.aggregated || !appKey) return [];
  
  // Filter types that are available for the resolved app
  return typesResult.value.aggregated.filter((type: AggregatedType) => {
    return type.owningApps.includes(appKey);
  });
});

// Methods
// ARCHITECTURAL INTENT: All entry points open drawer in Quick Create mode immediately.
// Intent selection happens within the drawer when user switches to Full Form mode.
// We still keep intent selection page for backward compatibility, but it opens drawer immediately.
const selectIntent = async (intent: IntentMapping) => {
  // Build intent context (can be used if provided, but drawer doesn't require it)
  const context = buildIntentContext(intent);
  intentContext.value = context;
  
  // Open drawer immediately in Quick Create mode
  // User can switch to Full Form and see intent pre-selected, or change it
  showCreateDrawer.value = true;
};

// Open drawer immediately on mount (Quick Create mode)
onMounted(() => {
  showCreateDrawer.value = true;
});

const handleDrawerSaved = (person: { _id?: string; id?: string }) => {
  // Navigate to the created person's detail page
  router.push(`/people/${person._id || person.id}`);
  // Reset state
  resetState();
};

const handleDrawerClose = () => {
  showCreateDrawer.value = false;
  // Reset state when drawer closes
  resetState();
};

// Resolver is called AFTER intent selection (not on mount)
// This function is called after user selects intent
const resolveAppContextAfterIntent = async (appKey: string) => {
  try {
    loading.value = true;
    error.value = null;

    // Build route info with explicit appKey from intent
    const routeInfo = {
      path: `/people/create`,
      name: 'people-create',
      params: {},
      query: {},
      meta: {}
    };

    // Call resolver with explicit appKey (should resolve deterministically)
    const response = await apiClient.post('/people/resolve-context', {
      routeInfo,
      navigationIntent: {
        intent: 'create',
        targetModuleKey: 'people',
        appKey: appKey // Explicit appKey from intent selection
      }
    });

    if (response.success) {
      appContextResult.value = response.data;
      resolvedAppKey.value = appKey; // Use appKey from intent, not resolver
      await resolveTypes();
      await resolveQuickCreate();
    } else {
      error.value = response.message || 'Failed to resolve app context';
    }
  } catch (err: unknown) {
    console.error('Error resolving app context:', err);
    error.value = err instanceof Error ? err.message : 'Error resolving app context';
  } finally {
    loading.value = false;
  }
};

const resolveTypes = async () => {
  try {
    const response = await apiClient.post('/people/resolve-types');

    if (response.success) {
      typesResult.value = response.data;
    }
  } catch (err: unknown) {
    console.error('Error resolving types:', err);
  }
};

const resolveQuickCreate = async () => {
  if (!resolvedAppKey.value || !appContextResult.value) return;

  try {
    const selectedTypeKey = selectedType.value || null;
    const owningApps = selectedTypeKey
      ? (typesResult.value?.aggregated.find((t: AggregatedType) => t.typeKey === selectedTypeKey)?.owningApps || [])
      : [];

    const response = await apiClient.post('/people/resolve-quick-create', {
      selectedType: selectedTypeKey,
      owningApps,
      resolvedAppContext: appContextResult.value
    });

    if (response.success) {
      quickCreateResult.value = response.data;

      // DO NOT overwrite finalAppKey - it's set from intent and should remain locked
      // quickCreateResult is only used for validation/display purposes
      if (quickCreateResult.value?.requiresUserChoice) {
        // This should not happen in intent-first flow, but if it does, keep finalAppKey from intent
        // finalAppKey.value remains unchanged (set from intent)
      }
      // finalAppKey.value remains unchanged - it's set from intent
    }
  } catch (err: unknown) {
    console.error('Error resolving quick create context:', err);
    // finalAppKey.value remains unchanged - it's set from intent
  }
};

const selectAppContext = async (appKey: string) => {
  resolvedAppKey.value = appKey;
  await resolveTypes();
  await resolveQuickCreate();
};

const selectAppForType = (appKey: string) => {
  finalAppKey.value = appKey;
  quickCreateResult.value = {
    appKey,
    requiresUserChoice: false,
    reason: `User selected app: ${appKey}`,
    confidence: 'HIGH'
  };
};

const handleTypeChange = async () => {
  await resolveQuickCreate();
};

// Format app name for display
const formatAppName = (appKey: string | null) => {
  if (!appKey) return '';
  const appNames = {
    'SALES': 'Sales',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PROJECTS': 'Projects',
    'PORTAL': 'Portal',
    'LMS': 'LMS'
  };
  return appNames[appKey as keyof typeof appNames] || appKey;
};

// Get display name for intent
const getIntentDisplayName = (intent: IntentMapping | null) => {
  if (!intent) return '';
  // Convert "Add Sales Lead" to "Sales Lead", etc.
  return intent.label.replace('Add ', '');
};

const handleSubmit = async () => {
  // Explicit intent validation - appKey is required
  if (!finalAppKey.value) {
    error.value = 'App context is required. Cannot create person without explicit app selection.';
    return;
  }

  // Explicit intent validation - type is required for app participation
  if (availableTypes.value.length > 0 && !selectedType.value) {
    error.value = `Participation type is required. Please select a type for ${formatAppName(finalAppKey.value)}.`;
    validationErrors.value = { sales_type: 'Participation type is required' };
    return;
  }

  if (!formData.value.first_name) {
    validationErrors.value = { first_name: 'First name is required' };
    return;
  }

  try {
    submitting.value = true;
    validationErrors.value = {};
    error.value = null;

    // Clean form data: convert empty strings to null for enum fields
    const cleanedFormData: Record<string, string | number | null> = { ...formData.value };
    const enumFields = ['lead_status', 'contact_status', 'role', 'source', 'sales_type'];
    enumFields.forEach(field => {
      if (cleanedFormData[field] === '') {
        cleanedFormData[field] = null;
      }
    });

    // Standardized create payload: appKey + role (backend maps role → type)
    const role = toAttachRole(selectedType.value) ?? selectedType.value;
    const response = await apiClient.post('/people/create', {
      appKey: finalAppKey.value,
      role,
      formData: cleanedFormData
    });

    if (response.success) {
      // Navigate to the created person's detail page
      router.push(`/people/${response.data._id}`);
    } else {
      if (response.errors) {
        validationErrors.value = response.errors;
      } else {
        error.value = response.message || 'Failed to create person';
      }
    }
  } catch (err: unknown) {
    const apiErr = err as PeopleCreateApiError;
    console.error('Error creating person:', err);
    console.error('Error response:', apiErr?.response?.data);
    console.error('Validation errors:', apiErr?.response?.data?.errors);
    
    // Handle validation errors from backend
    if (apiErr?.response?.data?.errors) {
      validationErrors.value = apiErr.response.data.errors;
      error.value = apiErr.response.data.message || 'Validation failed. Please check the fields below.';
      console.log('Set validationErrors:', validationErrors.value);
    } else if (apiErr?.response?.data?.message) {
      error.value = apiErr.response.data.message;
    } else {
      error.value = err instanceof Error ? err.message : 'Error creating person';
    }
  } finally {
    submitting.value = false;
  }
};

// Reset state function
const resetState = () => {
  selectedIntent.value = null;
  resolvedAppKey.value = null;
  finalAppKey.value = null;
  selectedType.value = null;
  appContextResult.value = null;
  typesResult.value = null;
  quickCreateResult.value = null;
  error.value = null;
  loading.value = false;
  submitting.value = false;
  validationErrors.value = {};
  formData.value = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    source: '',
    sales_type: '',
    lead_status: '',
    lead_score: null,
    contact_status: '',
    role: ''
  };
};

// Lifecycle
// Reset state when component is activated (handles keep-alive cache)
onActivated(() => {
  resetState();
});

// Watch for type changes
watch(selectedType, () => {
  resolveQuickCreate();
});
</script>

