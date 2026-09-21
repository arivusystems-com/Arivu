import {
  AdjustmentsHorizontalIcon,
  ArchiveBoxIcon,
  AcademicCapIcon,
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BanknotesIcon,
  BookOpenIcon,
  BookmarkIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  CogIcon,
  CreditCardIcon,
  CubeIcon,
  DocumentChartBarIcon,
  DocumentCurrencyDollarIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  FunnelIcon,
  HomeIcon,
  InboxArrowDownIcon,
  InboxIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MegaphoneIcon,
  PhotoIcon,
  PresentationChartLineIcon,
  ReceiptRefundIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparklesIcon,
  Squares2X2Icon,
  TicketIcon,
  TrophyIcon,
  TruckIcon,
  UserGroupIcon,
  UsersIcon,
  VideoCameraIcon
} from '@heroicons/vue/24/outline';
import {
  MODULE_ICON_COMPONENTS,
  MODULE_ICON_IDS,
  resolveStoredModuleIconId
} from '@/utils/moduleIcons';

type IconLookupItem = {
  moduleKey?: string;
  icon?: string;
  label?: string;
  route?: string;
  id?: string;
};

const MODULE_ICON_MAP: Record<string, any> = {
  attention: ExclamationTriangleIcon,
  inbox: InboxIcon,
  astra: SparklesIcon,
  platform: Squares2X2Icon,
  people: UserGroupIcon,
  organization: BuildingOfficeIcon,
  organizations: BuildingOfficeIcon,
  deals: BriefcaseIcon,
  deal: BriefcaseIcon,
  tasks: CheckCircleIcon,
  task: CheckCircleIcon,
  events: CalendarDaysIcon,
  event: CalendarDaysIcon,
  items: CubeIcon,
  item: CubeIcon,
  forms: ClipboardDocumentListIcon,
  form: ClipboardDocumentListIcon,
  documents: DocumentTextIcon,
  document: DocumentTextIcon,
  cases: TicketIcon,
  case: TicketIcon,
  projects: FolderIcon,
  project: FolderIcon,
  responses: ClipboardDocumentListIcon,
  import: ArchiveBoxIcon,
  dashboard: DocumentChartBarIcon,
  audits: DocumentMagnifyingGlassIcon,
  findings: ExclamationTriangleIcon,
  portal_support: LifebuoyIcon,
  support: LifebuoyIcon,
  portal_invoices: BanknotesIcon,
  portal_knowledge: BookOpenIcon,
  knowledge: BookOpenIcon,
  portal_documents: DocumentTextIcon,
  campaigns: MegaphoneIcon,
  audiences: UserGroupIcon,
  segments: FunnelIcon,
  articles: BookOpenIcon,
  blog: DocumentTextIcon,
  assets: PhotoIcon,
  purchase_orders: DocumentTextIcon,
  receipt_notes: InboxArrowDownIcon,
  purchase_returns: ArrowUturnLeftIcon,
  delivery_notes: TruckIcon,
  delivery_returns: ArrowUturnRightIcon,
  sales_returns: ReceiptRefundIcon,
  stockrooms: BuildingStorefrontIcon,
  stock_adjustments: AdjustmentsHorizontalIcon,
  stock_transfers: ArrowsRightLeftIcon,
  lms: AcademicCapIcon,
  learning: AcademicCapIcon,
  learning_my: BookmarkIcon,
  learning_explore: MagnifyingGlassIcon,
  learning_courses: BookOpenIcon,
  learning_paths: MapIcon,
  learning_programs: RectangleStackIcon,
  learning_live: VideoCameraIcon,
  learning_assessments: ClipboardDocumentCheckIcon,
  learning_certificates: TrophyIcon,
  learning_skills: SparklesIcon,
  learning_content: FolderIcon,
  learning_compliance: ShieldCheckIcon,
  learning_analytics: ChartBarIcon,
  learning_settings: Cog6ToothIcon,
  ...MODULE_ICON_COMPONENTS
};

const RAW_ICON_MAP: Record<string, any> = {
  users: UsersIcon,
  user: UserGroupIcon,
  'building-office': BuildingOfficeIcon,
  building: BuildingOfficeIcon,
  briefcase: BriefcaseIcon,
  'check-circle': CheckCircleIcon,
  check: CheckCircleIcon,
  calendar: CalendarIcon,
  'calendar-days': CalendarDaysIcon,
  cog: CogIcon,
  squares: Squares2X2Icon,
  'document-chart-bar': DocumentChartBarIcon,
  dashboard: DocumentChartBarIcon,
  'presentation-chart': PresentationChartLineIcon,
  'document-magnifying-glass': DocumentMagnifyingGlassIcon,
  'exclamation-triangle': ExclamationTriangleIcon,
  'clipboard-document': ClipboardDocumentIcon,
  clipboard: ClipboardDocumentIcon,
  'clipboard-document-list': ClipboardDocumentListIcon,
  cube: CubeIcon,
  'arrow-down-tray': ArrowDownTrayIcon,
  download: ArrowDownTrayIcon,
  inbox: InboxIcon,
  folder: FolderIcon,
  search: MagnifyingGlassIcon,
  sparkles: SparklesIcon,
  astra: SparklesIcon,
  lifebuoy: LifebuoyIcon,
  banknotes: BanknotesIcon,
  'book-open': BookOpenIcon,
  ticket: TicketIcon,
  support: LifebuoyIcon,
  'shield-check': ShieldCheckIcon,
  shield: ShieldCheckIcon,
  'document-text': DocumentTextIcon,
  'shopping-cart': ShoppingCartIcon,
  'document-currency-dollar': DocumentCurrencyDollarIcon,
  'credit-card': CreditCardIcon,
  megaphone: MegaphoneIcon,
  funnel: FunnelIcon,
  photo: PhotoIcon,
  'chart-bar': ChartBarIcon,
  'chat-bubble-left-right': ChatBubbleLeftRightIcon,
  'chat-bubble-oval-left-ellipsis': ChatBubbleOvalLeftEllipsisIcon,
  'inbox-arrow-down': InboxArrowDownIcon,
  'arrow-uturn-left': ArrowUturnLeftIcon,
  'arrow-uturn-right': ArrowUturnRightIcon,
  truck: TruckIcon,
  'receipt-refund': ReceiptRefundIcon,
  'building-storefront': BuildingStorefrontIcon,
  'building-office-2': BuildingOffice2Icon,
  'building-office2': BuildingOffice2Icon,
  'adjustments-horizontal': AdjustmentsHorizontalIcon,
  'arrows-right-left': ArrowsRightLeftIcon,
  home: HomeIcon,
  'academic-cap': AcademicCapIcon,
  'magnifying-glass': MagnifyingGlassIcon,
  map: MapIcon,
  'rectangle-stack': RectangleStackIcon,
  'video-camera': VideoCameraIcon,
  'clipboard-document-check': ClipboardDocumentCheckIcon,
  trophy: TrophyIcon,
  'cog-6-tooth': Cog6ToothIcon,
  lms: AcademicCapIcon,
  bookmark: BookmarkIcon,
  ...Object.fromEntries(
    Object.entries(MODULE_ICON_IDS).map(([moduleKey, iconId]) => [moduleKey, MODULE_ICON_COMPONENTS[moduleKey]])
  )
};

const EMOJI_ICON_MAP: Record<string, string> = {
  '👥': 'users',
  '🏢': 'building',
  '💼': 'briefcase',
  '✅': 'check',
  '📅': 'calendar',
  '📦': 'cube',
  '📝': 'clipboard',
  '📥': 'download',
  '⚙️': 'cog',
  '💰': 'briefcase',
  '🎧': 'lifebuoy',
  '🛟': 'lifebuoy',
  '🌐': 'squares',
  '📋': 'clipboard',
  '🛡️': 'shield-check',
  '🎫': 'ticket',
  '💳': 'credit-card'
};

export function getIconComponent(icon?: string, moduleKey?: string): any {
  const resolvedId = resolveStoredModuleIconId(icon, moduleKey);
  const normalized = String(EMOJI_ICON_MAP[icon || ''] || resolvedId || icon || '').toLowerCase();
  return RAW_ICON_MAP[normalized] || Squares2X2Icon;
}

export function getNavigationIconComponent(item: IconLookupItem): any {
  const moduleKey = String(item.moduleKey || '').toLowerCase();
  // Shared platform key `cases`: Helpdesk tickets vs Audit findings (also moduleKey `cases`).
  if (moduleKey === 'cases') {
    const routeLower = String(item.route || '').toLowerCase();
    const rawId = String(item.id || '');
    if (routeLower.startsWith('/audit/') || rawId.toUpperCase().startsWith('AUDIT:')) {
      return ExclamationTriangleIcon;
    }
    return TicketIcon;
  }
  if (moduleKey && MODULE_ICON_MAP[moduleKey]) {
    return MODULE_ICON_MAP[moduleKey];
  }

  const route = String(item.route || '').toLowerCase();
  if (route.includes('/audit/audits')) {
    return DocumentMagnifyingGlassIcon;
  }
  if (route.includes('/audit/findings')) {
    return ExclamationTriangleIcon;
  }
  if (route.includes('/audit/responses')) {
    return ClipboardDocumentListIcon;
  }
  if (route.startsWith('/portal/cases')) {
    return LifebuoyIcon;
  }
  if (route.startsWith('/portal/invoices')) {
    return BanknotesIcon;
  }
  if (route.startsWith('/portal/documents')) {
    return DocumentTextIcon;
  }
  if (route.startsWith('/portal/knowledge')) {
    return BookOpenIcon;
  }
  if (route.startsWith('/portal/organization')) {
    return BuildingOfficeIcon;
  }
  if (route.startsWith('/portal/deals')) {
    return BriefcaseIcon;
  }
  if (route.startsWith('/portal/forms')) {
    return ClipboardDocumentListIcon;
  }
  if (route.startsWith('/portal/responses')) {
    return ClipboardDocumentListIcon;
  }
  if (route.startsWith('/dashboard/marketing') || route === '/marketing/reports') {
    return ChartBarIcon;
  }
  if (route.startsWith('/marketing/campaigns')) {
    return MegaphoneIcon;
  }
  if (route.startsWith('/marketing/audiences')) {
    return UserGroupIcon;
  }
  if (route.startsWith('/marketing/segments')) {
    return FunnelIcon;
  }
  if (route.startsWith('/marketing/assets')) {
    return PhotoIcon;
  }
  if (route.startsWith('/analytics/reports')) {
    return ChartBarIcon;
  }

  const iconComponent = getIconComponent(item.icon, moduleKey);
  if (iconComponent !== Squares2X2Icon) {
    return iconComponent;
  }

  const label = String(item.label || '').toLowerCase();
  if (label.includes('deal')) return BriefcaseIcon;
  if (label.includes('response')) return ClipboardDocumentListIcon;
  if (label.includes('import')) return ArchiveBoxIcon;
  if (label.includes('dashboard')) return DocumentChartBarIcon;

  const rawId = String(item.id || '');
  const idTail = rawId.includes(':') ? String(rawId.split(':').pop() || '').toLowerCase() : '';
  if (idTail && MODULE_ICON_MAP[idTail]) {
    return MODULE_ICON_MAP[idTail];
  }

  return Squares2X2Icon;
}

