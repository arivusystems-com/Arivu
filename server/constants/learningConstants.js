'use strict';

const LEARNING_OBJECT_TYPES = Object.freeze({
  TEXT: 'TEXT',
  VIDEO: 'VIDEO',
  DOCUMENT: 'DOCUMENT',
  SCORM: 'SCORM',
  LTI: 'LTI',
});

/** Core content types shipped with V1. */
const V1_LEARNING_OBJECT_TYPES = Object.freeze([
  LEARNING_OBJECT_TYPES.TEXT,
  LEARNING_OBJECT_TYPES.VIDEO,
  LEARNING_OBJECT_TYPES.DOCUMENT,
]);

/** Authoring-allowed types (V1 + interop). */
const AUTHORING_LEARNING_OBJECT_TYPES = Object.freeze([
  ...V1_LEARNING_OBJECT_TYPES,
  LEARNING_OBJECT_TYPES.SCORM,
  LEARNING_OBJECT_TYPES.LTI,
]);

const COURSE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
});

const ENROLLMENT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  EXPIRED: 'expired',
});

/** Active for seat consumption. */
const SEAT_CONSUMING_ENROLLMENT_STATUSES = Object.freeze([
  ENROLLMENT_STATUSES.ACTIVE,
  ENROLLMENT_STATUSES.COMPLETED,
]);

const LEARNING_EVENT_TYPES = Object.freeze({
  COURSE_STARTED: 'course_started',
  LESSON_STARTED: 'lesson_started',
  LESSON_COMPLETED: 'lesson_completed',
  VIDEO_COMPLETED: 'video_completed',
  QUIZ_STARTED: 'quiz_started',
  QUESTION_ANSWERED: 'question_answered',
  ASSESSMENT_COMPLETED: 'assessment_completed',
  ASSIGNMENT_SUBMITTED: 'assignment_submitted',
  CERTIFICATE_ISSUED: 'certificate_issued',
  COURSE_COMPLETED: 'course_completed',
  PROGRESS_UPDATED: 'progress_updated',
});

const ASSESSMENT_QUESTION_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  MULTIPLE_ANSWER: 'multiple_answer',
  TRUE_FALSE: 'true_false',
});

const CERTIFICATE_STATUSES = Object.freeze({
  ISSUED: 'issued',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

const COHORT_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
});

const LIVE_SESSION_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** Derived seat/catalog audience — not a User identity type. */
const LEARNING_AUDIENCES = Object.freeze({
  INTERNAL: 'internal',
  CUSTOMER: 'customer',
  PARTNER: 'partner',
  EXTERNAL: 'external',
});

const ACADEMY_LEARNER_AUDIENCES = Object.freeze([
  LEARNING_AUDIENCES.CUSTOMER,
  LEARNING_AUDIENCES.PARTNER,
  LEARNING_AUDIENCES.EXTERNAL,
]);

const ACADEMY_ACCESS_STATUSES = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

const ACADEMY_CATALOG_VISIBILITY = Object.freeze({
  ASSIGNED: 'assigned',
  AUDIENCE: 'audience',
  INVITE_ONLY: 'invite_only',
});

const COURSE_ACADEMY_VISIBILITY = Object.freeze({
  INHERIT: 'inherit',
  ASSIGNED: 'assigned',
  AUDIENCE: 'audience',
  INVITE_ONLY: 'invite_only',
});

const DEFAULT_ACADEMY_PRIMARY_COLOR = '#3a1f8a';

module.exports = {
  LEARNING_OBJECT_TYPES,
  V1_LEARNING_OBJECT_TYPES,
  AUTHORING_LEARNING_OBJECT_TYPES,
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  SEAT_CONSUMING_ENROLLMENT_STATUSES,
  LEARNING_EVENT_TYPES,
  ASSESSMENT_QUESTION_TYPES,
  CERTIFICATE_STATUSES,
  COHORT_STATUSES,
  LIVE_SESSION_STATUSES,
  LEARNING_AUDIENCES,
  ACADEMY_LEARNER_AUDIENCES,
  ACADEMY_ACCESS_STATUSES,
  ACADEMY_CATALOG_VISIBILITY,
  COURSE_ACADEMY_VISIBILITY,
  DEFAULT_ACADEMY_PRIMARY_COLOR,
};
