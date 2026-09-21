import {
  AcademicCapIcon,
  BriefcaseIcon,
  CubeIcon,
  GlobeAltIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  Squares2X2Icon
} from '@heroicons/vue/24/outline';
import { PLATFORM_HOME_FLAT_CHIP_CLASS } from '@/utils/platformHomeLayout';

const FLAT = PLATFORM_HOME_FLAT_CHIP_CLASS;

const ICON_BY_APP = {
  AUDIT: ShieldCheckIcon,
  SALES: BriefcaseIcon,
  HELPDESK: LifebuoyIcon,
  PROJECTS: RectangleStackIcon,
  PORTAL: GlobeAltIcon,
  INVENTORY: CubeIcon,
  MARKETING: MegaphoneIcon,
  LMS: AcademicCapIcon
};

/** Light surfaces for light mode; dark:* uses only @theme-defined scales (no -950). */
const PILL_CLASS_BY_APP = {
  SALES: [
    FLAT,
    'bg-secondary-50 text-secondary-900 border-secondary-200/80 hover:bg-secondary-100',
    'dark:border-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-200 dark:hover:bg-secondary-900/50'
  ].join(' '),
  HELPDESK: [
    FLAT,
    'bg-success-50 text-success-900 border-success-200/80 hover:bg-success-100',
    'dark:border-success-600 dark:bg-success-900/30 dark:text-success-200 dark:hover:bg-success-900/50'
  ].join(' '),
  AUDIT: [
    FLAT,
    'bg-primary-50 text-primary-900 border-primary-200/80 hover:bg-primary-100',
    'dark:border-primary-500 dark:bg-primary-900/35 dark:text-primary-200 dark:hover:bg-primary-900/55'
  ].join(' '),
  PROJECTS: [
    FLAT,
    'bg-warning-50 text-warning-900 border-warning-200/80 hover:bg-warning-100',
    'dark:border-warning-600 dark:bg-warning-900/30 dark:text-warning-200 dark:hover:bg-warning-900/50'
  ].join(' '),
  PORTAL: [
    FLAT,
    'bg-neutral-100 text-neutral-800 border-neutral-200/80 hover:bg-neutral-200',
    'dark:border-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-200 dark:hover:bg-neutral-800/70'
  ].join(' '),
  INVENTORY: [
    FLAT,
    'bg-neutral-50 text-neutral-800 border-neutral-200/80 hover:bg-neutral-100',
    'dark:border-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-200 dark:hover:bg-neutral-800/70'
  ].join(' '),
  MARKETING: [
    FLAT,
    'bg-primary-50 text-primary-900 border-primary-200/80 hover:bg-primary-100',
    'dark:border-primary-500 dark:bg-primary-900/35 dark:text-primary-200 dark:hover:bg-primary-900/55'
  ].join(' '),
  LMS: [
    FLAT,
    'bg-primary-50 text-primary-900 border-primary-200/80 hover:bg-primary-100',
    'dark:border-primary-500 dark:bg-primary-900/35 dark:text-primary-200 dark:hover:bg-primary-900/55'
  ].join(' ')
};

const ICON_WRAP_CLASS_BY_APP = {
  SALES: 'bg-secondary-200/80 text-secondary-800 dark:bg-secondary-800 dark:text-secondary-200',
  HELPDESK: 'bg-success-200/80 text-success-800 dark:bg-success-800 dark:text-success-200',
  AUDIT: 'bg-primary-200/80 text-primary-800 dark:bg-primary-800 dark:text-primary-200',
  PROJECTS: 'bg-warning-200/80 text-warning-800 dark:bg-warning-800 dark:text-warning-200',
  PORTAL: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
  INVENTORY: 'bg-neutral-200/80 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
  MARKETING: 'bg-primary-200/80 text-primary-800 dark:bg-primary-800 dark:text-primary-200',
  LMS: 'bg-primary-200/80 text-primary-800 dark:bg-primary-800 dark:text-primary-200'
};

const DEFAULT_PILL_CLASS = [
  FLAT,
  'bg-neutral-50 text-neutral-800 border-neutral-200/80 hover:bg-neutral-100',
  'dark:border-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-100 dark:hover:bg-neutral-800/70'
].join(' ');

export function getPlatformHomeAppIcon(appKey) {
  return ICON_BY_APP[String(appKey || '').toUpperCase()] || Squares2X2Icon;
}

export function getPlatformHomeAppPillClass(appKey) {
  return PILL_CLASS_BY_APP[String(appKey || '').toUpperCase()] || DEFAULT_PILL_CLASS;
}

export function getPlatformHomeAppIconWrapClass(appKey) {
  return ICON_WRAP_CLASS_BY_APP[String(appKey || '').toUpperCase()]
    || 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200';
}

export function getAppTopSignal(app) {
  const signals = app?.pulse?.signals || [];
  const urgent = signals.find(
    (signal) => signal.severity !== 'info' && signal.text !== 'No urgent items'
  );
  return urgent || null;
}

/** Flatten app pulse signals for the Today brief chip row. */
export function extractPlatformHomeBriefSignals(appPulses, limit = 4) {
  const items = [];
  for (const pulse of appPulses || []) {
    for (const signal of pulse.signals || []) {
      if (!signal?.text || signal.text === 'No urgent items') continue;
      items.push({
        id: `${pulse.appKey}-${signal.text}`,
        appKey: pulse.appKey,
        appName: pulse.name,
        text: signal.text,
        severity: signal.severity || 'info',
        signalKey: signal.signalKey || null,
        route: signal.route || pulse.route || null
      });
    }
  }
  return items.slice(0, limit);
}
