<template>
  <div>
    <div class="flex items-start justify-between gap-3">
      <label 
        :for="field.key" 
        class="block text-sm font-normal text-gray-700 dark:text-gray-300"
      >
        {{ effectiveLabel }}
        <span v-if="isRequired" class="text-red-500">*</span>
      </label>

      <!-- Explicit action only: never auto-assign -->
      <button
        v-if="showAssignToMe"
        type="button"
        class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
        @click="assignReviewerToMe"
      >
        {{ t('common.formAssignToMe') }}
      </button>
    </div>

    <p v-if="helperText" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ helperText }}
    </p>
    
    <!-- Tags: key must win before Text — Tasks module historically inferred tags[] as Text in /modules -->
    <div v-if="isTagsField" class="mt-2">
      <FormTagsField
        :model-value="Array.isArray(value) ? value : []"
        :module-key="moduleKey"
        :disabled="isReadOnly"
        :placeholder="field.placeholder || `Select ${displayLabel}...`"
        @update:model-value="updateValue($event)"
        @blur="$emit('blur')"
      />
    </div>
    
    <!-- Event location: address search + geo pin -->
    <div v-else-if="isEventLocationField" class="mt-2">
      <EventLocationField
        :location="String(value || '')"
        :geo-location="eventFormGeoLocation"
        :geo-required="eventGeoRequired"
        :related-to-id="eventRelatedToId"
        :disabled="isReadOnly"
        :error="localValidationError || errors[field.key] || null"
        :input-id="field.key"
        :placeholder="field.placeholder || t('events.eventLocationSearchPlaceholder')"
        @update:location="updateValue($event)"
        @update:geo-location="onEventGeoLocationUpdate"
      />
    </div>

    <!-- Event conference provider: Meet / Teams / Zoom -->
    <div v-else-if="isEventConferenceProviderField" class="mt-2 grid grid-cols-3 gap-2">
      <button
        v-for="opt in conferenceProviderOptions"
        :key="opt.value"
        type="button"
        :disabled="isReadOnly"
        class="rounded-xl border-2 px-2 py-3 text-center transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        :class="String(value || '') === opt.value
          ? 'border-indigo-600 bg-indigo-50/50 shadow-sm dark:bg-indigo-950/30 dark:border-indigo-500'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'"
        @click="selectConferenceProvider(opt.value)"
      >
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ opt.label }}</p>
      </button>
    </div>

    <!-- People: first name with inline salutation -->
    <PeopleFirstNameWithSalutationField
      v-else-if="isPeopleFirstNameWithSalutationField"
      class="mt-2"
      :first-name="String(value || '')"
      :salutation="String(salutationValue || '')"
      :salutation-options="salutationOptions"
      :disabled="isReadOnly"
      :required="isRequired"
      :invalid="Boolean(localValidationError || errors[field.key])"
      :first-name-id="field.key"
      :first-name-placeholder="field.placeholder || `Enter ${displayLabel}`"
      @update:first-name="updateValue($event)"
      @update:salutation="emit('update:salutationValue', $event)"
      @blur="$emit('blur')"
    />

    <!-- Text -->
    <input 
      v-else-if="field.dataType === 'Text'"
      :id="field.key"
      :name="field.key"
      :type="getInputType(field)"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="effectiveTextPlaceholder"
      :required="isRequired"
      :disabled="isReadOnly"
      :class="[
        'block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
        localValidationError || errors[field.key]
          ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
          : ''
      ]"
    />
    
    <!-- Text-Area / Rich Text (legacy module type; had no control → label only) -->
    <textarea 
      v-else-if="!isEventRecurrencePicklist && (field.dataType === 'Text-Area' || field.dataType === 'RichText' || field.dataType === 'Rich Text' || isEventNotesAsTextArea)"
      :id="field.key"
      :name="field.key"
      :value="isEventNotesAsTextArea ? textareaFieldValue : (typeof value === 'string' || typeof value === 'number' ? value : (value == null ? '' : String(value)))"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter.ctrl="$event.target.blur()"
      :placeholder="field.placeholder || `Enter ${displayLabel}`"
      :required="isRequired"
      :disabled="isReadOnly"
      :rows="field.textSettings?.rows || 4"
      :maxlength="field.textSettings?.maxLength"
      class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 resize-none"
    />
    
    <!-- Email -->
    <input 
      v-else-if="field.dataType === 'Email'"
      :id="field.key"
      :name="field.key"
      type="email"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `email@example.com`"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
    />
    
    <!-- Phone -->
    <PhoneInput
      v-else-if="field.dataType === 'Phone'"
      :id="field.key"
      :name="field.key"
      :model-value="value"
      :default-country="defaultPhoneCountry"
      :placeholder="field.placeholder || 'Phone number'"
      :required="isRequired"
      :disabled="isReadOnly"
      :invalid="Boolean(localValidationError || errors[field.key])"
      class="mt-2"
      :input-class="[
        'block w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
        localValidationError || errors[field.key] ? 'border-red-500 dark:border-red-500' : '',
      ].join(' ')"
      @update:model-value="updateValue($event)"
      @blur="onPhoneFieldBlur"
      @enter="$emit('blur')"
    />
    
    <!-- Currency: amount input + inline currency selector -->
    <div v-else-if="field.dataType === 'Currency'" class="mt-2 flex">
      <input
        :id="field.key"
        :name="field.key"
        type="number"
        :value="value"
        @input="updateValue($event.target.value)"
        @blur="$emit('blur')"
        @keydown.enter="$event.target.blur()"
        :placeholder="field.placeholder || `Enter ${displayLabel}`"
        :required="isRequired"
        :disabled="isReadOnly"
        :min="field.numberSettings?.min"
        :max="field.numberSettings?.max"
        :step="field.numberSettings?.decimalPlaces ? Math.pow(0.1, field.numberSettings.decimalPlaces) : 0.01"
        :class="[
          'block w-full rounded-l-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
          localValidationError || errors[field.key] ? 'border-red-500 dark:border-red-500' : ''
        ]"
      />
      <Listbox
        :model-value="effectiveCurrencyCode"
        @update:model-value="handleCurrencyCodeChange"
        :disabled="isReadOnly || !currencyCodeEditable"
      >
        <div class="relative w-24">
          <ListboxButton
            :class="[
              'h-full w-full rounded-r-lg border border-l-0 border-gray-200 bg-white px-2 py-2.5 text-left text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
              localValidationError || errors[field.key] ? 'border-red-500 dark:border-red-500' : '',
              isReadOnly || !currencyCodeEditable ? 'opacity-60 cursor-not-allowed' : ''
            ]"
          >
            <span class="block truncate pr-4">{{ effectiveCurrencyCode }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-1 flex items-center">
              <ChevronUpDownIcon class="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>
          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute right-0 z-20 mt-1 max-h-60 w-28 overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="currency in currencyOptions"
                :key="currency.code"
                :value="currency.code"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-3 pr-8',
                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                    {{ currency.code }}
                  </span>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 right-0 flex items-center pr-2 text-indigo-600 dark:text-indigo-400"
                  >
                    <CheckIcon class="h-4 w-4" aria-hidden="true" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>

    <!-- Integer, Decimal -->
    <input 
      v-else-if="['Integer', 'Decimal'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="number"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `Enter ${displayLabel}`"
      :required="isRequired"
      :disabled="isReadOnly"
      :min="field.numberSettings?.min"
      :max="field.numberSettings?.max"
      :step="field.dataType === 'Integer' ? 1 : (field.numberSettings?.decimalPlaces ? Math.pow(0.1, field.numberSettings.decimalPlaces) : 0.01)"
      class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
    />
    
    <!-- Date -->
    <DatePicker
      v-else-if="field.dataType === 'Date'"
      :id="field.key"
      :model-value="formatDateForInput(value)"
      :disabled="isReadOnly"
      :invalid="Boolean(localValidationError || errors[field.key])"
      input-class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 cursor-pointer"
      @update:model-value="updateValue($event)"
      @blur="$emit('blur')"
      @enter="$emit('blur')"
    />
    
    <!-- Date-Time -->
    <DateTimePicker
      v-else-if="field.dataType === 'Date-Time'"
      :id="field.key"
      :model-value="normalizeDateTimeInput(value)"
      :disabled="isReadOnly"
      :invalid="Boolean(localValidationError || errors[field.key])"
      input-class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 cursor-pointer"
      @update:model-value="updateValue($event)"
      @blur="$emit('blur')"
      @enter="$emit('blur')"
    />
    
    <!-- Picklist (using Headless UI Combobox with search input inside dropdown) -->
    <div v-else-if="field.dataType === 'Picklist' || isEventRecurrencePicklist" class="mt-2 relative">
      <Combobox :model-value="value || ''" @update:model-value="handlePicklistChange" :disabled="isReadOnly" nullable>
        <div class="relative">
          <ComboboxButton
            @click="handlePicklistButtonClick"
            :class="[
              'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
              'relative cursor-default text-left',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : '',
              localValidationError || errors[field.key]
                ? 'border-red-500 dark:border-red-500'
                : ''
            ]"
          >
            <div class="flex items-center gap-2">
              <span v-if="getSelectedPicklistOptionColor() && value" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getSelectedPicklistOptionColor() }"></span>
              <span :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getSelectedPicklistLabel() || (field.placeholder || `Select ${displayLabel}`) }}</span>
            </div>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ComboboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            @after-enter="focusPicklistSearch"
          >
            <ComboboxOptions
              class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <!-- Search input inside dropdown (ComboboxInput so ↑/↓/Enter navigate options) -->
              <div class="p-2 border-b border-gray-200 dark:border-gray-600" @click.stop @mousedown.stop>
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
                  <ComboboxInput
                    ref="picklistSearchInput"
                    :display-value="() => picklistSearchQuery"
                    @change="picklistSearchQuery = $event.target.value"
                    @keydown.escape.stop
                    @click.stop
                    @mousedown.stop
                    :placeholder="t('common.formSearchOptions')"
                    class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 relative z-10"
                    autocomplete="off"
                  />
                </div>
              </div>
              
              <!-- Options list (scrollable) -->
              <div class="max-h-60 overflow-auto py-1">
                <button
                  v-if="picklistCreateCandidate"
                  type="button"
                  class="w-full text-left px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="picklistOptionCreating"
                  @click.stop="handleCreatePicklistOption"
                >
                  <span class="inline-flex items-center gap-2">
                    <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{{ t('common.formAddPicklistOption', { value: picklistCreateCandidate }) }}</span>
                  </span>
                </button>
                <div v-if="filteredSearchablePicklistOptions.length === 0 && !picklistCreateCandidate" class="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                  {{ t('common.formNoOptions') }}
                </div>
                <ComboboxOption
                  v-for="(option, optIdx) in filteredSearchablePicklistOptions"
                  :key="optIdx"
                  :value="getPicklistOptionValue(option)"
                  v-slot="{ active, selected }"
                >
                  <li
                    :class="[
                      'relative cursor-default select-none py-2 pl-4 pr-10',
                      active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                    ]"
                  >
                    <div class="flex items-center gap-2">
                      <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                      <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                        {{ normalizePicklistOption(option) }}
                      </span>
                    </div>
                    <span
                      v-if="selected"
                      class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                    >
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                </ComboboxOption>
              </div>
            </ComboboxOptions>
          </Transition>
        </div>
      </Combobox>
    </div>
    
    <!-- Radio Button (using Headless UI Listbox) -->
    <div v-else-if="field.dataType === 'Radio Button'" class="mt-2 relative">
      <Listbox :model-value="value || ''" @update:model-value="handleRadioChange" :disabled="isReadOnly">
        <div class="relative">
          <ListboxButton
            :class="[
              'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
              'relative cursor-default text-left',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : ''
            ]"
          >
            <span :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getSelectedLabel() || (field.placeholder || `Select ${displayLabel}`) }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="(option, optIdx) in filteredPicklistOptions"
                :key="optIdx"
                :value="getPicklistOptionValue(option)"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-4 pr-10',
                    active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                    <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                      {{ normalizePicklistOption(option) }}
                    </span>
                  </div>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                  >
                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
    
      <!-- Multi-Picklist (custom tag-based multi-select) -->
    <div v-else-if="field.dataType === 'Multi-Picklist'" class="mt-2 relative">
      <div
        :class="[
          'w-full rounded-md transition-all text-base sm:text-sm/6',
          isReadOnly
            ? 'border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800 opacity-50 cursor-not-allowed'
            : 'border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900/80 cursor-pointer focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:focus-within:border-indigo-400',
          showMultiOptions ? 'outline-2 -outline-offset-2 outline-indigo-500 dark:outline-indigo-500' : ''
        ]"
        @click.stop="!isReadOnly && onMultiPicklistTriggerClick()"
      >
        <!-- Selected tags and placeholder -->
        <div class="flex flex-wrap items-center gap-2 px-3 py-2">
          <template v-if="selectedMultiValues.length > 0">
            <span
              v-for="(selected, selIdx) in selectedMultiValues"
              :key="selIdx"
              class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-3 py-1 text-sm font-medium text-indigo-800 dark:text-indigo-200"
            >
              <span v-if="getSelectedOptionColor(selected)" class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: getSelectedOptionColor(selected) }"></span>
              <span>{{ normalizeMultiValue(selected) }}</span>
              <button
                v-if="!isReadOnly"
                type="button"
                @click.stop="removeMultiSelect(selected)"
                class="ml-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                :aria-label="t('actions.remove')"
              >
                <XMarkIcon class="h-3.5 w-3.5" />
              </button>
            </span>
          </template>
          <span
            v-else
            class="text-gray-500 dark:text-gray-500 text-base sm:text-sm/6 px-2"
          >
            {{ field.placeholder || `Select ${displayLabel}...` }}
          </span>
        </div>
      </div>
      
      <!-- Dropdown options -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showMultiOptions && !isReadOnly"
          v-click-outside="closeMultiPicklistDropdown"
          @click.stop
          class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-72 flex flex-col"
        >
          <div
            v-if="canCreatePicklistOption || isEventAttendeesField"
            class="shrink-0 p-2 border-b border-gray-200 dark:border-gray-600"
            @click.stop
            @mousedown.stop
          >
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
              <input
                type="text"
                v-model="picklistSearchQuery"
                @keydown.enter.stop.prevent="canCreatePicklistOption && picklistCreateCandidate && handleCreatePicklistOption()"
                @keydown.escape.stop
                @click.stop
                @mousedown.stop
                :placeholder="isEventAttendeesField ? t('common.formSearchUsers') : t('common.formSearchOptions')"
                class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 relative z-10"
                autocomplete="off"
              />
            </div>
          </div>
          <div class="py-1 max-h-60 overflow-y-auto">
            <button
              v-if="picklistCreateCandidate"
              type="button"
              class="w-full text-left px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="picklistOptionCreating"
              @click.stop="handleCreatePicklistOption"
            >
              <span class="inline-flex items-center gap-2">
                <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{{ t('common.formAddPicklistOption', { value: picklistCreateCandidate }) }}</span>
              </span>
            </button>
            <button
              v-for="(option, optIdx) in filteredSearchablePicklistOptions"
              :key="optIdx"
              type="button"
              @click.stop="toggleMultiSelect(option)"
              :class="[
                'w-full text-left px-4 py-2 text-sm transition-colors',
                isMultiValueSelected(option)
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 font-medium'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
              ]"
            >
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    isMultiValueSelected(option)
                      ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
                      : 'border-gray-300 dark:border-gray-600'
                  ]"
                >
                  <CheckSolidIcon v-if="isMultiValueSelected(option)" class="w-3 h-3 text-white" />
                </div>
                <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                <span>{{ normalizePicklistOption(option) }}</span>
              </div>
            </button>
            <div
              v-if="filteredSearchablePicklistOptions.length === 0 && !picklistCreateCandidate"
              class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('common.formNoOptions') }}
            </div>
          </div>
        </div>
      </Transition>
    </div>
    
    <!-- Checkbox -->
    <div v-else-if="field.dataType === 'Checkbox'" class="mt-2 flex items-center space-x-2">
      <HeadlessCheckbox 
        :id="field.key"
        :name="field.key"
        :checked="value"
        @change="updateValue($event.target.checked)"
        @blur="$emit('blur')"
        :required="isRequired"
        :disabled="isReadOnly"
        checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
      />
      <label 
        :for="field.key"
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ displayLabel }}
      </label>
    </div>
    
    <!-- Lookup (Relationship) - with searchable Combobox and modal browse button -->
    <div v-else-if="isLookupField" class="mt-2 relative">
      <!-- Read-only lookup: show static text (no dropdown / no browse icon) -->
      <div
        v-if="isReadOnly"
        class="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <span :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">
          {{ getLookupSelectedLabel() || '—' }}
        </span>
      </div>

      <Combobox v-else :model-value="normalizedLookupValue ?? null" @update:model-value="handleLookupChange" :disabled="isReadOnly" nullable>
        <div class="relative">
          <ComboboxButton
            @click="handleLookupButtonClick"
            :class="[
              'flex items-center w-full gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20',
              'cursor-default text-left min-w-0 h-[2.5rem]',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : '',
              localValidationError || errors[field.key]
                ? 'border-red-500 dark:border-red-500'
                : ''
            ]"
          >
            <!-- Label / selected value (flex-1 so it truncates) -->
            <span class="flex-1 min-w-0 truncate text-left">
              <!-- Show selected user with avatar/initial for any users lookup -->
              <span v-if="isUserLookupField && value && getSelectedLookupOption()" class="flex items-center gap-2">
                <Avatar :user="getSelectedLookupOption()" size="sm" />
                <span class="block truncate">{{ getLookupSelectedLabel() }}</span>
              </span>
              <!-- Default placeholder or non-user lookup -->
              <span v-else :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getLookupSelectedLabel() || `Select ${effectiveLabel}` }}</span>
            </span>
            <button
              v-if="canClearLookup && hasLookupValue"
              type="button"
              @click.stop="clearLookupSelection"
              class="flex-shrink-0 flex items-center justify-center p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              :title="t('common.formClearLookup')"
            >
              <XMarkIcon class="w-5 h-5" />
            </button>
            <!-- Modal browse button (not absolute) -->
            <button
              type="button"
              @click.stop="openLookupModal"
              class="flex-shrink-0 flex items-center justify-center p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              :title="t('common.formBrowseRecords')"
            >
              <MagnifyingGlassIcon class="w-5 h-5" />
            </button>
            <button
              v-if="canCreateLookupRecord"
              type="button"
              @click.stop="openLookupCreateDrawer"
              class="flex-shrink-0 flex items-center justify-center p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              :title="t('common.formCreateAndSelect')"
            >
              <PlusIcon class="w-5 h-5" />
            </button>
            <!-- Dropdown arrow (not absolute) -->
            <span class="pointer-events-none flex-shrink-0 flex items-center p-1">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ComboboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            @after-enter="focusLookupSearch"
          >
            <ComboboxOptions
              class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <!-- Search input inside dropdown (ComboboxInput so ↑/↓/Enter navigate options) -->
              <div class="p-2 border-b border-gray-200 dark:border-gray-600" @click.stop @mousedown.stop>
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
                  <ComboboxInput
                    ref="lookupSearchInput"
                    :display-value="() => lookupSearchQuery"
                    @change="lookupSearchQuery = $event.target.value"
                    @keydown.escape.stop
                    @click.stop
                    @mousedown.stop
                    :placeholder="t('common.formSearchRecords')"
                    class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20 relative z-10"
                    autocomplete="off"
                  />
                </div>
              </div>
              
              <!-- Options list (scrollable) -->
              <div class="max-h-60 overflow-auto py-1">
                <ComboboxOption
                  v-if="canClearLookup"
                  :value="null"
                  v-slot="{ active, selected }"
                >
                  <li
                    :class="[
                      'relative cursor-default select-none py-2 pl-10 pr-4',
                      active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                    ]"
                  >
                    <span :class="['block truncate', selected ? 'font-medium' : 'font-normal', !selected && 'text-gray-500 dark:text-gray-400']">
                      {{ lookupClearOptionLabel }}
                    </span>
                    <span
                      v-if="selected"
                      class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                    >
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                </ComboboxOption>
                <div v-if="filteredSearchableLookupOptions.length === 0" class="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                  {{ t('common.formNoMatchingRecords') }}
                </div>
                <button
                  v-if="filteredSearchableLookupOptions.length === 0 && canCreateLookupRecord"
                  type="button"
                  class="w-full text-left px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  @click.stop="openLookupCreateDrawer"
                >
                  Create new {{ lookupSearchQuery ? `"${lookupSearchQuery}"` : getLookupModuleName() }}
                </button>
                <ComboboxOption
                  v-for="item in filteredSearchableLookupOptions"
                  :key="item._id"
                  :value="item._id"
                  v-slot="{ active, selected }"
                >
                  <li
                    :class="[
                      'relative cursor-default select-none py-2 pr-4',
                      active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                    ]"
                  >
                    <!-- User avatar/initial for any users lookup -->
                    <div v-if="isUserLookupField" class="flex items-center gap-3 pl-10">
                      <Avatar :user="item" size="md" />
                      <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate flex-1']">
                        {{ getLookupDisplay(item) }}
                      </span>
                      <span
                        v-if="selected"
                        class="flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>
                    <!-- Regular lookup display (non-user fields) -->
                    <div v-else class="flex items-center pl-10">
                      <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate flex-1']">
                        {{ getLookupDisplay(item) }}
                      </span>
                      <span
                        v-if="selected"
                        class="flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                      >
                        <CheckIcon class="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>
                  </li>
                </ComboboxOption>
              </div>
            </ComboboxOptions>
          </Transition>
        </div>
      </Combobox>
      
      <!-- Lookup Drawer -->
      <TransitionRoot as="template" :show="showLookupModal">
        <Dialog :initialFocus="lookupModalSearchInputRef" class="relative z-[10000]" @close="closeLookupModal">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="ease-in duration-200"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-black/25 dark:bg-black/50" />
          </TransitionChild>

          <div class="fixed inset-0 overflow-hidden">
            <div class="absolute inset-0 overflow-hidden">
              <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
                <TransitionChild
                  as="template"
                  enter="transform transition ease-in-out duration-300 sm:duration-300"
                  enter-from="translate-x-full"
                  enter-to="translate-x-0"
                  leave="transform transition ease-in-out duration-300 sm:duration-300"
                  leave-from="translate-x-0"
                  leave-to="translate-x-full"
                >
                  <DialogPanel class="pointer-events-auto w-screen max-w-3xl">
                    <div class="relative flex h-full flex-col bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
                      <!-- Header -->
                      <div class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 sm:px-6">
                        <div class="flex items-center justify-between gap-3">
                          <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {{ t('common.formLookupSelectTitle', { label: lookupModuleSingularLabel }) }}
                          </DialogTitle>
                          <div class="ml-3 flex h-7 items-center">
                            <button
                              type="button"
                              class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                              @click="closeLookupModal"
                            >
                              <span class="absolute -inset-2.5" />
                              <span class="sr-only">{{ t('common.closePanel') }}</span>
                              <XMarkIcon class="size-5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {{ t('common.formLookupChooseOne', { module: lookupModuleSingularLabel.toLowerCase(), field: effectiveLabel }) }}
                        </p>
                      </div>

                      <!-- Body -->
                      <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <!-- Search bar -->
                        <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                          <div class="flex items-center gap-3">
                            <div class="relative flex-1 min-w-0">
                              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                              <input
                                ref="lookupModalSearchInputRef"
                                v-model="lookupModalSearchInput"
                                type="search"
                                class="block w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
                                :placeholder="t('common.formLookupSearchModule', { module: lookupModulePluralLabel.toLowerCase() })"
                                autocomplete="off"
                                @input="handleLookupSearchInput"
                              />
                            </div>
                            <button
                              type="button"
                              class="inline-flex shrink-0 items-center justify-center rounded-md bg-white dark:bg-gray-800 p-2 text-gray-500 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              :disabled="lookupModalLoading"
                              :title="lookupModalLoading ? t('common.formRefreshing') : t('actions.refresh')"
                              @click="refreshLookupModalData"
                            >
                              <span class="sr-only">{{ t('actions.refresh') }}</span>
                              <ArrowPathIcon class="size-4" :class="lookupModalLoading ? 'animate-spin' : ''" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <!-- List -->
                        <div class="flex-1 overflow-auto p-4">
                          <!-- Loading skeletons -->
                          <ul v-if="lookupModalLoading" class="divide-y divide-gray-200 dark:divide-gray-700">
                            <li v-for="i in 6" :key="`skeleton-${i}`" class="flex items-center gap-3 py-3 px-2">
                              <div class="size-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                              <div class="min-w-0 flex-1 space-y-2">
                                <div class="h-3.5 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                                <div class="h-3 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-700/70" />
                              </div>
                            </li>
                          </ul>

                          <!-- Empty state -->
                          <div
                            v-else-if="lookupModalData.length === 0"
                            class="flex min-h-[20rem] flex-col items-center justify-center text-center px-6"
                          >
                            <div class="flex size-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                              <MagnifyingGlassIcon class="size-6 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                            </div>
                            <h4 class="mt-4 text-sm font-semibold text-gray-900 dark:text-white">{{ t('common.formNoRecordsFound') }}</h4>
                            <p class="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                              <template v-if="lookupModalSearchQuery">
                                {{ t('common.formLookupNoMatch', { module: lookupModulePluralLabel.toLowerCase(), query: lookupModalSearchQuery }) }}
                              </template>
                              <template v-else>
                                {{ t('common.formLookupNoRecordsYet', { module: lookupModulePluralLabel.toLowerCase() }) }}
                              </template>
                            </p>
                            <button
                              v-if="canCreateLookupRecord"
                              type="button"
                              class="mt-4 inline-flex items-center gap-2 rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600"
                              @click="openLookupCreateDrawer"
                            >
                              <PlusIcon class="size-4" aria-hidden="true" />
                              {{ t('common.formLookupCreateModule', { module: lookupModuleSingularLabel.toLowerCase() }) }}
                            </button>
                          </div>

                          <!-- Records list -->
                          <ul v-else class="divide-y divide-gray-200 dark:divide-gray-700">
                            <li
                              v-for="row in lookupModalData"
                              :key="row._id"
                              :class="[
                                'flex items-center gap-3 py-3 px-2 rounded-md transition-colors',
                                String(normalizedLookupValue || '') === String(row._id || '')
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                              ]"
                            >
                              <div class="shrink-0">
                                <Avatar :record="row" size="md" />
                              </div>
                              <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2">
                                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {{ getLookupDisplay(row) }}
                                  </p>
                                  <span
                                    v-if="String(normalizedLookupValue || '') === String(row._id || '')"
                                    class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                                  >
                                    <CheckSolidIcon class="size-3" aria-hidden="true" />
                                    {{ t('common.formSelected') }}
                                  </span>
                                </div>
                                <p
                                  v-if="getLookupSubtitle(row)"
                                  class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate"
                                >
                                  {{ getLookupSubtitle(row) }}
                                </p>
                              </div>
                              <div v-if="String(normalizedLookupValue || '') !== String(row._id || '')" class="shrink-0">
                                <button
                                  type="button"
                                  class="rounded-md bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                  @click="handleLookupRowClick(row)"
                                >
                                  {{ t('actions.select') }}
                                </button>
                              </div>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <!-- Footer -->
                      <div class="flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-5 py-3.5 sm:px-6">
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ lookupModalPageSummary }}</p>
                        <div class="flex items-center gap-2">
                          <button
                            v-if="canCreateLookupRecord"
                            type="button"
                            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                            @click="openLookupCreateDrawer"
                          >
                            <PlusIcon class="size-4" aria-hidden="true" />
                            {{ t('common.formCreateNew') }}
                          </button>
                          <div class="ml-1 flex items-center gap-1">
                            <button
                              type="button"
                              class="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              :disabled="lookupModalCurrentPage <= 1 || lookupModalLoading"
                              :title="t('actions.previous')"
                              @click="handleLookupPageChange(lookupModalCurrentPage - 1)"
                            >
                              <span class="sr-only">{{ t('actions.previous') }}</span>
                              <ChevronLeftIcon class="size-4" aria-hidden="true" />
                            </button>
                            <span class="min-w-12 text-center text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                              {{ lookupModalCurrentPage }} / {{ lookupModalTotalPages }}
                            </span>
                            <button
                              type="button"
                              class="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              :disabled="lookupModalCurrentPage >= lookupModalTotalPages || lookupModalLoading"
                              :title="t('actions.next')"
                              @click="handleLookupPageChange(lookupModalCurrentPage + 1)"
                            >
                              <span class="sr-only">{{ t('actions.next') }}</span>
                              <ChevronRightIcon class="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogPanel>
                </TransitionChild>
              </div>
            </div>
          </div>
        </Dialog>
      </TransitionRoot>

      <CreateRecordDrawer
        v-if="usesModuleCreateDrawer"
        :isOpen="showLookupCreateDrawer"
        :moduleKey="lookupTargetModuleKey"
        :initialData="lookupCreateInitialData"
        :prefillText="lookupSearchQuery"
        :prefillFieldKey="lookupCreatePrefillFieldKey"
        :open-record-on-save="false"
        @close="closeLookupCreateDrawer"
        @saved="handleLookupRecordCreated"
      />
    </div>
    
    <!-- URL: type="text" so the browser does not show native "Please enter a URL" tooltips; we validate inline. -->
    <input 
      v-else-if="field.dataType === 'URL'"
      :id="field.key"
      :name="field.key"
      type="text"
      inputmode="url"
      autocomplete="url"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `https://example.com`"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-[border-color,box-shadow] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20"
    />
    
    <!-- Image -->
    <div v-else-if="field.dataType === 'Image'" class="mt-2">
      <input 
        type="file"
        :id="field.key"
        :name="field.key"
        accept="image/*"
        @change="handleImageUpload"
        :required="isRequired && !value"
        :disabled="isReadOnly || uploading"
        class="hidden"
        :ref="el => imageInputRef = el"
      />
      <div 
        v-if="value"
        class="relative inline-block"
      >
        <img 
          :src="value" 
          :alt="displayLabel"
          class="max-w-full h-32 object-contain rounded-lg border border-gray-300 dark:border-gray-600"
        />
        <button
          v-if="!isReadOnly"
          type="button"
          @click="removeImage"
          class="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg"
        >
          <XMarkIcon class="w-4 h-4" />
        </button>
      </div>
      <button
        v-else
        type="button"
        @click="triggerImageUpload"
        :disabled="isReadOnly || uploading"
        class="w-full px-4 py-3 border-2 border-dashed rounded-lg transition-colors"
        :class="uploading 
          ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-wait' 
          : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer'"
      >
        <div class="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
          <ArrowUpTrayIcon class="w-5 h-5" />
          <span v-if="uploading">{{ t('common.formUploading') }}</span>
          <span v-else>{{ t('common.formUploadImage') }}</span>
        </div>
      </button>
    </div>
    
    <!-- Auto-Number, Formula, Rollup Summary (Read-only display) -->
    <input 
      v-else-if="['Auto-Number', 'Formula', 'Rollup Summary'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="text"
      :value="value || field.defaultValue || '(Auto-generated)'"
      disabled
      class="block w-full mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed"
    />
    
    <!-- Error message (render dynamically only when present) -->
    <p v-if="localValidationError || errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">
      {{ localValidationError || errors[field.key] }}
    </p>
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, Listbox, ListboxButton, ListboxOptions, ListboxOption, Combobox, ComboboxButton, ComboboxInput, ComboboxOptions, ComboboxOption, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon, MagnifyingGlassIcon, ArrowUpTrayIcon, PlusIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';
import { CheckIcon as CheckSolidIcon } from '@heroicons/vue/24/solid';
import { Transition } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import FormTagsField from '@/components/common/FormTagsField.vue';
import EventLocationField from '@/components/events/EventLocationField.vue';
import PhoneInput from '@/components/common/PhoneInput.vue';
import PeopleFirstNameWithSalutationField from '@/components/people/PeopleFirstNameWithSalutationField.vue';
import { isPeopleFirstNameHostField } from '@/platform/fields/peopleSalutationField';
import { MEETING_CONFERENCE_PROVIDERS } from '@/constants/meetingConferenceProviders';
import DatePicker from '@/components/common/DatePicker.vue';
import DateTimePicker from '@/components/common/DateTimePicker.vue';
import { normalizeDateTimeInput } from '@/utils/datePickerUtils';
import apiClient from '@/utils/apiClient';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import {
  fetchUsersListCached,
  fetchOrganizationsListCached,
  fetchPeopleListCached,
} from '@/utils/recordLookupCache';
import { validateField } from '@/utils/fieldValidation';
import { sanitizeInternationalPhone, validatePhoneValue } from '@/utils/phoneInput';
import { useDefaultPhoneCountry } from '@/composables/useDefaultPhoneCountry';
import { getWebsiteValidationMessage } from '@/utils/urlInputValidation';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { getEnabledCurrencyOptions, resolveOrgCurrencyCode } from '@/utils/currencyOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { deleteInlineUpload, isManagedInlineUploadRef } from '@/utils/inlineUploadStorage';
import {
  canCreatePicklistOptionInline,
  normalizeNewPicklistOptionValue,
  picklistOptionExists,
} from '@/utils/picklistInlineOptionCreate';
import { canEditField } from '@/platform/fields/fieldCapabilityEngine';
import { filterFormsForEventLinkedForm, resolveEventGeoRequired } from '@/utils/eventUtils';
import { getEventTypeDefinitionByKey, EVENT_TYPE_DEFINITIONS } from '@/metadata/eventTypes';
import { createEmptyGeoLocation } from '@/types/eventLocation.types';
import { isModuleRegistered } from '@/platform/fields/FieldRegistry';

import { useNotifications } from '@/composables/useNotifications';
const { t } = useI18n();
const notifications = useNotifications();


const { defaultPhoneCountry } = useDefaultPhoneCountry(computed(() => props.formContext));

const _c = globalThis.console;
function fieldDbg(...args) {
  if (import.meta.env.DEV) _c.log(...args);
}

// Note: Headless UI Listbox is still used for Lookup (Relationship) fields and Radio Button
// Picklist uses native HTML select styled with Tailwind
// Multi-Picklist uses a custom tag-based dropdown component

// Click outside directive for multi-select dropdown
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      // Use setTimeout to ensure this runs after any click handlers that might toggle visibility
      // This allows Vue to update the DOM before we check if the element should be closed
      setTimeout(() => {
        // Check if element is still mounted
        if (!document.contains(el)) return;
        
        // Check if click was outside the element and its parent container
        // The parent container includes both the dropdown and the trigger button
        const container = el.closest('.relative');
        if (!container) return;
        
        if (!(container === event.target || container.contains(event.target))) {
          binding.value(event);
        }
      }, 10);
    };
    // Use capture phase so nested @click.stop handlers don't block outside-close behavior
    document.addEventListener('pointerdown', el.clickOutsideEvent, true);
  },
  unmounted(el) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('pointerdown', el.clickOutsideEvent, true);
    }
  }
};

const props = defineProps({
  field: {
    type: Object,
    required: true
  },
  value: {
    type: [String, Number, Boolean, Array, Object, null],
    default: null
  },
  errors: {
    type: Object,
    default: () => ({})
  },
  dependencyState: {
    type: Object,
    default: () => ({
      readonly: false,
      required: false,
      allowedOptions: null
    })
  },
  locked: {
    type: Boolean,
    default: false // If true, field is readonly/locked
  },
  moduleKey: {
    type: String,
    default: ''
  },
  currencyCode: {
    type: String,
    default: ''
  },
  currencyCodeEditable: {
    type: Boolean,
    default: false
  },
  formContext: {
    type: Object,
    default: null
  },
  salutationValue: {
    type: String,
    default: ''
  },
  salutationOptions: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:value', 'validation-error', 'blur', 'update:currency-code', 'picklist-option-created', 'update:form-context', 'update:salutationValue']);

const displayLabel = computed(() => getFieldDisplayLabel(props.field, props.moduleKey));
const effectiveLabel = computed(() => {
  return props.dependencyState?.label || displayLabel.value || props.field?.key || '';
});

const isAuditRoleLookupField = computed(() => {
  const key = String(props.field?.key || '').toLowerCase();
  const isUserLookup = props.field?.lookupSettings?.targetModule === 'users';
  // Treat assignedTo as an audit role when dependencies relabel it to "Auditor" (dependency-driven, not hardcoded per module).
  const labelLower = String(props.dependencyState?.label || '').toLowerCase();
  const isAuditorLabel = labelLower === 'auditor';
  return isUserLookup && (isAuditorLabel || key === 'auditorid' || key === 'reviewerid' || key === 'correctiveownerid');
});

const isValidObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

const isEventLocationField = computed(() => {
  if (props.moduleKey !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'location';
});

const isEventAttendeesField = computed(() => {
  if (props.moduleKey !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'attendees';
});

/** Stale module defs type notes as RichText (or array) — always render a textarea. */
const isEventNotesAsTextArea = computed(() => {
  if (String(props.moduleKey || '').toLowerCase() !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'notes';
});

/** Coerce legacy notes[] objects or non-strings for event notes textarea. */
const textareaFieldValue = computed(() => {
  const v = props.value;
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (item == null) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return String(item.text || item.content || item.note || '');
        return String(item);
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
});

/** Stale module defs type recurrence as RichText — render schema enum as picklist. */
const isEventRecurrencePicklist = computed(() => {
  if (String(props.moduleKey || '').toLowerCase() !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'recurrence';
});

const EVENT_RECURRENCE_OPTIONS = [
  { value: 'Daily', label: 'Daily' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Custom', label: 'Custom' },
];


const isEventConferenceProviderField = computed(() => {
  if (props.moduleKey !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'conferenceprovider';
});

const isEventMeetingLinkField = computed(() => {
  if (props.moduleKey !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'meetinglink';
});

const conferenceProviderOptions = computed(() =>
  MEETING_CONFERENCE_PROVIDERS.map((p) => ({
    value: p.value,
    label: t(p.labelKey),
  }))
);

const effectiveTextPlaceholder = computed(() => {
  if (props.field.placeholder) return props.field.placeholder;
  if (isEventMeetingLinkField.value) {
    const provider = String(props.formContext?.conferenceProvider || '').toLowerCase();
    if (provider === 'ms_teams') return t('events.meetingLinkPlaceholderMsTeams');
    if (provider === 'zoom') return t('events.meetingLinkPlaceholderZoom');
    if (provider === 'google_meet') return t('events.meetingLinkPlaceholderGoogleMeet');
    return t('events.meetingLinkPlaceholderGoogleMeet');
  }
  return `Enter ${displayLabel.value}`;
});

function selectConferenceProvider(providerValue) {
  if (isReadOnly.value) return;
  updateValue(providerValue);
  emit('blur');
}

const isPeopleFirstNameWithSalutationField = computed(() => {
  return isPeopleFirstNameHostField(props.moduleKey, props.field?.key || '')
    && props.field?.dataType === 'Text';
});

const isEventLinkedFormField = computed(() => {
  if (props.moduleKey !== 'events') return false;
  return String(props.field?.key || '').toLowerCase() === 'linkedformid';
});

const eventLinkedFormEventType = computed(() => props.formContext?.eventType ?? null);

const applyEventLinkedFormFilter = (forms) => {
  if (!isEventLinkedFormField.value) return forms;
  return filterFormsForEventLinkedForm(Array.isArray(forms) ? forms : [], eventLinkedFormEventType.value);
};

const syncLinkedFormSelection = () => {
  if (!isEventLinkedFormField.value) return;
  const selectedId = normalizedLookupValue.value;
  if (selectedId == null || selectedId === '') return;
  const stillValid = lookupOptions.value.some((opt) => String(opt?._id) === String(selectedId));
  if (!stillValid) {
    emit('update:value', '');
  }
};

const eventFormGeoLocation = computed(() => {
  const raw = props.formContext?.geoLocation;
  if (raw && typeof raw === 'object') return raw;
  return createEmptyGeoLocation();
});

const eventGeoRequired = computed(() =>
  resolveEventGeoRequired(
    props.formContext?.eventType,
    props.formContext?.geoRequired
  )
);

const eventRelatedToId = computed(() => {
  const raw = props.formContext?.relatedToId;
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) return String(raw._id);
  return String(raw);
});

function onEventGeoLocationUpdate(geoLocation) {
  emit('update:form-context', { geoLocation });
}

/** When Settings omits lookupSettings, map known field keys to /people or /v2/organization list APIs. */
function inferLookupTargetFromFieldKey(fieldKey) {
  const k = String(fieldKey || '').toLowerCase();
  if (k === 'contactid' || k === 'personid' || k === 'vendorcontactid' || k === 'contactpersonid') return 'people';
  if (k === 'organizationrefid' || k === 'accountid' || k === 'vendorid' || k === 'customerid') return 'organizations';
  if (k === 'dealid') return 'deals';
  if (k === 'deliverynoteid') return 'delivery_notes';
  if (k === 'receiptnoteid') return 'receipt_notes';
  if (k === 'purchaseorderid') return 'purchase_orders';
  if (k === 'salesorderid') return 'sales_orders';
  if (k === 'invoiceid') return 'invoices';
  if (k === 'returnwarehouseid' || k === 'receiptlocationid' || k === 'deliverywarehouseid' || k === 'returnlocationid') {
    return 'inventory_locations';
  }
  if (k === 'ownerid' || k === 'buyerid' || k === 'receivedby') return 'users';
  return '';
}

/** Inventory vendor pickers: PLATFORM skips SALES Customer/Lead projection; type=Vendor scopes the list.
 * Do not pass appKey=INVENTORY — /v2/organization is Sales-gated and 403s non-SALES req.appKey. */
function vendorOrgLookupParams(fieldKey, params = {}) {
  const k = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (k !== 'vendorid') return params;
  return {
    ...params,
    appKey: params.appKey || 'PLATFORM',
    type: params.type || 'Vendor',
  };
}

const isLookupField = computed(() => {
  const dataType = String(props.field?.dataType || '').toLowerCase();
  const hasLookupSettings = !!props.field?.lookupSettings?.targetModule;
  if (hasLookupSettings) return true;
  if (inferLookupTargetFromFieldKey(props.field?.key)) return true;
  return dataType.includes('lookup') || dataType.includes('reference') || dataType.includes('related');
});

const helperText = computed(() => {
  const key = String(props.field?.key || '').toLowerCase();
  if (key === 'auditorid') return 'User responsible for executing the audit.';
  if (key === 'reviewerid') return 'User responsible for reviewing and approving this audit.';
  if (key === 'correctiveownerid') return 'User responsible for addressing corrective actions raised in this audit.';
  if (isEventMeetingLinkField.value) {
    const provider = String(props.formContext?.conferenceProvider || '').toLowerCase();
    if (provider === 'zoom') return t('events.meetingLinkHelperZoom');
    if (provider === 'ms_teams') return t('events.meetingLinkHelperMsTeams');
    return t('events.meetingLinkHelperGoogleMeet');
  }
  if (isEventConferenceProviderField.value) {
    return t('events.conferenceProviderHelper');
  }
  if (isEventAttendeesField.value) {
    return t('events.attendeesHelper');
  }
  // For other Lookup fields, use configured placeholder as helper text (shown under label).
  if (isLookupField.value && props.field?.placeholder) return String(props.field.placeholder);
  return '';
});

const showAssignToMe = computed(() => {
  // Only show when we have a logged-in user and field is editable
  return isAuditRoleLookupField.value && !isReadOnly.value && !!authStore.user?._id;
});

const assignReviewerToMe = () => {
  if (!authStore.user?._id) return;
  // Explicit action only; never triggered automatically.
  emit('update:value', authStore.user._id);
};

const authStore = useAuthStore();
const lookupOptions = ref([]);
const isLoadingUsers = ref(false);
const showMultiOptions = ref(false);

// Search queries for Combobox components
const picklistSearchQuery = ref('');
const picklistOptionCreating = ref(false);
const additionalPicklistOptions = ref([]);
const lookupSearchQuery = ref('');

// Refs for search inputs to auto-focus
const picklistSearchInput = ref(null);
const lookupSearchInput = ref(null);

// Image upload refs
const imageInputRef = ref(null);
const uploading = ref(false);

// Lookup modal state
const showLookupModal = ref(false);
const lookupModalData = ref([]);
const lookupModalLoading = ref(false);
const lookupModalTotal = ref(0);
const lookupModalColumns = ref([]);
const lookupModalCurrentPage = ref(1);
const lookupModalSearchQuery = ref('');
const lookupModalSearchInput = ref('');
const lookupModalSortBy = ref('');
const lookupModalSortOrder = ref('asc');
const lookupModalSearchInputRef = ref(null);
const showLookupCreateDrawer = ref(false);
const LOOKUP_MODAL_PAGE_SIZE = 20;
let lookupModalSearchDebounce = null;
const isReadOnly = computed(() => {
  // Check if explicitly locked via prop
  if (props.locked) return true;
  // Check if field is read-only by type
  if (['Auto-Number', 'Formula', 'Rollup Summary'].includes(props.field.dataType)) return true;
  // System/computed fields: use FieldCapabilityEngine when module is registered, else fallback
  if (props.moduleKey && props.field?.key && isModuleRegistered(props.moduleKey)) {
    if (!canEditField(props.moduleKey, props.field)) return true;
  } else {
    const readonlySystemFields = ['createdby', 'organizationid'];
    if (readonlySystemFields.includes((props.field.key || '').toLowerCase())) return true;
  }
  // Check if dependency makes it read-only
  return props.dependencyState?.readonly || false;
});

const isRequired = computed(() => {
  const hasDeps = Array.isArray(props.field.dependencies) && props.field.dependencies.length > 0;
  // Default dependencyState is { required: false }; `??` would wrongly mask field.required for fields without rules
  if (!hasDeps) {
    return props.field.required ?? false;
  }
  if (props.dependencyState && typeof props.dependencyState.required === 'boolean') {
    return props.dependencyState.required;
  }
  return props.field.required ?? false;
});

/** Field key `tags` (string[]); dataType should be Multi-Picklist — Tasks used to infer Text from schema */
const isTagsField = computed(() => String(props.field?.key || '').toLowerCase() === 'tags');
const currencyOptions = computed(() => getEnabledCurrencyOptions(authStore.organization));
const effectiveCurrencyCode = computed(() => {
  // Prefer explicit companion/prop; do not let legacy numberSettings ($ → USD) override org default
  if (props.currencyCode) return String(props.currencyCode).toUpperCase();
  return resolveOrgCurrencyCode(authStore.organization);
});

const mergedPicklistSourceOptions = computed(() => {
  const fieldKeyNorm = String(props.field?.key || '').toLowerCase();
  const isCurrencyCodeField =
    fieldKeyNorm === 'currency' || fieldKeyNorm === 'paymentcurrency';
  let base = Array.isArray(props.field.options) ? props.field.options : [];

  // Events recurrence: ensure enum options even when module def has wrong type/empty options
  if (String(props.moduleKey || '').toLowerCase() === 'events' && fieldKeyNorm === 'recurrence') {
    if (!base.length) base = EVENT_RECURRENCE_OPTIONS;
  }

  // Events status vocabulary: scope options by event type (Meeting seeds vs audit/FSB)
  if (String(props.moduleKey || '').toLowerCase() === 'events' && fieldKeyNorm === 'status') {
    const eventType = props.formContext?.eventType;
    let def =
      getEventTypeDefinitionByKey(String(eventType || 'MEETING')) ||
      EVENT_TYPE_DEFINITIONS.find(
        (d) =>
          d.label.toLowerCase() === String(eventType || '').toLowerCase() ||
          d.key.toLowerCase() === String(eventType || '').toLowerCase()
      );
    if (!def) def = getEventTypeDefinitionByKey('MEETING');
    const allowed = def?.statusConfig?.allowedStatuses;
    if (Array.isArray(allowed) && allowed.length > 0) {
      const byVal = new Map(
        base.map((opt) => [String(opt?.value ?? opt?.label ?? opt).toLowerCase(), opt])
      );
      base = allowed.map((label) => {
        const existing = byVal.get(String(label).toLowerCase());
        if (existing) return typeof existing === 'object' ? existing : { value: existing, label: existing };
        return { value: label, label };
      });
    }
  }

  const currencyExtras = isCurrencyCodeField
    ? currencyOptions.value.map((c) => ({ value: c.code, label: c.code }))
    : [];
  const extras = [
    ...currencyExtras,
    ...(Array.isArray(additionalPicklistOptions.value) ? additionalPicklistOptions.value : []),
  ];
  if (!extras.length) return base;
  const seen = new Set(base.map((opt) => String(getPicklistOptionValue(opt) || '').toLowerCase()));
  const merged = [...base];
  for (const opt of extras) {
    const value = String(getPicklistOptionValue(opt) || '').toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    merged.push(opt);
  }
  return merged.length ? merged : extras;
});

const canCreatePicklistOption = computed(() => {
  if (isReadOnly.value || !props.moduleKey) return false;
  if (isEventAttendeesField.value) return false;
  return canCreatePicklistOptionInline(props.moduleKey, props.field, authStore.user);
});

const picklistCreateCandidate = computed(() => {
  const query = String(picklistSearchQuery.value || '').trim();
  if (!query || !canCreatePicklistOption.value || picklistOptionCreating.value) return '';
  const normalizedValue = normalizeNewPicklistOptionValue(query, props.field.key, props.moduleKey);
  if (!normalizedValue) return '';
  if (picklistOptionExists(mergedPicklistSourceOptions.value, normalizedValue)) return '';
  return query;
});

// Get filtered picklist options based on dependency
const filteredPicklistOptions = computed(() => {
  if (props.field.dataType !== 'Picklist' && props.field.dataType !== 'Multi-Picklist') {
    return mergedPicklistSourceOptions.value;
  }
  
  const allowedOptions = props.dependencyState?.allowedOptions;
  // null/undefined = no restriction; [] = restrict to none (controlling value unset/unmapped)
  if (allowedOptions == null || !Array.isArray(allowedOptions)) {
    return mergedPicklistSourceOptions.value;
  }

  // Normalize allowedOptions to strings for comparison
  const normalizedAllowed = allowedOptions.map(opt => String(opt || ''));

  // Filter options to only show allowed ones
  const filtered = mergedPicklistSourceOptions.value.filter(option => {
    const optionValue = String(getPicklistOptionValue(option) || '');
    return normalizedAllowed.includes(optionValue);
  });

  if (filtered.length === 0 && normalizedAllowed.length > 0) {
    console.warn('⚠️ No picklist options matched dependency filter:', {
      fieldKey: props.field.key,
      allowedOptions: normalizedAllowed,
      allOptions: mergedPicklistSourceOptions.value.map(opt => getPicklistOptionValue(opt))
    });
  }

  return filtered;
});

// Get searchable filtered picklist options (with search query filtering)
const filteredSearchablePicklistOptions = computed(() => {
  const baseOptions = filteredPicklistOptions.value;
  
  if (!picklistSearchQuery.value) {
    return baseOptions;
  }
  
  const query = picklistSearchQuery.value.toLowerCase();
  return baseOptions.filter(option => {
    const optionText = normalizePicklistOption(option).toLowerCase();
    return optionText.includes(query);
  });
});

// Get searchable filtered lookup options
const filteredSearchableLookupOptions = computed(() => {
  if (!lookupSearchQuery.value) {
    return lookupOptions.value;
  }
  
  const query = lookupSearchQuery.value.toLowerCase();
  return lookupOptions.value.filter(item => {
    const displayText = getLookupDisplay(item).toLowerCase();
    return displayText.includes(query);
  });
});

const lookupTargetModuleKey = computed(() => {
  const fromSettings = String(props.field?.lookupSettings?.targetModule || '').toLowerCase().trim();
  const raw = fromSettings || inferLookupTargetFromFieldKey(props.field?.key);
  if (!raw) return '';
  if (raw === 'organization') return 'organizations';
  if (raw === 'contact' || raw === 'person') return 'people';
  if (raw === 'deal') return 'deals';
  if (raw === 'task') return 'tasks';
  if (raw === 'event') return 'events';
  if (raw === 'user') return 'users';
  return raw;
});

const canCreateLookupRecord = computed(() => {
  return !isReadOnly.value && !!lookupTargetModuleKey.value && lookupTargetModuleKey.value !== 'users';
});

const isCatalogCategoriesLookup = computed(
  () => String(lookupTargetModuleKey.value || '').toLowerCase() === 'catalog/categories'
);

const usesModuleCreateDrawer = computed(
  () => canCreateLookupRecord.value && !isCatalogCategoriesLookup.value
);

// When the lookup drawer is open, prefer its search seed; fall back to the inline combobox query otherwise.
const activeLookupSearchSeed = computed(() => {
  const drawer = String(lookupModalSearchQuery.value || lookupModalSearchInput.value || '').trim();
  if (showLookupModal.value && drawer) return drawer;
  return String(lookupSearchQuery.value || '').trim();
});

const lookupCreateInitialData = computed(() => {
  const seed = activeLookupSearchSeed.value;
  if (!seed) return {};

  const displayField = String(props.field?.lookupSettings?.displayField || '').trim();
  if (displayField) {
    return { [displayField]: seed };
  }

  const moduleKey = lookupTargetModuleKey.value;
  if (moduleKey === 'people') return { first_name: seed };
  if (moduleKey === 'tasks') return { title: seed };
  return { name: seed };
});

const lookupCreatePrefillFieldKey = computed(() => {
  const displayField = String(props.field?.lookupSettings?.displayField || '').trim();
  if (displayField) return displayField;
  const moduleKey = lookupTargetModuleKey.value;
  if (moduleKey === 'people') return 'first_name';
  if (moduleKey === 'tasks') return 'title';
  return 'name';
});

const lookupModulePluralLabel = computed(() => {
  const raw = getLookupModuleName();
  // getLookupModuleName already returns title-cased plurals (e.g., "Users", "Organizations")
  return raw || 'Records';
});

const lookupModuleSingularLabel = computed(() => {
  const plural = lookupModulePluralLabel.value;
  if (!plural) return 'Record';
  if (plural.toLowerCase() === 'categories') return 'Category';
  // Naive singularize: trim a trailing "s" if present and result is non-empty
  if (plural.length > 1 && plural.toLowerCase().endsWith('s')) {
    return plural.slice(0, -1);
  }
  return plural;
});

const lookupModalTotalPages = computed(() => Math.max(1, Math.ceil((lookupModalTotal.value || lookupModalData.value.length || 0) / LOOKUP_MODAL_PAGE_SIZE)));

const lookupModalPageSummary = computed(() => {
  const total = lookupModalTotal.value || lookupModalData.value.length || 0;
  if (!total) return 'No records to show';
  const start = ((lookupModalCurrentPage.value - 1) * LOOKUP_MODAL_PAGE_SIZE) + 1;
  const end = Math.min(start + lookupModalData.value.length - 1, total);
  return `Showing ${start}-${end} of ${total} ${total === 1 ? 'record' : 'records'}`;
});

// Real-time validation
const localValidationError = ref(null);
const hasInteracted = ref(false);

function isEmptyForValidation(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim() === '';
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') {
    const id = val._id != null ? val._id : val.id;
    if (id !== null && id !== undefined && id !== '') return false;
    return true;
  }
  return false;
}

// Validate field value
const validateValue = (val, opts = {}) => {
  const phoneBlur = opts.phoneBlur === true;
  const silent = opts.silent === true;
  const strVal = val === null || val === undefined ? '' : String(val);
  const trimmed = strVal.trim();
  const empty = isEmptyForValidation(val);

  // Dependency-driven required (and static required) must run even when no field.validations are configured
  if (empty && isRequired.value) {
    if (silent) {
      localValidationError.value = null;
      emit('validation-error', props.field.key, null);
      return;
    }
    const msg = `${effectiveLabel.value || displayLabel.value || props.field.key} is required`;
    localValidationError.value = msg;
    emit('validation-error', props.field.key, msg);
    return;
  }

  if (empty && !isRequired.value) {
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }

  // Intrinsic URL format (module-independent; avoids <input type="url"> native tooltips)
  if (props.field.dataType === 'URL' && trimmed !== '') {
    const urlMsg = getWebsiteValidationMessage(strVal);
    if (urlMsg) {
      if (silent) {
        localValidationError.value = null;
        emit('validation-error', props.field.key, null);
        return;
      }
      localValidationError.value = urlMsg;
      emit('validation-error', props.field.key, urlMsg);
      return;
    }
  }

  // Phone: while typing partial international numbers, validate fully on blur.
  if (props.field.dataType === 'Phone') {
    const phoneValidation = validatePhoneValue(strVal, defaultPhoneCountry.value);
    if (!phoneBlur && strVal && !phoneValidation.isValid) {
      localValidationError.value = null;
      emit('validation-error', props.field.key, null);
      return;
    }
    if (!phoneValidation.isValid) {
      localValidationError.value = phoneValidation.error;
      emit('validation-error', props.field.key, localValidationError.value);
      return;
    }
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }

  if (!props.field.validations || !Array.isArray(props.field.validations) || props.field.validations.length === 0) {
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }

  const result = validateField(val, props.field.validations);
  if (silent && result.error) {
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }
  localValidationError.value = result.error;
  emit('validation-error', props.field.key, result.error);
};

// Re-run when value, dependency required state, or label/required metadata changes
watch(
  () => [props.value, isRequired.value, props.dependencyState, props.field?.required],
  ([v]) => {
    validateValue(v, { silent: !hasInteracted.value });
  },
  { deep: true, immediate: true }
);

// Check if this is an "owner/assignee" style user lookup field.
// These fields may be auto-defaulted to current user (convenience), unlike audit role fields.
const isAssignedToField = computed(() => {
  const key = props.field.key?.toLowerCase();
  const label = props.field.label?.toLowerCase() || '';
  
  // Check by key
  if (key === 'assignedto' || 
      key === 'assigned_to' || 
      key === 'assignedto' ||
      key === 'ownerid' ||
      key === 'owner_id' ||
      key === 'assignedto' ||
      key === 'accountmanager' ||
      key === 'account_manager') {
    return true;
  }
  
  // Check by label
  if (label.includes('assigned to') || 
      label.includes('assigned to (owner)') ||
      label.includes('event owner') ||
      label.includes('deal owner') ||
      label.includes('case owner') ||
      label.includes('account manager') ||
      (label === 'owner' && props.field.lookupSettings?.targetModule === 'users') ||
      (label.includes('manager') && props.field.lookupSettings?.targetModule === 'users')) {
    return true;
  }

  return false;
});

const isUserLookupField = computed(() => {
  if (String(props.field?.lookupSettings?.targetModule || '').toLowerCase() === 'users') {
    return true;
  }
  if (String(props.field?.key || '').toLowerCase() === 'assignedto') {
    return true;
  }
  const dt = String(props.field?.dataType || '').toLowerCase();
  return dt === 'user' || dt === 'users' || (dt.includes('user') && dt.includes('lookup'));
});

const isOrganizationLookupField = computed(() => {
  const target = String(props.field?.lookupSettings?.targetModule || '').toLowerCase();
  return target === 'organization' || target === 'organizations';
});

const updateValue = (newValue) => {
  hasInteracted.value = true;
  let v = newValue;
  if (props.field.dataType === 'Phone') {
    v = sanitizeInternationalPhone(
      typeof newValue === 'string' ? newValue : newValue == null ? '' : String(newValue),
      defaultPhoneCountry.value
    );
  }
  emit('update:value', v);
  // Validate immediately on input
  validateValue(v);
  // Clear search queries when value is selected
  picklistSearchQuery.value = '';
  lookupSearchQuery.value = '';
};

function onPhoneFieldBlur() {
  hasInteracted.value = true;
  emit('blur');
  validateValue(props.value, { phoneBlur: true });
}

// Handler for picklist changes (emits blur immediately since selection is complete)
const handlePicklistChange = (newValue) => {
  updateValue(newValue);
  // Emit blur immediately after selection for dropdown fields
  emit('blur');
};

async function handleCreatePicklistOption() {
  const rawValue = picklistCreateCandidate.value;
  if (!rawValue || !canCreatePicklistOption.value || picklistOptionCreating.value) return;

  const moduleKey = String(props.moduleKey || '').toLowerCase();
  const fieldKey = String(props.field?.key || '').trim();
  if (!moduleKey || !fieldKey) return;

  picklistOptionCreating.value = true;
  try {
    const response = await apiClient.post(
      `/modules/system/${encodeURIComponent(moduleKey)}/fields/${encodeURIComponent(fieldKey)}/options`,
      { value: rawValue, label: rawValue }
    );
    const option = response?.data;
    if (!option?.value) {
      throw new Error(response?.message || 'Failed to add picklist option');
    }

    if (Array.isArray(props.field.options)) {
      if (!picklistOptionExists(props.field.options, option.value)) {
        props.field.options.push(option);
      }
    } else {
      props.field.options = [option];
    }
    if (!picklistOptionExists(additionalPicklistOptions.value, option.value)) {
      additionalPicklistOptions.value = [...additionalPicklistOptions.value, option];
    }

    emit('picklist-option-created', { fieldKey, option });

    if (props.field.dataType === 'Multi-Picklist') {
      const current = Array.isArray(props.value) ? [...props.value] : [];
      if (!current.includes(option.value)) {
        updateValue([...current, option.value]);
      }
    } else {
      handlePicklistChange(option.value);
    }

    picklistSearchQuery.value = '';
    showMultiOptions.value = false;
  } catch (error) {
    console.error('Failed to create picklist option:', error);
    localValidationError.value = error?.message || t('common.formAddPicklistOptionFailed');
  } finally {
    picklistOptionCreating.value = false;
  }
}

// Handler for radio button changes (emits blur immediately since selection is complete)
const handleRadioChange = (newValue) => {
  updateValue(newValue);
  // Emit blur immediately after selection for radio buttons
  emit('blur');
};

// Handler for lookup changes (emits blur immediately since selection is complete)
const handleLookupChange = (newValue) => {
  updateValue(newValue == null || newValue === '' ? null : newValue);
  // Emit blur immediately after selection for lookup fields
  emit('blur');
};

const canClearLookup = computed(() => !isReadOnly.value && !isRequired.value);

const hasLookupValue = computed(() => {
  if (props.value == null || props.value === '') return false;
  if (typeof props.value === 'object' && !props.value._id) return false;
  return true;
});

const lookupClearOptionLabel = computed(() =>
  isUserLookupField.value ? t('records.editableUnassigned') : t('common.formLookupClearOption')
);

const clearLookupSelection = () => {
  handleLookupChange(null);
};

const handleCurrencyCodeChange = (newValue) => {
  const selected = String(newValue || resolveOrgCurrencyCode(authStore.organization)).toUpperCase();
  emit('update:currency-code', selected);
  emit('blur');
};

// Image upload functions
const triggerImageUpload = () => {
  if (imageInputRef.value) {
    imageInputRef.value.click();
  }
};

const handleImageUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    notifications.warning(t('validation.imageFileRequired'));
    return;
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    notifications.error(t('validation.imageMaxSize'));
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);

    const authStore = useAuthStore();
    const token = authStore.user?.token;

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json();
    if (result.success && result.url) {
      const previous = String(props.modelValue || '').trim();
      if (previous && previous !== result.url && isManagedInlineUploadRef(previous)) {
        deleteInlineUpload(previous).catch((error) => {
          console.error('Previous image delete error:', error);
        });
      }
      updateValue(result.url);
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    console.error('Image upload error:', error);
    notifications.error(t('validation.imageUploadFailed'));
  } finally {
    uploading.value = false;
    // Reset input to allow re-uploading the same file
    if (imageInputRef.value) {
      imageInputRef.value.value = '';
    }
  }
};

const removeImage = async () => {
  const current = String(props.modelValue || '').trim();
  if (current && isManagedInlineUploadRef(current)) {
    try {
      await deleteInlineUpload(current);
    } catch (error) {
      console.error('Image delete error:', error);
    }
  }
  updateValue('');
};

/** Resolve DOM input from a native el or Headless UI ComboboxInput component ref. */
function resolveSearchInputEl(refVal) {
  if (!refVal) return null;
  if (typeof refVal.focus === 'function' && refVal.nodeType === 1) return refVal;
  const el = refVal.el ?? refVal.$el ?? null;
  if (!el) return null;
  if (typeof el.focus === 'function') return el;
  return typeof el.querySelector === 'function' ? el.querySelector('input') : null;
}

// Focus functions for auto-focusing search inputs when Combobox opens
const focusPicklistSearch = () => {
  requestAnimationFrame(() => {
    const attemptFocus = (delay = 0) => {
      window.setTimeout(() => {
        const inputEl = resolveSearchInputEl(picklistSearchInput.value);
        if (inputEl) {
          try {
            if (document.contains(inputEl)) {
              inputEl.focus();
              inputEl.select?.();
            }
          } catch (e) {
            console.warn('Failed to focus picklist search:', e);
          }
        } else if (delay < 300) {
          attemptFocus(delay + 50);
        }
      }, delay);
    };

    nextTick(() => {
      attemptFocus(0);
    });
  });
};

const focusLookupSearch = () => {
  requestAnimationFrame(() => {
    const attemptFocus = (delay = 0) => {
      window.setTimeout(() => {
        const inputEl = resolveSearchInputEl(lookupSearchInput.value);
        if (inputEl) {
          try {
            if (document.contains(inputEl)) {
              inputEl.focus();
              inputEl.select?.();
            }
          } catch (e) {
            console.warn('Failed to focus lookup search:', e);
          }
        } else if (delay < 300) {
          attemptFocus(delay + 50);
        }
      }, delay);
    };

    nextTick(() => {
      attemptFocus(0);
    });
  });
};

// Handler functions for button clicks (to avoid setTimeout in template)
const handlePicklistButtonClick = () => {
  // Wait for Combobox to open, then focus search
  nextTick(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        focusPicklistSearch();
      }, 150);
    });
  });
};

const handleLookupButtonClick = () => {
  // Wait for Combobox to open, then focus search
  nextTick(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        focusLookupSearch();
      }, 150);
    });
  });
};

// Helper function to normalize picklist option for display (label first, like field settings)
const normalizePicklistOption = (option) => {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.label || option.value || String(option);
  }
  return String(option);
};

// Helper function to get picklist option value for comparison
const getPicklistOptionValue = (option) => {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    // User/entity rows use _id; picklist options use value/label
    return option.value || option._id || option.id || option.userId || option.label || String(option);
  }
  return String(option);
};

// Helper function to get picklist option color if available
const getPicklistOptionColor = (option) => {
  if (typeof option === 'object' && option !== null && option.color) {
    return option.color;
  }
  return null;
};

const getInputType = (field) => {
  if (field.textSettings?.maxLength) return 'text';
  return 'text';
};

const formatDateForInput = (dateValue) => {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.split('T')[0];
  if (dateValue instanceof Date) return dateValue.toISOString().split('T')[0];
  return '';
};

// Multi-select helpers
const selectedMultiValues = computed(() => {
  // Always return an array for Multi-Picklist
  if (!props.value) return [];
  if (Array.isArray(props.value)) return props.value;
  // If value is not an array but exists, convert to array
  // (handles cases where backend might return a single string or other type)
  return [props.value].filter(Boolean);
});

function onMultiPicklistTriggerClick() {
  showMultiOptions.value = !showMultiOptions.value;
}

function closeMultiPicklistDropdown() {
  showMultiOptions.value = false;
  picklistSearchQuery.value = '';
  emit('blur');
}

const handleMultiSelectUpdate = (newValues) => {
  // Ensure we always emit an array
  const values = Array.isArray(newValues) ? newValues : (newValues ? [newValues] : []);
  emit('update:value', values);
};

const handleMultiSelectChange = (event) => {
  // Get selected options from the select element
  const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
  emit('update:value', selectedOptions);
};

const toggleMultiSelect = (option) => {
  const current = [...selectedMultiValues.value];
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = current.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
  
  if (index > -1) {
    // Remove if already selected
    current.splice(index, 1);
  } else {
    // Add if not selected - store the normalized value (string) for consistency
    current.push(optionValue);
  }
  
  emit('update:value', current);
  // Note: blur will be emitted when dropdown closes (v-click-outside)
};

const getMultiSelectDisplayText = () => {
  const selected = selectedMultiValues.value;
  if (selected.length === 0) return '';
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
};

const removeMultiSelect = (option) => {
  const current = [...selectedMultiValues.value];
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = current.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
  
  if (index > -1) {
    current.splice(index, 1);
    emit('update:value', current);
    // Emit blur immediately for tag removal (user interaction is complete)
    emit('blur');
  }
};

// Single select helpers
const getSelectedLabel = () => {
  if (!props.value) return '';
  // Use filtered options if available, otherwise use all options
  const optionsToSearch = props.field.dataType === 'Picklist' || props.field.dataType === 'Multi-Picklist' 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === props.value || optValue === String(props.value);
  });
  if (option) {
    return normalizePicklistOption(option);
  }
  return props.value;
};

// Get selected picklist label
const getSelectedPicklistLabel = () => {
  return getSelectedLabel();
};

// Get selected picklist option color
const getSelectedPicklistOptionColor = () => {
  if (!props.value) return null;
  const optionsToSearch = filteredPicklistOptions.value.length > 0 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === props.value || optValue === String(props.value);
  });
  return getPicklistOptionColor(option);
};

// Helper to get color for a selected multi-value
const getSelectedOptionColor = (value) => {
  const optionsToSearch = props.field.dataType === 'Multi-Picklist'
    ? filteredPicklistOptions.value
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === value || optValue === String(value);
  });
  return getPicklistOptionColor(option);
};

// Helper to normalize multi-value display
const normalizeMultiValue = (value) => {
  const optionsToSearch = props.field.dataType === 'Multi-Picklist'
    ? filteredPicklistOptions.value
    : (props.field.options || []);
  const raw =
    value && typeof value === 'object'
      ? value.value || value._id || value.id || value.userId || value.label || value
      : value;
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === raw || String(optValue) === String(raw);
  });
  if (option) {
    return normalizePicklistOption(option);
  }
  if (value && typeof value === 'object') {
    const name = [value.firstName, value.lastName].filter(Boolean).join(' ').trim();
    if (name) return name;
    if (value.email) return value.email;
    if (value.label) return String(value.label);
  }
  return String(raw ?? value ?? '');
};

// Check if a multi-value option is selected
const isMultiValueSelected = (option) => {
  const optionValue = getPicklistOptionValue(option);
  return selectedMultiValues.value.some(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
};

// Get user display name
const getUserDisplayName = (user) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const altName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || altName || user.name || user.username || user.email || user._id;
};

const getLookupDisplay = (item) => {
  // For all user lookups (assignedTo, auditorId, reviewerId, correctiveOwnerId, etc.), show human-friendly names.
  if (isUserLookupField.value || isAssignedToField.value) {
    return getUserDisplayName(item);
  }

  if (!item || typeof item !== 'object') return item ?? '';

  if (props.field.lookupSettings?.displayField) {
    const displayField = props.field.lookupSettings.displayField;
    const chosen = item[displayField];
    if (chosen != null && chosen !== '') return chosen;
  }

  // Prefer human labels; document modules use *Number fields rather than name.
  return (
    item.name ||
    item.title ||
    item.poNumber ||
    item.receiptNoteNumber ||
    item.purchaseReturnNumber ||
    item.quoteNumber ||
    item.salesOrderNumber ||
    item.invoiceNumber ||
    item.paymentNumber ||
    item.locationCode ||
    item.sku ||
    item.itemNumber ||
    item.first_name ||
    item.email ||
    item._id
  );
};

// Normalize value - handle both ID strings and populated objects
const normalizedLookupValue = computed(() => {
  if (!props.value) return null;
  // If value is an object (populated), extract the ID
  if (typeof props.value === 'object' && props.value._id) {
    return props.value._id;
  }
  // If it's already an ID, return as is
  return props.value;
});

// Get the populated object if value is an object, otherwise find it in options
const getSelectedLookupOption = () => {
  if (!props.value) return null;
  
  // If value is a populated object (has _id and other properties), return it directly
  if (typeof props.value === 'object' && props.value._id && Object.keys(props.value).length > 1) {
    return props.value;
  }
  
  // Otherwise, find it in lookupOptions
  const valueId = normalizedLookupValue.value;
  if (lookupOptions.value.length) {
    const matched = lookupOptions.value.find(
      (opt) => String(opt?._id ?? '') === String(valueId ?? '')
    );
    if (matched) return matched;
  }

  // Fallback: for user lookup fields, resolve current user by ID even when filtered option lists are empty.
  if (isUserLookupField.value && authStore.user?._id && String(authStore.user._id) === String(valueId)) {
    return authStore.user;
  }

  // Fallback: resolve current organization for organization lookups when option list isn't loaded.
  if (
    isOrganizationLookupField.value &&
    authStore.organization?._id &&
    String(authStore.organization._id) === String(valueId)
  ) {
    return authStore.organization;
  }

  return null;
};

const getLookupSelectedLabel = () => {
  if (!props.value) return '';
  const selected = getSelectedLookupOption();
  if (selected) {
    return getLookupDisplay(selected);
  }
  // Fallback: if value is an object, try to display it
  if (typeof props.value === 'object' && props.value._id) {
    if (isAssignedToField.value) {
      return getUserDisplayName(props.value);
    }
    return getLookupDisplay(props.value);
  }
  // Avoid leaking raw ids for user lookups when we cannot resolve option labels yet.
  if (isUserLookupField.value) {
    return '';
  }
  // Same for other ID-backed lookups: never show raw ObjectId in the control.
  const v = props.value;
  if (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)) {
    return '';
  }
  return v;
};

// Fetch users for any users-lookup field (assignedTo, assignedTo, assignedTo, auditorId, etc.)
const fetchUsers = async ({ autoDefault = false } = {}) => {
  if (!isUserLookupField.value) return;
  
  isLoadingUsers.value = true;
  try {
    // Use the /users/list endpoint which doesn't require manageUsers permission
    const params = (props.dependencyState && typeof props.dependencyState.lookupQuery === 'object' && props.dependencyState.lookupQuery)
      ? props.dependencyState.lookupQuery
      : undefined;
    const response = await fetchUsersListCached(params || { limit: 500 });
    
    if (response.success && Array.isArray(response.data)) {
      // Keep only valid user rows; this avoids showing malformed placeholder values.
      lookupOptions.value = response.data.filter((u) => isValidObjectId(String(u?._id || '')));
      
      // Optional: auto-default convenience fields ONLY.
      // NEVER auto-default audit roles (Auditor/Reviewer/Corrective Owner) — must be explicitly assigned.
      const keyLower = String(props.field?.key || '').toLowerCase();
      const canAutoDefault =
        autoDefault &&
        !isAuditRoleLookupField.value &&
        (
          keyLower === 'assignedto' ||
          keyLower === 'ownerid' ||
          keyLower === 'owner_id' ||
          keyLower === 'assignedto' ||
          keyLower === 'accountmanager' ||
          keyLower === 'account_manager'
        );

      if (canAutoDefault && !props.value && authStore.user?._id) {
        const currentUser = response.data.find(u =>
          u._id === authStore.user._id || u._id?.toString() === authStore.user._id?.toString()
        );
        if (currentUser) emit('update:value', currentUser._id);
      }
    } else {
      console.warn('Unexpected response format from /users/list:', response);
      lookupOptions.value = [];
    }
  } catch (error) {
    console.error('Error fetching users for assignedTo:', error);
    // If error, show empty array so form still works
    lookupOptions.value = [];
  } finally {
    isLoadingUsers.value = false;
  }
};

// Flatten catalog category tree for lookup options / modal rows
const flattenCatalogCategoryTree = (tree) => {
  const out = [];
  const walk = (node, parentPath = '') => {
    if (!node || typeof node !== 'object') return;
    const id = node._id || node.id;
    const name = node.name || node.label;
    const path = node.path || (parentPath && name ? `${parentPath} / ${name}` : name) || name || '';
    if (id) {
      out.push({ ...node, _id: id, name, path });
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) walk(child, path || parentPath);
  };
  if (Array.isArray(tree)) {
    for (const root of tree) walk(root, '');
  } else if (tree) {
    walk(tree, '');
  }
  return out;
};

// Fetch lookup options for Lookup fields
const fetchLookupOptions = async () => {
  if (!isLookupField.value) return;
  
  // Users lookup: always use /users/list. Only auto-default for assignee/owner fields (never audit roles).
  if (isUserLookupField.value) {
    await fetchUsers({ autoDefault: isAssignedToField.value || String(props.field?.key || '').toLowerCase() === 'assignedto' });
    return;
  }
  
  const targetModule = props.field.lookupSettings?.targetModule || inferLookupTargetFromFieldKey(props.field?.key);
  if (!targetModule) {
    console.warn('Lookup field missing targetModule:', props.field.key, props.field);
    return;
  }
  
  try {
    const moduleKey = targetModule;
    fieldDbg('Fetching lookup options for module:', moduleKey, 'field:', props.field.key);

    const depParams = vendorOrgLookupParams(
      props.field?.key,
      props.dependencyState?.lookupQuery && typeof props.dependencyState.lookupQuery === 'object'
        ? { ...props.dependencyState.lookupQuery }
        : {}
    );
    const mk = String(moduleKey || '').toLowerCase();
    const isPeopleList =
      mk === 'people' || mk === 'person' || mk === 'contact';
    const isOrganizationList = mk === 'organization' || mk === 'organizations';

    let response;
    if (isOrganizationList) {
      response = await fetchOrganizationsListCached({ limit: 1000, ...depParams });
    } else if (isPeopleList) {
      response = await fetchPeopleListCached({ limit: 1000, sortBy: 'firstName', sortOrder: 'asc', ...depParams });
    } else if (String(moduleKey).toLowerCase() === 'catalog/categories') {
      response = await apiClient.get('/catalog/categories/tree');
    } else {
      const params = { limit: 1000 };
      const endpoint = getModuleRecordCrudPathBase(moduleKey);
      response = await apiClient.get(endpoint, { params });
    }
    
    fieldDbg('Lookup response for', moduleKey, ':', response);
    
    if (response.success) {
      if (String(moduleKey).toLowerCase() === 'catalog/categories') {
        const payload = response.data?.data ?? response.data;
        lookupOptions.value = flattenCatalogCategoryTree(payload);
      } else if (Array.isArray(response.data)) {
        lookupOptions.value = applyEventLinkedFormFilter(response.data);
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        lookupOptions.value = applyEventLinkedFormFilter(response.data.data);
        // Also check for pagination info
        if (response.data.total) {
          // If there are more records, we might want to fetch all or handle pagination
          fieldDbg('Total records:', response.data.total, 'Loaded:', response.data.data.length);
        }
      } else if (Array.isArray(response.data)) {
        lookupOptions.value = applyEventLinkedFormFilter(response.data);
      }
      
      syncLinkedFormSelection();
      fieldDbg('Loaded lookup options:', lookupOptions.value.length, 'for', props.field.key);
    } else {
      console.warn('Lookup fetch unsuccessful:', response);
      lookupOptions.value = [];
    }
  } catch (error) {
    console.error('Error fetching lookup options for', props.field.key, ':', error);
    lookupOptions.value = [];
  }
};

// If the option list (org filter, pagination, etc.) omits the selected id, load that record
// so the combobox shows a name instead of a raw id. Applies to read-only and create/edit.
const fetchLookupOptionById = async (id) => {
  if (!id || !isLookupField.value) return;
  if (isUserLookupField.value) return;

  const mk = lookupTargetModuleKey.value;
  if (!mk || mk === 'users') return;

  try {
    let endpoint;
    if (mk === 'organizations') {
      endpoint = `/v2/organization/${id}`;
    } else if (String(mk).toLowerCase() === 'catalog/categories') {
      // No direct GET by id for categories; reload tree and pick from it.
      endpoint = '/catalog/categories/tree';
    } else {
      const base = getModuleRecordCrudPathBase(mk);
      endpoint = `${base}/${id}`;
    }
    const response = await apiClient.get(endpoint);
    if (response?.success) {
      if (String(mk).toLowerCase() === 'catalog/categories') {
        const payload = response.data?.data ?? response.data;
        const all = flattenCatalogCategoryTree(payload);
        const picked = all.find((c) => String(c?._id) === String(id));
        if (picked) {
          const exists = lookupOptions.value.some((opt) => String(opt?._id) === String(picked._id));
          if (!exists) lookupOptions.value = [picked, ...lookupOptions.value];
        } else if (all.length) {
          lookupOptions.value = all;
        }
      } else {
        const record = response.data?.data || response.data;
        if (record && record._id) {
          const exists = lookupOptions.value.some((opt) => String(opt?._id) === String(record._id));
          if (!exists) lookupOptions.value = [record, ...lookupOptions.value];
        }
      }
    }
  } catch {
    // Non-fatal: label may stay empty until options load
  }
};

const ensureLookupLabelHydrated = async () => {
  if (!isLookupField.value) return;
  if (isUserLookupField.value) return;
  const id = normalizedLookupValue.value;
  if (id == null || id === '') return;
  if (getSelectedLookupOption()) return;
  await fetchLookupOptionById(String(id));
};

// Get lookup module name for modal header
const getLookupModuleName = () => {
  if (props.field.lookupSettings?.targetModule === 'users') {
    return 'Users';
  }
  if (String(props.field.lookupSettings?.targetModule || '').toLowerCase() === 'catalog/categories') {
    return 'Categories';
  }
  if (props.field.lookupSettings?.targetModule) {
    const moduleKey = props.field.lookupSettings.targetModule;
    // Capitalize first letter and add 's' if needed
    return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  }
  return 'Records';
};

// Open lookup modal
const openLookupModal = async () => {
  if (isReadOnly.value) return;
  showLookupModal.value = true;
  lookupModalColumns.value = generateLookupModalColumns();
  await fetchLookupModalData();
};

const createCatalogCategoryFromLookup = async () => {
  const name = String(activeLookupSearchSeed.value || '').trim();
  if (!name) {
    localValidationError.value = t('common.formCatalogCategoryNameRequired');
    return;
  }
  try {
    localValidationError.value = null;
    const response = await apiClient.post('/catalog/categories', { name });
    const created = response?.data?.data ?? response?.data ?? response;
    if (!created?._id) {
      localValidationError.value = t('common.formCatalogCategoryCreateFailed');
      return;
    }
    handleLookupRecordCreated({
      ...created,
      name: created.name || name,
      path: created.path || name,
    });
    await fetchLookupOptions();
  } catch (err) {
    localValidationError.value =
      err?.response?.data?.message ||
      err?.message ||
      t('common.formCatalogCategoryCreateFailed');
  }
};

const openLookupCreateDrawer = async () => {
  if (!canCreateLookupRecord.value) return;
  if (isCatalogCategoriesLookup.value) {
    await createCatalogCategoryFromLookup();
    return;
  }
  showLookupCreateDrawer.value = true;
};

const closeLookupCreateDrawer = () => {
  showLookupCreateDrawer.value = false;
};

const handleLookupRecordCreated = (savedRecord) => {
  const recordId = savedRecord?._id || savedRecord?.id;
  if (!savedRecord || !recordId) return;
  const exists = lookupOptions.value.some((opt) => String(opt?._id || opt?.id) === String(recordId));
  if (!exists) {
    lookupOptions.value = [{ ...savedRecord, _id: recordId }, ...lookupOptions.value];
  }
  updateValue(recordId);
  emit('blur');
  closeLookupCreateDrawer();
};

// Close lookup modal
const closeLookupModal = () => {
  showLookupModal.value = false;
  lookupModalData.value = [];
  lookupModalCurrentPage.value = 1;
  lookupModalSearchQuery.value = '';
  lookupModalSearchInput.value = '';
  lookupModalSortBy.value = '';
  lookupModalSortOrder.value = 'asc';
  if (lookupModalSearchDebounce) {
    window.clearTimeout(lookupModalSearchDebounce);
    lookupModalSearchDebounce = null;
  }
};

// Fetch data for lookup modal
const fetchLookupModalData = async () => {
  lookupModalLoading.value = true;
  let lookupTargetModule = '';
  try {
    let endpoint = '';
    let params = {
      page: lookupModalCurrentPage.value,
      limit: LOOKUP_MODAL_PAGE_SIZE
    };
    
    if (lookupModalSearchQuery.value) {
      params.search = lookupModalSearchQuery.value;
    }
    
    if (lookupModalSortBy.value) {
      params.sortBy = lookupModalSortBy.value;
      params.sortOrder = lookupModalSortOrder.value;
    }
    
    if (props.field.lookupSettings?.targetModule === 'users') {
      lookupTargetModule = 'users';
      endpoint = '/users/list';
      if (props.dependencyState?.lookupQuery && typeof props.dependencyState.lookupQuery === 'object') {
        params = { ...params, ...props.dependencyState.lookupQuery };
      }
    } else if (props.field.lookupSettings?.targetModule) {
      lookupTargetModule = props.field.lookupSettings.targetModule;
      const moduleKey = lookupTargetModule;
      // Handle special module key mappings
      if (moduleKey === 'organization' || moduleKey === 'organizations') {
        endpoint = '/v2/organization';
      } else if (String(moduleKey).toLowerCase() === 'catalog/categories') {
        endpoint = '/catalog/categories/tree';
      } else {
        endpoint = getModuleRecordCrudPathBase(moduleKey);
      }
      if (props.dependencyState?.lookupQuery && typeof props.dependencyState.lookupQuery === 'object') {
        const mk = String(moduleKey || '').toLowerCase();
        const isPeopleList = mk === 'people' || mk === 'person' || mk === 'contact';
        const isOrgList = mk === 'organization' || mk === 'organizations';
        if (isPeopleList || isOrgList) {
          params = { ...params, ...props.dependencyState.lookupQuery };
        }
      }
      const orgMk = String(moduleKey || '').toLowerCase();
      if (orgMk === 'organization' || orgMk === 'organizations') {
        params = vendorOrgLookupParams(props.field?.key, params);
      }
    } else {
      // Fallback when Settings omitted lookupSettings but field key is a known relationship.
      const inferred = inferLookupTargetFromFieldKey(props.field?.key);
      if (!inferred) {
        lookupModalLoading.value = false;
        return;
      }
      lookupTargetModule = inferred;
      if (inferred === 'organizations') {
        endpoint = '/v2/organization';
        params = vendorOrgLookupParams(props.field?.key, {
          ...params,
          ...(props.dependencyState?.lookupQuery && typeof props.dependencyState.lookupQuery === 'object'
            ? props.dependencyState.lookupQuery
            : {}),
        });
      } else if (inferred === 'people') {
        endpoint = '/people';
        if (props.dependencyState?.lookupQuery && typeof props.dependencyState.lookupQuery === 'object') {
          params = { ...params, ...props.dependencyState.lookupQuery };
        }
      } else {
        endpoint = `/${inferred}`;
      }
    }
    
    const response = await apiClient.get(endpoint, { params });
    
    if (response.success) {
      let data = [];
      if (String(lookupTargetModule).toLowerCase() === 'catalog/categories') {
        const payload = response.data?.data ?? response.data;
        data = flattenCatalogCategoryTree(payload);
        lookupModalTotal.value = data.length;
      } else if (Array.isArray(response.data)) {
        data = response.data;
        lookupModalTotal.value = response.data.length;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
        lookupModalTotal.value = response.data.total || response.data.data.length;
      }
      
      lookupModalData.value = applyEventLinkedFormFilter(data);
      
      // Generate columns if not already set
      if (lookupModalColumns.value.length === 0) {
        lookupModalColumns.value = generateLookupModalColumns();
      }
    }
  } catch (error) {
    console.error('Error fetching lookup modal data:', error);
    lookupModalData.value = [];
  } finally {
    lookupModalLoading.value = false;
  }
};

// Generate columns for lookup modal
const generateLookupModalColumns = () => {
  if (isAssignedToField.value) {
    return [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: true }
    ];
  }
  
  // Try to get module definition to generate proper columns
  // For now, use common fields or displayField
  const displayField = props.field.lookupSettings?.displayField || 'name';
  const columns = [
    { key: displayField, label: displayField.charAt(0).toUpperCase() + displayField.slice(1).replace(/_/g, ' '), sortable: true }
  ];
  
  // Add common fields
  const commonFields = ['email', 'phone', 'status', 'sales_type'];
  commonFields.forEach(field => {
    if (field !== displayField) {
      columns.push({ key: field, label: field.charAt(0).toUpperCase() + field.slice(1), sortable: true });
    }
  });
  
  return columns;
};

const getLookupSubtitle = (row) => {
  if (isUserLookupField.value || isAssignedToField.value) return row?.email || row?.username || '';
  const candidates = ['email', 'phone', 'website', 'industry', 'status', 'title'];
  const primaryKey = props.field?.lookupSettings?.displayField || (lookupModalColumns.value[0]?.key) || 'name';
  for (const key of candidates) {
    if (key === primaryKey) continue;
    const value = row?.[key];
    if (value) return String(value);
  }
  return '';
};

const refreshLookupModalData = () => {
  fetchLookupModalData();
};

// Handle row click in lookup modal
const handleLookupRowClick = (row) => {
  updateValue(row._id);
  emit('blur');
  closeLookupModal();
};

// Handle pagination in lookup modal
const handleLookupPageChange = (page) => {
  lookupModalCurrentPage.value = page;
  fetchLookupModalData();
};

// Handle search in lookup modal
const handleLookupSearch = (query) => {
  lookupModalSearchQuery.value = query;
  lookupModalSearchInput.value = query;
  lookupModalCurrentPage.value = 1;
  fetchLookupModalData();
};

const handleLookupSearchInput = () => {
  if (lookupModalSearchDebounce) window.clearTimeout(lookupModalSearchDebounce);
  lookupModalSearchDebounce = window.setTimeout(() => {
    lookupModalSearchQuery.value = lookupModalSearchInput.value.trim();
    lookupModalCurrentPage.value = 1;
    fetchLookupModalData();
  }, 250);
};

// Handle sort in lookup modal
const handleLookupSort = (sortBy, sortOrder) => {
  lookupModalSortBy.value = sortBy;
  lookupModalSortOrder.value = sortOrder;
  fetchLookupModalData();
};

// Handle populated object values - add them to lookupOptions if needed
const handlePopulatedValue = () => {
  if (!isLookupField.value) return;
  if (!props.value || typeof props.value !== 'object' || !props.value._id) return;
  if (isUserLookupField.value && !isValidObjectId(String(props.value._id))) return;
  
  // Check if this populated object is already in lookupOptions
  const exists = lookupOptions.value.some(
    (opt) => String(opt?._id) === String(props.value?._id)
  );
  
  // If not found and it's a populated object (has more than just _id), add it
  if (!exists && Object.keys(props.value).length > 1) {
    lookupOptions.value = [...lookupOptions.value, props.value];
  }
};

// Stable id for "filter people by org" (avoid refetching when parent re-creates a new lookupQuery object with the same org id)
const peopleListFilterOrgId = computed(() => {
  if (lookupTargetModuleKey.value !== 'people' || isUserLookupField.value) return null;
  const o = props.dependencyState?.lookupQuery?.organization;
  return o == null || o === '' ? null : String(o);
});

watch(peopleListFilterOrgId, async (next, prev) => {
  if (next === prev) return;
  if (!isLookupField.value) return;
  if (isUserLookupField.value) return;
  if (lookupTargetModuleKey.value !== 'people') return;
  await fetchLookupOptions();
  handlePopulatedValue();
  await ensureLookupLabelHydrated();
});

// When a contact is selected, org lookup uses `ids` to show only that org; refetch when it changes
const orgListRestrictIds = computed(() => {
  if (lookupTargetModuleKey.value !== 'organizations' || isUserLookupField.value) return null;
  const ids = props.dependencyState?.lookupQuery?.ids;
  if (ids == null || ids === '') return null;
  return String(ids);
});

watch(orgListRestrictIds, async (next, prev) => {
  if (next === prev) return;
  if (!isLookupField.value) return;
  if (isUserLookupField.value) return;
  if (lookupTargetModuleKey.value !== 'organizations') return;
  await fetchLookupOptions();
  handlePopulatedValue();
  await ensureLookupLabelHydrated();
});

watch(eventLinkedFormEventType, async (next, prev) => {
  if (next === prev) return;
  if (!isEventLinkedFormField.value) return;
  await fetchLookupOptions();
  handlePopulatedValue();
  await ensureLookupLabelHydrated();
  syncLinkedFormSelection();
});

watch(() => props.field?.key, () => {
  additionalPicklistOptions.value = [];
  picklistSearchQuery.value = '';
  picklistOptionCreating.value = false;
});

// Watch for field changes to refetch lookup options
watch(() => props.field, async (newField, oldField) => {
  // If targetModule changed, refetch
  const newDataType = String(newField?.dataType || '').toLowerCase();
  const oldDataType = String(oldField?.dataType || '').toLowerCase();
  const isNewLookupLike = !!newField?.lookupSettings?.targetModule
    || newDataType.includes('lookup')
    || newDataType.includes('reference')
    || newDataType.includes('related')
    || newDataType.includes('entity')
    || !!inferLookupTargetFromFieldKey(newField?.key);
  const isOldLookupLike = !!oldField?.lookupSettings?.targetModule
    || oldDataType.includes('lookup')
    || oldDataType.includes('reference')
    || oldDataType.includes('related')
    || oldDataType.includes('entity')
    || !!inferLookupTargetFromFieldKey(oldField?.key);
  if (isNewLookupLike) {
    const newTargetModule = newField?.lookupSettings?.targetModule;
    const oldTargetModule = oldField?.lookupSettings?.targetModule;
    if (!isOldLookupLike || newTargetModule !== oldTargetModule || !lookupOptions.value.length) {
      await fetchLookupOptions();
      handlePopulatedValue();
      await ensureLookupLabelHydrated();
    }
  }
}, { deep: true, immediate: false });

// Watch for value changes to handle populated objects
watch(
  () => props.value,
  async () => {
    if (isLookupField.value) {
      handlePopulatedValue();
      await ensureLookupLabelHydrated();
    }
  },
  { deep: true, immediate: true }
);

onMounted(async () => {
  // Fetch lookup options immediately when component mounts
  if (isLookupField.value) {
    await fetchLookupOptions();
    // Handle populated object value after fetching options
    handlePopulatedValue();
    if (normalizedLookupValue.value && !getSelectedLookupOption()) {
      await fetchLookupOptionById(normalizedLookupValue.value);
    }
  }

  // Event participants: multi-select of users (options loaded client-side)
  if (isEventAttendeesField.value) {
    try {
      const response = await fetchUsersListCached({ limit: 500 });
      if (response.success && Array.isArray(response.data)) {
        additionalPicklistOptions.value = response.data
          .filter((u) => isValidObjectId(String(u?._id || '')))
          .map((u) => {
            const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
            const label = name || u.email || u.username || String(u._id);
            return { value: String(u._id), label };
          });
      }
    } catch (err) {
      console.error('Error loading meeting participants:', err);
      additionalPicklistOptions.value = [];
    }
  }
  
  // Set default value if provided (skip numeric 0 — leave empty for placeholder)
  const isNumericType = ['Currency', 'Integer', 'Decimal'].includes(props.field.dataType);
  const skipZeroNumericDefault =
    isNumericType && (props.field.defaultValue === 0 || props.field.defaultValue === '0');
  const isUnset =
    props.value === null || props.value === undefined || props.value === '';
  const fieldKeyNorm = String(props.field?.key || '').toLowerCase();
  const isCurrencyCodeField =
    fieldKeyNorm === 'currency' || fieldKeyNorm === 'paymentcurrency';
  if (isUnset && isCurrencyCodeField) {
    // Prefer tenant org currency over schema/mongoose defaults (e.g. 'USD')
    emit('update:value', resolveOrgCurrencyCode(authStore.organization));
  } else if (
    props.field.defaultValue !== null &&
    props.field.defaultValue !== undefined &&
    !skipZeroNumericDefault &&
    isUnset
  ) {
    emit('update:value', props.field.defaultValue);
  }

  // Meeting mode default: Virtual (remote-first)
  if (
    props.moduleKey === 'events' &&
    fieldKeyNorm === 'meetingmode' &&
    isUnset
  ) {
    emit('update:value', 'Virtual');
  }

  // Conference provider default when Virtual/Hybrid path
  if (
    props.moduleKey === 'events' &&
    fieldKeyNorm === 'conferenceprovider' &&
    isUnset
  ) {
    emit('update:value', 'google_meet');
  }
  
  // Ensure Multi-Picklist fields always have array values
  if (props.field.dataType === 'Multi-Picklist' && !Array.isArray(props.value)) {
    const arrayValue = props.value ? (Array.isArray(props.value) ? props.value : [props.value]) : [];
    emit('update:value', arrayValue);
  }
});

onUnmounted(() => {
  if (lookupModalSearchDebounce) {
    window.clearTimeout(lookupModalSearchDebounce);
    lookupModalSearchDebounce = null;
  }
});
</script>

<style scoped>
</style>
