<template>
  <CardWidget :title="t('common.lifecycleStageTitle')">
    <!-- Type and Age Info -->
    <div class="flex items-center gap-3 mb-4 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-gray-600 dark:text-gray-400">{{ t('common.lifecycleType') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ recordTypeLabel }}</span>
      </div>
      <div class="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
      <div class="flex items-center gap-2">
        <span class="text-gray-600 dark:text-gray-400">{{ t('common.lifecycleAge') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">{{ recordAge }}</span>
      </div>
    </div>

    <!-- Lifecycle Stages Progress Bar -->
    <div class="flex items-center gap-0">
      <div
        v-for="(stage, index) in stages"
        :key="index"
        class="relative group min-w-0 flex-1"
      >
        <!-- Left Arrow Connector -->
        <div
          v-if="index > 0"
          :class="[
            'absolute top-0 right-full w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent transition-all duration-200 z-10',
            getArrowColorClassesForPrevious(index)
          ]"
          :style="getArrowStyleForPrevious(index)"
        ></div>

        <!-- Stage Button -->
        <button
          @click="changeStage(stage.value)"
          :class="[
            'px-4 py-2 text-sm font-medium transition-all duration-200 truncate w-full text-center relative z-20',
            getButtonClasses(stage, index)
          ]"
          :style="getButtonStyle(stage)"
        >
          {{ stage.label }}
        </button>

        <!-- Right Arrow Connector -->
        <div
          v-if="index < stages.length - 1"
          :class="[
            'absolute top-0 left-full w-0 h-0 border-t-[16px] border-t-transparent border-b-[16px] border-b-transparent transition-all duration-200 z-10',
            isStageActive(stage.value) || isStageCompleted(stage.value)
              ? getArrowColorClasses(stage)
              : 'border-l-[8px] border-l-gray-100 dark:border-l-gray-700'
          ]"
          :style="getArrowStyle(stage)"
        ></div>
      </div>
    </div>
  </CardWidget>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import CardWidget from '@/components/common/CardWidget.vue';

const { t } = useI18n();

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  recordType: {
    type: String,
    required: true
  },
  moduleDefinition: {
    type: Object,
    required: false
  }
});

const emit = defineEmits(['update']);

/** SALES role (Lead/Contact); API uses sales_type */
function getPeopleSalesRole(record = props.record) {
  if (!record) return null;
  return record.sales_type ?? null;
}

// Get record type label (first letter capitalized)
const recordTypeLabel = computed(() => {
  if (props.recordType === 'people') {
    return getPeopleSalesRole() || 'Person';
  }
  // Capitalize first letter
  return props.recordType.charAt(0).toUpperCase() + props.recordType.slice(1);
});

// Calculate record age
const recordAge = computed(() => {
  if (!props.record.createdAt) return t('common.lifecycleAgeZero');
  const days = Math.floor((new Date() - new Date(props.record.createdAt)) / (1000 * 60 * 60 * 24));
  if (days === 0) return t('common.lifecycleJustCreated');
  return t('common.lifecycleAgeDays', { days }, days);
});

// Get field definition helper
const getFieldDefinition = (key) => {
  if (!props.moduleDefinition?.fields) return null;
  return props.moduleDefinition.fields.find(f => 
    f.key?.toLowerCase() === key.toLowerCase()
  );
};

// Get lifecycle stages based on record type
const stages = computed(() => {
  // First try to get from module definition
  if (props.recordType === 'people') {
    const type = getPeopleSalesRole();
    if (type === 'Lead') {
      const fieldDef = getFieldDefinition('lead_status');
      if (fieldDef && fieldDef.options && fieldDef.options.length > 0) {
        // Use options from module definition
        return fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt, color: null };
          }
          return { value: opt.value, label: opt.value, color: opt.color || null };
        });
      }
    } else if (type === 'Contact') {
      const fieldDef = getFieldDefinition('contact_status');
      if (fieldDef && fieldDef.options && fieldDef.options.length > 0) {
        return fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt, color: null };
          }
          return { value: opt.value, label: opt.value, color: opt.color || null };
        });
      }
    }
  } else if (props.recordType === 'organizations') {
    const types = props.record.types || [];
    if (types.includes('Customer')) {
      const fieldDef = getFieldDefinition('customerStatus');
      if (fieldDef && fieldDef.options && fieldDef.options.length > 0) {
        return fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt, color: null };
          }
          return { value: opt.value, label: opt.value, color: opt.color || null };
        });
      }
    } else if (types.includes('Partner')) {
      const fieldDef = getFieldDefinition('partnerStatus');
      if (fieldDef && fieldDef.options && fieldDef.options.length > 0) {
        return fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt, color: null };
          }
          return { value: opt.value, label: opt.value, color: opt.color || null };
        });
      }
    } else if (types.includes('Vendor')) {
      const fieldDef = getFieldDefinition('vendorStatus');
      if (fieldDef && fieldDef.options && fieldDef.options.length > 0) {
        return fieldDef.options.map(opt => {
          if (typeof opt === 'string') {
            return { value: opt, label: opt, color: null };
          }
          return { value: opt.value, label: opt.value, color: opt.color || null };
        });
      }
    }
  }
  
  // Fallback to hardcoded stages if no module definition
  if (props.recordType === 'people') {
    const type = getPeopleSalesRole();
    if (type === 'Lead') {
      return [
        { value: 'New', label: 'New' },
        { value: 'Discovery', label: 'Discovery' },
        { value: 'Proposal', label: 'Proposal' },
        { value: 'Negotiation', label: 'Negotiation' },
        { value: 'Ready to close', label: 'Ready to close' }
      ];
    } else if (type === 'Contact') {
      return [
        { value: 'New', label: 'New' },
        { value: 'Active', label: 'Active' },
        { value: 'Nurturing', label: 'Nurturing' },
        { value: 'Customer', label: 'Customer' }
      ];
    }
  } else if (props.recordType === 'organizations') {
    const types = props.record.types || [];
    if (types.includes('Customer')) {
      return [
        { value: 'Prospect', label: 'Prospect' },
        { value: 'Evaluation', label: 'Evaluation' },
        { value: 'Negotiation', label: 'Negotiation' },
        { value: 'Customer', label: 'Customer' }
      ];
    } else if (types.includes('Partner')) {
      return [
        { value: 'Potential', label: 'Potential' },
        { value: 'Discussing', label: 'Discussing' },
        { value: 'Partner', label: 'Partner' }
      ];
    } else if (types.includes('Vendor')) {
      return [
        { value: 'Potential', label: 'Potential' },
        { value: 'Evaluating', label: 'Evaluating' },
        { value: 'Vendor', label: 'Vendor' }
      ];
    }
  }
  
  // Default stages
  return [
    { value: 'New', label: 'New' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Complete', label: 'Complete' }
  ];
});

// Get current stage value
const currentStage = computed(() => {
  if (props.recordType === 'people') {
    const type = getPeopleSalesRole();
    if (type === 'Lead') {
      return props.record.lead_status;
    } else if (type === 'Contact') {
      return props.record.contact_status;
    }
  } else if (props.recordType === 'organizations') {
    const types = props.record.types || [];
    if (types.includes('Customer')) {
      return props.record.customerStatus;
    } else if (types.includes('Partner')) {
      return props.record.partnerStatus;
    } else if (types.includes('Vendor')) {
      return props.record.vendorStatus;
    }
  }
  return props.record.status || stages.value[0].value;
});

// Check if a stage is active
const isStageActive = (stageValue) => {
  return currentStage.value === stageValue;
};

// Check if a stage is completed
const isStageCompleted = (stageValue) => {
  const currentIndex = stages.value.findIndex(s => s.value === currentStage.value);
  const stageIndex = stages.value.findIndex(s => s.value === stageValue);
  return stageIndex < currentIndex;
};

// Change stage
const changeStage = (newStage) => {
  if (newStage === currentStage.value) return; // Don't update if same
  
  // Determine which field to update based on record type
  let fieldKey = 'status';
  
  if (props.recordType === 'people') {
    const type = getPeopleSalesRole();
    if (type === 'Lead') {
      fieldKey = 'lead_status';
    } else if (type === 'Contact') {
      fieldKey = 'contact_status';
    }
  } else if (props.recordType === 'organizations') {
    const types = props.record.types || [];
    if (types.includes('Customer')) {
      fieldKey = 'customerStatus';
    } else if (types.includes('Partner')) {
      fieldKey = 'partnerStatus';
    } else if (types.includes('Vendor')) {
      fieldKey = 'vendorStatus';
    }
  }
  
  // Emit update event
  emit('update', {
    field: fieldKey,
    value: newStage
  });
};

// Convert hex color to RGB
const hexToRgb = (hexColor) => {
  if (!hexColor) return null;
  
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return { r, g, b };
};

// Get button classes based on stage state
const getButtonClasses = (stage, index) => {
  const isActive = isStageActive(stage.value);
  const optionColor = stage.color;
  
  // Base classes for all buttons
  const baseClasses = 'border cursor-pointer transition-all duration-200';
  
  // Rounding classes based on position
  const roundingClasses = index === 0 ? 'rounded-l-md rounded-r-none' : (index === stages.value.length - 1 ? 'rounded-r-md rounded-l-none' : 'rounded-none');
  
  if (isActive) {
    // Active stage - apply color if available, otherwise use blue
    if (optionColor) {
      return `${baseClasses} ${roundingClasses} hover:opacity-90`;
    }
    return `${baseClasses} ${roundingClasses} bg-blue-600 text-white hover:bg-blue-700 border-blue-600`;
  } else {
    // Inactive stages - always gray
    return `${baseClasses} ${roundingClasses} bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600`;
  }
};

// Get button style based on stage color
const getButtonStyle = (stage) => {
  const isActive = isStageActive(stage.value);
  
  // Only apply color if stage is active
  if (!isActive) {
    return {};
  }
  
  const optionColor = stage.color;
  if (!optionColor) {
    // No color - return empty (Tailwind classes handle it)
    return {};
  }
  
  // Convert hex to RGB for opacity calculation
  const rgb = hexToRgb(optionColor);
  if (!rgb) {
    return {};
  }
  
  // Apply the color as text and use 15% opacity for background
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
    borderColor: optionColor,
    color: optionColor
  };
};

// Get arrow color classes
const getArrowColorClasses = (stage) => {
  const isActive = isStageActive(stage.value);
  const isCompleted = isStageCompleted(stage.value);
  
  // Only apply color if active or completed
  if (!isActive && !isCompleted) {
    return 'border-l-[8px] border-l-gray-100 dark:border-l-gray-700';
  }
  
  const optionColor = stage.color;
  if (!optionColor) {
    // No color - use blue for active/completed
    return 'border-l-[8px] border-l-blue-600';
  }
  
  // Custom color - return empty to use inline styles
  return '';
};

// Get arrow style based on stage color
const getArrowStyle = (stage) => {
  const isActive = isStageActive(stage.value);
  const isCompleted = isStageCompleted(stage.value);
  
  // Only apply color if active or completed
  if (!isActive && !isCompleted) {
    return {};
  }
  
  const optionColor = stage.color;
  if (!optionColor) {
    // No color - return empty (Tailwind classes handle it)
    return {};
  }
  
  // Apply the color to the arrow
  return {
    borderLeftColor: optionColor
  };
};

// Get arrow color classes for previous stage
const getArrowColorClassesForPrevious = (index) => {
  if (index === 0) {
    return 'border-r-[8px] border-r-gray-100 dark:border-r-gray-700';
  }
  const previousStage = stages.value[index - 1];
  const isActive = isStageActive(previousStage.value);
  const isCompleted = isStageCompleted(previousStage.value);
  
  // Only apply color if previous stage is active or completed
  if (!isActive && !isCompleted) {
    return 'border-r-[8px] border-r-gray-100 dark:border-r-gray-700';
  }
  
  const optionColor = previousStage.color;
  if (!optionColor) {
    // No color - use blue for active/completed
    return 'border-r-[8px] border-r-blue-600';
  }
  
  // Custom color - return empty to use inline styles
  return '';
};

// Get arrow style for previous stage
const getArrowStyleForPrevious = (index) => {
  if (index === 0) {
    return {};
  }
  const previousStage = stages.value[index - 1];
  const isActive = isStageActive(previousStage.value);
  const isCompleted = isStageCompleted(previousStage.value);
  
  // Only apply color if previous stage is active or completed
  if (!isActive && !isCompleted) {
    return {};
  }
  
  const optionColor = previousStage.color;
  if (!optionColor) {
    // No color - return empty (Tailwind classes handle it)
    return {};
  }
  
  // Apply the color to the arrow
  return {
    borderRightColor: optionColor
  };
};
</script>


