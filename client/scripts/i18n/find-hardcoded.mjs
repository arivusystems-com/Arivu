#!/usr/bin/env node
/**
 * i18n:find-hardcoded — detect likely English UI strings in enforced paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_ROOT, isEnforcementPath, scanSourceFiles } from './shared.mjs';

// (?<![=-]) skips arrow functions / TS generics such as `=> Record<string, string>`.
const ENGLISH_TEXT_RE = /(?<![=-])>\s*([A-Za-z][A-Za-z0-9\s,'’.!?-]{2,})\s*</g;
// (?<![:@\w-]) skips bound attributes (`:title="a === 'b' ? t(...) : t(...)"`); static `subtitle="..."` / `empty-label="..."` are still checked.
const ATTR_TEXT_RE = /(?<![:@\w-])[\w-]*(?:title|label|placeholder)=["']([A-Za-z][^"']{2,})["']/g;
const TOAST_RE = /(?:toast|notify|showMessage|alert)\([^)]*["']([A-Za-z][^"']{3,})["']/g;

const ALLOWLIST = new Set([
  'OK',
  'ID',
  'API',
  'CRM',
  'URL',
  'UTC',
  'PDF',
  'CSV',
  'ESC',
  'Enter',
  'Promise',
]);

const errors = [];

function isLikelyUiEnglish(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return false;
  if (ALLOWLIST.has(trimmed)) return false;
  if (trimmed.startsWith('{')) return false;
  if (/^[\d\s$%]+$/.test(trimmed)) return false;
  // Dynamic Vue bindings mistaken as static attribute strings
  if (/^t\s*\(/.test(trimmed) || /\bt\s*\(/.test(trimmed)) return false;
  if (/^(get|is|has)[A-Z]\w*\(/.test(trimmed)) return false;
  if (/^[a-zA-Z_$][\w$]*(\.[a-zA-Z_$][\w$]*)+$/.test(trimmed) && !/\s/.test(trimmed)) return false;
  if (
    trimmed.includes('${') ||
    trimmed.includes('{{') ||
    trimmed.includes('?') ||
    trimmed.includes('||') ||
    trimmed.includes('(')
  ) {
    return false;
  }
  if (/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(trimmed)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(trimmed) && !/\s/.test(trimmed)) return false;
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return /[aeiouAEIOU]/.test(trimmed);
}

function scanFile(filePath, options = {}) {
  if (!options.skipEnforcementCheck && !isEnforcementPath(filePath)) return;
  const rel = path.relative(CLIENT_ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lineMin = options.lineMin ?? 1;
  const lineMax = options.lineMax ?? Infinity;

  if (rel.includes('.test.') || rel.includes('__tests__')) return;
  if (/RecordPageExample|useRecordTags\.js$/.test(rel)) return;

  const checks = [
    [ENGLISH_TEXT_RE, 'template text'],
    [ATTR_TEXT_RE, 'attribute'],
    [TOAST_RE, 'toast/message'],
  ];

  for (const [re, kind] of checks) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const text = match[1];
      if (isLikelyUiEnglish(text)) {
        const line = content.slice(0, match.index).split('\n').length;
        if (line < lineMin || line > lineMax) continue;
        errors.push(`${rel}:${line} [${kind}] "${text}"`);
      }
    }
  }
}

/** @param {string | { path: string, lineMin?: number, lineMax?: number }} entry */
function phaseEntryMatchesRel(entry, rel) {
  const pathPrefix = typeof entry === 'string' ? entry : entry.path;
  return rel.startsWith(pathPrefix);
}

/** @param {string | { path: string, lineMin?: number, lineMax?: number }} entry */
function phaseScanOptions(entry) {
  if (!entry || typeof entry === 'string') return {};
  return { lineMin: entry.lineMin, lineMax: entry.lineMax };
}

const PHASE_PATHS = {
  ui: ['src/components/ui'],
  common: ['src/components/common'],
  layouts: ['src/layouts'],
  modals: ['src/components/modals'],
  tables: [
    'src/components/common/DataTable.vue',
    'src/components/common/TableView.vue',
    'src/components/common/metrics/MetricsWidget.vue',
    'src/components/common/metrics/KeyFieldsWidget.vue',
  ],
  forms: [
    'src/components/common/DynamicFormField.vue',
    'src/components/common/metrics/LifecycleStageWidget.vue',
    'src/components/common/DynamicForm.vue',
    'src/components/common/FormTagsField.vue',
    'src/components/common/CreateRecordDrawer.vue',
    'src/components/common/DateFilterDropdown.vue',
    'src/components/common/DependencyPopupModal.vue',
    'src/components/common/LinkRecordsDrawer.vue',
    'src/components/common/KanbanBoard.vue',
  ],
  summary: ['src/components/common/SummaryView.vue'],
  navigation: [
    'src/components/AppSidebar.vue',
    'src/components/AppSidebarSkeleton.vue',
    'src/components/TabBar.vue',
  ],
  notifications: [
    'src/components/notifications',
    'src/components/Nav.vue',
  ],
  auth: ['src/views/Login.vue', 'src/components/LoginForm.vue'],
  'settings-shell': [
    'src/views/Settings.vue',
    'src/components/settings/SettingsLandingPage.vue',
    'src/components/settings/AutomationSettings.vue',
    'src/components/settings/UsersAccessSettings.vue',
    'src/components/settings/PerformanceSettings.vue',
  ],
  'settings-account': [
    'src/components/settings/ProfileSettings.vue',
    'src/components/settings/OrganizationSettings.vue',
    'src/components/settings/SecuritySettings.vue',
  ],
  'settings-users-access': [
    'src/components/settings/UserManagement.vue',
    'src/components/settings/RolesPermissions.vue',
    'src/components/settings/RoleFormDrawer.vue',
    'src/components/settings/RoleUsersModal.vue',
    'src/components/settings/InviteUserDrawer.vue',
    'src/components/settings/EditUserModal.vue',
    'src/components/settings/GroupsSettings.vue',
  ],
  'settings-groups-helpdesk': [
    'src/components/groups/GroupFormModal.vue',
    'src/components/settings/HelpdeskExecutionSettings.vue',
  ],
  'settings-assignment-rules': ['src/components/settings/AssignmentRulesSettings.vue'],
  'settings-apps-sla': [
    'src/components/settings/HelpdeskSlaScheduleSection.vue',
    'src/components/settings/AppsSettings.vue',
  ],
  'settings-app-panels': [
    'src/components/settings/SalesSchema.vue',
    'src/components/settings/HelpdeskSchema.vue',
    'src/components/analytics/PlatformAnalyticsDashboardEmbed.vue',
    'src/components/settings/SalesPipelines.vue',
    'src/components/settings/SalesPlaybooks.vue',
  ],
  /** Full-file burndown (not CI-gated until shell + panels complete). */
  'settings-modules-fields': ['src/components/settings/ModulesAndFields.vue'],
  /** Incremental gate: module list, header, tabs, fields list chrome (lines 1–910). */
  'settings-modules-fields-shell': [
    { path: 'src/components/settings/ModulesAndFields.vue', lineMin: 1, lineMax: 910 },
  ],
  'settings-modules-fields-editor': [
    { path: 'src/components/settings/ModulesAndFields.vue', lineMin: 911, lineMax: 2450 },
  ],
  'settings-modules-fields-tabs': [
    { path: 'src/components/settings/ModulesAndFields.vue', lineMin: 2451, lineMax: 5035 },
  ],
  'settings-modules-fields-modals': [
    { path: 'src/components/settings/ModulesAndFields.vue', lineMin: 5036, lineMax: 5480 },
  ],
  'settings-modules-fields-messages': [
    { path: 'src/components/settings/ModulesAndFields.vue', lineMin: 6500, lineMax: 13500 },
  ],
  'settings-remaining-sm': [
    'src/components/settings/BusinessHoursSettings.vue',
    'src/components/settings/CoreModulesList.vue',
    'src/components/settings/CoreEntities.vue',
    'src/components/settings/PlatformSettings.vue',
    'src/components/settings/ApplicationsList.vue',
    'src/components/settings/SubscriptionsList.vue',
    'src/components/settings/ModuleFormModal.vue',
    'src/components/settings/OrganizationHierarchy.vue',
    'src/components/settings/HierarchyNode.vue',
    'src/components/settings/SalesPeople.vue',
    'src/components/settings/AppManagement.vue',
    'src/components/settings/SubscriptionDetail.vue',
  ],
  'settings-remaining-drawers': [
    'src/components/settings/AddCustomFieldDrawer.vue',
    'src/components/settings/RelationshipFormDrawer.vue',
    'src/components/settings/ApplicationDetail.vue',
  ],
  'settings-people-types': ['src/components/settings/PeopleTypesSettings.vue'],
  'settings-core-module-detail': ['src/components/settings/CoreModuleDetail.vue'],
  'settings-integrations': ['src/components/settings/IntegrationsSettings.vue'],
  'records-shell': [
    'src/components/record-page/RecordPageShell.vue',
    'src/components/record-page/RecordHeader.vue',
    'src/components/record-page/RecordContextTabs.vue',
    'src/components/record-page/RecordFieldsSection.vue',
    'src/components/record-page/CustomFieldsSection.vue',
    'src/components/record-page/RelatedRecordsSection.vue',
  ],
  'records-generic-shell': [
    { path: 'src/components/record-page/GenericRecordContent.vue', lineMin: 1, lineMax: 900 },
  ],
  'records-generic-main': [
    { path: 'src/components/record-page/GenericRecordContent.vue', lineMin: 901, lineMax: 2000 },
  ],
  'records-generic-drawers': [
    { path: 'src/components/record-page/GenericRecordContent.vue', lineMin: 2001, lineMax: 3512 },
  ],
  'records-generic-content': [
    'src/components/record-page/GenericRecordContent.vue',
  ],
  'records-comment-editable': [
    'src/components/record-page/CommentInput.vue',
    'src/components/record-page/EditableLabeledValue.vue',
  ],
  'records-deal-shell': [{ path: 'src/pages/deals/DealRecordPage.vue', lineMin: 1, lineMax: 900 }],
  'records-deal-main': [{ path: 'src/pages/deals/DealRecordPage.vue', lineMin: 901, lineMax: 2000 }],
  'records-deal-rest': [{ path: 'src/pages/deals/DealRecordPage.vue', lineMin: 2001, lineMax: 4000 }],
  'records-deal-page': ['src/pages/deals/DealRecordPage.vue'],
  'records-task-shell': [{ path: 'src/pages/tasks/TaskRecordPage.vue', lineMin: 1, lineMax: 1200 }],
  'records-task-main': [{ path: 'src/pages/tasks/TaskRecordPage.vue', lineMin: 1201, lineMax: 3000 }],
  'records-task-rest': [{ path: 'src/pages/tasks/TaskRecordPage.vue', lineMin: 3001, lineMax: 6000 }],
  'records-task-page': ['src/pages/tasks/TaskRecordPage.vue'],
  'records-activity-section': ['src/components/activity/ActivitySection.vue'],
  'records-activity-comment-card': ['src/components/activity/events/ActivityCommentCard.vue'],
  'forms-question-types': [
    'src/components/forms/question-types/',
    'src/components/forms/SignaturePad.vue',
  ],
  'forms-modals': [
    'src/components/forms/DuplicateFormDialog.vue',
    'src/components/forms/FormCreationModal.vue',
  ],
  'forms-preview': [
    'src/components/forms/FormPreview.vue',
    'src/components/forms/FormPreviewDrawer.vue',
    'src/components/forms/PreviewAndSave.vue',
  ],
  'forms-tabs': [
    'src/components/forms/FormDetailsTab.vue',
    'src/components/forms/FormSettingsTab.vue',
    'src/components/forms/FormTemplateTab.vue',
  ],
  'forms-analytics-panels': [
    'src/components/forms/FormAnalytics.vue',
    'src/components/forms/CorrectiveActionPanel.vue',
    'src/components/forms/AuditorVerificationPanel.vue',
    'src/components/forms/analytics/',
  ],
  'forms-outcomes-template': [
    'src/components/forms/OutcomesAndRules.vue',
    'src/components/forms/ResponseTemplateBuilder.vue',
  ],
  'forms-sections-builder': [
    'src/components/forms/SectionsBuilder.vue',
    'src/utils/formEditPermissions.js',
  ],
  'forms-builder-shell': [
    'src/views/FormBuilder.vue',
  ],
  'forms-hub-list': [
    'src/views/Forms.vue',
    'src/views/FormResponses.vue',
    'src/views/FormDetail.vue',
  ],
  'forms-hub-wizard': [
    'src/views/FormCreate.vue',
    'src/views/FormFill.vue',
    'src/views/PublicFormView.vue',
  ],
  'process-flow': [
    'src/components/process-flow/',
    'src/utils/processDesignerConstants.js',
  ],
  'process-admin-views': [
    'src/views/admin/Processes.vue',
    'src/views/admin/BusinessFlows.vue',
    'src/views/admin/BusinessFlowDetail.vue',
    'src/views/admin/BusinessFlowForm.vue',
    'src/views/admin/BusinessFlowHealth.vue',
    'src/views/admin/ProcessFlowDesigner.vue',
    'src/views/admin/ProcessSetupView.vue',
    'src/views/admin/AutomationRules.vue',
  ],
  'forms-hub-response-detail': ['src/views/FormResponseDetail.vue'],
  'forms-report-blocks': [
    'src/components/forms/report-blocks/',
  ],
  'forms-views': [
    'src/components/forms/TrendsChart.vue',
    'src/components/forms/FormReportView.vue',
    'src/components/forms/FormComparisonView.vue',
    'src/components/forms/widgets/FormAnalyticsWidget.vue',
  ],
  appointments: [
    'src/components/appointments/',
    'src/views/appointments/',
    'src/views/PublicManageAppointmentView.vue',
  ],
  'business-hours': ['src/components/business-hours/'],
  'global-chrome': [
    'src/components/GlobalSearch.vue',
    'src/components/UserMenu.vue',
  ],
  'app-surfaces': [
    'src/components/Notes.vue',
    'src/components/Files.vue',
    'src/components/ExecutionActionBar.vue',
    'src/components/ActivityTimeline.vue',
    'src/components/tasks/',
    'src/components/events/',
    'src/components/deals/',
    'src/components/people/',
    'src/components/contacts/',
    'src/components/organizations/',
    'src/components/inbox/',
    'src/components/communications/',
    'src/components/dashboard/',
    'src/components/import/',
    'src/components/audit/',
    'src/components/platform/',
    'src/components/record-page/',
    'src/components/record-detail/',
    'src/components/relationships/',
    'src/components/activity/',
    'src/components/approvals/',
    'src/views/Tasks.vue',
    'src/views/TaskDetail.vue',
    'src/views/Events.vue',
    'src/views/EventDetail.vue',
    'src/views/EventExecutionSurface.vue',
    'src/views/Deals.vue',
    'src/views/DealDetail.vue',
    'src/views/People.vue',
    'src/views/PeopleCreate.vue',
    'src/views/PeopleDetail.vue',
    'src/views/PeopleQuickCreate.vue',
    'src/views/PeopleSurface.vue',
    'src/views/ContactDetail.vue',
    'src/views/Organizations.vue',
    'src/views/OrganizationDetail.vue',
    'src/views/OrganizationSurface.vue',
    'src/views/CreateOrganizationSurface.vue',
    'src/views/Groups.vue',
    'src/views/GroupDetail.vue',
    'src/views/InboxSurface.vue',
    'src/views/Dashboard.vue',
    'src/views/Imports.vue',
    'src/views/ImportDetail.vue',
    'src/views/audit/',
    'src/views/portal/',
    'src/views/Responses.vue',
    'src/views/ResponseDetail.vue',
    'src/views/platform/',
    'src/views/InstanceManagement.vue',
    'src/views/LandingPage.vue',
    'src/views/Trash.vue',
    'src/views/ApprovalDetail.vue',
    'src/views/ApprovalInbox.vue',
    'src/views/DemoRequests.vue',
    'src/views/PublicBookingView.vue',
    'src/views/settings/NotificationOverview.vue',
    'src/views/settings/NotificationHealth.vue',
    'src/views/settings/NotificationPreferences.vue',
    'src/views/settings/NotificationRules.vue',
    'src/components/auth/RegistrationForm.vue',
    'src/components/DemoRequestForm.vue',
  ],
  'process-admin-components': [
    'src/components/admin/ProcessCreationWizard.vue',
    'src/components/admin/AutomationRuleForm.vue',
    'src/components/admin/AutomationRulePreview.vue',
    'src/components/admin/ProcessTestModal.vue',
    'src/components/admin/ProcessExecutionLogs.vue',
    'src/components/admin/process/RuleEditPanel.vue',
    'src/components/admin/process/TimelineItem.vue',
    'src/components/automation/AppFlows.vue',
    'src/components/automation/AutomationContext.vue',
    'src/components/automation/AutomationBadge.vue',
    'src/components/settings/AutomationSettings.vue',
    'src/views/ControlPlane.vue',
  ],
  'records-activity-pane': [
    'src/components/record-page/RecordActivityTimeline.vue',
    'src/components/record-page/RecordRightPane.vue',
    'src/components/record-page/RecordStateSection.vue',
    'src/components/record-page/RecordTagPopover.vue',
    'src/components/record-page/sections/DescriptionSection.vue',
    'src/components/record-page/sections/RelatedSection.vue',
    'src/components/record-page/sections/StageHistorySection.vue',
    'src/components/record-page/sections/SubtasksSection.vue',
    'src/components/record-page/sections/DetailsSection.vue',
    'src/components/record-page/sections/SectionStack.vue',
  ],
};

function main() {
  const scopedOnly = process.argv.includes('--scoped');
  const phaseArg = process.argv.find((a) => a.startsWith('--phase='));
  const phasePaths = phaseArg ? PHASE_PATHS[phaseArg.split('=')[1]] : null;

  for (const file of scanSourceFiles()) {
    const rel = path.relative(CLIENT_ROOT, file);
    const phaseEntry = phasePaths?.find((p) => phaseEntryMatchesRel(p, rel));
    if (phasePaths && !phaseEntry) continue;
    if (scopedOnly && !phasePaths && !isEnforcementPath(file)) continue;
    scanFile(file, {
      skipEnforcementCheck: Boolean(phasePaths),
      ...phaseScanOptions(phaseEntry),
    });
  }

  const limit = Number(process.env.I18N_HARDCODED_LIMIT || 0);
  const reported = limit > 0 ? errors.slice(0, limit) : errors;

  for (const e of reported) console.error(`❌ hardcoded: ${e}`);

  if (errors.length && process.env.I18N_FAIL_ON_HARDCODED === '1') {
    console.error(`\ni18n:find-hardcoded failed (${errors.length} finding(s)).`);
    process.exit(1);
  }

  if (!errors.length) {
    console.log('✅ No hardcoded UI strings detected in enforced paths.');
  } else {
    console.log(`Found ${errors.length} hardcoded string(s) (set I18N_FAIL_ON_HARDCODED=1 to fail CI).`);
  }
}

main();
