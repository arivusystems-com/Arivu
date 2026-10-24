<template>
  <div class="flex-shrink-0">
    <img
      v-if="resolvedAvatar"
      :src="resolvedAvatar"
      :alt="getDisplayName(recordObj)"
      class="object-cover rounded-lg"
      :class="sizeClass"
    />
    <div
      v-else
      :class="['flex items-center justify-center font-medium rounded-lg', colorClasses.bg, colorClasses.text, sizeClass]"
    >
      <component v-if="icon" :is="icon" :class="iconSizeClass" />
      <UserIcon v-else-if="!displayInitials" :class="iconSizeClass" />
      <span v-else>{{ displayInitials }}</span>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'UserAvatar' });
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { UserIcon } from '@heroicons/vue/24/outline';
import { getApiUrlForFetch } from '@/config/apiBase';

const props = defineProps({
  user: {
    type: Object,
    required: false
  },
  record: {
    type: Object,
    required: false
  },
  size: {
    type: String,
    default: 'md', // 'sm', 'md', 'lg'
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  },
  icon: {
    type: [Object, Function],
    required: false,
    default: null
  }
});

const { t } = useI18n();

// Determine which record object to use (user prop or record prop)
const recordObj = computed(() => props.user || props.record);

const resolvedAvatar = computed(() => {
  const url = String(recordObj.value?.avatar || '').trim();
  if (!url) return '';
  if (
    url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('data:')
    || url.startsWith('blob:')
  ) {
    return url;
  }
  return getApiUrlForFetch(url);
});

// Size mapping
const sizeClass = computed(() => {
  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-xl'
  };
  return sizes[props.size] || sizes.md;
});

const iconSizeClass = computed(() => {
  const sizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };
  return sizes[props.size] || sizes.md;
});

// Color mapping for alphabets A-Z
const getColorForLetter = (letter) => {
  const colors = {
    'A': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
    'B': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300' },
    'C': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
    'D': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300' },
    'E': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-700 dark:text-lime-300' },
    'F': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300' },
    'G': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
    'H': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-700 dark:text-teal-300' },
    'I': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-300' },
    'J': { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-700 dark:text-sky-300' },
    'K': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
    'L': { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
    'M': { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-300' },
    'N': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
    'O': { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
    'P': { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300' },
    'Q': { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-300' },
    'R': { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' },
    'S': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
    'T': { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
    'U': { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
    'V': { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-800 dark:text-lime-200' },
    'W': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
    'X': { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-800 dark:text-emerald-200' },
    'Y': { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
    'Z': { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-800 dark:text-cyan-200' }
  };
  return colors[letter.toUpperCase()] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };
};

const displayInitials = computed(() => {
  const record = recordObj.value;
  if (!record) return '';

  if (record.initials) return String(record.initials).trim().toUpperCase();

  const first = String(record.firstName || record.first_name || '').trim();
  const last = String(record.lastName || record.last_name || '').trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first.length >= 2) return first.slice(0, 2).toUpperCase();
  if (first) return first[0].toUpperCase();
  if (last.length >= 2) return last.slice(0, 2).toUpperCase();
  if (last) return last[0].toUpperCase();

  if (record.username) return String(record.username).trim().slice(0, 2).toUpperCase();

  const full = String(record.name || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  const email = String(record.email || '').trim();
  if (email) {
    const local = email.split('@')[0] || '';
    const parts = local.replace(/[._+-]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local) return local[0].toUpperCase();
  }

  return '';
});

// Get color classes
const colorClasses = computed(() => {
  const letter = displayInitials.value[0];
  if (letter) return getColorForLetter(letter);
  return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400' };
});

// Get display name for alt text
const getDisplayName = (obj) => {
  const record = recordObj.value;
  
  // Try user fields first
  const name = [record.firstName || record.first_name, record.lastName || record.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (name) return name;
  if (record.username) return record.username;
  if (record.email) return record.email;
  
  // Try module record fields
  if (record.name) return record.name;
  
  return record._id || 'User';
};
</script>

