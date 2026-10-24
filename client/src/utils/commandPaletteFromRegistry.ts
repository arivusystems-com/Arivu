import type { CommandItem, CommandCategory } from '@/types/command.types';
import type { DashboardDefinition } from '@/types/dashboard.types';
import type { AppRegistry } from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { PermissionOutcome } from '@/types/permission-visibility.types';
import type { SidebarStructure } from '@/types/sidebar.types';
import type {
  CommandPaletteItem,
  CommandCategory as PaletteCategory
} from '@/types/commandPalette.types';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { buildCommandsFromRegistry } from '@/utils/buildCommandsFromRegistry';
import { buildDashboardFromRegistry } from '@/utils/buildDashboardFromRegistry';
import { buildAppNavForRegistry } from '@/utils/buildSidebarFromRegistry';

const NAV_REGISTRY_CATEGORIES = new Set<CommandCategory>([
  'navigation',
  'modules',
  'apps',
  'settings'
]);

function mapPaletteCategory(_item: CommandItem): PaletteCategory {
  return 'navigation';
}

function extractModuleKey(item: CommandItem): string | undefined {
  if (item.moduleKey) return String(item.moduleKey).toLowerCase();
  const id = item.id || '';
  if (id.startsWith('core-module-')) return id.replace('core-module-', '');
  const moduleMatch = id.match(/^module-[^-]+-(.+)$/);
  if (moduleMatch?.[1]) return moduleMatch[1].toLowerCase();
  if (id === 'shell-inbox' || id.includes('inbox')) return 'inbox';
  return undefined;
}

function iconFromRegistryItem(item: CommandItem): string | undefined {
  if (item.icon && item.icon !== 'module') return item.icon;
  return extractModuleKey(item);
}

/**
 * Build dashboard definitions for every entitled app (powers registry action metadata).
 */
export function buildAllDashboardsFromRegistry(
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot
): DashboardDefinition[] {
  // Dashboard builder uses dashboard.types AppRegistry shape (compatible with sidebar registry)
  const registry = appRegistry as Parameters<typeof buildDashboardFromRegistry>[1];
  return Object.keys(appRegistry)
    .map((appKey) => buildDashboardFromRegistry(appKey, registry, snapshot))
    .filter((d): d is DashboardDefinition => d !== null);
}

/**
 * Convert registry CommandItem rows into executable CommandPaletteItem navigation commands.
 * Skips dashboard "actions" — those stay in the manual registry (drawers, quick create).
 */
export function registryCommandsToPaletteItems(items: CommandItem[]): CommandPaletteItem[] {
  const seenIds = new Set<string>();
  const palette: CommandPaletteItem[] = [];

  for (const item of items) {
    if (item.visibility === PermissionOutcome.HIDDEN) continue;
    if (!item.route || !NAV_REGISTRY_CATEGORIES.has(item.category)) continue;

    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const route = item.route;
    const label = item.label;
    const description = item.description || undefined;
    const moduleKey = extractModuleKey(item);

    palette.push({
      id: item.id,
      label,
      description,
      category: mapPaletteCategory(item),
      scope: 'global',
      moduleKey,
      icon: iconFromRegistryItem(item),
      kind: 'navigate',
      run: (nav) => {
        nav.openTab(route, { title: label, background: false });
      }
    });
  }

  return palette;
}

/**
 * Full platform command list from sidebar + dashboards (permission-aware).
 */
export function buildPaletteCommandsFromSidebar(
  sidebar: SidebarStructure,
  dashboards: DashboardDefinition[],
  appRegistry: AppRegistry,
  snapshot: ReturnType<typeof createPermissionSnapshot>
): CommandPaletteItem[] {
  const allAppNavs = sidebar.appSwitcher.apps.map((app) =>
    buildAppNavForRegistry(appRegistry, app.id, snapshot)
  );
  const definition = buildCommandsFromRegistry(sidebar, dashboards, { allAppNavs });
  return registryCommandsToPaletteItems(definition.commands);
}
