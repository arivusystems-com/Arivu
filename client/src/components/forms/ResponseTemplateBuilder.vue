<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('forms.tabTemplateHeading') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('forms.rtBuilderSubtitle') }}
        </p>
      </div>
      
      <!-- Template Selection & Actions (Right Side) -->
      <div class="flex items-center gap-3">
        <!-- Template Dropdown -->
        <div class="relative">
          <select
            v-model="activeTemplateId"
            class="px-4 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer min-w-[200px]"
          >
            <option
              v-for="template in templates"
              :key="template.id"
              :value="template.id"
            >
              {{ template.name }}{{ template.isDefault ? t('forms.rtTemplateDefaultSuffix') : '' }}
            </option>
          </select>
        </div>
        
        <!-- Template Actions -->
        <div class="flex items-center gap-2">
          <button
            @click="startEditTemplateName(activeTemplateId, activeTemplate.name)"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            :title="t('forms.rtRenameTitle')"
          >
            <PencilIcon class="w-4 h-4" />
          </button>
          <button
            @click="duplicateActiveTemplate"
            class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            :title="t('forms.rtDuplicateTitle')"
          >
            <DocumentDuplicateIcon class="w-4 h-4" />
          </button>
          <button
            v-if="!activeTemplate.isDefault"
            @click="deleteTemplate(activeTemplateId)"
            class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            :title="t('forms.rtDeleteTitle')"
          >
            <TrashIcon class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Inline Edit Template Name (shown below header when editing) -->
    <div v-if="editingTemplateId === activeTemplateId && activeTemplate" class="flex items-center gap-3 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.rtRenameLabel') }}</span>
      <input
        v-model="editingTemplateName"
        @blur="saveTemplateName(activeTemplateId)"
        @keyup.enter="saveTemplateName(activeTemplateId)"
        @keyup.esc="cancelEditTemplateName"
        class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        :ref="el => { if (el && editingTemplateId === activeTemplateId) templateNameInput = el; }"
        :placeholder="t('forms.rtTemplateNamePh')"
      />
    </div>

    <!-- Branding Configuration -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('forms.rtReportBranding') }}</h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ t('forms.rtReportBrandingDesc') }}
          </p>
        </div>
        <button
          @click="showBrandingSettings = !showBrandingSettings"
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          :title="showBrandingSettings ? t('forms.rtHideBranding') : t('forms.rtShowBranding')"
        >
          <Cog6ToothIcon class="w-5 h-5" />
        </button>
      </div>

      <div v-if="showBrandingSettings && activeTemplate" class="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <!-- Logo -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('forms.rtLogo') }}
          </label>
          <div class="flex items-center gap-4">
            <input
              v-model="activeTemplate.branding.logo"
              @input="emitUpdate"
              type="text"
              :placeholder="t('forms.rtLogoPh')"
              class="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div v-if="activeTemplate.branding.logo" class="w-16 h-16 border border-gray-300 dark:border-gray-600 rounded overflow-hidden bg-gray-50 dark:bg-gray-900">
              <img :src="activeTemplate.branding.logo" :alt="t('forms.rtLogoAlt')" class="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        <!-- Colors -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('forms.rtColorPalette') }}
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtColorPrimary') }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="activeTemplate.branding.colors.primary"
                  @input="emitUpdate"
                  type="color"
                  class="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="activeTemplate.branding.colors.primary"
                  @input="emitUpdate"
                  type="text"
                  class="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="#FF6B35"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtColorSecondary') }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="activeTemplate.branding.colors.secondary"
                  @input="emitUpdate"
                  type="color"
                  class="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="activeTemplate.branding.colors.secondary"
                  @input="emitUpdate"
                  type="text"
                  class="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="#004E89"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtColorSuccess') }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="activeTemplate.branding.colors.success"
                  @input="emitUpdate"
                  type="color"
                  class="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="activeTemplate.branding.colors.success"
                  @input="emitUpdate"
                  type="text"
                  class="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="#4CAF50"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtColorDanger') }}</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="activeTemplate.branding.colors.danger"
                  @input="emitUpdate"
                  type="color"
                  class="w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="activeTemplate.branding.colors.danger"
                  @input="emitUpdate"
                  type="text"
                  class="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="#F44336"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Typography -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('forms.rtTypography') }}
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtFontFamily') }}</label>
              <input
                v-model="activeTemplate.branding.typography.fontFamily"
                @input="emitUpdate"
                type="text"
                :placeholder="t('forms.rtFontFamilyPh')"
                class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtBaseFontSize') }}</label>
              <input
                v-model.number="activeTemplate.branding.typography.baseFontSize"
                @input="emitUpdate"
                type="number"
                min="8"
                max="18"
                class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <!-- Header Configuration -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('forms.rtHeaderLayout') }}
          </label>
          <div class="space-y-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <HeadlessCheckbox
                v-model="activeTemplate.branding.header.showLogo"
                @change="emitUpdate"
                checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.rtShowLogoHeader') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <HeadlessCheckbox
                v-model="activeTemplate.branding.header.showCompanyName"
                @change="emitUpdate"
                checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.rtShowCompanyHeader') }}</span>
            </label>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtHeaderAlignment') }}</label>
              <select
                v-model="activeTemplate.branding.header.alignment"
                @change="emitUpdate"
                class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="left">{{ t('forms.rtAlignLeft') }}</option>
                <option value="center">{{ t('forms.rtAlignCenter') }}</option>
                <option value="right">{{ t('forms.rtAlignRight') }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Footer Configuration -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('forms.rtFooterLayout') }}
          </label>
          <div class="space-y-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <HeadlessCheckbox
                v-model="activeTemplate.branding.footer.showDisclaimer"
                @change="emitUpdate"
                checkbox-class="w-4 h-4 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('forms.rtShowDisclaimer') }}</span>
            </label>
            <div v-if="activeTemplate.branding.footer.showDisclaimer">
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtDisclaimerText') }}</label>
              <input
                v-model="activeTemplate.branding.footer.disclaimerText"
                @input="emitUpdate"
                type="text"
                :placeholder="t('forms.rtDisclaimerPh')"
                class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.rtFooterAlignment') }}</label>
              <select
                v-model="activeTemplate.branding.footer.alignment"
                @change="emitUpdate"
                class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="left">{{ t('forms.rtAlignLeft') }}</option>
                <option value="center">{{ t('forms.rtAlignCenter') }}</option>
                <option value="right">{{ t('forms.rtAlignRight') }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Designer -->
    <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <div class="flex h-[calc(100vh-var(--tabbar-offset)-400px)] min-h-[600px]">
        <!-- Left: Block Library -->
        <div class="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto p-4">
          <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('forms.rtBlockLibrary') }}</h5>
          
          <!-- Content Blocks -->
          <div class="mb-6">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{{ t('forms.rtBlockCategoryContent') }}</p>
            <div class="space-y-2">
              <div
                v-for="block in contentBlocks"
                :key="block.type"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, block)"
                class="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
              >
                <div class="flex items-center gap-2">
                  <component :is="block.icon" class="w-5 h-5 text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.name }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ block.description }}</p>
              </div>
            </div>
          </div>

          <!-- INSIGHTS Blocks -->
          <div class="mb-6">
            <p class="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">{{ t('forms.rtBlockCategoryInsights') }}</p>
            <div class="space-y-2">
              <div
                v-for="block in insightsBlocks"
                :key="block.type"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, block)"
                class="p-3 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 rounded-lg cursor-move hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
              >
                <div class="flex items-center gap-2">
                  <component :is="block.icon" class="w-5 h-5 text-indigo-500" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.name }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ block.description }}</p>
              </div>
            </div>
          </div>

          <!-- TRENDS Blocks -->
          <div class="mb-6">
            <p class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">{{ t('forms.rtBlockCategoryTrends') }}</p>
            <div class="space-y-2">
              <div
                v-for="block in trendsBlocks"
                :key="block.type"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, block)"
                class="p-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg cursor-move hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all"
              >
                <div class="flex items-center gap-2">
                  <component :is="block.icon" class="w-5 h-5 text-blue-500" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.name }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ block.description }}</p>
              </div>
            </div>
          </div>

          <!-- DETAILS Blocks -->
          <div>
            <p class="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">{{ t('forms.rtBlockCategoryDetails') }}</p>
            <div class="space-y-2">
              <div
                v-for="block in detailsBlocks"
                :key="block.type"
                draggable="true"
                @dragstart="(e) => handleDragStart(e, block)"
                class="p-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-lg cursor-move hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-sm transition-all"
              >
                <div class="flex items-center gap-2">
                  <component :is="block.icon" class="w-5 h-5 text-purple-500" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ block.name }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ block.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Report Canvas -->
        <div class="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800">
          <div
            @drop="handleDrop"
            @dragover.prevent
            @dragenter.prevent
            class="min-h-full bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed transition-colors"
            :class="
              isDragging
                ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-700'
            "
          >
            <div v-if="activeTemplate.blocks.length === 0" class="flex items-center justify-center h-full min-h-[400px]">
              <div class="text-center">
                <DocumentTextIcon class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.rtDragBlocksHint') }}</p>
              </div>
            </div>
            <div v-else class="space-y-4 p-6">
              <ReportBlock
                v-for="block in visibleBlocks"
                :key="block.id"
                :block="block"
                :index="getVisibleBlockIndex(block.id)"
                :is-selected="selectedBlockIndex === getOriginalBlockIndex(block.id)"
                :max-index="visibleBlocks.length - 1"
                @select="selectBlock(getOriginalBlockIndex(block.id))"
                @delete="deleteBlock(getOriginalBlockIndex(block.id))"
                @move-up="moveBlockUp(getOriginalBlockIndex(block.id))"
                @move-down="moveBlockDown(getOriginalBlockIndex(block.id))"
              />
            </div>
          </div>
        </div>

        <!-- Right: Block Settings -->
        <div class="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto p-4">
          <h5 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('forms.rtBlockSettings') }}</h5>
          
          <div v-if="selectedBlockIndex === null" class="text-center py-8">
            <Cog6ToothIcon class="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.rtSelectBlock') }}</p>
          </div>
          
          <BlockSettings
            v-else
            :block="selectedBlock"
            :metrics-enabled="metricsEnabled"
            @update="updateBlockSettings"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DocumentTextIcon,
  TrashIcon,
  Cog6ToothIcon,
  Bars3Icon,
  ChartBarIcon,
  ChartPieIcon,
  PhotoIcon,
  DocumentCheckIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  ArrowTrendingUpIcon,
  ArrowPathIcon,
  PencilIcon,
  DocumentDuplicateIcon
} from '@heroicons/vue/24/outline';
import ReportBlock from './report-blocks/ReportBlock.vue';
import BlockSettings from './report-blocks/BlockSettings.vue';
import { evaluateBlockVisibility, hasSystemVisibilityRule } from '../../utils/blockVisibility';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

const { t } = useI18n();
const notifications = useNotifications();


// Generate a unique ID for blocks/templates
const generateId = () => `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Core mandatory block IDs (system-defined, never change)
const CORE_BLOCK_IDS = {
  REPORT_IDENTITY: 'core_report_identity',
  OVERALL_PERFORMANCE: 'core_overall_performance',
  SECTION_BREAKDOWN: 'core_section_breakdown'
};

// Create core mandatory blocks
const createCoreBlocks = () => {
  return [
    {
      id: CORE_BLOCK_IDS.REPORT_IDENTITY,
      type: 'report_identity',
      mandatory: true,
      locked: true,
      visibilityRule: 'ALWAYS',
      order: 0,
      config: {
        companyName: '',
        reportTitle: t('forms.previewDefaultReportHeading'),
        showAuditId: true,
        showDates: true,
        showRound: true,
        showAddress: false,
        showGeneralManager: false
      }
    },
    {
      id: CORE_BLOCK_IDS.OVERALL_PERFORMANCE,
      type: 'overall_performance',
      mandatory: true,
      locked: true,
      visibilityRule: 'ALWAYS',
      order: 1,
      config: {
        showScore: true,
        showRating: true,
        showBenchmark: true,
        showScoreBreakdown: true,
        showClassification: true,
        chartType: 'donut',
        showPerformanceHistory: false
      }
    },
    {
      id: CORE_BLOCK_IDS.SECTION_BREAKDOWN,
      type: 'section_breakdown',
      mandatory: true,
      locked: true,
      visibilityRule: 'ALWAYS',
      order: 2,
      config: {
        showCurrentScores: true,
        showPreviousScores: false,
        showChange: false,
        showPassFailCounts: true,
        sortBy: 'default',
        sortOrder: 'asc'
      }
    }
  ];
};

// Ensure core blocks exist in template (add if missing, preserve order)
const ensureCoreBlocks = (blocks) => {
  const coreBlocks = createCoreBlocks();
  const existingBlocks = [...blocks];
  const coreBlockIds = coreBlocks.map(b => b.id);
  
  // Remove any existing core blocks (in case they were modified)
  const nonCoreBlocks = existingBlocks.filter(b => !coreBlockIds.includes(b.id));
  
  // Add core blocks at the beginning
  return [...coreBlocks, ...nonCoreBlocks.map((block, index) => ({
    ...block,
    order: index + coreBlocks.length
  }))];
};

// Default branding configuration
const getDefaultBranding = () => ({
  logo: null,
  colors: {
    primary: '#FF6B35',
    secondary: '#004E89',
    success: '#4CAF50',
    danger: '#F44336',
    warning: '#FF9800',
    text: '#333333',
    textLight: '#666666',
    background: '#FFFFFF'
  },
  typography: {
    fontFamily: 'Arial, sans-serif',
    headingFont: 'Arial, sans-serif',
    baseFontSize: 12
  },
  header: {
    showLogo: true,
    showCompanyName: true,
    alignment: 'center'
  },
  footer: {
    showDisclaimer: true,
    disclaimerText: t('forms.rtDisclaimerPh'),
    alignment: 'right'
  }
});

// Initialize templates from form data or create default
const initializeTemplates = () => {
  const formData = props.form || {};
  const existingTemplate = formData.responseTemplate || {};
  
  // If templates exist, use them but ensure core blocks and branding are present
  if (existingTemplate.templates && Array.isArray(existingTemplate.templates) && existingTemplate.templates.length > 0) {
    const templates = existingTemplate.templates.map(template => ({
      ...template,
      blocks: ensureCoreBlocks(template.blocks || []),
      branding: template.branding || getDefaultBranding()
    }));
    
    return {
      templates,
      activeTemplateId: existingTemplate.activeTemplateId || templates[0].id
    };
  }
  
  // Otherwise create default template with core blocks and branding
  const defaultTemplate = {
    id: 'default',
    name: t('forms.previewDefaultTemplateName'),
    isDefault: true,
    blocks: ensureCoreBlocks([]),
    branding: getDefaultBranding()
  };
  
  return {
    templates: [defaultTemplate],
    activeTemplateId: 'default'
  };
};

const { templates: initialTemplates, activeTemplateId: initialActiveId } = initializeTemplates();
const templates = ref(initialTemplates);
const activeTemplateId = ref(initialActiveId);
const selectedBlockIndex = ref(null);
const isDragging = ref(false);
const editingTemplateId = ref(null);
const editingTemplateName = ref('');
const showBrandingSettings = ref(false);
const templateNameInput = null;

// Get metrics enabled from Step 3
const metricsEnabled = computed(() => {
  const outcomes = props.form?.outcomesAndRules || {};
  return outcomes.reportingMetrics || {
    overallCompliance: true,
    sectionWiseCompliance: true,
    evidenceCompletion: false,
    averageRating: false
  };
});

// Active template
const activeTemplate = computed(() => {
  return templates.value.find(t => t.id === activeTemplateId.value) || templates.value[0];
});

// Selected block
const selectedBlock = computed(() => {
  if (selectedBlockIndex.value === null) return null;
  return activeTemplate.value.blocks[selectedBlockIndex.value];
});

// Filter blocks based on system-driven visibility rules
// In template builder, we show all blocks (no response data available)
// Visibility will be enforced during actual report generation
const visibleBlocks = computed(() => {
  // In template builder mode, show all blocks
  // Visibility will be evaluated during report generation with actual response data
  return activeTemplate.value.blocks || [];
});

// Helper to get visible block index from original index
const getVisibleBlockIndex = (blockId) => {
  return visibleBlocks.value.findIndex(b => b.id === blockId);
};

// Helper to get original block index from block ID
const getOriginalBlockIndex = (blockId) => {
  return activeTemplate.value.blocks.findIndex(b => b.id === blockId);
};

// Block definitions for library - organized by category
const contentBlocks = computed(() => [
  {
    type: 'heading',
    name: t('forms.rtBlockHeading'),
    description: t('forms.rtBlockHeadingDesc'),
    icon: Bars3Icon
  },
  {
    type: 'text',
    name: t('forms.rtBlockText'),
    description: t('forms.rtBlockTextDesc'),
    icon: DocumentTextIcon
  },
  {
    type: 'divider',
    name: t('forms.rtBlockDivider'),
    description: t('forms.rtBlockDividerDesc'),
    icon: Bars3Icon
  }
]);

const insightsBlocks = computed(() => [
  {
    type: 'narrative_summary',
    name: t('forms.rtBlockNarrativeSummary'),
    description: t('forms.rtBlockNarrativeSummaryDesc'),
    icon: DocumentTextIcon,
    category: 'INSIGHTS'
  },
  {
    type: 'top_bottom_areas',
    name: t('forms.rtBlockTopBottom'),
    description: t('forms.rtBlockTopBottomDesc'),
    icon: ChartBarIcon,
    category: 'INSIGHTS'
  },
  {
    type: 'non_compliance_summary',
    name: t('forms.rtBlockNonCompliance'),
    description: t('forms.rtBlockNonComplianceDesc'),
    icon: XCircleIcon,
    category: 'INSIGHTS'
  }
]);

const trendsBlocks = computed(() => [
  {
    type: 'performance_trends',
    name: t('forms.rtBlockPerformanceTrends'),
    description: t('forms.rtBlockPerformanceTrendsDesc'),
    icon: ArrowTrendingUpIcon,
    category: 'TRENDS'
  }
]);

const detailsBlocks = computed(() => [
  {
    type: 'detailed_findings',
    name: t('forms.rtBlockDetailedFindings'),
    description: t('forms.rtBlockDetailedFindingsDesc'),
    icon: ClipboardDocumentListIcon,
    category: 'DETAILS'
  },
  {
    type: 'action_items_summary',
    name: t('forms.rtBlockActionItems'),
    description: t('forms.rtBlockActionItemsDesc'),
    icon: ArrowPathIcon,
    category: 'DETAILS'
  }
]);

// Drag and drop handlers
const handleDragStart = (e, block) => {
  isDragging.value = true;
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(block));
};

const handleDrop = (e) => {
  isDragging.value = false;
  e.preventDefault();
  
  try {
    const blockData = JSON.parse(e.dataTransfer.getData('application/json'));
    addBlock(blockData);
  } catch (error) {
    console.error('Error parsing block data:', error);
  }
};

// Block management
const addBlock = (blockDefinition) => {
  if (isUpdating.value) return;
  
  const defaultConfig = getDefaultBlockConfig(blockDefinition.type);
  
  // For blocks that use config structure, wrap defaults in config object
  const blocksWithConfig = [
    'report_identity', 'overall_performance', 'section_breakdown',
    'narrative_summary', 'top_bottom_areas', 'non_compliance_summary',
    'performance_trends', 'detailed_findings', 'action_items_summary'
  ];
  
  const newBlock = {
    id: generateId(),
    type: blockDefinition.type,
    mandatory: false,
    locked: false,
    visibilityRule: 'ALWAYS',
    order: activeTemplate.value.blocks.length
  };
  
  if (blocksWithConfig.includes(blockDefinition.type)) {
    newBlock.config = defaultConfig;
  } else {
    // For legacy blocks, merge defaults directly
    Object.assign(newBlock, defaultConfig);
  }
  
  const template = activeTemplate.value;
  if (selectedBlockIndex.value !== null) {
    template.blocks.splice(selectedBlockIndex.value + 1, 0, newBlock);
  } else {
    template.blocks.push(newBlock);
  }
  
  // Re-ensure core blocks after adding (in case order got messed up)
  isUpdating.value = true;
  template.blocks = ensureCoreBlocks(template.blocks);
  isUpdating.value = false;
  
  selectedBlockIndex.value = template.blocks.findIndex(b => b.id === newBlock.id);
  emitUpdate();
};

const getDefaultBlockConfig = (type) => {
  const configs = {
    // Content blocks
    heading: { content: t('forms.rtDefaultHeadingContent'), level: 1 },
    text: { content: t('forms.rtDefaultTextContent') },
    divider: {},
    
    // Core blocks (already have config structure)
    report_identity: {
      companyName: '',
      reportTitle: t('forms.previewDefaultReportHeading'),
      showAuditId: true,
      showDates: true,
      showRound: true,
      showAddress: false,
      showGeneralManager: false
    },
    overall_performance: {
      showScore: true,
      showRating: true,
      showBenchmark: true,
      showScoreBreakdown: true,
      showClassification: true,
      chartType: 'donut',
      showPerformanceHistory: false
    },
    section_breakdown: {
      showCurrentScores: true,
      showPreviousScores: false,
      showChange: false,
      showPassFailCounts: true,
      sortBy: 'default',
      sortOrder: 'asc'
    },
    
    // INSIGHTS blocks
    narrative_summary: {
      customText: null,
      includeScoreContext: true,
      includeTopAreas: true,
      includeBottomAreas: true,
      includeTrends: false,
      maxLength: 0
    },
    top_bottom_areas: {
      topCount: 5,
      bottomCount: 5,
      showScores: true,
      showChange: false,
      layout: 'side_by_side'
    },
    non_compliance_summary: {
      showByDepartment: true,
      showByCategory: false,
      showPreviousComparison: false,
      showChange: false,
      sortBy: 'count',
      limit: null
    },
    
    // TRENDS blocks
    performance_trends: {
      periodCount: 5,
      metrics: ['compliance'],
      chartType: 'line',
      showCurrentHighlight: true,
      showAverage: false,
      showProjection: false
    },
    
    // DETAILS blocks
    detailed_findings: {
      sectionIds: null,
      showOnlyFailed: false,
      showOnlyPassed: false,
      showEvidence: true,
      showComments: true,
      showScores: true,
      columns: ['sNo', 'category', 'tag', 'area', 'standard', 'answer', 'comment', 'score'],
      sortBy: 'section'
    },
    action_items_summary: {
      showStatus: true,
      showDates: true,
      showAssignee: false,
      showPriority: false,
      statusFilter: null,
      showFromPreviousAudits: true,
      sortBy: 'date'
    },
    
    // Legacy blocks (for backward compatibility)
    audit_summary: { showOverallScore: true, showResult: true },
    overall_score: { showPercentage: true, showLabel: true },
    section_results: { showCompliancePercentage: true, showFailedSections: true },
    failed_questions: { showSectionName: true, showEvidence: true },
    evidence_gallery: { layout: 'grid', showThumbnails: true },
    corrective_actions: { showStatus: true, showDates: true },
    comparison: { metrics: ['compliance', 'failedPoints'], period: 'previous' },
    trend: { metrics: ['compliance'], periodCount: 5 },
    line_chart: { metric: 'overallCompliance', title: t('forms.rtDefaultTrendTitle') },
    bar_chart: { metric: 'sectionWiseCompliance', title: t('forms.rtDefaultSectionComparisonTitle') },
    pie_chart: { metric: 'overallCompliance', title: t('forms.rtDefaultDistributionTitle') }
  };
  return configs[type] || {};
};

const deleteBlock = (index) => {
  if (isUpdating.value) return;
  
  const block = activeTemplate.value.blocks[index];
  
  // Prevent deletion of mandatory blocks
  if (block.mandatory) {
    notifications.error(t('forms.rtCannotDeleteCore'));
    return;
  }
  
  isUpdating.value = true;
  activeTemplate.value.blocks.splice(index, 1);
  // Re-ensure core blocks after deletion
  activeTemplate.value.blocks = ensureCoreBlocks(activeTemplate.value.blocks);
  isUpdating.value = false;
  
  if (selectedBlockIndex.value === index) {
    selectedBlockIndex.value = null;
  } else if (selectedBlockIndex.value > index) {
    selectedBlockIndex.value--;
  }
  emitUpdate();
};

const selectBlock = (index) => {
  selectedBlockIndex.value = index;
};

const moveBlockUp = (index) => {
  if (index > 0) {
    const blocks = activeTemplate.value.blocks;
    const currentBlock = blocks[index];
    const previousBlock = blocks[index - 1];
    
    // Prevent moving core blocks out of their core positions (first 3)
    if (currentBlock.mandatory && index < 3) {
      return; // Core blocks stay in first 3 positions
    }
    if (previousBlock.mandatory && index <= 3) {
      return; // Cannot move above core blocks
    }
    
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
    selectedBlockIndex.value = index - 1;
    emitUpdate();
  }
};

const moveBlockDown = (index) => {
  const blocks = activeTemplate.value.blocks;
  if (index < blocks.length - 1) {
    const currentBlock = blocks[index];
    const nextBlock = blocks[index + 1];
    
    // Prevent moving core blocks out of their core positions (first 3)
    if (currentBlock.mandatory && index < 2) {
      return; // Core blocks stay in first 3 positions
    }
    if (nextBlock.mandatory && index < 2) {
      return; // Cannot move below core blocks if we're in core range
    }
    
    [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    selectedBlockIndex.value = index + 1;
    emitUpdate();
  }
};

const updateBlockSettings = (updatedBlock) => {
  if (selectedBlockIndex.value !== null) {
    activeTemplate.value.blocks[selectedBlockIndex.value] = {
      ...activeTemplate.value.blocks[selectedBlockIndex.value],
      ...updatedBlock
    };
    emitUpdate();
  }
};

// Template management
const duplicateActiveTemplate = () => {
  const active = activeTemplate.value;
  const newTemplate = {
    id: generateId(),
    name: t('forms.rtTemplateDuplicateName', { name: active.name }),
    isDefault: false,
    blocks: JSON.parse(JSON.stringify(active.blocks)),
    branding: JSON.parse(JSON.stringify(active.branding || getDefaultBranding()))
  };
  templates.value.push(newTemplate);
  activeTemplateId.value = newTemplate.id;
  emitUpdate();
};

const startEditTemplateName = (id, name) => {
  editingTemplateId.value = id;
  editingTemplateName.value = name;
  nextTick(() => {
    const input = templateNameInput.value;
    if (input) {
      if (Array.isArray(input) && input[0]) {
        input[0].focus();
        input[0].select();
      } else if (input.focus) {
        input.focus();
        input.select();
      }
    }
  });
};

const saveTemplateName = (id) => {
  const template = templates.value.find(t => t.id === id);
  if (template && editingTemplateName.value.trim()) {
    template.name = editingTemplateName.value.trim();
    editingTemplateId.value = null;
    editingTemplateName.value = '';
    emitUpdate();
  }
};

const cancelEditTemplateName = () => {
  editingTemplateId.value = null;
  editingTemplateName.value = '';
};

const deleteTemplate = async (id) => {
  if (templates.value.length <= 1) {
    notifications.error(t('forms.rtCannotDeleteLast'));
    return;
  }
  
  const template = templates.value.find(t => t.id === id);
  if (template && template.isDefault) {
    notifications.error(t('forms.rtCannotDeleteDefault'));
    return;
  }
  
  if (await confirmAction(t('forms.rtConfirmDeleteTemplate', { name: template.name }))) {
    const index = templates.value.findIndex(t => t.id === id);
    templates.value.splice(index, 1);
    
    if (activeTemplateId.value === id) {
      activeTemplateId.value = templates.value[0].id;
    }
    emitUpdate();
  }
};

// Flag to prevent recursive updates
const isUpdating = ref(false);

// Watch active template changes and ensure core blocks and branding
watch(() => activeTemplateId.value, () => {
  if (isUpdating.value) return;
  selectedBlockIndex.value = null;
  // Ensure core blocks and branding are always present
  if (activeTemplate.value) {
    isUpdating.value = true;
    activeTemplate.value.blocks = ensureCoreBlocks(activeTemplate.value.blocks);
    if (!activeTemplate.value.branding) {
      activeTemplate.value.branding = getDefaultBranding();
    }
    isUpdating.value = false;
  }
  emitUpdate();
});

// Emit updates to parent
const emitUpdate = () => {
  if (isUpdating.value) return;
  
  // Ensure core blocks and branding are present before emitting (only for active template)
  if (activeTemplate.value) {
    isUpdating.value = true;
    if (activeTemplate.value.blocks) {
      activeTemplate.value.blocks = ensureCoreBlocks(activeTemplate.value.blocks);
    }
    if (!activeTemplate.value.branding) {
      activeTemplate.value.branding = getDefaultBranding();
    }
    isUpdating.value = false;
  }
  
  emit('update', {
    ...props.form,
    responseTemplate: {
      templates: templates.value,
      activeTemplateId: activeTemplateId.value
    }
  });
};

// Initialize on mount
watch(() => props.form?._id, () => {
  if (isUpdating.value) return;
  
  isUpdating.value = true;
  const { templates: newTemplates, activeTemplateId: newActiveId } = initializeTemplates();
  templates.value = newTemplates;
  activeTemplateId.value = newActiveId;
  selectedBlockIndex.value = null;
  // Core blocks are already ensured in initializeTemplates
  isUpdating.value = false;
}, { immediate: true });
</script>

