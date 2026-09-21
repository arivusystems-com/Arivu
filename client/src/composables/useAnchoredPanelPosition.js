import { ref, onUnmounted } from 'vue';

const DEFAULT_PANEL_WIDTH = 320;
const DEFAULT_PANEL_HEIGHT = 52;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 6;
/** Half-height of caret box used when aligning to anchor center. */
const CARET_HALF_PX = 8;

function resolveElement(refValue) {
  if (!refValue) return null;
  if (refValue instanceof HTMLElement) return refValue;
  if (refValue?.$el instanceof HTMLElement) return refValue.$el;
  return null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(min, value), max);
}

/**
 * Fixed-position panel anchored to a trigger element (escapes overflow-hidden parents).
 * @param {{ panelWidth?: number, panelHeight?: number, preferredPlacement?: 'bottom' | 'right' }} options
 */
export function useAnchoredPanelPosition(options = {}) {
  const panelWidth = options.panelWidth ?? DEFAULT_PANEL_WIDTH;
  const defaultPreferredPlacement = options.preferredPlacement ?? 'bottom';
  const panelStyle = ref({ top: '0px', left: '0px', width: `${panelWidth}px` });
  const placement = ref(defaultPreferredPlacement);
  const caretOffsetPx = ref(16);
  const isOpen = ref(false);

  let activePreferredPlacement = defaultPreferredPlacement;

  const applyBottomPlacement = (rect, maxWidth, height) => {
    let left = rect.left;
    if (left + maxWidth + VIEWPORT_MARGIN > window.innerWidth) {
      left = rect.right - maxWidth;
    }
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - maxWidth - VIEWPORT_MARGIN));

    let top = rect.bottom + ANCHOR_GAP;
    let nextPlacement = 'bottom';
    if (top + height + VIEWPORT_MARGIN > window.innerHeight) {
      top = rect.top - height - ANCHOR_GAP;
      nextPlacement = 'top';
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    const anchorCenterX = rect.left + rect.width / 2;
    caretOffsetPx.value = clamp(anchorCenterX - left - CARET_HALF_PX, 12, Math.max(12, maxWidth - 28));
    placement.value = nextPlacement;
    panelStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${maxWidth}px`,
    };
  };

  const applyRightPlacement = (rect, maxWidth, height) => {
    let left = rect.right + ANCHOR_GAP;
    if (left + maxWidth + VIEWPORT_MARGIN > window.innerWidth) {
      applyBottomPlacement(rect, maxWidth, height);
      return;
    }

    let top = rect.top + rect.height / 2 - height / 2;
    top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - height - VIEWPORT_MARGIN));

    const anchorCenterY = rect.top + rect.height / 2;
    caretOffsetPx.value = clamp(anchorCenterY - top - CARET_HALF_PX, 12, Math.max(12, height - 28));
    placement.value = 'right';
    panelStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      width: `${maxWidth}px`,
    };
  };

  const updatePosition = (triggerRef, panelRef) => {
    const anchor = resolveElement(triggerRef?.value ?? triggerRef);
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const measuredHeight = panelRef?.value?.offsetHeight;
    const height = measuredHeight && measuredHeight > 0 ? measuredHeight : (options.panelHeight ?? DEFAULT_PANEL_HEIGHT);
    const maxWidth = Math.min(panelWidth, window.innerWidth - VIEWPORT_MARGIN * 2);

    if (activePreferredPlacement === 'right') {
      applyRightPlacement(rect, maxWidth, height);
      return;
    }
    applyBottomPlacement(rect, maxWidth, height);
  };

  let activeTriggerRef = null;
  let activePanelRef = null;

  const onViewportChange = () => {
    if (!isOpen.value) return;
    updatePosition(activeTriggerRef, activePanelRef);
  };

  const attachListeners = () => {
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
  };

  const detachListeners = () => {
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
  };

  /**
   * @param {unknown} triggerRef
   * @param {import('vue').Ref<HTMLElement | null> | null} panelRef
   * @param {{ preferredPlacement?: 'bottom' | 'right' }} [overrides]
   */
  const openAt = (triggerRef, panelRef, overrides = {}) => {
    activePreferredPlacement = overrides.preferredPlacement ?? defaultPreferredPlacement;
    activeTriggerRef = triggerRef;
    activePanelRef = panelRef;
    isOpen.value = true;
    updatePosition(triggerRef, panelRef);
    attachListeners();
  };

  const close = () => {
    isOpen.value = false;
    activeTriggerRef = null;
    activePanelRef = null;
    activePreferredPlacement = defaultPreferredPlacement;
    detachListeners();
  };

  const refresh = () => {
    if (!isOpen.value) return;
    updatePosition(activeTriggerRef, activePanelRef);
  };

  onUnmounted(detachListeners);

  return {
    panelStyle,
    placement,
    caretOffsetPx,
    isOpen,
    openAt,
    close,
    refresh,
    updatePosition,
  };
}
