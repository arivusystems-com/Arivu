<template>
  <div>
    <!-- Trial Banner -->
    <div v-if="showTrialBanner" :class="[
      'flex items-center justify-between p-4 px-6 mb-8 rounded-xl border',
      trialDaysRemaining <= 3 
        ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800' 
        : 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'
    ]">
      <div class="flex items-center gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" :class="[
          'w-6 h-6',
          trialDaysRemaining <= 3 ? 'text-danger-600 dark:text-danger-400' : 'text-warning-600 dark:text-warning-400'
        ]">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p :class="[
            'font-semibold',
            trialDaysRemaining <= 3 ? 'text-danger-800 dark:text-danger-200' : 'text-warning-800 dark:text-warning-200'
          ]">
            <span v-if="trialDaysRemaining === 0">{{ t('dashboard.dashboardYourTrialExpiresToday') }}</span>
            <span v-else-if="trialDaysRemaining === 1">{{ t('dashboard.dashboardYourTrialExpiresIn1Day') }}</span>
            <span v-else>Your trial expires in {{ trialDaysRemaining }} days</span>
          </p>
          <p :class="[
            'text-sm mt-1',
            trialDaysRemaining <= 3 ? 'text-danger-700 dark:text-danger-300' : 'text-warning-700 dark:text-warning-300'
          ]">{{ t('dashboard.dashboardUpgradeNowToContinueUsingAll') }}</p>
        </div>
      </div>
      <button @click="navigateToUpgrade" :class="[
        'px-4 py-2 rounded-lg font-medium transition-colors',
        trialDaysRemaining <= 3 
          ? 'bg-danger-600 hover:bg-danger-700 text-white' 
          : 'bg-warning-600 hover:bg-warning-700 text-white'
      ]">{{ t('dashboard.dashboardUpgradeNow') }}</button>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Good {{ getTimeOfDay() }}, {{ userName }}! 👋</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">{{ t('dashboard.dashboardHeresWhatsHappeningWithYourBusiness') }}</p>
      </div>
      <div class="flex gap-3 mt-4 sm:mt-0">
        <!-- <button @click="$router.push('/contacts?action=new')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>{{ t('dashboard.dashboardAddContact') }}</button> -->
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('dashboard.dashboardTotalContacts2') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ contactStats.total || 0 }}</p>
          <p class="text-sm text-green-600 dark:text-green-400 font-medium" v-if="contactStats.newThisWeek > 0">
            +{{ contactStats.newThisWeek }} this week
          </p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('dashboard.dashboardActiveLeads') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ contactStats.leads || 0 }}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ contactStats.conversionRate || 0 }}% conversion</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('dashboard.dashboardCustomers') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ contactStats.customers || 0 }}</p>
          <p class="text-sm text-green-600 dark:text-green-400 font-medium" v-if="contactStats.newCustomers > 0">
            +{{ contactStats.newCustomers }} new
          </p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-7 h-7 text-white">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{{ t('dashboard.dashboardActivitiesToday') }}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ activityStats.today || 0 }}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ activityStats.pending || 0 }} pending</p>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <!-- Recent Contacts -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('dashboard.dashboardRecentContacts') }}</h2>
          <router-link to="/people" class="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">{{ t('dashboard.dashboardViewAll') }}</router-link>
        </div>
        
        <div v-if="loading" class="px-6 py-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p class="text-gray-600 dark:text-gray-400 mt-4">{{ t('dashboard.dashboardLoadingContacts') }}</p>
        </div>

        <div v-else-if="recentContacts.length === 0" class="px-6 py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400 mb-4">{{ t('dashboard.dashboardNoContactsYet') }}</p>
          <button @click="$router.push('/people')" class="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-medium transition-colors">{{ t('dashboard.dashboardAddYourFirstPerson') }}</button>
        </div>

        <div v-else class="px-6 py-4">
          <div class="flex flex-col gap-3">
            <div v-for="contact in recentContacts" :key="contact._id" 
              @click="viewContact(contact._id)"
              class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                {{ getInitials(contact) }}
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-gray-900 dark:text-white text-sm truncate">
                  {{ contact.first_name }} {{ contact.last_name }}
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-400 truncate">{{ contact.email }}</p>
              </div>
              <span :class="[
                'px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0',
                contact.lifecycle_stage?.toLowerCase() === 'lead' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                contact.lifecycle_stage?.toLowerCase() === 'customer' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              ]">
                {{ contact.lifecycle_stage || 'Lead' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Contact Growth Chart -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('dashboard.dashboardContactGrowth') }}</h2>
          <select v-model="chartPeriod" @change="fetchChartData" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm py-1 px-2 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <option value="7">{{ t('dashboard.dashboardLast7Days') }}</option>
            <option value="30">{{ t('dashboard.dashboardLast30Days') }}</option>
            <option value="90">{{ t('dashboard.dashboardLast90Days') }}</option>
          </select>
        </div>

        <div class="px-6 py-4">
          <div class="mb-4">
            <svg class="w-full h-[200px]" viewBox="0 0 400 200">
              <!-- Grid lines -->
              <line x1="40" y1="20" x2="40" y2="180" stroke="#e5e7eb" stroke-width="1"/>
              <line x1="40" y1="180" x2="380" y2="180" stroke="#e5e7eb" stroke-width="1"/>
              
              <!-- Y-axis labels -->
              <text x="30" y="25" text-anchor="end" font-size="10" fill="#9ca3af">{{ maxChartValue }}</text>
              <text x="30" y="105" text-anchor="end" font-size="10" fill="#9ca3af">{{ Math.floor(maxChartValue / 2) }}</text>
              <text x="30" y="185" text-anchor="end" font-size="10" fill="#9ca3af">0</text>
              
              <!-- Line chart -->
              <polyline
                :points="chartPoints"
                fill="none"
                stroke="#6049E7"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              
              <!-- Area fill -->
              <polygon
                :points="chartAreaPoints"
                fill="url(#gradient)"
                opacity="0.3"
              />
              
              <!-- Gradient definition -->
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:#6049E7;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#6049E7;stop-opacity:0" />
                </linearGradient>
              </defs>
              
              <!-- Data points -->
              <circle
                v-for="(point, index) in chartData"
                :key="index"
                :cx="40 + (index * (340 / (chartData.length - 1)))"
                :cy="180 - ((point.count / maxChartValue) * 160)"
                r="4"
                fill="#6049E7"
              />
            </svg>
          </div>

          <div class="flex items-center justify-center gap-6">
            <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span class="w-3 h-3 rounded-sm bg-indigo-500"></span>
              <span>{{ t('dashboard.dashboardTotalContacts') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('dashboard.dashboardQuickActions') }}</h2>
        </div>
        
        <div class="px-6 py-4">
          <div class="grid grid-cols-2 gap-4">
          <button @click="$router.push('/people?action=new')" class="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.dashboardAddPerson') }}</span>
            </button>

            <button @click="$router.push('/people?action=import')" class="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.dashboardImportPeople') }}</span>
            </button>

            <button @click="$router.push('/people')" class="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.dashboardSearchPeople') }}</span>
            </button>

            <button @click="exportContacts" class="flex flex-col items-center gap-3 p-6 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-white">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.dashboardExportData') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('dashboard.dashboardRecentActivity') }}</h2>
        </div>

        <div v-if="recentActivity.length === 0" class="px-6 py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-gray-600 dark:text-gray-400">{{ t('dashboard.dashboardNoRecentActivity') }}</p>
        </div>

        <div v-else class="px-6 py-4">
          <div class="flex flex-col gap-4">
            <div v-for="activity in recentActivity" :key="activity.id" class="flex gap-4 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div :class="[
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                activity.type === 'contact' ? 'bg-blue-50 dark:bg-blue-900/20' :
                activity.type === 'note' ? 'bg-warning-50 dark:bg-warning-900/20' :
                'bg-purple-50 dark:bg-purple-900/20'
              ]">
                <svg v-if="activity.type === 'contact'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" :class="[
                  'w-5 h-5',
                  activity.type === 'contact' ? 'text-blue-600 dark:text-blue-400' : ''
                ]">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <svg v-else-if="activity.type === 'note'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-warning-600 dark:text-warning-400">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5 text-purple-600 dark:text-purple-400">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div class="flex-1">
                <p class="text-sm text-gray-900 dark:text-white mb-1">{{ activity.text }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatTime(activity.time) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: 'DashboardView' });
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { formatUserDate } from '@/utils/localeFormat';

const router = useRouter();
const authStore = useAuthStore();
const { openTab } = useTabs();

// State
const loading = ref(true);
const recentContacts = ref([]);
const contactStats = ref({
  total: 0,
  leads: 0,
  customers: 0,
  newThisWeek: 0,
  newCustomers: 0,
  conversionRate: 0
});
const activityStats = ref({
  today: 0,
  pending: 0
});
const chartData = ref([]);
const chartPeriod = ref('30');
const recentActivity = ref([]);

// Trial info
const trialDaysRemaining = ref(0);
const showTrialBanner = computed(() => {
  return authStore.isTrialActive && trialDaysRemaining.value >= 0;
});

const userName = computed(() => {
  return authStore.user?.firstName || authStore.user?.username || 'there';
});

// Chart computations
const maxChartValue = computed(() => {
  if (chartData.value.length === 0) return 100;
  const max = Math.max(...chartData.value.map(d => d.count));
  return Math.ceil(max / 10) * 10 || 100;
});

const chartPoints = computed(() => {
  if (chartData.value.length === 0) return '';
  return chartData.value.map((point, index) => {
    const x = 40 + (index * (340 / (chartData.value.length - 1)));
    const y = 180 - ((point.count / maxChartValue.value) * 160);
    return `${x},${y}`;
  }).join(' ');
});

const chartAreaPoints = computed(() => {
  if (chartData.value.length === 0) return '';
  const points = chartPoints.value;
  const lastX = 40 + ((chartData.value.length - 1) * (340 / (chartData.value.length - 1)));
  return `${points} ${lastX},180 40,180`;
});

// Methods
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

const getInitials = (contact) => {
  return `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
};

const formatTime = (time) => {
  const date = new Date(time);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatUserDate(date);
};

const getTrialDaysRemaining = () => {
  if (authStore.organization?.subscription?.trialEndDate) {
    const endDate = new Date(authStore.organization.subscription.trialEndDate);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    trialDaysRemaining.value = Math.max(0, diffDays);
  }
};

const navigateToUpgrade = () => {
  router.push({ name: 'settings', query: { tab: 'subscription' } });
};

const fetchDashboardData = async () => {
  loading.value = true;
  
  try {
    // Fetch recent contacts
    const contactsData = await apiClient('/people?limit=5&sortBy=createdAt&sortOrder=desc', {
      method: 'GET'
    });
    
    if (contactsData.success) {
      recentContacts.value = contactsData.data;
      
      // Extract stats
      if (contactsData.statistics) {
        contactStats.value = {
          total: contactsData.statistics.totalContacts || 0,
          leads: contactsData.statistics.leadContacts || 0,
          customers: contactsData.statistics.customerContacts || 0,
          newThisWeek: contactsData.statistics.newThisWeek || 0,
          newCustomers: contactsData.statistics.newCustomers || 0,
          conversionRate: contactsData.statistics.conversionRate || 0
        };
      }
      
      // Generate activity feed
      recentActivity.value = recentContacts.value.slice(0, 5).map(contact => ({
        id: contact._id,
        type: 'contact',
        text: `New contact added: ${contact.first_name} ${contact.last_name}`,
        time: contact.createdAt
      }));
    }
    
    // Fetch chart data
    await fetchChartData();
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  } finally {
    loading.value = false;
  }
};

const fetchChartData = async () => {
  // Generate sample data for the chart
  // In production, this would come from an analytics API endpoint
  const days = parseInt(chartPeriod.value);
  const data = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: formatUserDate(date),
      count: Math.floor(Math.random() * 20) + contactStats.value.total / days
    });
  }
  
  chartData.value = data;
};

const exportContacts = async () => {
  try {
    const data = await apiClient('/people?limit=10000', {
      method: 'GET'
    });
    
    if (data.success) {
      const csv = [
        ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Stage', 'Status'].join(','),
        ...data.data.map(c => [
          c.first_name,
          c.last_name,
          c.email,
          c.phone || '',
          c.account_id?.name || '',
          c.lifecycle_stage,
          c.status
        ].map(field => `"${field}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts_${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error exporting contacts:', error);
  }
};

// Contact click handler to open in new tab
const viewContact = (contactId) => {
  const contact = recentContacts.value.find(c => c._id === contactId);
  const title = contact 
    ? `${contact.first_name} ${contact.last_name}` 
    : 'Contact Detail';
  
  openTab(`/people/${contactId}`, {
    title,
    icon: 'users',
    params: { name: title },
    insertAdjacent: true
  });
};

// Lifecycle
onMounted(() => {
  getTrialDaysRemaining();
  fetchDashboardData();
});
</script>

