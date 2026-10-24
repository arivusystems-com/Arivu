import type { CanvasWidget, WidgetFrame } from '@/astraStudio/types';
import { sortWidgetsForFlow } from '@/astraStudio/widgets/widgetContent';

export const LIVING_BOARD_WIDTH = 1140;
/** Gutter between widgets (also used as collision margin). */
export const LIVING_BOARD_GAP = 24;
export const LIVING_BOARD_PAD = 24;
export const LIVING_BOARD_COLS = 3;
/** Fine row snap (px). Column snap uses column slots. */
export const LIVING_GRID = 16;
export const LIVING_MIN_W = 200;
export const LIVING_MIN_H = LIVING_GRID * 8; // 128
/** Clearance under board content for floating Ask bar */
export const LIVING_ASK_CLEARANCE = 140;

export function livingColWidth(
  boardWidth = LIVING_BOARD_WIDTH,
  columns = LIVING_BOARD_COLS,
  gap = LIVING_BOARD_GAP,
  padding = LIVING_BOARD_PAD,
): number {
  const inner = boardWidth - padding * 2 - gap * (columns - 1);
  return Math.max(LIVING_MIN_W, Math.floor(inner / columns));
}

function snapScalar(n: number, grid = LIVING_GRID): number {
  return Math.round(n / grid) * grid;
}

/**
 * Snap frame to Living Canvas grid:
 * - x → column slots (1–3)
 * - w → column spans (1–3)
 * - y/h → 16px grid
 */
export function snapLivingFrame(
  frame: WidgetFrame,
  opts: {
    boardWidth?: number;
    columns?: number;
    gap?: number;
    padding?: number;
    grid?: number;
  } = {},
): WidgetFrame {
  const gap = opts.gap ?? LIVING_BOARD_GAP;
  const padding = opts.padding ?? LIVING_BOARD_PAD;
  const columns = opts.columns ?? LIVING_BOARD_COLS;
  const grid = opts.grid ?? LIVING_GRID;
  const boardWidth = opts.boardWidth ?? LIVING_BOARD_WIDTH;
  const colW = livingColWidth(boardWidth, columns, gap, padding);
  const stride = colW + gap;

  const rawX = Number(frame.x) || 0;
  const rawY = Number(frame.y) || 0;
  const rawW = Number(frame.w) || colW;
  const rawH = Number(frame.h) || 200;

  let col = Math.round((rawX - padding) / stride);
  col = Math.max(0, Math.min(columns - 1, col));

  let span = Math.round((rawW + gap) / stride);
  if (!Number.isFinite(span) || span < 1) span = 1;
  span = Math.max(1, Math.min(columns - col, span));

  const x = padding + col * stride;
  const w = span * colW + (span - 1) * gap;
  const y = Math.max(0, snapScalar(rawY, grid));
  const h = Math.max(LIVING_MIN_H, snapScalar(rawH, grid));

  return {
    ...frame,
    x,
    y,
    w,
    h,
    z: frame.z ?? 1,
  };
}

/** True when frames intersect (including required gap). */
export function framesOverlap(
  a: WidgetFrame,
  b: WidgetFrame,
  gap = LIVING_BOARD_GAP,
): boolean {
  return !(
    a.x + a.w + gap <= b.x
    || b.x + b.w + gap <= a.x
    || a.y + a.h + gap <= b.y
    || b.y + b.h + gap <= a.y
  );
}

function hasCollision(
  frame: WidgetFrame,
  others: WidgetFrame[],
  gap = LIVING_BOARD_GAP,
): boolean {
  return others.some((o) => framesOverlap(frame, o, gap));
}

type SnapOpts = {
  boardWidth?: number;
  columns?: number;
  gap?: number;
  padding?: number;
  grid?: number;
  /** Keep active at pointer position (live drag preview) */
  freeActive?: boolean;
};

/**
 * Push obstacle clear of the active widget.
 * Prefer down (column flow); sideways into next free column when horizontal push is clearer.
 */
function pushObstacleAway(
  active: WidgetFrame,
  obstacle: WidgetFrame,
  gap: number,
  snapOpts: SnapOpts,
): WidgetFrame {
  // Cards entirely above the active one stay put unless they actually overlap
  if (obstacle.y + obstacle.h <= active.y + 1 && !framesOverlap(active, obstacle, gap)) {
    return obstacle;
  }

  const padding = snapOpts.padding ?? LIVING_BOARD_PAD;
  const columns = snapOpts.columns ?? LIVING_BOARD_COLS;
  const boardWidth = snapOpts.boardWidth ?? LIVING_BOARD_WIDTH;
  const colW = livingColWidth(boardWidth, columns, gap, padding);
  const stride = colW + gap;

  const activeCX = active.x + active.w / 2;
  const activeCY = active.y + active.h / 2;
  const obsCX = obstacle.x + obstacle.w / 2;
  const obsCY = obstacle.y + obstacle.h / 2;
  const dx = obsCX - activeCX;
  const dy = obsCY - activeCY;

  // Prefer pushing downward (below the resized/dragged card)
  if (dy >= 0 || obstacle.y >= active.y) {
    return snapLivingFrame(
      { ...obstacle, y: active.y + active.h + gap },
      snapOpts,
    );
  }

  // Overlapping card that sits mostly above — nudge up only if needed
  if (framesOverlap(active, obstacle, gap)) {
    const upY = active.y - obstacle.h - gap;
    if (upY >= 0) {
      return snapLivingFrame({ ...obstacle, y: upY }, snapOpts);
    }
  }

  // Sideways into adjacent column
  const obsSpan = Math.max(1, Math.round((obstacle.w + gap) / stride));
  let col = Math.round((obstacle.x - padding) / stride);
  if (dx >= 0) col += 1;
  else col -= obsSpan;
  col = Math.max(0, Math.min(columns - obsSpan, col));
  const x = padding + col * stride;
  let next = snapLivingFrame({ ...obstacle, x }, snapOpts);
  if (framesOverlap(active, next, gap)) {
    next = snapLivingFrame({ ...next, y: active.y + active.h + gap }, snapOpts);
  }
  return next;
}

/**
 * Place active widget at desired (snapped) position and push obstacles
 * (and anything they collide with) until nothing overlaps.
 */
export function resolveLivingLayoutPush(
  activeId: string,
  desired: WidgetFrame,
  widgets: Array<{ id: string; frame: WidgetFrame }>,
  opts: SnapOpts = {},
): Array<{ id: string; frame: WidgetFrame }> {
  const gap = opts.gap ?? LIVING_BOARD_GAP;
  const snapOpts: SnapOpts = {
    boardWidth: opts.boardWidth ?? LIVING_BOARD_WIDTH,
    columns: opts.columns ?? LIVING_BOARD_COLS,
    gap,
    padding: opts.padding ?? LIVING_BOARD_PAD,
    grid: opts.grid ?? LIVING_GRID,
  };

  const frames = new Map<string, WidgetFrame>();
  const activeFrame = opts.freeActive
    ? {
        ...desired,
        x: Math.max(0, Number(desired.x) || 0),
        y: Math.max(0, Number(desired.y) || 0),
        w: Math.max(LIVING_MIN_W, Number(desired.w) || livingColWidth()),
        h: Math.max(LIVING_MIN_H, Number(desired.h) || 200),
      }
    : snapLivingFrame(desired, snapOpts);
  for (const w of widgets) {
    frames.set(w.id, w.id === activeId ? activeFrame : { ...w.frame });
  }
  if (!frames.has(activeId)) {
    frames.set(activeId, activeFrame);
  }

  for (let iter = 0; iter < 60; iter += 1) {
    let changed = false;
    const ids = [...frames.keys()];
    const active = frames.get(activeId);
    if (!active) break;

    // 1) Active vs others — only push obstacles that actually overlap
    for (const id of ids) {
      if (id === activeId) continue;
      const obs = frames.get(id);
      if (!obs || !framesOverlap(active, obs, gap)) continue;
      // Same-column / overlapping only — don't fling distant cards across the board
      const pushed = pushObstacleAway(active, obs, gap, snapOpts);
      if (pushed.x !== obs.x || pushed.y !== obs.y || pushed.w !== obs.w || pushed.h !== obs.h) {
        frames.set(id, pushed);
        changed = true;
      } else {
        frames.set(
          id,
          snapLivingFrame({ ...obs, y: active.y + active.h + gap }, snapOpts),
        );
        changed = true;
      }
    }

    // 2) Obstacle vs obstacle cascade (neither is active — push the lower/righter one)
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aId = ids[i];
        const bId = ids[j];
        if (!aId || !bId || aId === activeId || bId === activeId) continue;
        const a = frames.get(aId);
        const b = frames.get(bId);
        if (!a || !b || !framesOverlap(a, b, gap)) continue;
        // Push the one further down / right
        const pushB = b.y > a.y || (b.y === a.y && b.x >= a.x);
        if (pushB) {
          frames.set(bId, pushObstacleAway(a, b, gap, snapOpts));
        } else {
          frames.set(aId, pushObstacleAway(b, a, gap, snapOpts));
        }
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Gravity: slide non-pinned widgets up into free gaps
  const gravitySettled = applyLivingGravity(
    [...frames.entries()].map(([id, frame]) => ({ id, frame })),
    { ...snapOpts, pinnedId: activeId },
  );

  // Safety: if anything still overlaps, push the lower card down (never stack)
  const byId = new Map(gravitySettled.map((row) => [row.id, { ...row.frame }]));
  const order = [...byId.keys()].sort((a, b) => {
    const fa = byId.get(a)!;
    const fb = byId.get(b)!;
    return fa.y - fb.y || fa.x - fb.x;
  });
  for (let i = 0; i < order.length; i += 1) {
    for (let j = i + 1; j < order.length; j += 1) {
      const idA = order[i];
      const idB = order[j];
      if (!idA || !idB) continue;
      const a = byId.get(idA);
      const b = byId.get(idB);
      if (!a || !b || !framesOverlap(a, b, gap)) continue;
      const moveId = b.y >= a.y ? idB : idA;
      const stay = moveId === idB ? a : b;
      const moving = byId.get(moveId);
      if (!moving) continue;
      byId.set(moveId, snapLivingFrame({
        ...moving,
        y: stay.y + stay.h + gap,
      }, snapOpts));
    }
  }

  return [...byId.entries()].map(([id, frame]) => ({ id, frame }));
}

/**
 * Snap only into column slots (x/w); keep y/h as-is for live drag physics.
 */
export function snapLivingColumns(
  frame: WidgetFrame,
  opts: SnapOpts = {},
): WidgetFrame {
  const snapped = snapLivingFrame(frame, opts);
  return {
    ...snapped,
    y: Math.max(0, Number(frame.y) || 0),
    h: Math.max(LIVING_MIN_H, Number(frame.h) || snapped.h),
  };
}

/**
 * Slide widgets upward into empty space (per-column gravity).
 * `pinnedId` stays put (drag/resize target).
 * Widgets fully above the pinned card are left alone — resizing/moving a lower
 * card must not re-pack unrelated cards or land on top of them.
 */
export function applyLivingGravity(
  items: Array<{ id: string; frame: WidgetFrame }>,
  opts: SnapOpts & { pinnedId?: string } = {},
): Array<{ id: string; frame: WidgetFrame }> {
  const gap = opts.gap ?? LIVING_BOARD_GAP;
  const pad = opts.padding ?? LIVING_BOARD_PAD;
  const columns = opts.columns ?? LIVING_BOARD_COLS;
  const boardWidth = opts.boardWidth ?? LIVING_BOARD_WIDTH;
  const grid = opts.grid ?? LIVING_GRID;
  const colW = livingColWidth(boardWidth, columns, gap, pad);
  const stride = colW + gap;
  const pinnedId = opts.pinnedId;

  const result = new Map<string, WidgetFrame>();
  for (const item of items) {
    result.set(item.id, { ...item.frame });
  }

  const pinned = pinnedId ? result.get(pinnedId) : null;

  const colOf = (frame: WidgetFrame) => {
    const col = Math.round((frame.x - pad) / stride);
    return Math.max(0, Math.min(columns - 1, col));
  };

  const spansCol = (frame: WidgetFrame, c: number) => {
    const c0 = colOf(frame);
    const span = Math.max(1, Math.round((frame.w + gap) / stride));
    return c >= c0 && c < c0 + span;
  };

  /** Fully above pinned → do not move. */
  const lockedAbove = new Set<string>();
  if (pinned) {
    for (const item of items) {
      if (item.id === pinnedId) continue;
      const f = result.get(item.id)!;
      if (f.y + f.h <= pinned.y + 1) lockedAbove.add(item.id);
    }
  }

  /** Only reflow cards that share a column with the pinned card (when pinned). */
  const pinnedCols = new Set<number>();
  if (pinned) {
    for (let c = 0; c < columns; c += 1) {
      if (spansCol(pinned, c)) pinnedCols.add(c);
    }
  }

  const buckets: string[][] = Array.from({ length: columns }, () => []);
  for (const item of items) {
    if (item.id === pinnedId || lockedAbove.has(item.id)) continue;
    const frame = result.get(item.id)!;
    const c = colOf(frame);
    // With a pinned card, never pull cards from other columns into this reflow
    if (pinned && !pinnedCols.has(c)) continue;
    const bucket = buckets[c];
    if (!bucket) continue;
    bucket.push(item.id);
  }

  const firstFreeY = (
    h: number,
    blockers: Array<{ y0: number; y1: number }>,
    startY: number,
  ) => {
    let y = Math.max(pad, startY);
    for (let guard = 0; guard < 200; guard += 1) {
      let hit: { y0: number; y1: number } | null = null;
      for (const b of blockers) {
        if (y + h + gap > b.y0 && y < b.y1 + gap) {
          if (!hit || b.y1 > hit.y1) hit = b;
        }
      }
      if (!hit) return snapScalar(y, grid);
      y = hit.y1 + gap;
    }
    return snapScalar(y, grid);
  };

  for (let c = 0; c < columns; c += 1) {
    if (pinned && !pinnedCols.has(c)) continue;

    const colX = pad + c * stride;
    const colBucket = buckets[c];
    if (!colBucket) continue;
    const ids = colBucket
      .slice()
      .sort((a, b) => (result.get(a)!.y - result.get(b)!.y));

    const blockers: Array<{ y0: number; y1: number }> = [];

    // Locked cards in this column stay put
    for (const item of items) {
      if (!lockedAbove.has(item.id)) continue;
      const f = result.get(item.id)!;
      if (!spansCol(f, c)) continue;
      blockers.push({ y0: f.y, y1: f.y + f.h });
    }

    if (pinned && spansCol(pinned, c)) {
      blockers.push({ y0: pinned.y, y1: pinned.y + pinned.h });
    }

    // Start under the pinned card when present in this column; otherwise under top locks
    let startY = pad;
    if (pinned && spansCol(pinned, c)) {
      startY = pinned.y + pinned.h + gap;
    } else {
      for (const b of blockers) {
        startY = Math.max(startY, b.y1 + gap);
      }
    }

    let cursor = startY;
    for (const id of ids) {
      const prev = result.get(id)!;
      // Keep original column width preference but stay in this column
      const h = Math.max(LIVING_MIN_H, prev.h || 200);
      const y = firstFreeY(h, blockers, cursor);
      const settled = {
        ...prev,
        x: prev.x, // do not yank into a different visual column mid-gesture
        w: prev.w,
        y,
        h,
      };
      // Column-align x; preserve user width (incl. multi-span), never clamp to 1 col
      if (Math.abs(prev.x - colX) <= stride / 2) {
        settled.x = colX;
        settled.w = Math.max(LIVING_MIN_W, prev.w || colW);
      }
      result.set(id, settled);
      cursor = settled.y + settled.h + gap;
      blockers.push({ y0: settled.y, y1: settled.y + settled.h });
    }
  }

  return items.map((i) => ({
    id: i.id,
    frame: result.get(i.id) || i.frame,
  }));
}

/**
 * Find a free snapped slot for a new widget (no pushing).
 */
export function resolveLivingFrame(
  desired: WidgetFrame,
  others: WidgetFrame[],
  opts: {
    previous?: WidgetFrame;
    boardWidth?: number;
    columns?: number;
    gap?: number;
    padding?: number;
    grid?: number;
  } = {},
): WidgetFrame {
  const gap = opts.gap ?? LIVING_BOARD_GAP;
  const snapOpts = {
    boardWidth: opts.boardWidth ?? LIVING_BOARD_WIDTH,
    columns: opts.columns ?? LIVING_BOARD_COLS,
    gap,
    padding: opts.padding ?? LIVING_BOARD_PAD,
    grid: opts.grid ?? LIVING_GRID,
  };

  const snapped = snapLivingFrame(desired, snapOpts);
  if (!hasCollision(snapped, others, gap)) return snapped;

  // Place below the lowest widget in the shortest column
  const updates = resolveLivingLayoutPush(
    '__new__',
    snapped,
    [
      { id: '__new__', frame: snapped },
      ...others.map((f, i) => ({ id: `o${i}`, frame: f })),
    ],
    snapOpts,
  );
  return updates.find((u) => u.id === '__new__')?.frame || snapped;
}

/**
 * Column masonry pack — fills shortest column first to avoid vertical voids.
 * All frames land on the same snap grid.
 */
export function packLivingWidgets(
  widgets: CanvasWidget[],
  opts: {
    boardWidth?: number;
    gap?: number;
    padding?: number;
    columns?: number;
  } = {},
): Array<{ id: string; frame: WidgetFrame }> {
  const gap = opts.gap ?? LIVING_BOARD_GAP;
  const padding = opts.padding ?? LIVING_BOARD_PAD;
  const boardWidth = opts.boardWidth ?? LIVING_BOARD_WIDTH;
  const columns = opts.columns ?? LIVING_BOARD_COLS;
  const colW = livingColWidth(boardWidth, columns, gap, padding);
  const colHeights = Array.from({ length: columns }, () => padding);
  const sorted = sortWidgetsForFlow(widgets);

  return sorted.map((w) => {
    const prev = w.frame || { x: 0, y: 0, w: colW, h: 200, z: 1 };
    const height = Math.max(LIVING_MIN_H, snapScalar(prev.h || 200));
    const ci = colHeights.indexOf(Math.min(...colHeights));
    const colY = colHeights[ci] ?? padding;
    const x = padding + ci * (colW + gap);
    const y = snapScalar(colY);
    colHeights[ci] = y + height + gap;
    return {
      id: w.id,
      frame: snapLivingFrame(
        {
          ...prev,
          x,
          y,
          w: colW,
          h: height,
          z: prev.z ?? 1,
        },
        { boardWidth, columns, gap, padding },
      ),
    };
  });
}

/** Board height needed to contain all frames. */
export function livingBoardHeight(widgets: CanvasWidget[], pad = LIVING_BOARD_PAD): number {
  let max = 480;
  for (const w of widgets) {
    const bottom = (w.frame?.y || 0) + (w.frame?.h || 200);
    if (bottom > max) max = bottom;
  }
  return snapScalar(max + pad + LIVING_ASK_CLEARANCE);
}

/**
 * Template rows place several widgets on the same y — that creates the red-box voids.
 */
export function shouldAutoPackLiving(widgets: CanvasWidget[]): boolean {
  if (widgets.length < 2) return false;
  const buckets = new Map<number, number>();
  for (const w of widgets) {
    const y = Math.round((w.frame?.y || 0) / 24) * 24;
    buckets.set(y, (buckets.get(y) || 0) + 1);
  }
  return [...buckets.values()].some((n) => n >= 2);
}
