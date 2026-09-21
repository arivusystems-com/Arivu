'use strict';

/**
 * Academy catalog visibility for EXTERNAL learners.
 */

const LearningCourse = require('../../models/learning/LearningCourse');
const LearningEnrollment = require('../../models/learning/LearningEnrollment');
const {
  COURSE_STATUSES,
  ACADEMY_CATALOG_VISIBILITY,
  COURSE_ACADEMY_VISIBILITY,
  SEAT_CONSUMING_ENROLLMENT_STATUSES,
  ENROLLMENT_STATUSES,
} = require('../../constants/learningConstants');
const { getAcademyConfig } = require('./learningAcademyConfigService');
const { deriveLearnerAudience } = require('./learningAudienceService');

function effectiveVisibility(course, academyConfig) {
  const override = String(course.academyVisibility || COURSE_ACADEMY_VISIBILITY.INHERIT).toLowerCase();
  if (override && override !== COURSE_ACADEMY_VISIBILITY.INHERIT) return override;
  return academyConfig.catalogVisibility || ACADEMY_CATALOG_VISIBILITY.ASSIGNED;
}

/**
 * @returns {Promise<object[]>} published courses visible to this EXTERNAL learner
 */
async function listAcademyCatalog({ organizationId, user }) {
  const academyConfig = await getAcademyConfig(organizationId);
  const audience = await deriveLearnerAudience(user);

  if (
    audience !== 'internal'
    && Array.isArray(academyConfig.allowedAudiences)
    && academyConfig.allowedAudiences.length
    && !academyConfig.allowedAudiences.includes(audience)
  ) {
    return [];
  }

  const published = await LearningCourse.find({
    organizationId,
    status: COURSE_STATUSES.PUBLISHED,
  })
    .sort({ publishedAt: -1 })
    .lean();

  const enrollments = await LearningEnrollment.find({
    organizationId,
    userId: user._id,
    status: { $in: [...SEAT_CONSUMING_ENROLLMENT_STATUSES, ENROLLMENT_STATUSES.ACTIVE] },
  })
    .select('courseId')
    .lean();
  const enrolledIds = new Set(enrollments.map((e) => String(e.courseId)));

  return published.filter((course) => {
    const mode = effectiveVisibility(course, academyConfig);
    if (mode === ACADEMY_CATALOG_VISIBILITY.ASSIGNED || mode === ACADEMY_CATALOG_VISIBILITY.INVITE_ONLY) {
      return enrolledIds.has(String(course._id));
    }
    if (mode === ACADEMY_CATALOG_VISIBILITY.AUDIENCE) {
      const audiences = Array.isArray(course.academyAudiences) ? course.academyAudiences : [];
      if (!audiences.length) {
        // No per-course audiences → visible to all allowed academy audiences
        return academyConfig.allowedAudiences.includes(audience);
      }
      return audiences.includes(audience);
    }
    return enrolledIds.has(String(course._id));
  });
}

module.exports = {
  listAcademyCatalog,
  effectiveVisibility,
};
