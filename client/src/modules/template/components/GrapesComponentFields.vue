<template>
  <section v-if="context" class="space-y-3 border-b pb-4" :class="ui.border">
    <div>
      <h3 :class="ui.label">{{ t(inspectorLabelKey(context.kind)) }}</h3>
      <p v-if="hintKey" class="mt-1 text-xs leading-relaxed" :class="ui.textMuted">{{ t(hintKey) }}</p>
    </div>

    <!-- Merge field -->
    <template v-if="context.kind === 'merge-field'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMergePath') }}</label>
          <input
            v-model="mergePathField.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="mergePathField.onFocus"
            @input="mergePathField.onInput"
            @blur="mergePathField.onBlur"
          />
      </div>
    </template>

    <!-- Variable -->
    <template v-else-if="context.kind === 'variable'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldVariableName') }}</label>
          <input
            v-model="variableName.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="variableName.onFocus"
            @input="variableName.onInput"
            @blur="variableName.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldDefaultValue') }}</label>
          <input
            v-model="variableField.draft"
            type="text"
            :class="ui.input"
            @focus="variableField.onFocus"
            @input="variableField.onInput"
            @blur="variableField.onBlur"
          />
      </div>
    </template>

    <!-- Formula -->
    <template v-else-if="context.kind === 'formula'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldExpression') }}</label>
          <input
            v-model="formulaExpr.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="formulaExpr.onFocus"
            @input="formulaExpr.onInput"
            @blur="formulaExpr.onBlur"
          />
      </div>
    </template>

    <!-- Conditional -->
    <template v-else-if="context.kind === 'conditional'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldCondition') }}</label>
          <input
            v-model="conditionExpr.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="conditionExpr.onFocus"
            @input="conditionExpr.onInput"
            @blur="conditionExpr.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
        <textarea
          v-model="innerText.draft"
          rows="3"
          :class="ui.input"
          @focus="innerText.onFocus"
          @input="innerText.onInput"
          @blur="innerText.onBlur"
        />
      </div>
    </template>

    <!-- Loop / Repeater -->
    <template v-else-if="context.kind === 'loop' || context.kind === 'repeater'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldCollection') }}</label>
          <input
            v-model="collectionName.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="collectionName.onFocus"
            @input="collectionName.onInput"
            @blur="collectionName.onBlur"
          />
      </div>
      <div v-if="context.kind === 'repeater'">
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldItemAlias') }}</label>
          <input
            v-model="itemAlias.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="itemAlias.onFocus"
            @input="itemAlias.onInput"
            @blur="itemAlias.onBlur"
          />
      </div>
    </template>

    <!-- Related records -->
    <template v-else-if="context.kind === 'related-records'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldRelation') }}</label>
          <input
            v-model="relationName.draft"
            type="text"
            :class="ui.input"
            @focus="relationName.onFocus"
            @input="relationName.onInput"
            @blur="relationName.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldModuleScope') }}</label>
          <input
            v-model="moduleScope.draft"
            type="text"
            :class="ui.input"
            @focus="moduleScope.onFocus"
            @input="moduleScope.onInput"
            @blur="moduleScope.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldRecordPath') }}</label>
          <input
            v-model="relatedRecord.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="relatedRecord.onFocus"
            @input="relatedRecord.onInput"
            @blur="relatedRecord.onBlur"
          />
      </div>
    </template>

    <!-- QR code -->
    <template v-else-if="context.kind === 'qr-code'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldValue') }}</label>
          <input
            v-model="qrValue.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="qrValue.onFocus"
            @input="qrValue.onInput"
            @blur="qrValue.onBlur"
          />
      </div>
    </template>

    <!-- Barcode -->
    <template v-else-if="context.kind === 'barcode'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldBarcodeFormat') }}</label>
        <BuilderSelect
          :model-value="attr('data-format', 'code128')"
          :options="barcodeFormatOptions"
          @update:model-value="patchAttr('data-format', $event)"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldValue') }}</label>
          <input
            v-model="mergePathField.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="mergePathField.onFocus"
            @input="mergePathField.onInput"
            @blur="mergePathField.onBlur"
          />
      </div>
    </template>

    <!-- Logo / Image -->
    <template v-else-if="context.kind === 'logo' || context.kind === 'image'">
      <button
        v-if="context.kind === 'logo'"
        type="button"
        :class="[ui.btnGhost, 'w-full text-xs']"
        :disabled="companyLogoBusy"
        @click="applyCompanyLogo"
      >
        {{ companyLogoBusy ? t('states.loading') : t('templates.builderUseCompanyLogo') }}
      </button>
      <BuilderImageAssetPicker :library="assetLibrary" @select="onAssetPicked" />
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageSrc') }}</label>
          <input
            v-model="imageSrc.draft"
            type="text"
            :class="ui.input"
            @focus="imageSrc.onFocus"
            @input="imageSrc.onInput"
            @blur="imageSrc.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldImageAlt') }}</label>
          <input
            v-model="imageAlt.draft"
            type="text"
            :class="ui.input"
            @focus="imageAlt.onFocus"
            @input="imageAlt.onInput"
            @blur="imageAlt.onBlur"
          />
      </div>
    </template>

    <!-- Icon -->
    <template v-else-if="context.kind === 'icon'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldIconName') }}</label>
          <input
            v-model="innerText.draft"
            type="text"
            maxlength="2"
            :class="ui.input"
            @focus="innerText.onFocus"
            @input="innerText.onInput"
            @blur="innerText.onBlur"
          />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldIconSize') }}</label>
        <input
          :value="iconSize"
          type="number"
          min="12"
          max="96"
          :class="ui.input"
          @input="patchStyle({ 'font-size': $event.target.value ? `${$event.target.value}px` : '' })"
        />
      </div>
    </template>

    <!-- Signature -->
    <template v-else-if="context.kind === 'signature'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldSignerName') }}</label>
          <input
            v-model="signerLabelField.draft"
            type="text"
            :class="ui.input"
            @focus="signerLabelField.onFocus"
            @input="signerLabelField.onInput"
            @blur="signerLabelField.onBlur"
          />
      </div>
    </template>

    <!-- Link / Button -->
    <template v-else-if="context.kind === 'link' || context.kind === 'button'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
          <input
            v-model="innerText.draft"
            type="text"
            :class="ui.input"
            @focus="innerText.onFocus"
            @input="innerText.onInput"
            @blur="innerText.onBlur"
          />
        </div>
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldHref') }}</label>
          <input
            v-model="linkHref.draft"
            type="text"
            :class="ui.input"
            @focus="linkHref.onFocus"
            @input="linkHref.onInput"
            @blur="linkHref.onBlur"
          />
      </div>
    </template>

    <!-- Heading -->
    <template v-else-if="context.kind === 'heading'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldHeadingLevel') }}</label>
        <BuilderSelect
          :model-value="headingLevel"
          :options="headingLevelOptions"
          @update:model-value="onHeadingLevelChange"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
        <textarea
          v-model="innerText.draft"
          rows="2"
          :class="ui.input"
          @focus="innerText.onFocus"
          @input="innerText.onInput"
          @blur="innerText.onBlur"
        />
      </div>
    </template>

    <!-- Paragraph / Rich text / Address blocks -->
    <template v-else-if="showsContentEditor">
      <GrapesRichTextField
        v-if="context.kind === 'rich-text'"
        :field="richTextContent"
        :watch-key="targetKey"
        @update:draft="richTextContent.draft = $event"
      />
      <div v-else>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
        <textarea
          v-model="content.draft"
          :rows="context.kind === 'html' ? 5 : 3"
          :class="[ui.input, context.kind === 'html' ? 'font-mono text-xs' : '']"
          @focus="content.onFocus"
          @input="content.onInput"
          @blur="content.onBlur"
        />
      </div>
    </template>

    <!-- List -->
    <template v-else-if="context.kind === 'list'">
      <label class="mb-1 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="listOrdered"
          @change="onListOrderedChange($event.target.checked)"
        />
        {{ t('templates.builderFieldListOrdered') }}
      </label>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldListItems') }}</label>
        <textarea
          v-model="listItems.draft"
          rows="4"
          :class="ui.input"
          @focus="listItems.onFocus"
          @input="listItems.onInput"
          @blur="listItems.onBlur"
        />
      </div>
    </template>

    <!-- Spacer -->
    <template v-else-if="context.kind === 'spacer'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldSpacerHeight') }}</label>
        <input
          :value="spacerHeight"
          type="number"
          min="4"
          max="240"
          :class="ui.input"
          @input="patchStyle({ height: $event.target.value ? `${$event.target.value}px` : '' })"
        />
      </div>
    </template>

    <!-- Watermark -->
    <template v-else-if="context.kind === 'watermark'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldText') }}</label>
        <input
          v-model="innerText.draft"
          type="text"
          :class="ui.input"
          @focus="innerText.onFocus"
          @input="innerText.onInput"
          @blur="innerText.onBlur"
        />
      </div>
    </template>

    <!-- Page number -->
    <template v-else-if="context.kind === 'page-number'">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldPageNumberFormat') }}</label>
          <input
            v-model="pageNumber.draft"
            type="text"
            :class="[ui.input, 'font-mono']"
            @focus="pageNumber.onFocus"
            @input="pageNumber.onInput"
            @blur="pageNumber.onBlur"
          />
      </div>
    </template>

    <!-- Totals -->
    <template v-else-if="context.kind === 'totals'">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="totalsFlag('data-show-subtotal', true)"
          @change="patchAttr('data-show-subtotal', $event.target.checked ? 'true' : 'false')"
        />
        {{ t('templates.builderFieldShowSubtotal') }}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="totalsFlag('data-show-tax', true)"
          @change="patchAttr('data-show-tax', $event.target.checked ? 'true' : 'false')"
        />
        {{ t('templates.builderFieldShowTax') }}
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="totalsFlag('data-show-grand-total', true)"
          @change="patchAttr('data-show-grand-total', $event.target.checked ? 'true' : 'false')"
        />
        {{ t('templates.builderFieldShowGrandTotal') }}
      </label>
    </template>

    <!-- Tax summary -->
    <template v-else-if="context.kind === 'tax-summary'">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          :checked="totalsFlag('data-show-breakdown', true)"
          @change="patchAttr('data-show-breakdown', $event.target.checked ? 'true' : 'false')"
        />
        {{ t('templates.builderFieldShowTaxBreakdown') }}
      </label>
    </template>

    <!-- Page break -->
    <template v-else-if="context.kind === 'page-break'">
      <p class="text-xs leading-relaxed" :class="ui.textMuted">{{ t('templates.builderPageBreakHint') }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useAttrDraft, useComponentTextDraft } from '../composables/useComponentTextDraft';
import { useCompanyLogoAsset } from '../composables/useCompanyLogoAsset';
import { buildDefaultLogoAttributes, resolveLogoPreviewUrl } from '../editor/logoContent';
import { applyImageSrcToComponent } from '../editor/canvasImageSrc';
import BuilderImageAssetPicker from '@/components/templates/builder/BuilderImageAssetPicker.vue';
import BuilderSelect from './BuilderSelect.vue';
import GrapesRichTextField from './GrapesRichTextField.vue';
import {
  inspectorLabelKey,
  resolveInspectorContext
} from '../editor/componentInspector';
import {
  formatMergeToken,
  parseMergePathFromContent,
  patchComponentAttributes,
  patchComponentStyle,
  readComponentAttributes,
  readStyleValue,
  readRichTextHtml,
  readTextContent,
  writeRichTextHtml,
  writeTextContent
} from '../editor/selection';

const props = defineProps({
  component: { type: Object, default: null },
  revision: { type: Number, default: 0 },
  assetLibrary: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const emit = defineEmits(['change', 'pick-asset']);

const { t } = useI18n();
const ui = useBuilderUi();
const companyLogoBusy = ref(false);
const { ensureCompanyLogo } = useCompanyLogoAsset();

const context = computed(() => {
  void props.revision;
  return resolveInspectorContext(props.component);
});

const target = computed(() => context.value?.target ?? null);
const targetKey = computed(
  () => `${context.value?.kind || 'none'}:${String(target.value?.getId?.() || '')}:${props.revision}`
);

function commitChange() {
  emit('change');
}

function readComponentContent(model) {
  return readTextContent(model);
}

function writeComponentContent(model, value) {
  writeTextContent(model, value, { silent: true, force: true });
}

function readListItems(model) {
  const items = model.components?.().models || [];
  if (items.length) {
    return items
      .map((item) => readTextContent(item).trim())
      .filter(Boolean)
      .join('\n');
  }
  return readTextContent(model);
}

function writeListItems(model, value) {
  const ordered = String(model.get('tagName') || 'ul').toLowerCase() === 'ol';
  const lines = String(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const html = lines.map((line) => `<li>${line}</li>`).join('');
  model.components(`<${ordered ? 'ol' : 'ul'}>${html}</${ordered ? 'ol' : 'ul'}>`);
}

function readSignerLabel(model) {
  const children = model.components?.().models || [];
  const label = children.find((child) => String(child.get('tagName') || '').toLowerCase() === 'div');
  return label ? readTextContent(label) : readTextContent(model);
}

function writeSignerLabel(model, value) {
  const children = model.components?.().models || [];
  const label = children.find((child) => String(child.get('tagName') || '').toLowerCase() === 'div');
  if (label) writeTextContent(label, value, { silent: true, force: true });
  else writeTextContent(model, value, { silent: true, force: true });
}

function readRelatedRecordPath(model) {
  return parseMergePathFromContent(readTextContent(model)) || 'related.name';
}

function writeRelatedRecordPath(model, value) {
  const child = model.components?.().models?.[1];
  const token = formatMergeToken(value);
  if (child) writeTextContent(child, token, { silent: true, force: true });
  else writeTextContent(model, token, { silent: true, force: true });
}

const innerText = useComponentTextDraft(
  target,
  targetKey,
  readTextContent,
  (model, value) => writeTextContent(model, value, { silent: true, force: true }),
  commitChange
);
const content = useComponentTextDraft(
  target,
  targetKey,
  readComponentContent,
  writeComponentContent,
  commitChange
);
const richTextContent = useComponentTextDraft(
  target,
  targetKey,
  readRichTextHtml,
  (model, value) => writeRichTextHtml(model, value, { silent: true, force: true }),
  commitChange
);
const mergePathField = useComponentTextDraft(
  target,
  targetKey,
  (model) => parseMergePathFromContent(readTextContent(model)),
  (model, value) => writeTextContent(model, formatMergeToken(value), { silent: true, force: true }),
  commitChange
);
const variableField = useComponentTextDraft(
  target,
  targetKey,
  readTextContent,
  (model, value) => writeTextContent(model, value, { silent: true, force: true }),
  commitChange
);
const listItems = useComponentTextDraft(target, targetKey, readListItems, writeListItems, commitChange);
const relatedRecord = useComponentTextDraft(
  target,
  targetKey,
  readRelatedRecordPath,
  writeRelatedRecordPath,
  commitChange
);
const pageNumber = useComponentTextDraft(
  target,
  targetKey,
  (model) => parseMergePathFromContent(readTextContent(model)) || 'System.pageNumber',
  (model, value) => writeTextContent(model, formatMergeToken(value), { silent: true, force: true }),
  commitChange
);
const signerLabelField = useComponentTextDraft(
  target,
  targetKey,
  readSignerLabel,
  writeSignerLabel,
  commitChange
);

const variableName = useAttrDraft(target, targetKey, 'data-name', 'customVar', commitChange);
const formulaExpr = useAttrDraft(target, targetKey, 'data-expression', 'subtotal * 0.1', commitChange);
const conditionExpr = useAttrDraft(target, targetKey, 'data-condition', '', commitChange);
const collectionName = useAttrDraft(target, targetKey, 'data-collection', 'lines', commitChange);
const itemAlias = useAttrDraft(target, targetKey, 'data-item-alias', 'line', commitChange);
const relationName = useAttrDraft(target, targetKey, 'data-relation', 'contacts', commitChange);
const moduleScope = useAttrDraft(target, targetKey, 'data-module-scope', '', commitChange);
const qrValue = useAttrDraft(target, targetKey, 'data-value', '', commitChange);
const imageSrc = useAttrDraft(target, targetKey, 'src', '', commitChange);
const imageAlt = useAttrDraft(target, targetKey, 'alt', '', commitChange);
const linkHref = useAttrDraft(target, targetKey, 'href', '#', commitChange);

const hintKey = computed(() => {
  const kind = context.value?.kind;
  if (kind === 'page-break') return 'templates.builderPageBreakHint';
  if (kind === 'conditional') return 'templates.builderConditionalHint';
  if (kind === 'loop' || kind === 'repeater') return 'templates.builderLoopHint';
  return '';
});

const showsContentEditor = computed(() => {
  const kind = context.value?.kind;
  return ['paragraph', 'rich-text', 'html', 'address', 'organization', 'contact-card', 'header', 'footer'].includes(kind);
});

const headingLevelOptions = computed(() =>
  [1, 2, 3, 4, 5, 6].map((level) => ({
    value: String(level),
    label: `H${level}`
  }))
);

const barcodeFormatOptions = computed(() => [
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'upc', label: 'UPC' }
]);

function attr(key, fallback = '') {
  void props.revision;
  if (!target.value) return fallback;
  return readComponentAttributes(target.value)[key] || fallback;
}

const iconSize = computed(() => {
  void props.revision;
  return readStyleValue(target.value, ['font-size', 'fontSize']).replace(/px$/, '') || '16';
});

const headingLevel = computed(() => {
  const tag = String(target.value?.get?.('tagName') || 'h2').toLowerCase();
  const match = tag.match(/^h([1-6])$/);
  return match ? match[1] : '2';
});

const listOrdered = computed(() => String(target.value?.get?.('tagName') || 'ul').toLowerCase() === 'ol');

function patchStyle(style) {
  if (!target.value) return;
  patchComponentStyle(target.value, style);
  commitChange();
}

const spacerHeight = computed(() => {
  void props.revision;
  return readStyleValue(target.value, ['height']).replace(/px$/, '') || '24';
});

function totalsFlag(key, defaultValue) {
  const value = attr(key, defaultValue ? 'true' : 'false');
  return value !== 'false';
}

function patchAttr(key, value) {
  if (!target.value) return;
  patchComponentAttributes(target.value, { [key]: value });
  commitChange();
}

function onHeadingLevelChange(level) {
  if (!target.value) return;
  target.value.set('tagName', `h${level}`);
  commitChange();
}

function onListOrderedChange(checked) {
  if (!target.value) return;
  target.value.set('tagName', checked ? 'ol' : 'ul');
  commitChange();
}

function onAssetPicked(payload) {
  emit('pick-asset', payload);
  if (!target.value) return;
  const patch = {
    alt: payload.alt || ''
  };
  const attrs = readComponentAttributes(target.value);
  if (attrs['data-logo'] === 'true') {
    patch['data-company-logo'] = 'false';
    patch['data-custom-image'] = 'true';
    patch['data-merge-src'] = undefined;
  }
  patchComponentAttributes(target.value, patch);
  applyImageSrcToComponent(target.value, payload.src);
  commitChange();
}

async function applyCompanyLogo() {
  if (!target.value) return;
  companyLogoBusy.value = true;
  try {
    const data = await ensureCompanyLogo();
    const previewUrl = resolveLogoPreviewUrl(data?.asset?.downloadUrl, data?.organizationLogoUrl);
    if (!previewUrl) return;
    patchComponentAttributes(target.value, buildDefaultLogoAttributes({
      assetUrl: previewUrl,
      alt: data?.organizationName || ''
    }));
    applyImageSrcToComponent(target.value, previewUrl);
    commitChange();
  } finally {
    companyLogoBusy.value = false;
  }
}
</script>
