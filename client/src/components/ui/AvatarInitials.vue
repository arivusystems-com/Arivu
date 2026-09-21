<template>
  <div class="flex-shrink-0 overflow-hidden rounded-full">
    <img
      v-if="resolvedAvatar"
      :src="resolvedAvatar"
      :alt="displayName"
      class="object-cover rounded-full"
      :class="sizeClass"
    />
    <div
      v-else
      :class="['flex items-center justify-center font-medium rounded-full', colorClasses.bg, colorClasses.text, sizeClass]"
    >
      {{ initials }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { getApiUrlForFetch } from '@/config/apiBase';

const props = defineProps({
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: null
  },
  size: {
    type: String,
    default: 'md', // 'sm', 'md', 'lg', 'xl'
    validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
  }
});

const { t } = useI18n();

// Size mapping
const sizeClass = computed(() => {
  const sizes = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl'
  };
  return sizes[props.size] || sizes.md;
});

const resolvedAvatar = computed(() => {
  const url = String(props.avatar || '').trim();
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

// Get initials (first letter of first name + first letter of last name)
const initials = computed(() => {
  const first = props.firstName?.trim()?.[0]?.toUpperCase() || '';
  const last = props.lastName?.trim()?.[0]?.toUpperCase() || '';

  if (first && last) {
    return `${first}${last}`;
  }
  if (first) {
    return first;
  }
  const username = props.username?.trim() || '';
  if (username) {
    const seg = username.split(/[^a-z0-9]/i).filter(Boolean);
    if (seg.length >= 2) return (seg[0][0] + seg[1][0]).toUpperCase();
    return (seg[0]?.slice(0, 2) || 'U').toUpperCase();
  }
  if (props.email) {
    return props.email[0].toUpperCase();
  }
  return '?';
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

// Get color classes based on first letter of name
const colorClasses = computed(() => {
  const firstLetter = props.firstName?.trim()?.[0]?.toUpperCase() || 
                      props.lastName?.trim()?.[0]?.toUpperCase() ||
                      props.email?.[0]?.toUpperCase() || '?';
  return getColorForLetter(firstLetter);
});

// Get display name for alt text
const displayName = computed(() => {
  const name = [props.firstName, props.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (props.email) return props.email;
  return 'Person';
});
</script>

