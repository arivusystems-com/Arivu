'use strict';

const crypto = require('crypto');
const LearningCourse = require('../../models/learning/LearningCourse');
const LearningModule = require('../../models/learning/LearningModule');
const LearningObject = require('../../models/learning/LearningObject');
const LearningEnrollment = require('../../models/learning/LearningEnrollment');
const LearningEvent = require('../../models/learning/LearningEvent');
const LearningProgress = require('../../models/learning/LearningProgress');
const LearningPath = require('../../models/learning/LearningPath');
const LearningProgram = require('../../models/learning/LearningProgram');
const LearningCohort = require('../../models/learning/LearningCohort');
const LearningLiveSession = require('../../models/learning/LearningLiveSession');
const LearningSkill = require('../../models/learning/LearningSkill');
const LearningBadge = require('../../models/learning/LearningBadge');
const LearningUserBadge = require('../../models/learning/LearningUserBadge');
const LearningAssessment = require('../../models/learning/LearningAssessment');
const LearningCertificate = require('../../models/learning/LearningCertificate');
const LearningSeatService = require('./learningSeatService');
const {
  COURSE_STATUSES,
  ENROLLMENT_STATUSES,
  AUTHORING_LEARNING_OBJECT_TYPES,
  LEARNING_EVENT_TYPES,
  CERTIFICATE_STATUSES,
  COHORT_STATUSES,
  LIVE_SESSION_STATUSES,
} = require('../../constants/learningConstants');

async function createCourse({ organizationId, userId, title, description }) {
  return LearningCourse.create({
    organizationId,
    title,
    description: description || '',
    status: COURSE_STATUSES.DRAFT,
    createdBy: userId,
    updatedBy: userId,
  });
}

async function addModule({ organizationId, courseId, title, description, sortOrder }) {
  return LearningModule.create({
    organizationId,
    courseId,
    title,
    description: description || '',
    sortOrder: sortOrder ?? 0,
  });
}

async function addLearningObject({
  organizationId,
  courseId,
  moduleId,
  type,
  title,
  body,
  mediaUrl,
  sortOrder,
  estimatedMinutes,
  metadata,
}) {
  if (!AUTHORING_LEARNING_OBJECT_TYPES.includes(type)) {
    const err = new Error(`LearningObject type ${type} is not available`);
    err.code = 'UNSUPPORTED_LEARNING_OBJECT_TYPE';
    throw err;
  }
  if (
    (type === 'VIDEO' || type === 'DOCUMENT' || type === 'SCORM' || type === 'LTI')
    && !String(mediaUrl || '').trim()
  ) {
    const err = new Error('mediaUrl is required for this learning object type');
    err.code = 'MEDIA_URL_REQUIRED';
    throw err;
  }
  return LearningObject.create({
    organizationId,
    courseId,
    moduleId,
    type,
    title,
    body: body || '',
    mediaUrl: mediaUrl || null,
    sortOrder: sortOrder ?? 0,
    estimatedMinutes: estimatedMinutes ?? null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  });
}

/**
 * Build learner launch payload for SCORM (iframe) or LTI 1.1 (form POST).
 */
async function buildLearningObjectLaunch({
  organizationId,
  userId,
  courseId,
  objectId,
  returnUrl = '',
}) {
  const object = await LearningObject.findOne({
    _id: objectId,
    organizationId,
    courseId,
  }).lean();
  if (!object) {
    const err = new Error('Learning object not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const enrollment = await LearningEnrollment.findOne({
    organizationId,
    userId,
    courseId,
    status: { $ne: ENROLLMENT_STATUSES.DROPPED },
  }).lean();
  if (!enrollment) {
    const err = new Error('Enroll in the course before launching this content');
    err.code = 'NOT_ENROLLED';
    throw err;
  }

  if (object.type === 'SCORM') {
    const url = String(object.mediaUrl || object.metadata?.scormEntryUrl || '').trim();
    if (!url) {
      const err = new Error('SCORM package URL is missing');
      err.code = 'SCORM_URL_MISSING';
      throw err;
    }
    return {
      mode: 'iframe',
      type: 'SCORM',
      url,
      title: object.title,
      objectId: String(object._id),
      guidance: 'SCORM content opens in an embedded player. Mark complete when finished.',
    };
  }

  if (object.type === 'LTI') {
    const toolUrl = String(object.mediaUrl || object.metadata?.toolUrl || '').trim();
    const consumerKey = String(object.metadata?.ltiConsumerKey || '').trim();
    const sharedSecret = String(object.metadata?.ltiSharedSecret || '').trim();
    if (!toolUrl || !consumerKey || !sharedSecret) {
      const err = new Error('LTI tool URL, consumer key, and shared secret are required');
      err.code = 'LTI_CONFIG_INCOMPLETE';
      throw err;
    }
    const params = buildLti11LaunchParams({
      toolUrl,
      consumerKey,
      sharedSecret,
      userId: String(userId),
      courseId: String(courseId),
      objectId: String(object._id),
      resourceTitle: object.title,
      returnUrl: returnUrl || undefined,
    });
    return {
      mode: 'lti_form_post',
      type: 'LTI',
      url: toolUrl,
      title: object.title,
      objectId: String(object._id),
      params,
      guidance: 'Submit the signed LTI form to open the external tool.',
    };
  }

  const err = new Error('Launch is only supported for SCORM and LTI objects');
  err.code = 'LAUNCH_UNSUPPORTED';
  throw err;
}

function buildLti11LaunchParams({
  toolUrl,
  consumerKey,
  sharedSecret,
  userId,
  courseId,
  objectId,
  resourceTitle,
  returnUrl,
}) {
  const crypto = require('crypto');
  const oauthTimestamp = String(Math.floor(Date.now() / 1000));
  const oauthNonce = crypto.randomBytes(16).toString('hex');
  const params = {
    lti_message_type: 'basic-lti-launch-request',
    lti_version: 'LTI-1p0',
    resource_link_id: objectId,
    resource_link_title: resourceTitle || 'Learning content',
    user_id: userId,
    roles: 'Learner',
    context_id: courseId,
    context_type: 'CourseSection',
    tool_consumer_instance_guid: 'arivu-learning',
    oauth_callback: 'about:blank',
    oauth_consumer_key: consumerKey,
    oauth_nonce: oauthNonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: oauthTimestamp,
    oauth_version: '1.0',
  };
  if (returnUrl) {
    params.launch_presentation_return_url = returnUrl;
  }

  const baseUrl = toolUrl.split('?')[0];
  const existing = new URL(toolUrl);
  existing.searchParams.forEach((value, key) => {
    if (!(key in params)) params[key] = value;
  });

  const encoded = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(String(params[key]))}`)
    .join('&');
  const baseString = ['POST', percentEncode(baseUrl), percentEncode(encoded)].join('&');
  const signingKey = `${percentEncode(sharedSecret)}&`;
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');
  params.oauth_signature = signature;
  return params;
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function publishCourse({ organizationId, courseId, userId }) {
  const course = await LearningCourse.findOne({ _id: courseId, organizationId });
  if (!course) {
    const err = new Error('Course not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const objectCount = await LearningObject.countDocuments({ organizationId, courseId });
  if (objectCount < 1) {
    const err = new Error('Publish requires at least one learning object');
    err.code = 'COURSE_EMPTY';
    throw err;
  }
  course.status = COURSE_STATUSES.PUBLISHED;
  course.publishedAt = new Date();
  course.updatedBy = userId;
  await course.save();
  return course;
}

async function getCourseTree({ organizationId, courseId }) {
  const course = await LearningCourse.findOne({ _id: courseId, organizationId }).lean();
  if (!course) return null;
  const modules = await LearningModule.find({ organizationId, courseId })
    .sort({ sortOrder: 1 })
    .lean();
  const objects = await LearningObject.find({ organizationId, courseId })
    .sort({ sortOrder: 1 })
    .lean();
  const byModule = new Map();
  for (const o of objects) {
    const key = String(o.moduleId);
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key).push(o);
  }
  return {
    ...course,
    modules: modules.map((m) => ({
      ...m,
      learningObjects: byModule.get(String(m._id)) || [],
    })),
  };
}

async function enrollLearner({
  organizationId,
  userId,
  courseId,
  assignedBy,
  pathId = null,
  dueAt = null,
}) {
  await LearningSeatService.consumeSeat(organizationId, userId);

  const dueDate = dueAt ? new Date(dueAt) : null;
  const validDue = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null;

  const existing = await LearningEnrollment.findOne({
    organizationId,
    userId,
    courseId,
  });
  if (existing && existing.status !== ENROLLMENT_STATUSES.DROPPED) {
    let dirty = false;
    if (validDue) {
      existing.dueAt = validDue;
      dirty = true;
    }
    if (assignedBy && String(assignedBy) !== String(userId)) {
      existing.assignedBy = assignedBy;
      dirty = true;
    }
    if (pathId && !existing.pathId) {
      existing.pathId = pathId;
      dirty = true;
    }
    if (dirty) await existing.save();
    return existing;
  }

  if (existing) {
    existing.status = ENROLLMENT_STATUSES.ACTIVE;
    existing.enrolledAt = new Date();
    existing.assignedBy = assignedBy;
    if (validDue) existing.dueAt = validDue;
    if (pathId) existing.pathId = pathId;
    await existing.save();
    return existing;
  }

  const enrollment = await LearningEnrollment.create({
    organizationId,
    userId,
    courseId,
    pathId,
    status: ENROLLMENT_STATUSES.ACTIVE,
    assignedBy,
    enrolledAt: new Date(),
    dueAt: validDue,
  });

  await LearningEvent.create({
    organizationId,
    userId,
    eventType: LEARNING_EVENT_TYPES.COURSE_STARTED,
    courseId,
    enrollmentId: enrollment._id,
    occurredAt: new Date(),
  });

  await LearningProgress.findOneAndUpdate(
    { organizationId, userId, courseId },
    {
      $setOnInsert: {
        enrollmentId: enrollment._id,
        percentComplete: 0,
        completedObjectIds: [],
        startedAt: new Date(),
      },
      $set: { lastEventAt: new Date() },
    },
    { upsert: true, new: true }
  );

  return enrollment;
}

async function unenrollLearner({ organizationId, userId, courseId }) {
  const enrollment = await LearningEnrollment.findOne({
    organizationId,
    userId,
    courseId,
  });
  if (!enrollment) return null;
  enrollment.status = ENROLLMENT_STATUSES.DROPPED;
  await enrollment.save();
  await LearningSeatService.releaseSeat(organizationId, userId);
  return enrollment;
}

async function recordLessonCompleted({
  organizationId,
  userId,
  courseId,
  moduleId,
  learningObjectId,
  enrollmentId,
}) {
  await LearningEvent.create({
    organizationId,
    userId,
    eventType: LEARNING_EVENT_TYPES.LESSON_COMPLETED,
    courseId,
    moduleId,
    learningObjectId,
    enrollmentId,
    occurredAt: new Date(),
  });

  const totalObjects = await LearningObject.countDocuments({ organizationId, courseId });
  const progress = await LearningProgress.findOneAndUpdate(
    { organizationId, userId, courseId },
    {
      $addToSet: { completedObjectIds: learningObjectId },
      $set: {
        lastLearningObjectId: learningObjectId,
        lastEventAt: new Date(),
      },
      $setOnInsert: {
        enrollmentId: enrollmentId || null,
        startedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  const completed = (progress.completedObjectIds || []).length;
  const percent = totalObjects > 0 ? Math.min(100, Math.round((completed / totalObjects) * 100)) : 0;
  progress.percentComplete = percent;
  if (percent >= 100 && !progress.completedAt) {
    progress.completedAt = new Date();
    const enrollment = await LearningEnrollment.findOneAndUpdate(
      { organizationId, userId, courseId },
      { $set: { status: ENROLLMENT_STATUSES.COMPLETED, completedAt: new Date() } },
      { new: true }
    );
    await LearningEvent.create({
      organizationId,
      userId,
      eventType: LEARNING_EVENT_TYPES.COURSE_COMPLETED,
      courseId,
      enrollmentId,
      occurredAt: new Date(),
    });
    if (enrollment?.pathId) {
      await unlockNextPathCourse({
        organizationId,
        userId,
        pathId: enrollment.pathId,
        completedCourseId: courseId,
      });
    }
    await progress.save();
    return { progress, courseJustCompleted: true, enrollment };
  }
  await progress.save();
  return { progress, courseJustCompleted: false, enrollment: null };
}

async function issueCertificate({ organizationId, userId, courseId, title }) {
  const credentialId = `ARV-LRN-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const cert = await LearningCertificate.create({
    organizationId,
    userId,
    courseId,
    credentialId,
    title: title || 'Certificate of Completion',
    status: CERTIFICATE_STATUSES.ISSUED,
    issuedAt: new Date(),
  });
  await LearningEvent.create({
    organizationId,
    userId,
    eventType: LEARNING_EVENT_TYPES.CERTIFICATE_ISSUED,
    courseId,
    payload: { credentialId },
    occurredAt: new Date(),
  });
  await awardCourseBadges({ organizationId, userId, courseId }).catch(() => {});
  return cert;
}

async function awardCourseBadges({ organizationId, userId, courseId }) {
  if (!courseId) return [];
  const badges = await LearningBadge.find({ organizationId, courseId }).lean();
  const awarded = [];
  for (const badge of badges) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const row = await LearningUserBadge.findOneAndUpdate(
        { organizationId, userId, badgeId: badge._id },
        {
          $setOnInsert: {
            organizationId,
            userId,
            badgeId: badge._id,
            awardedAt: new Date(),
            source: 'course_complete',
          },
        },
        { upsert: true, new: true }
      );
      awarded.push(row);
    } catch {
      // unique race — ignore
    }
  }
  return awarded;
}

async function createSkill({ organizationId, userId, title, description }) {
  return LearningSkill.create({
    organizationId,
    title,
    description: description || '',
    createdBy: userId,
  });
}

async function createBadge({
  organizationId,
  userId,
  title,
  description,
  skillId = null,
  courseId = null,
}) {
  if (skillId) {
    const skill = await LearningSkill.findOne({ _id: skillId, organizationId }).lean();
    if (!skill) {
      const err = new Error('Skill not found');
      err.code = 'SKILL_NOT_FOUND';
      throw err;
    }
  }
  if (courseId) {
    const course = await LearningCourse.findOne({ _id: courseId, organizationId }).lean();
    if (!course) {
      const err = new Error('Course not found');
      err.code = 'COURSE_NOT_FOUND';
      throw err;
    }
  }
  return LearningBadge.create({
    organizationId,
    title,
    description: description || '',
    skillId: skillId || null,
    courseId: courseId || null,
    createdBy: userId,
  });
}

async function listSkillsAndBadges({ organizationId }) {
  const [skills, badges] = await Promise.all([
    LearningSkill.find({ organizationId }).sort({ title: 1 }).lean(),
    LearningBadge.find({ organizationId }).sort({ title: 1 }).lean(),
  ]);
  return { skills, badges };
}

async function listMyBadges({ organizationId, userId }) {
  const rows = await LearningUserBadge.find({ organizationId, userId })
    .sort({ awardedAt: -1 })
    .lean();
  const badgeIds = rows.map((r) => r.badgeId);
  const badges = badgeIds.length
    ? await LearningBadge.find({ _id: { $in: badgeIds } }).lean()
    : [];
  const skillIds = [...new Set(badges.map((b) => b.skillId).filter(Boolean).map(String))];
  const skills = skillIds.length
    ? await LearningSkill.find({ _id: { $in: skillIds } }).lean()
    : [];
  const badgeById = Object.fromEntries(badges.map((b) => [String(b._id), b]));
  const skillById = Object.fromEntries(skills.map((s) => [String(s._id), s]));
  return rows.map((row) => {
    const badge = badgeById[String(row.badgeId)] || null;
    const skill = badge?.skillId ? skillById[String(badge.skillId)] || null : null;
    return {
      ...row,
      badge,
      skill,
    };
  });
}

async function awardBadgeManual({ organizationId, badgeId, userId, awardedBy }) {
  const badge = await LearningBadge.findOne({ _id: badgeId, organizationId }).lean();
  if (!badge) {
    const err = new Error('Badge not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  try {
    return await LearningUserBadge.create({
      organizationId,
      userId,
      badgeId,
      awardedBy,
      awardedAt: new Date(),
      source: 'manual',
    });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await LearningUserBadge.findOne({
        organizationId,
        userId,
        badgeId,
      }).lean();
      return existing;
    }
    throw err;
  }
}

async function scoreAssessmentAttempt({
  organizationId,
  userId,
  assessmentId,
  answers,
}) {
  const assessment = await LearningAssessment.findOne({
    _id: assessmentId,
    organizationId,
  }).lean();
  if (!assessment) {
    const err = new Error('Assessment not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  let earned = 0;
  let total = 0;
  for (const q of assessment.questions || []) {
    total += q.points || 1;
    const answer = (answers || []).find((a) => String(a.questionId) === String(q._id));
    if (!answer) continue;
    const correctIds = (q.options || []).filter((o) => o.correct).map((o) => o.id);
    const given = Array.isArray(answer.optionIds) ? answer.optionIds : [answer.optionId].filter(Boolean);
    const ok =
      correctIds.length === given.length
      && correctIds.every((id) => given.includes(id));
    if (ok) earned += q.points || 1;
  }

  const scorePercent = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passed = scorePercent >= (assessment.passScorePercent || 70);

  await LearningEvent.create({
    organizationId,
    userId,
    eventType: LEARNING_EVENT_TYPES.ASSESSMENT_COMPLETED,
    courseId: assessment.courseId,
    assessmentId,
    payload: { scorePercent, passed, earned, total },
    occurredAt: new Date(),
  });

  return { scorePercent, passed, earned, total, passScorePercent: assessment.passScorePercent };
}

async function publishPath({ organizationId, pathId }) {
  const path = await LearningPath.findOne({ _id: pathId, organizationId });
  if (!path) {
    const err = new Error('Path not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!(path.items || []).length) {
    const err = new Error('Publish requires at least one course on the path');
    err.code = 'PATH_EMPTY';
    throw err;
  }
  path.status = COURSE_STATUSES.PUBLISHED;
  await path.save();
  return path;
}

async function getPathWithProgress({ organizationId, userId, pathId }) {
  const path = await LearningPath.findOne({ _id: pathId, organizationId }).lean();
  if (!path) return null;

  const items = [...(path.items || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const courseIds = items.map((i) => i.courseId).filter(Boolean);
  const [courses, enrollments, progressRows] = await Promise.all([
    LearningCourse.find({ _id: { $in: courseIds }, organizationId }).lean(),
    LearningEnrollment.find({
      organizationId,
      userId,
      courseId: { $in: courseIds },
      status: { $ne: ENROLLMENT_STATUSES.DROPPED },
    }).lean(),
    LearningProgress.find({ organizationId, userId, courseId: { $in: courseIds } }).lean(),
  ]);

  const byCourse = Object.fromEntries(courses.map((c) => [String(c._id), c]));
  const byEnrollment = Object.fromEntries(enrollments.map((e) => [String(e.courseId), e]));
  const byProgress = Object.fromEntries(progressRows.map((p) => [String(p.courseId), p]));

  let unlocked = true;
  const enriched = items.map((item) => {
    const key = String(item.courseId);
    const enrollment = byEnrollment[key] || null;
    const progress = byProgress[key] || null;
    const completed =
      enrollment?.status === ENROLLMENT_STATUSES.COMPLETED
      || Number(progress?.percentComplete || 0) >= 100;
    const row = {
      ...item,
      course: byCourse[key] || null,
      enrollment,
      progress,
      completed,
      unlocked,
      percentComplete: Number(progress?.percentComplete || 0),
    };
    if (path.sequential) {
      unlocked = completed;
    }
    return row;
  });

  const completedCount = enriched.filter((i) => i.completed).length;
  const percentComplete =
    enriched.length > 0 ? Math.round((completedCount / enriched.length) * 100) : 0;

  return {
    ...path,
    items: enriched,
    percentComplete,
    completedCount,
  };
}

async function enrollInPath({ organizationId, userId, pathId, assignedBy, dueAt = null }) {
  const path = await LearningPath.findOne({ _id: pathId, organizationId });
  if (!path) {
    const err = new Error('Path not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (path.status !== COURSE_STATUSES.PUBLISHED) {
    const err = new Error('Path is not published');
    err.code = 'PATH_NOT_PUBLISHED';
    throw err;
  }
  const items = [...(path.items || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (!items.length) {
    const err = new Error('Path has no courses');
    err.code = 'PATH_EMPTY';
    throw err;
  }

  const targets = path.sequential ? [items[0]] : items;
  const enrollments = [];
  for (const item of targets) {
    // eslint-disable-next-line no-await-in-loop
    const enrollment = await enrollLearner({
      organizationId,
      userId,
      courseId: item.courseId,
      assignedBy,
      pathId,
      dueAt,
    });
    enrollments.push(enrollment);
  }
  return { path, enrollments };
}

async function assignLearnersToCourse({
  organizationId,
  courseId,
  userIds,
  assignedBy,
  dueAt = null,
}) {
  const course = await LearningCourse.findOne({ _id: courseId, organizationId }).lean();
  if (!course) {
    const err = new Error('Course not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (course.status !== COURSE_STATUSES.PUBLISHED) {
    const err = new Error('Course must be published before assigning');
    err.code = 'COURSE_NOT_PUBLISHED';
    throw err;
  }

  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) {
    const err = new Error('userIds is required');
    err.code = 'USER_IDS_REQUIRED';
    throw err;
  }

  const results = [];
  for (const uid of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const enrollment = await enrollLearner({
        organizationId,
        userId: uid,
        courseId,
        assignedBy,
        dueAt,
      });
      results.push({ userId: uid, ok: true, enrollment });
    } catch (err) {
      results.push({
        userId: uid,
        ok: false,
        code: err.code || 'ASSIGN_FAILED',
        message: err.message,
      });
    }
  }
  return { course, results };
}

async function assignLearnersToPath({
  organizationId,
  pathId,
  userIds,
  assignedBy,
  dueAt = null,
}) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) {
    const err = new Error('userIds is required');
    err.code = 'USER_IDS_REQUIRED';
    throw err;
  }

  const results = [];
  for (const uid of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const data = await enrollInPath({
        organizationId,
        userId: uid,
        pathId,
        assignedBy,
        dueAt,
      });
      results.push({ userId: uid, ok: true, enrollments: data.enrollments });
    } catch (err) {
      results.push({
        userId: uid,
        ok: false,
        code: err.code || 'ASSIGN_FAILED',
        message: err.message,
      });
    }
  }
  return { results };
}

async function unlockNextPathCourse({ organizationId, userId, pathId, completedCourseId }) {
  if (!pathId || !completedCourseId) return null;
  const path = await LearningPath.findOne({ _id: pathId, organizationId }).lean();
  if (!path || !path.sequential) return null;
  const items = [...(path.items || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const idx = items.findIndex((i) => String(i.courseId) === String(completedCourseId));
  if (idx < 0 || idx >= items.length - 1) return null;
  const next = items[idx + 1];
  return enrollLearner({
    organizationId,
    userId,
    courseId: next.courseId,
    assignedBy: userId,
    pathId,
  });
}

async function createProgram({ organizationId, userId, title, description, pathIds = [] }) {
  const items = (pathIds || []).map((pathId, i) => ({
    pathId,
    sortOrder: i,
  }));
  return LearningProgram.create({
    organizationId,
    title,
    description: description || '',
    status: COURSE_STATUSES.DRAFT,
    items,
    createdBy: userId,
  });
}

async function addPathToProgram({ organizationId, programId, pathId }) {
  const program = await LearningProgram.findOne({ _id: programId, organizationId });
  if (!program) {
    const err = new Error('Program not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const path = await LearningPath.findOne({ _id: pathId, organizationId }).lean();
  if (!path) {
    const err = new Error('Path not found');
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  const exists = (program.items || []).some((i) => String(i.pathId) === String(pathId));
  if (!exists) {
    program.items.push({ pathId, sortOrder: (program.items || []).length });
    await program.save();
  }
  return program;
}

async function publishProgram({ organizationId, programId }) {
  const program = await LearningProgram.findOne({ _id: programId, organizationId });
  if (!program) {
    const err = new Error('Program not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (!(program.items || []).length) {
    const err = new Error('Program must include at least one path');
    err.code = 'PROGRAM_EMPTY';
    throw err;
  }
  program.status = COURSE_STATUSES.PUBLISHED;
  await program.save();
  return program;
}

async function getProgramDetail({ organizationId, programId }) {
  const program = await LearningProgram.findOne({ _id: programId, organizationId }).lean();
  if (!program) return null;
  const pathIds = (program.items || []).map((i) => i.pathId).filter(Boolean);
  const paths = pathIds.length
    ? await LearningPath.find({ _id: { $in: pathIds }, organizationId }).lean()
    : [];
  const pathById = Object.fromEntries(paths.map((p) => [String(p._id), p]));
  const items = [...(program.items || [])]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((item) => ({
      ...item,
      path: pathById[String(item.pathId)] || null,
    }));
  const cohorts = await LearningCohort.find({ organizationId, programId })
    .sort({ createdAt: -1 })
    .lean();
  return { ...program, items, cohorts };
}

async function createCohort({
  organizationId,
  userId,
  programId,
  title,
  startAt = null,
  endAt = null,
  memberUserIds = [],
}) {
  const program = await LearningProgram.findOne({ _id: programId, organizationId }).lean();
  if (!program) {
    const err = new Error('Program not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return LearningCohort.create({
    organizationId,
    programId,
    title,
    startAt: startAt ? new Date(startAt) : null,
    endAt: endAt ? new Date(endAt) : null,
    memberUserIds: [...new Set((memberUserIds || []).map(String).filter(Boolean))],
    status: COHORT_STATUSES.DRAFT,
    createdBy: userId,
  });
}

async function setCohortMembers({ organizationId, cohortId, memberUserIds }) {
  const cohort = await LearningCohort.findOne({ _id: cohortId, organizationId });
  if (!cohort) {
    const err = new Error('Cohort not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  cohort.memberUserIds = [...new Set((memberUserIds || []).map(String).filter(Boolean))];
  await cohort.save();
  return cohort;
}

/**
 * Launch cohort: enroll all members into every path in the program (dueAt = cohort.endAt).
 */
async function launchCohort({ organizationId, cohortId, assignedBy }) {
  const cohort = await LearningCohort.findOne({ _id: cohortId, organizationId });
  if (!cohort) {
    const err = new Error('Cohort not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (cohort.status === COHORT_STATUSES.CLOSED) {
    const err = new Error('Cohort is closed');
    err.code = 'COHORT_CLOSED';
    throw err;
  }
  const program = await LearningProgram.findOne({
    _id: cohort.programId,
    organizationId,
  }).lean();
  if (!program || program.status !== COURSE_STATUSES.PUBLISHED) {
    const err = new Error('Program must be published before launching a cohort');
    err.code = 'PROGRAM_NOT_PUBLISHED';
    throw err;
  }
  const members = (cohort.memberUserIds || []).map(String).filter(Boolean);
  if (!members.length) {
    const err = new Error('Cohort has no members');
    err.code = 'COHORT_EMPTY';
    throw err;
  }
  const pathIds = [...(program.items || [])]
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((i) => i.pathId)
    .filter(Boolean);
  if (!pathIds.length) {
    const err = new Error('Program has no paths');
    err.code = 'PROGRAM_EMPTY';
    throw err;
  }

  const dueAt = cohort.endAt || null;
  const pathResults = [];
  for (const pathId of pathIds) {
    // eslint-disable-next-line no-await-in-loop
    const data = await assignLearnersToPath({
      organizationId,
      pathId,
      userIds: members,
      assignedBy,
      dueAt,
    });
    pathResults.push({ pathId: String(pathId), results: data.results });
  }

  cohort.status = COHORT_STATUSES.ACTIVE;
  cohort.launchedAt = new Date();
  await cohort.save();
  return { cohort, pathResults };
}

async function createLiveSession({
  organizationId,
  userId,
  title,
  description = '',
  courseId = null,
  startsAt,
  endsAt = null,
  meetingUrl = '',
  attendeeUserIds = [],
}) {
  if (!startsAt) {
    const err = new Error('startsAt is required');
    err.code = 'STARTS_AT_REQUIRED';
    throw err;
  }
  if (courseId) {
    const course = await LearningCourse.findOne({ _id: courseId, organizationId }).lean();
    if (!course) {
      const err = new Error('Course not found');
      err.code = 'COURSE_NOT_FOUND';
      throw err;
    }
  }
  return LearningLiveSession.create({
    organizationId,
    title,
    description: description || '',
    courseId: courseId || null,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
    meetingUrl: meetingUrl || '',
    status: LIVE_SESSION_STATUSES.SCHEDULED,
    attendeeUserIds: [...new Set((attendeeUserIds || []).map(String).filter(Boolean))],
    createdBy: userId,
  });
}

async function listLiveSessions({ organizationId, userId, canAuthor }) {
  const filter = { organizationId };
  if (!canAuthor) {
    filter.status = { $ne: LIVE_SESSION_STATUSES.CANCELLED };
  }
  const rows = await LearningLiveSession.find(filter)
    .sort({ startsAt: 1 })
    .limit(200)
    .lean();
  // userId reserved for future RSVP-only filtering
  void userId;
  const courseIds = [...new Set(rows.map((r) => r.courseId).filter(Boolean).map(String))];
  const courses = courseIds.length
    ? await LearningCourse.find({ _id: { $in: courseIds } }).select('title').lean()
    : [];
  const courseById = Object.fromEntries(courses.map((c) => [String(c._id), c]));
  const now = Date.now();
  return rows.map((row) => {
    const starts = row.startsAt ? new Date(row.startsAt).getTime() : 0;
    const ends = row.endsAt ? new Date(row.endsAt).getTime() : starts + 60 * 60 * 1000;
    let effectiveStatus = row.status;
    if (row.status === LIVE_SESSION_STATUSES.SCHEDULED) {
      if (now >= starts && now <= ends) effectiveStatus = LIVE_SESSION_STATUSES.LIVE;
      else if (now > ends) effectiveStatus = LIVE_SESSION_STATUSES.COMPLETED;
    }
    return {
      ...row,
      courseTitle: row.courseId ? courseById[String(row.courseId)]?.title || null : null,
      effectiveStatus,
    };
  });
}

async function registerForLiveSession({ organizationId, sessionId, userId }) {
  const session = await LearningLiveSession.findOne({ _id: sessionId, organizationId });
  if (!session) {
    const err = new Error('Live session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (session.status === LIVE_SESSION_STATUSES.CANCELLED) {
    const err = new Error('Session is cancelled');
    err.code = 'SESSION_CANCELLED';
    throw err;
  }
  const id = String(userId);
  const ids = (session.attendeeUserIds || []).map(String);
  if (!ids.includes(id)) {
    session.attendeeUserIds.push(userId);
    await session.save();
  }
  return session;
}

async function cancelLiveSession({ organizationId, sessionId }) {
  const session = await LearningLiveSession.findOne({ _id: sessionId, organizationId });
  if (!session) {
    const err = new Error('Live session not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  session.status = LIVE_SESSION_STATUSES.CANCELLED;
  await session.save();
  return session;
}

async function getContextualCourses({ organizationId, appKey, limit = 6 }) {
  const key = String(appKey || '').trim().toUpperCase();
  if (!key) {
    const err = new Error('appKey is required');
    err.code = 'APP_KEY_REQUIRED';
    throw err;
  }
  const cap = Math.min(20, Math.max(1, Number(limit) || 6));
  let courses = await LearningCourse.find({
    organizationId,
    status: COURSE_STATUSES.PUBLISHED,
    contextAppKeys: key,
  })
    .sort({ publishedAt: -1 })
    .limit(cap)
    .select('title description estimatedMinutes publishedAt contextAppKeys')
    .lean();

  if (!courses.length) {
    courses = await LearningCourse.find({
      organizationId,
      status: COURSE_STATUSES.PUBLISHED,
    })
      .sort({ publishedAt: -1 })
      .limit(cap)
      .select('title description estimatedMinutes publishedAt contextAppKeys')
      .lean();
  }

  return {
    appKey: key,
    matched: courses.some((c) => (c.contextAppKeys || []).includes(key)),
    courses,
  };
}

async function setCourseContextAppKeys({ organizationId, courseId, contextAppKeys, userId }) {
  const course = await LearningCourse.findOne({ _id: courseId, organizationId });
  if (!course) {
    const err = new Error('Course not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const keys = [...new Set(
    (contextAppKeys || [])
      .map((k) => String(k || '').trim().toUpperCase())
      .filter(Boolean)
  )];
  course.contextAppKeys = keys;
  course.updatedBy = userId;
  await course.save();
  return course;
}

async function listOverdueForNotify({ organizationId }) {
  const now = new Date();
  const enrollments = await LearningEnrollment.find({
    organizationId,
    status: ENROLLMENT_STATUSES.ACTIVE,
    dueAt: { $ne: null, $lt: now },
  })
    .limit(200)
    .lean();
  const courseIds = [...new Set(enrollments.map((e) => e.courseId).filter(Boolean).map(String))];
  const courses = courseIds.length
    ? await LearningCourse.find({ _id: { $in: courseIds } }).select('title').lean()
    : [];
  const courseById = Object.fromEntries(courses.map((c) => [String(c._id), c]));
  return enrollments.map((e) => ({
    enrollmentId: String(e._id),
    userId: String(e.userId),
    courseId: e.courseId ? String(e.courseId) : null,
    courseTitle: e.courseId ? courseById[String(e.courseId)]?.title || null : null,
    dueAt: e.dueAt,
  }));
}

/**
 * Manager / compliance: assigned enrollments + who hasn't finished.
 * @param {{ organizationId: string, viewerUserId: string, scope?: 'org'|'team' }} args
 */
async function getComplianceReport({ organizationId, viewerUserId, scope = 'org' }) {
  const mongoose = require('mongoose');
  const User = require('../../models/User');
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const viewerId = new mongoose.Types.ObjectId(String(viewerUserId));
  const now = Date.now();
  const dueSoonMs = 7 * 24 * 60 * 60 * 1000;

  let teamIds = null;
  if (String(scope || '').toLowerCase() === 'team') {
    const reports = await User.find({
      organizationId: orgId,
      reportsTo: viewerId,
      status: { $ne: 'INACTIVE' },
    })
      .select('_id')
      .lean();
    teamIds = reports.map((u) => u._id);
  }

  const assignmentClause = {
    $or: [{ assignedBy: { $ne: null } }, { dueAt: { $ne: null } }],
  };
  const enrollmentFilter = {
    organizationId: orgId,
    status: { $ne: ENROLLMENT_STATUSES.DROPPED },
    $and: [assignmentClause],
  };
  if (teamIds) {
    enrollmentFilter.$and.push({
      $or: [{ userId: { $in: teamIds } }, { assignedBy: viewerId }],
    });
  }

  const enrollments = await LearningEnrollment.find(enrollmentFilter)
    .sort({ dueAt: 1, updatedAt: -1 })
    .limit(500)
    .lean();

  const userIds = [...new Set(enrollments.map((e) => String(e.userId)))];
  const courseIds = [...new Set(enrollments.map((e) => e.courseId).filter(Boolean).map(String))];
  const pathIds = [...new Set(enrollments.map((e) => e.pathId).filter(Boolean).map(String))];

  const [users, courses, paths, progressRows] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select('firstName lastName email')
      .lean(),
    courseIds.length
      ? LearningCourse.find({ _id: { $in: courseIds } }).select('title status').lean()
      : [],
    pathIds.length
      ? LearningPath.find({ _id: { $in: pathIds } }).select('title status').lean()
      : [],
    courseIds.length
      ? LearningProgress.find({
          organizationId: orgId,
          userId: { $in: userIds },
          courseId: { $in: courseIds },
        }).lean()
      : [],
  ]);

  const userById = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const courseById = Object.fromEntries(courses.map((c) => [String(c._id), c]));
  const pathById = Object.fromEntries(paths.map((p) => [String(p._id), p]));
  const progressKey = (uid, cid) => `${uid}:${cid}`;
  const progressByKey = Object.fromEntries(
    progressRows.map((p) => [progressKey(String(p.userId), String(p.courseId)), p])
  );

  const summary = {
    total: 0,
    overdue: 0,
    dueSoon: 0,
    inProgress: 0,
    completed: 0,
  };

  const rows = enrollments.map((e) => {
    const uid = String(e.userId);
    const user = userById[uid] || {};
    const learnerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
      || user.email
      || uid;
    const course = e.courseId ? courseById[String(e.courseId)] : null;
    const path = e.pathId ? pathById[String(e.pathId)] : null;
    const progress = e.courseId
      ? progressByKey[progressKey(uid, String(e.courseId))]
      : null;
    const percentComplete = e.status === ENROLLMENT_STATUSES.COMPLETED
      ? 100
      : Number(progress?.percentComplete) || 0;
    const dueAt = e.dueAt ? new Date(e.dueAt) : null;
    const completed = e.status === ENROLLMENT_STATUSES.COMPLETED || percentComplete >= 100;
    let complianceStatus = 'in_progress';
    if (completed) {
      complianceStatus = 'completed';
    } else if (dueAt && dueAt.getTime() < now) {
      complianceStatus = 'overdue';
    } else if (dueAt && dueAt.getTime() - now <= dueSoonMs) {
      complianceStatus = 'due_soon';
    } else if (!dueAt) {
      complianceStatus = 'no_due';
    }

    summary.total += 1;
    if (complianceStatus === 'completed') summary.completed += 1;
    else if (complianceStatus === 'overdue') summary.overdue += 1;
    else if (complianceStatus === 'due_soon') summary.dueSoon += 1;
    else summary.inProgress += 1;

    return {
      enrollmentId: String(e._id),
      userId: uid,
      learnerName,
      learnerEmail: user.email || null,
      courseId: e.courseId ? String(e.courseId) : null,
      courseTitle: course?.title || null,
      pathId: e.pathId ? String(e.pathId) : null,
      pathTitle: path?.title || null,
      status: e.status,
      complianceStatus,
      percentComplete,
      dueAt: e.dueAt || null,
      enrolledAt: e.enrolledAt || null,
      completedAt: e.completedAt || null,
      assignedBy: e.assignedBy ? String(e.assignedBy) : null,
    };
  });

  rows.sort((a, b) => {
    const rank = { overdue: 0, due_soon: 1, in_progress: 2, no_due: 3, completed: 4 };
    const ra = rank[a.complianceStatus] ?? 9;
    const rb = rank[b.complianceStatus] ?? 9;
    if (ra !== rb) return ra - rb;
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return aDue - bDue;
  });

  return { summary, rows, scope: String(scope || 'org').toLowerCase() === 'team' ? 'team' : 'org' };
}

/**
 * Astra / AI helpers — search, recommend, summarize (tenant-scoped).
 */
async function searchLearningContent({ organizationId, query, limit = 10 }) {
  const q = String(query || '').trim();
  const cap = Math.min(20, Math.max(1, Number(limit) || 10));
  if (q.length < 2) {
    return { courses: [], paths: [], query: q };
  }
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  const [courses, paths] = await Promise.all([
    LearningCourse.find({
      organizationId,
      status: COURSE_STATUSES.PUBLISHED,
      $or: [{ title: regex }, { description: regex }],
    })
      .sort({ publishedAt: -1 })
      .limit(cap)
      .select('title description estimatedMinutes publishedAt contextAppKeys')
      .lean(),
    LearningPath.find({
      organizationId,
      status: COURSE_STATUSES.PUBLISHED,
      $or: [{ title: regex }, { description: regex }],
    })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .select('title description sequential items')
      .lean(),
  ]);
  return {
    query: q,
    courses: courses.map((c) => ({
      id: String(c._id),
      title: c.title,
      description: c.description || '',
      estimatedMinutes: c.estimatedMinutes,
      contextAppKeys: c.contextAppKeys || [],
      route: `/learning/courses/${c._id}`,
    })),
    paths: paths.map((p) => ({
      id: String(p._id),
      title: p.title,
      description: p.description || '',
      itemCount: (p.items || []).length,
      route: `/learning/paths/${p._id}`,
    })),
  };
}

async function recommendLearning({ organizationId, userId, limit = 6 }) {
  const cap = Math.min(12, Math.max(1, Number(limit) || 6));
  const enrollments = await LearningEnrollment.find({
    organizationId,
    userId,
    status: ENROLLMENT_STATUSES.ACTIVE,
  })
    .sort({ dueAt: 1, updatedAt: -1 })
    .lean();

  const enrolledCourseIds = new Set(
    enrollments.map((e) => e.courseId).filter(Boolean).map(String)
  );
  const continueRows = [];
  for (const e of enrollments) {
    if (!e.courseId) continue;
    // eslint-disable-next-line no-await-in-loop
    const [course, progress] = await Promise.all([
      LearningCourse.findOne({ _id: e.courseId, organizationId }).select('title description').lean(),
      LearningProgress.findOne({ organizationId, userId, courseId: e.courseId }).lean(),
    ]);
    if (!course) continue;
    const percent = Number(progress?.percentComplete) || 0;
    if (percent >= 100) continue;
    continueRows.push({
      kind: 'continue',
      courseId: String(e.courseId),
      title: course.title,
      description: course.description || '',
      percentComplete: percent,
      dueAt: e.dueAt || null,
      overdue: Boolean(e.dueAt && new Date(e.dueAt).getTime() < Date.now()),
      route: `/learning/courses/${e.courseId}`,
      reason: e.dueAt && new Date(e.dueAt).getTime() < Date.now()
        ? 'overdue_assignment'
        : 'in_progress',
    });
  }

  const explore = await LearningCourse.find({
    organizationId,
    status: COURSE_STATUSES.PUBLISHED,
    ...(enrolledCourseIds.size
      ? { _id: { $nin: [...enrolledCourseIds] } }
      : {}),
  })
    .sort({ publishedAt: -1 })
    .limit(cap)
    .select('title description estimatedMinutes')
    .lean();

  const exploreRows = explore.map((c) => ({
    kind: 'explore',
    courseId: String(c._id),
    title: c.title,
    description: c.description || '',
    estimatedMinutes: c.estimatedMinutes,
    route: `/learning/courses/${c._id}`,
    reason: 'published_catalog',
  }));

  const recommendations = [...continueRows, ...exploreRows].slice(0, cap);
  return {
    recommendations,
    counts: {
      continue: continueRows.length,
      explore: exploreRows.length,
      returned: recommendations.length,
    },
  };
}

async function summarizeCourseForAi({ organizationId, courseId }) {
  const tree = await getCourseTree({ organizationId, courseId });
  if (!tree) {
    const err = new Error('Course not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const modules = (tree.modules || []).map((m, mi) => ({
    index: mi + 1,
    title: m.title,
    objects: (m.learningObjects || []).map((o, oi) => ({
      index: oi + 1,
      title: o.title,
      type: o.type,
    })),
  }));
  const objectCount = modules.reduce((n, m) => n + (m.objects?.length || 0), 0);
  const outline = modules
    .map((m) => {
      const lessons = (m.objects || [])
        .map((o) => `  ${m.index}.${o.index} [${o.type}] ${o.title}`)
        .join('\n');
      return `${m.index}. ${m.title}\n${lessons}`;
    })
    .join('\n');
  return {
    courseId: String(tree._id || courseId),
    title: tree.title,
    description: tree.description || '',
    status: tree.status,
    estimatedMinutes: tree.estimatedMinutes,
    moduleCount: modules.length,
    objectCount,
    outline,
    summary:
      `${tree.title}`
      + (tree.description ? ` — ${tree.description}` : '')
      + `. ${modules.length} modules, ${objectCount} learning objects.`
      + (tree.estimatedMinutes ? ` ~${tree.estimatedMinutes} min.` : ''),
    route: `/learning/courses/${courseId}`,
  };
}

async function getTenantAnalytics({ organizationId }) {
  const mongoose = require('mongoose');
  const orgId = new mongoose.Types.ObjectId(String(organizationId));
  const [
    courseCount,
    publishedCount,
    enrollmentCount,
    certificateCount,
    seatUsage,
  ] = await Promise.all([
    LearningCourse.countDocuments({ organizationId: orgId }),
    LearningCourse.countDocuments({ organizationId: orgId, status: COURSE_STATUSES.PUBLISHED }),
    LearningEnrollment.countDocuments({
      organizationId: orgId,
      status: { $in: [ENROLLMENT_STATUSES.ACTIVE, ENROLLMENT_STATUSES.COMPLETED] },
    }),
    LearningCertificate.countDocuments({
      organizationId: orgId,
      status: CERTIFICATE_STATUSES.ISSUED,
    }),
    LearningSeatService.getUsageBreakdown(organizationId),
  ]);

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const mauRows = await LearningEvent.aggregate([
    {
      $match: {
        organizationId: orgId,
        occurredAt: { $gte: periodStart },
      },
    },
    { $group: { _id: '$userId' } },
    { $count: 'mau' },
  ]);

  return {
    courses: courseCount,
    publishedCourses: publishedCount,
    enrollments: enrollmentCount,
    certificatesIssued: certificateCount,
    ...seatUsage,
    mauThisPeriod: mauRows[0]?.mau || 0,
  };
}

module.exports = {
  createCourse,
  addModule,
  addLearningObject,
  buildLearningObjectLaunch,
  publishCourse,
  getCourseTree,
  enrollLearner,
  unenrollLearner,
  recordLessonCompleted,
  issueCertificate,
  scoreAssessmentAttempt,
  publishPath,
  getPathWithProgress,
  enrollInPath,
  unlockNextPathCourse,
  assignLearnersToCourse,
  assignLearnersToPath,
  createProgram,
  addPathToProgram,
  publishProgram,
  getProgramDetail,
  createCohort,
  setCohortMembers,
  launchCohort,
  createLiveSession,
  listLiveSessions,
  registerForLiveSession,
  cancelLiveSession,
  createSkill,
  createBadge,
  listSkillsAndBadges,
  listMyBadges,
  awardBadgeManual,
  listOverdueForNotify,
  getContextualCourses,
  setCourseContextAppKeys,
  searchLearningContent,
  recommendLearning,
  summarizeCourseForAi,
  getComplianceReport,
  getTenantAnalytics,
  LearningCourse,
  LearningModule,
  LearningObject,
  LearningEnrollment,
  LearningPath,
  LearningProgram,
  LearningCohort,
  LearningLiveSession,
  LearningSkill,
  LearningBadge,
  LearningUserBadge,
  LearningAssessment,
  LearningCertificate,
  LearningProgress,
  LearningEvent,
};
