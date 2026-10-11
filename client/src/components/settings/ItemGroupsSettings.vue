<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.itemGroupsDesc') }}</p>
        <p v-if="groups.length && !loading" class="mt-1 text-xs text-gray-400">
          {{ t('settings.itemGroupListSummaryStats', {
            groups: groups.length,
            generated: totalGenerated,
            expected: totalExpected
          }) }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.itemGroupAdd') }}
      </button>
    </div>

    <div
      v-if="message"
      class="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      <span>{{ message }}</span>
      <button type="button" class="shrink-0 text-emerald-600 hover:text-emerald-900 dark:text-emerald-300" :aria-label="t('actions.close')" @click="message = ''">×</button>
    </div>
    <div
      v-if="error"
      class="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
    >
      <span>{{ error }}</span>
      <button type="button" class="shrink-0 text-red-500 hover:text-red-800 dark:text-red-300" :aria-label="t('actions.close')" @click="error = ''">×</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div
      v-else-if="!groups.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
    >
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.itemGroupsEmpty') }}</p>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.itemGroupsEmptyHint') }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.itemGroupAdd') }}
      </button>
    </div>

    <template v-else>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label class="relative block max-w-md flex-1">
          <span class="sr-only">{{ t('settings.itemGroupSearch') }}</span>
          <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('settings.itemGroupSearch')"
            class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <p class="text-xs text-gray-400 sm:text-right">
          {{ t('settings.itemGroupShowingCount', { shown: filteredGroups.length, total: groups.length }) }}
        </p>
      </div>

      <div
        v-if="!filteredGroups.length"
        class="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600"
      >
        {{ t('settings.itemGroupSearchEmpty') }}
      </div>

      <ul v-else class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40">
        <li
          v-for="g in filteredGroups"
          :key="g._id"
          class="group/row"
        >
          <div class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-800/60">
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openPreview(g)"
            >
              <!-- Primary: name + one lifecycle signal -->
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ g.name }}</span>
                <span
                  v-if="g.status && g.status !== 'ACTIVE'"
                  class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  :class="statusClass(g.status)"
                >
                  {{ statusLabel(g.status) }}
                </span>
                <span
                  class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                  :class="generationStateClass(generationOf(g).state)"
                  :title="generationStateLabel(generationOf(g))"
                >
                  {{ generationOf(g).generated }}/{{ generationOf(g).expected }}
                </span>
                <span
                  v-if="generationOf(g).state === 'partial'"
                  class="text-[11px] text-amber-700 dark:text-amber-300"
                >
                  {{ t('settings.itemGroupMissingShort', { count: generationOf(g).missing }) }}
                </span>
              </div>

              <!-- Secondary: attributes as quiet meta -->
              <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400" :title="attrsLineTitle(g)">
                <template v-if="(g.attributes || []).length">
                  {{ attrsLine(g) }}
                </template>
                <span v-else class="italic">{{ t('settings.itemGroupNoAttributes') }}</span>
              </p>
              <p
                v-if="generationOf(g).orphans > 0"
                class="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400"
              >
                {{ t('settings.itemGroupOrphansHint', { count: generationOf(g).orphans }) }}
              </p>
            </button>

            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                :disabled="previewLoadingId === g._id"
                @click.stop="openPreview(g)"
              >
                {{ previewLoadingId === g._id ? t('states.loading') : t('settings.itemGroupPreview') }}
              </button>
              <button
                v-if="canGenerate(g)"
                type="button"
                class="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="generateLoadingId === g._id"
                :title="generateBtnTitle(generationOf(g))"
                @click.stop="generate(g)"
              >
                {{ generateLoadingId === g._id ? t('states.loading') : generateBtnLabel(generationOf(g)) }}
              </button>
              <span
                v-else-if="generationOf(g).state === 'complete'"
                class="px-2.5 py-1.5 text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80"
                :title="t('settings.itemGroupAllGeneratedHint')"
              >
                {{ t('settings.itemGroupAllGenerated') }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </template>

    <!-- Create / builder dialog -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
        @click.self="closeForm"
        @keydown.esc="closeForm"
      >
        <form
          class="flex max-h-[min(92vh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          @submit.prevent="save(false)"
        >
          <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.itemGroupAdd') }}</h3>
              <p class="mt-0.5 text-xs text-gray-500">{{ t('settings.itemGroupBuilderDesc') }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              :aria-label="t('actions.cancel')"
              @click="closeForm"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-gray-200 overflow-hidden lg:grid-cols-2 lg:divide-x lg:divide-y-0 dark:divide-gray-700">
            <!-- Builder -->
            <div class="min-h-0 space-y-4 overflow-y-auto p-5">
              <label class="block text-sm">
                <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.itemGroupName') }}</span>
                <input
                  v-model="form.name"
                  required
                  autofocus
                  :placeholder="t('settings.itemGroupNamePlaceholder')"
                  class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </label>

              <div>
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.itemGroupAttributes') }}</p>
                    <p class="text-xs text-gray-500">{{ t('settings.itemGroupAttributesHint') }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    @click="addAttribute"
                  >
                    {{ t('settings.itemGroupAddAttribute') }}
                  </button>
                </div>

                <div v-if="!form.attributes.length" class="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-600">
                  {{ t('settings.itemGroupAttributesEmpty') }}
                </div>

                <ul class="mt-3 space-y-3">
                  <li
                    v-for="(attr, ai) in form.attributes"
                    :key="attr.uid"
                    class="rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-900/40"
                  >
                    <div class="flex items-start gap-2">
                      <div class="min-w-0 flex-1 space-y-2">
                        <input
                          v-model="attr.name"
                          :placeholder="t('settings.itemGroupAttrNamePlaceholder')"
                          class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          @keydown.enter.prevent
                        />
                        <div
                          class="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2 py-1.5 dark:border-gray-600 dark:bg-gray-700"
                          @click="focusValueInput(ai)"
                        >
                          <span
                            v-for="(val, vi) in attr.values"
                            :key="`${attr.uid}-${val}-${vi}`"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                          >
                            {{ val }}
                            <button
                              type="button"
                              class="rounded text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-100"
                              :aria-label="t('settings.itemGroupRemoveValue')"
                              @click.stop="removeValue(ai, vi)"
                            >
                              ×
                            </button>
                          </span>
                          <input
                            :ref="(el) => setValueInputRef(ai, el)"
                            v-model="attr.draft"
                            type="text"
                            :placeholder="attr.values.length ? t('settings.itemGroupValueAddMore') : t('settings.itemGroupValuePlaceholder')"
                            class="min-w-[7rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                            @keydown="onValueKeydown($event, ai)"
                            @blur="commitDraft(ai)"
                          />
                        </div>
                        <p class="text-[11px] text-gray-400">{{ t('settings.itemGroupValueChipHint') }}</p>
                      </div>
                      <div class="flex flex-col gap-1 pt-0.5">
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700"
                          :disabled="ai === 0"
                          :title="t('settings.itemGroupMoveUp')"
                          @click="moveAttribute(ai, -1)"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700"
                          :disabled="ai === form.attributes.length - 1"
                          :title="t('settings.itemGroupMoveDown')"
                          @click="moveAttribute(ai, 1)"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600"
                          :title="t('settings.itemGroupRemoveAttribute')"
                          @click="removeAttribute(ai)"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Live preview -->
            <div class="flex min-h-0 flex-col bg-slate-50/80 dark:bg-gray-900/50">
              <div class="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.itemGroupLivePreview') }}</p>
                  <p class="text-xs text-gray-500">{{ t('settings.itemGroupLivePreviewHint') }}</p>
                </div>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
                  :class="previewBadgeClass"
                >
                  {{ t('settings.itemGroupVariantCount', { count: livePreview.count }) }}
                </span>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto p-5">
                <div
                  v-if="!livePreview.count"
                  class="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 text-center dark:border-gray-600"
                >
                  <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('settings.itemGroupPreviewEmpty') }}</p>
                  <p class="mt-1 text-xs text-gray-400">{{ t('settings.itemGroupPreviewEmptyHint') }}</p>
                </div>

                <div v-else class="space-y-3">
                  <p
                    v-if="livePreview.count >= VARIANT_WARN"
                    class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200"
                  >
                    {{ t('settings.itemGroupVariantWarn', { count: livePreview.count }) }}
                  </p>
                  <p
                    v-if="livePreview.count >= VARIANT_HARD_CAP"
                    class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300"
                  >
                    {{ t('settings.itemGroupVariantCap', { max: VARIANT_HARD_CAP }) }}
                  </p>

                  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <table class="min-w-full text-left text-xs">
                      <thead class="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-900/60">
                        <tr>
                          <th class="px-3 py-2">#</th>
                          <th class="px-3 py-2">{{ t('settings.itemGroupVariantName') }}</th>
                          <th class="px-3 py-2">{{ t('settings.itemGroupVariantAttrs') }}</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                        <tr
                          v-for="(row, idx) in livePreview.visible"
                          :key="row.key"
                          class="text-gray-800 dark:text-gray-100"
                        >
                          <td class="px-3 py-2 tabular-nums text-gray-400">{{ idx + 1 }}</td>
                          <td class="px-3 py-2 font-medium">{{ row.name }}</td>
                          <td class="px-3 py-2 text-gray-500 dark:text-gray-400">
                            <span
                              v-for="(a, i) in row.attributes"
                              :key="`${row.key}-${a.name}`"
                            >
                              <span v-if="i"> · </span>
                              <span class="text-gray-400">{{ a.name }}:</span> {{ a.value }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p
                    v-if="livePreview.count > PREVIEW_TABLE_LIMIT"
                    class="text-center text-xs text-gray-500"
                  >
                    {{ t('settings.itemGroupPreviewMore', {
                      shown: PREVIEW_TABLE_LIMIT,
                      total: livePreview.count
                    }) }}
                  </p>
                  <p class="text-center text-[11px] text-gray-400">
                    {{ t('settings.itemGroupNameFormula') }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3.5 dark:border-gray-700">
            <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>
            <span v-else class="text-xs text-gray-400">{{ t('settings.itemGroupSaveNote') }}</span>
            <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
              <button type="button" class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700" @click="closeForm">
                {{ t('actions.cancel') }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-indigo-200 px-3.5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                :disabled="saving || !canSave"
                @click="save(true)"
              >
                {{ saving && saveAndGenerate ? t('states.loading') : t('settings.itemGroupSaveAndGenerate') }}
              </button>
              <button
                type="submit"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="saving || !canSave"
              >
                {{ saving && !saveAndGenerate ? t('states.loading') : t('actions.save') }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Teleport>

    <!-- Saved-group preview dialog -->
    <Teleport to="body">
      <div
        v-if="showPreviewPanel"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
        @click.self="closePreviewPanel"
        @keydown.esc="closePreviewPanel"
      >
        <div class="flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">
          <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('settings.itemGroupPreviewTitle', { name: previewGroup?.name || '' }) }}
              </h3>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  :class="generationStateClass(previewData.generation?.state || 'none')"
                >
                  {{ generationStateLabel(previewData.generation || { state: 'none', generated: 0, expected: previewData.count }) }}
                </span>
                <span class="tabular-nums">
                  {{ t('settings.itemGroupGeneratedRatio', {
                    generated: previewData.generation?.generated ?? 0,
                    expected: previewData.generation?.expected ?? previewData.count
                  }) }}
                </span>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="closePreviewPanel"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-5">
            <div v-if="previewLoadingId" class="flex justify-center py-10">
              <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
            </div>
            <div v-else-if="!previewData.variants.length" class="py-8 text-center text-sm text-gray-500">
              {{ t('settings.itemGroupPreviewEmpty') }}
            </div>
            <div v-else class="space-y-3">
              <div class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  class="h-full rounded-full transition-all"
                  :class="generationBarClass(previewData.generation?.state || 'none')"
                  :style="{ width: generationPct(previewData.generation || { generated: 0, expected: previewData.count }) + '%' }"
                />
              </div>
              <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <table class="min-w-full text-left text-sm">
                  <thead class="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900/60">
                    <tr>
                      <th class="px-3 py-2">#</th>
                      <th class="px-3 py-2">{{ t('settings.itemGroupVariantName') }}</th>
                      <th class="px-3 py-2">{{ t('settings.itemGroupVariantAttrs') }}</th>
                      <th class="px-3 py-2">{{ t('settings.itemGroupVariantStatus') }}</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                    <tr
                      v-for="(row, idx) in previewData.variants"
                      :key="row.key"
                      :class="row.exists ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''"
                    >
                      <td class="px-3 py-2 tabular-nums text-gray-400">{{ idx + 1 }}</td>
                      <td class="px-3 py-2 font-medium text-gray-900 dark:text-white">{{ row.name }}</td>
                      <td class="px-3 py-2 text-xs text-gray-500">
                        <span v-for="(a, i) in row.attributes" :key="`${row.key}-${a.name}`">
                          <span v-if="i"> · </span>{{ a.name }}: {{ a.value }}
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <span
                          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          :class="row.exists
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-200'"
                        >
                          {{ row.exists ? t('settings.itemGroupVariantExists') : t('settings.itemGroupVariantPending') }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <button type="button" class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300" @click="closePreviewPanel">
              {{ t('actions.close') }}
            </button>
            <button
              v-if="previewGroup && canGenerate(previewGroup)"
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="generateLoadingId === previewGroup._id"
              @click="generateFromPreview"
            >
              {{ generateBtnLabel(generationOf(previewGroup)) }}
            </button>
            <span
              v-else-if="previewGroup && generationOf(previewGroup).state === 'complete'"
              class="text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              {{ t('settings.itemGroupAllGenerated') }}
            </span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Teleport } from 'vue';
import apiClient from '@/utils/apiClient';
import { confirmAction } from '@/composables/useConfirmAction';

const PREVIEW_TABLE_LIMIT = 20;
const VARIANT_WARN = 50;
const VARIANT_HARD_CAP = 500;
const ATTR_VALUE_PREVIEW = 3;

const { t } = useI18n();
const groups = ref([]);
const loading = ref(false);
const error = ref('');
const message = ref('');
const formError = ref('');
const searchQuery = ref('');
const showForm = ref(false);
const saving = ref(false);
const saveAndGenerate = ref(false);
const previewLoadingId = ref(null);
const generateLoadingId = ref(null);
const showPreviewPanel = ref(false);
const previewGroup = ref(null);
const previewData = reactive({ count: 0, variants: [], generation: null });

let uidSeq = 0;
function nextUid() {
  uidSeq += 1;
  return `attr-${uidSeq}`;
}

function emptyAttr(seed = {}) {
  return {
    uid: nextUid(),
    name: seed.name || '',
    values: Array.isArray(seed.values) ? [...seed.values] : [],
    draft: ''
  };
}

const form = reactive({
  name: '',
  attributes: []
});

const valueInputRefs = {};

function setValueInputRef(ai, el) {
  if (el) valueInputRefs[ai] = el;
  else delete valueInputRefs[ai];
}

function focusValueInput(ai) {
  const el = valueInputRefs[ai];
  if (el && typeof el.focus === 'function') el.focus();
}

function cartesian(attrs) {
  const variantAttrs = (attrs || []).filter(
    (a) => a && String(a.name || '').trim() && Array.isArray(a.values) && a.values.length
  );
  if (!variantAttrs.length) return [];
  return variantAttrs.reduce(
    (acc, attr) => {
      const next = [];
      const name = String(attr.name).trim();
      for (const combo of acc) {
        for (const val of attr.values) {
          next.push([...combo, { name, value: val }]);
        }
      }
      return next;
    },
    [[]]
  );
}

function comboKey(combo) {
  return (combo || [])
    .map((c) => ({ name: String(c?.name || '').trim(), value: String(c?.value ?? '').trim() }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('|');
}

function comboLabel(groupName, combo) {
  const base = String(groupName || '').trim() || t('settings.itemGroupUntitled');
  if (!combo.length) return base;
  return `${base} - ${combo.map((c) => c.value).join(' - ')}`;
}

function buildPreview(name, attributes) {
  const combos = cartesian(attributes);
  const variants = combos.map((combo) => ({
    key: comboKey(combo),
    name: comboLabel(name, combo),
    attributes: combo,
    exists: false
  }));
  return {
    count: variants.length,
    variants,
    visible: variants.slice(0, PREVIEW_TABLE_LIMIT)
  };
}

function localGeneration(g) {
  const expected = buildPreview(g?.name, g?.attributes || []).count;
  return {
    expected,
    generated: 0,
    missing: expected,
    orphans: 0,
    itemsLinked: 0,
    state: expected === 0 ? 'empty' : 'none'
  };
}

function generationOf(g) {
  const gen = g?.generation;
  if (gen && typeof gen.expected === 'number') {
    return {
      expected: gen.expected,
      generated: gen.generated ?? 0,
      missing: gen.missing ?? Math.max(0, (gen.expected || 0) - (gen.generated || 0)),
      orphans: gen.orphans ?? 0,
      itemsLinked: gen.itemsLinked ?? 0,
      state: gen.state || (gen.expected === 0 ? 'empty' : gen.generated >= gen.expected ? 'complete' : gen.generated > 0 ? 'partial' : 'none')
    };
  }
  return localGeneration(g);
}

function generationPct(gen) {
  const expected = gen?.expected || 0;
  if (!expected) return 0;
  return Math.min(100, Math.round(((gen.generated || 0) / expected) * 100));
}

function generationStateClass(state) {
  if (state === 'complete') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (state === 'partial') return 'bg-amber-50 text-amber-800 dark:bg-amber-900/25 dark:text-amber-200';
  if (state === 'empty') return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
}

function generationDotClass(state) {
  if (state === 'complete') return 'bg-emerald-500';
  if (state === 'partial') return 'bg-amber-500';
  return 'bg-gray-400';
}

function generationBarClass(state) {
  if (state === 'complete') return 'bg-emerald-500';
  if (state === 'partial') return 'bg-amber-500';
  return 'bg-indigo-400';
}

function generationBadgeShell(state) {
  if (state === 'complete') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/25 dark:text-emerald-200';
  }
  if (state === 'partial') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/25 dark:text-amber-200';
  }
  return 'border-indigo-100 bg-indigo-50/80 text-indigo-800 dark:border-indigo-800/50 dark:bg-indigo-900/25 dark:text-indigo-200';
}

function generationStateLabel(gen) {
  if (gen.state === 'complete') return t('settings.itemGroupGenStateComplete');
  if (gen.state === 'partial') return t('settings.itemGroupGenStatePartial');
  if (gen.state === 'empty') return t('settings.itemGroupGenStateEmpty');
  return t('settings.itemGroupGenStateNone');
}

function canGenerate(g) {
  const gen = generationOf(g);
  return gen.expected > 0 && gen.missing > 0;
}

function generateBtnLabel(gen) {
  if (gen.state === 'complete') return t('settings.itemGroupAllGenerated');
  if (gen.state === 'partial') return t('settings.itemGroupGenerateMissing', { count: gen.missing });
  return t('settings.itemGroupGenerate');
}

function generateBtnTitle(gen) {
  if (gen.state === 'complete') return t('settings.itemGroupAllGeneratedHint');
  if (gen.missing > 0) return t('settings.itemGroupGenerateMissingHint', { count: gen.missing });
  return '';
}

function generateBtnClass(gen) {
  if (gen.state === 'complete') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30';
}

function toApiAttributes(attrs) {
  return (attrs || [])
    .map((a, idx) => ({
      name: String(a.name || '').trim(),
      values: [...new Set((a.values || []).map((v) => String(v).trim()).filter(Boolean))],
      isVariantAttribute: true,
      required: true,
      displayOrder: idx
    }))
    .filter((a) => a.name && a.values.length);
}

const livePreview = computed(() => buildPreview(form.name, form.attributes));

const canSave = computed(() => {
  const name = String(form.name || '').trim();
  const attrs = toApiAttributes(form.attributes);
  return Boolean(name) && attrs.length > 0 && livePreview.value.count > 0 && livePreview.value.count <= VARIANT_HARD_CAP;
});

const previewBadgeClass = computed(() => {
  const n = livePreview.value.count;
  if (n <= 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300';
  if (n >= VARIANT_HARD_CAP) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (n >= VARIANT_WARN) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200';
});

const totalExpected = computed(() =>
  groups.value.reduce((sum, g) => sum + generationOf(g).expected, 0)
);
const totalGenerated = computed(() =>
  groups.value.reduce((sum, g) => sum + generationOf(g).generated, 0)
);

const filteredGroups = computed(() => {
  const q = String(searchQuery.value || '').trim().toLowerCase();
  if (!q) return groups.value;
  return groups.value.filter((g) => {
    const gen = generationOf(g);
    const hay = [
      g.name,
      g.code,
      g.brand,
      g.category,
      g.status,
      gen.state,
      ...(g.attributes || []).flatMap((a) => [a.name, ...(a.values || [])])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
});

function statusClass(status) {
  return status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

function statusLabel(status) {
  if (status === 'ACTIVE') return t('settings.itemGroupStatusActive');
  if (status === 'INACTIVE') return t('settings.itemGroupStatusInactive');
  return status || '—';
}

function groupSubtitle(g) {
  return [g.brand, g.category].filter(Boolean).join(' · ');
}

function formatAttrValues(attr) {
  const values = (attr.values || []).filter(Boolean);
  if (!values.length) return '—';
  const shown = values.slice(0, ATTR_VALUE_PREVIEW);
  const extra = values.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
}

function attrValuesTitle(attr) {
  return (attr.values || []).filter(Boolean).join(', ');
}

function attrsLine(g) {
  const attrs = g.attributes || [];
  return attrs
    .slice(0, 3)
    .map((a) => {
      const vals = formatAttrValues(a);
      return `${a.name}: ${vals}`;
    })
    .join(' · ') + (attrs.length > 3 ? ` · +${attrs.length - 3}` : '');
}

function attrsLineTitle(g) {
  return (g.attributes || [])
    .map((a) => `${a.name}: ${(a.values || []).join(', ')}`)
    .join('\n');
}

function matrixLabel(g) {
  const sizes = (g.attributes || [])
    .map((a) => (Array.isArray(a.values) ? a.values.length : 0))
    .filter((n) => n > 0);
  if (!sizes.length) return '';
  return sizes.join(' × ');
}

function patchGroupGeneration(groupId, generation) {
  if (!groupId || !generation) return;
  const id = String(groupId);
  groups.value = groups.value.map((g) =>
    String(g._id) === id ? { ...g, generation } : g
  );
  if (previewGroup.value && String(previewGroup.value._id) === id) {
    previewGroup.value = { ...previewGroup.value, generation };
  }
}

function openCreate() {
  form.name = '';
  form.attributes = [emptyAttr()];
  formError.value = '';
  saveAndGenerate.value = false;
  showForm.value = true;
}

function closeForm() {
  if (saving.value) return;
  showForm.value = false;
  formError.value = '';
}

function addAttribute() {
  form.attributes.push(emptyAttr());
}

function removeAttribute(index) {
  form.attributes.splice(index, 1);
}

function moveAttribute(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= form.attributes.length) return;
  const list = form.attributes;
  const [row] = list.splice(index, 1);
  list.splice(next, 0, row);
}

function commitDraft(ai, { clear = true } = {}) {
  const attr = form.attributes[ai];
  if (!attr) return;
  const raw = String(attr.draft || '');
  const parts = raw.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
  if (!parts.length) return;
  for (const p of parts) {
    if (!attr.values.some((v) => v.toLowerCase() === p.toLowerCase())) {
      attr.values.push(p);
    }
  }
  if (clear) attr.draft = '';
}

function onValueKeydown(event, ai) {
  const attr = form.attributes[ai];
  if (!attr) return;
  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
    event.preventDefault();
    commitDraft(ai);
    return;
  }
  if (event.key === 'Backspace' && !attr.draft && attr.values.length) {
    attr.values.pop();
  }
}

function removeValue(ai, vi) {
  const attr = form.attributes[ai];
  if (!attr) return;
  attr.values.splice(vi, 1);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/item-groups');
    groups.value = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    loading.value = false;
  }
}

async function save(alsoGenerate) {
  formError.value = '';
  error.value = '';
  message.value = '';
  if (!canSave.value) {
    formError.value = t('settings.itemGroupSaveInvalid');
    return;
  }
  saving.value = true;
  saveAndGenerate.value = Boolean(alsoGenerate);
  try {
    const res = await apiClient.post('/item-groups', {
      name: String(form.name).trim(),
      attributes: toApiAttributes(form.attributes)
    });
    const created = res?.data || res;
    showForm.value = false;
    await load();
    if (alsoGenerate && created?._id) {
      await generate({ _id: created._id, name: created.name, generation: created.generation }, { skipConfirm: true });
    } else {
      message.value = t('settings.itemGroupSaved');
    }
  } catch (err) {
    formError.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    saving.value = false;
    saveAndGenerate.value = false;
  }
}

async function openPreview(g) {
  error.value = '';
  message.value = '';
  previewGroup.value = g;
  previewData.count = 0;
  previewData.variants = [];
  previewData.generation = generationOf(g);
  showPreviewPanel.value = true;
  previewLoadingId.value = g._id;
  try {
    const res = await apiClient.post(`/item-groups/${g._id}/preview`);
    const payload = res?.data || res || {};
    previewData.count = payload.count || 0;
    previewData.variants = Array.isArray(payload.variants) ? payload.variants : [];
    if (payload.generation) {
      previewData.generation = payload.generation;
      patchGroupGeneration(g._id, payload.generation);
    }
    if (!previewData.variants.length && previewData.count) {
      const local = buildPreview(g.name, g.attributes || []);
      previewData.variants = local.variants;
      previewData.count = local.count;
    }
  } catch (err) {
    const local = buildPreview(g.name, g.attributes || []);
    previewData.count = local.count;
    previewData.variants = local.variants;
    previewData.generation = generationOf(g);
    if (!local.count) {
      error.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
      showPreviewPanel.value = false;
    }
  } finally {
    previewLoadingId.value = null;
  }
}

function closePreviewPanel() {
  showPreviewPanel.value = false;
  previewGroup.value = null;
}

async function generateFromPreview() {
  const g = previewGroup.value;
  if (!g) return;
  await generate(g);
  if (previewGroup.value) {
    await openPreview(groups.value.find((x) => String(x._id) === String(g._id)) || g);
  }
}

async function generate(g, { skipConfirm = false } = {}) {
  error.value = '';
  message.value = '';
  const gen = generationOf(g);
  if (!gen.expected) {
    error.value = t('settings.itemGroupGenerateEmpty');
    return;
  }
  if (gen.missing <= 0) {
    message.value = t('settings.itemGroupAlreadyComplete', {
      generated: gen.generated,
      expected: gen.expected
    });
    return;
  }
  if (!skipConfirm) {
    const ok = await confirmAction(
      t('settings.itemGroupGenerateConfirmMissing', {
        name: g.name || '',
        missing: gen.missing,
        expected: gen.expected
      })
    );
    if (!ok) return;
  }
  generateLoadingId.value = g._id;
  try {
    const res = await apiClient.post(`/item-groups/${g._id}/generate`);
    const payload = res?.data || res || {};
    const createdCount = payload.createdCount ?? 0;
    const skippedCount = payload.skippedCount ?? 0;
    if (payload.generation) {
      patchGroupGeneration(g._id, payload.generation);
      previewData.generation = payload.generation;
    } else {
      await load();
    }
    if (createdCount > 0 && skippedCount > 0) {
      message.value = t('settings.itemGroupGenerateResultMixed', {
        created: createdCount,
        skipped: skippedCount
      });
    } else if (createdCount > 0) {
      message.value = t('settings.itemGroupGenerateResult', { count: createdCount });
    } else {
      message.value = t('settings.itemGroupAlreadyComplete', {
        generated: payload.generation?.generated ?? gen.generated,
        expected: payload.generation?.expected ?? gen.expected
      });
    }
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('states.genericFailure');
  } finally {
    generateLoadingId.value = null;
  }
}

onMounted(load);
</script>
