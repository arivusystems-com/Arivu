'use strict';

const learningService = require('../services/learning/learningService');
const LearningSeatService = require('../services/learning/learningSeatService');
const { COURSE_STATUSES } = require('../constants/learningConstants');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');
const {
  resolveLearningRole,
  canAuthorLearning,
} = require('../middleware/requireLearningRole');
const { emitNotification } = require('../services/notificationEngine');
const domainEvents = require('../constants/domainEvents');

function orgId(req) {
  return req.user.organizationId;
}

function userId(req) {
  return req.user._id || req.user.id;
}

function requireCourseId(req, res) {
  const id = req.params.id;
  if (!isMongoObjectIdString(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid course id',
      code: 'INVALID_COURSE_ID',
    });
    return null;
  }
  return id;
}

function requirePathId(req, res) {
  const id = req.params.id;
  if (!isMongoObjectIdString(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid path id',
      code: 'INVALID_PATH_ID',
    });
    return null;
  }
  return id;
}

function requireProgramId(req, res) {
  const id = req.params.id;
  if (!isMongoObjectIdString(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid program id',
      code: 'INVALID_PROGRAM_ID',
    });
    return null;
  }
  return id;
}

function requireCohortId(req, res) {
  const id = req.params.cohortId || req.params.id;
  if (!isMongoObjectIdString(id)) {
    res.status(400).json({
      success: false,
      message: 'Invalid cohort id',
      code: 'INVALID_COHORT_ID',
    });
    return null;
  }
  return id;
}

async function health(req, res) {
  return res.json({
    success: true,
    app: 'Learning',
    appKey: 'LMS',
    message: 'Learning API ready',
  });
}

async function getSeatUsage(req, res) {
  try {
    const breakdown = await LearningSeatService.getUsageBreakdown(orgId(req));
    return res.json({ success: true, data: breakdown });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getAnalytics(req, res) {
  try {
    const data = await learningService.getTenantAnalytics({ organizationId: orgId(req) });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getCompliance(req, res) {
  try {
    const scope = String(req.query?.scope || 'org').toLowerCase() === 'team' ? 'team' : 'org';
    const data = await learningService.getComplianceReport({
      organizationId: orgId(req),
      viewerUserId: userId(req),
      scope,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listCourses(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    if (req.query.status) filter.status = req.query.status;
    const courses = await learningService.LearningCourse.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: courses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createCourse(req, res) {
  try {
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const course = await learningService.createCourse({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      description,
    });
    const payload = typeof course?.toObject === 'function' ? course.toObject() : course;
    return res.status(201).json({
      success: true,
      data: {
        ...payload,
        _id: String(payload?._id || payload?.id || ''),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getCourse(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const tree = await learningService.getCourseTree({
      organizationId: orgId(req),
      courseId,
    });
    if (!tree) return res.status(404).json({ success: false, message: 'Course not found' });

    const uid = userId(req);
    const [enrollment, progress, certificate, assessments] = await Promise.all([
      learningService.LearningEnrollment.findOne({
        organizationId: orgId(req),
        userId: uid,
        courseId,
        status: { $ne: 'dropped' },
      }).lean(),
      learningService.LearningProgress.findOne({
        organizationId: orgId(req),
        userId: uid,
        courseId,
      }).lean(),
      learningService.LearningCertificate.findOne({
        organizationId: orgId(req),
        userId: uid,
        courseId,
      }).lean(),
      learningService.LearningAssessment.find({
        organizationId: orgId(req),
        courseId,
      })
        .select('title passScorePercent questions')
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        ...tree,
        learner: {
          enrollment: enrollment || null,
          progress: progress || null,
          certificate: certificate || null,
          assessments: assessments || [],
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function addModule(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const mod = await learningService.addModule({
      organizationId: orgId(req),
      courseId,
      title: req.body?.title,
      description: req.body?.description,
      sortOrder: req.body?.sortOrder,
    });
    return res.status(201).json({ success: true, data: mod });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function addLearningObject(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const obj = await learningService.addLearningObject({
      organizationId: orgId(req),
      courseId,
      moduleId: req.params.moduleId,
      type: req.body?.type,
      title: req.body?.title,
      body: req.body?.body,
      mediaUrl: req.body?.mediaUrl,
      sortOrder: req.body?.sortOrder,
      estimatedMinutes: req.body?.estimatedMinutes,
      metadata: req.body?.metadata,
    });
    return res.status(201).json({ success: true, data: obj });
  } catch (err) {
    const status =
      err.code === 'UNSUPPORTED_LEARNING_OBJECT_TYPE' || err.code === 'MEDIA_URL_REQUIRED'
        ? 400
        : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function launchLearningObject(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const objectId = req.params.objectId;
    if (!isMongoObjectIdString(objectId)) {
      return res.status(400).json({ success: false, message: 'Invalid object id' });
    }
    const data = await learningService.buildLearningObjectLaunch({
      organizationId: orgId(req),
      userId: userId(req),
      courseId,
      objectId,
      returnUrl: req.body?.returnUrl || req.query?.returnUrl || '',
    });
    return res.json({ success: true, data });
  } catch (err) {
    const code = err.code;
    const status =
      code === 'NOT_FOUND' ? 404
        : code === 'NOT_ENROLLED' ? 403
          : ['SCORM_URL_MISSING', 'LTI_CONFIG_INCOMPLETE', 'LAUNCH_UNSUPPORTED'].includes(code)
            ? 400
            : 500;
    return res.status(status).json({ success: false, message: err.message, code });
  }
}

async function publishCourse(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const course = await learningService.publishCourse({
      organizationId: orgId(req),
      courseId,
      userId: userId(req),
    });
    emitNotification({
      eventType: domainEvents.LEARNING_COURSE_PUBLISHED,
      entity: {
        type: 'LearningCourse',
        id: String(course._id),
        title: course.title,
      },
      organizationId: orgId(req),
      triggeredBy: userId(req),
      sourceAppKey: 'LMS',
    }).catch((err) => {
      console.error('[learningController] LEARNING_COURSE_PUBLISHED notify failed:', err?.message || err);
    });
    return res.json({ success: true, data: course });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'COURSE_EMPTY' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function enroll(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const role = resolveLearningRole(req.user);
    let targetUserId = userId(req);
    if (req.body?.userId && String(req.body.userId) !== String(userId(req))) {
      if (!canAuthorLearning(role)) {
        return res.status(403).json({
          success: false,
          message: 'Learning author access is required to enroll other users.',
          code: 'LEARNING_AUTHOR_REQUIRED',
        });
      }
      targetUserId = req.body.userId;
    }
    const enrollment = await learningService.enrollLearner({
      organizationId: orgId(req),
      userId: targetUserId,
      courseId,
      assignedBy: userId(req),
      pathId: req.body?.pathId || null,
      dueAt: req.body?.dueAt || null,
    });
    emitNotification({
      eventType: domainEvents.LEARNING_ENROLLED,
      entity: {
        type: 'LearningEnrollment',
        id: String(enrollment._id),
        title: 'Course enrollment',
        courseId: String(courseId),
        learnerUserId: String(targetUserId),
        dueAt: enrollment.dueAt || null,
      },
      organizationId: orgId(req),
      triggeredBy: userId(req),
      sourceAppKey: 'LMS',
    }).catch((err) => {
      console.error('[learningController] LEARNING_ENROLLED notify failed:', err?.message || err);
    });
    return res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    if (err.code === 'LEARNER_CAPACITY_REACHED' || err.code === 'LEARNING_ACCESS_REQUIRED') {
      return res.status(402).json({
        success: false,
        message: err.message,
        code: err.code,
        usage: err.usage,
      });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function unenroll(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const enrollment = await learningService.unenrollLearner({
      organizationId: orgId(req),
      userId: userId(req),
      courseId,
    });
    return res.json({ success: true, data: enrollment });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function myLearning(req, res) {
  try {
    const enrollments = await learningService.LearningEnrollment.find({
      organizationId: orgId(req),
      userId: userId(req),
      status: { $ne: 'dropped' },
    })
      .lean();
    const courseIds = enrollments.map((e) => e.courseId).filter(Boolean);
    const courses = await learningService.LearningCourse.find({
      _id: { $in: courseIds },
    }).lean();
    const progress = await learningService.LearningProgress.find({
      organizationId: orgId(req),
      userId: userId(req),
      courseId: { $in: courseIds },
    }).lean();
    const byCourse = Object.fromEntries(courses.map((c) => [String(c._id), c]));
    const byProgress = Object.fromEntries(progress.map((p) => [String(p.courseId), p]));
    const now = Date.now();
    const data = enrollments.map((e) => {
      const assigned =
        e.assignedBy && String(e.assignedBy) !== String(userId(req));
      const dueAt = e.dueAt ? new Date(e.dueAt) : null;
      const overdue =
        Boolean(dueAt)
        && e.status !== 'completed'
        && dueAt.getTime() < now;
      return {
        enrollment: e,
        course: byCourse[String(e.courseId)] || null,
        progress: byProgress[String(e.courseId)] || null,
        assigned,
        overdue,
      };
    });
    data.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const aDue = a.enrollment?.dueAt ? new Date(a.enrollment.dueAt).getTime() : Infinity;
      const bDue = b.enrollment?.dueAt ? new Date(b.enrollment.dueAt).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.enrollment?.updatedAt || 0) - new Date(a.enrollment?.updatedAt || 0);
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function explore(req, res) {
  try {
    const courses = await learningService.LearningCourse.find({
      organizationId: orgId(req),
      status: COURSE_STATUSES.PUBLISHED,
    })
      .sort({ publishedAt: -1 })
      .lean();
    return res.json({ success: true, data: courses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getContextual(req, res) {
  try {
    const data = await learningService.getContextualCourses({
      organizationId: orgId(req),
      appKey: req.query?.appKey,
      limit: req.query?.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.code === 'APP_KEY_REQUIRED' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function aiRecommend(req, res) {
  try {
    const data = await learningService.recommendLearning({
      organizationId: orgId(req),
      userId: userId(req),
      limit: req.query?.limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function aiSummarizeCourse(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const data = await learningService.summarizeCourseForAi({
      organizationId: orgId(req),
      courseId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function setCourseContext(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const course = await learningService.setCourseContextAppKeys({
      organizationId: orgId(req),
      courseId,
      contextAppKeys: req.body?.contextAppKeys || [],
      userId: userId(req),
    });
    return res.json({ success: true, data: course });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function completeLesson(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const result = await learningService.recordLessonCompleted({
      organizationId: orgId(req),
      userId: userId(req),
      courseId,
      moduleId: req.body?.moduleId,
      learningObjectId: req.body?.learningObjectId,
      enrollmentId: req.body?.enrollmentId,
    });
    const progress = result?.progress || result;
    if (result?.courseJustCompleted) {
      const course = await learningService.LearningCourse.findOne({
        _id: courseId,
        organizationId: orgId(req),
      })
        .select('title')
        .lean();
      emitNotification({
        eventType: domainEvents.LEARNING_COURSE_COMPLETED,
        entity: {
          type: 'LearningEnrollment',
          id: String(result.enrollment?._id || progress?._id || courseId),
          title: course?.title || 'Course completed',
          courseId: String(courseId),
          learnerUserId: String(userId(req)),
        },
        organizationId: orgId(req),
        triggeredBy: userId(req),
        sourceAppKey: 'LMS',
      }).catch((err) => {
        console.error('[learningController] LEARNING_COURSE_COMPLETED notify failed:', err?.message || err);
      });
    }
    return res.json({ success: true, data: progress });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function assignCourse(req, res) {
  try {
    const courseId = requireCourseId(req, res);
    if (!courseId) return;
    const data = await learningService.assignLearnersToCourse({
      organizationId: orgId(req),
      courseId,
      userIds: req.body?.userIds || [],
      assignedBy: userId(req),
      dueAt: req.body?.dueAt || null,
    });
    const courseTitle = data.course?.title || 'Course';
    for (const row of data.results) {
      if (!row.ok || !row.enrollment) continue;
      emitNotification({
        eventType: domainEvents.LEARNING_ENROLLED,
        entity: {
          type: 'LearningEnrollment',
          id: String(row.enrollment._id),
          title: courseTitle,
          courseId: String(courseId),
          learnerUserId: String(row.userId),
          dueAt: row.enrollment.dueAt || req.body?.dueAt || null,
        },
        organizationId: orgId(req),
        triggeredBy: userId(req),
        sourceAppKey: 'LMS',
      }).catch(() => {});
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'COURSE_NOT_PUBLISHED' || err.code === 'USER_IDS_REQUIRED'
          ? 400
          : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function assignPath(req, res) {
  try {
    const pathId = requirePathId(req, res);
    if (!pathId) return;
    const data = await learningService.assignLearnersToPath({
      organizationId: orgId(req),
      pathId,
      userIds: req.body?.userIds || [],
      assignedBy: userId(req),
      dueAt: req.body?.dueAt || null,
    });
    for (const row of data.results) {
      if (!row.ok) continue;
      emitNotification({
        eventType: domainEvents.LEARNING_ENROLLED,
        entity: {
          type: 'LearningPath',
          id: String(pathId),
          title: 'Learning path assignment',
          learnerUserId: String(row.userId),
          dueAt: req.body?.dueAt || null,
        },
        organizationId: orgId(req),
        triggeredBy: userId(req),
        sourceAppKey: 'LMS',
      }).catch(() => {});
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.code === 'USER_IDS_REQUIRED' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function listPaths(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    const role = resolveLearningRole(req.user);
    if (!canAuthorLearning(role)) {
      filter.status = COURSE_STATUSES.PUBLISHED;
    }
    const paths = await learningService.LearningPath.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: paths });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getPath(req, res) {
  try {
    const pathId = requirePathId(req, res);
    if (!pathId) return;
    const data = await learningService.getPathWithProgress({
      organizationId: orgId(req),
      userId: userId(req),
      pathId,
    });
    if (!data) return res.status(404).json({ success: false, message: 'Path not found' });
    const role = resolveLearningRole(req.user);
    if (!canAuthorLearning(role) && data.status !== COURSE_STATUSES.PUBLISHED) {
      return res.status(404).json({ success: false, message: 'Path not found' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createPath(req, res) {
  try {
    const path = await learningService.LearningPath.create({
      organizationId: orgId(req),
      title: req.body?.title,
      description: req.body?.description || '',
      sequential: req.body?.sequential !== false,
      items: req.body?.items || [],
      createdBy: userId(req),
    });
    return res.status(201).json({ success: true, data: path });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function publishPath(req, res) {
  try {
    const pathId = requirePathId(req, res);
    if (!pathId) return;
    const path = await learningService.publishPath({
      organizationId: orgId(req),
      pathId,
    });
    return res.json({ success: true, data: path });
  } catch (err) {
    const status =
      err.code === 'NOT_FOUND' ? 404 : err.code === 'PATH_EMPTY' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function enrollInPath(req, res) {
  try {
    const pathId = requirePathId(req, res);
    if (!pathId) return;
    const result = await learningService.enrollInPath({
      organizationId: orgId(req),
      userId: userId(req),
      pathId,
      assignedBy: userId(req),
    });
    emitNotification({
      eventType: domainEvents.LEARNING_ENROLLED,
      entity: {
        type: 'LearningPath',
        id: String(pathId),
        title: result.path?.title || 'Learning path',
        learnerUserId: String(userId(req)),
      },
      organizationId: orgId(req),
      triggeredBy: userId(req),
      sourceAppKey: 'LMS',
    }).catch((err) => {
      console.error('[learningController] path LEARNING_ENROLLED notify failed:', err?.message || err);
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'LEARNER_CAPACITY_REACHED' || err.code === 'LEARNING_ACCESS_REQUIRED') {
      return res.status(402).json({
        success: false,
        message: err.message,
        code: err.code,
        usage: err.usage,
      });
    }
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'PATH_NOT_PUBLISHED' || err.code === 'PATH_EMPTY'
          ? 400
          : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function searchLearning(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ success: true, data: { courses: [], paths: [] } });
    }
    const org = orgId(req);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const role = resolveLearningRole(req.user);
    const courseFilter = {
      organizationId: org,
      $or: [{ title: regex }, { description: regex }],
    };
    if (!canAuthorLearning(role)) {
      courseFilter.status = COURSE_STATUSES.PUBLISHED;
    }
    const pathFilter = {
      organizationId: org,
      $or: [{ title: regex }, { description: regex }],
    };
    if (!canAuthorLearning(role)) {
      pathFilter.status = COURSE_STATUSES.PUBLISHED;
    }
    const [courses, paths] = await Promise.all([
      learningService.LearningCourse.find(courseFilter).limit(10).lean(),
      learningService.LearningPath.find(pathFilter).limit(10).lean(),
    ]);
    return res.json({
      success: true,
      data: {
        courses: courses.map((c) => ({
          id: c._id,
          title: c.title,
          status: c.status,
          route: `/learning/courses/${c._id}`,
        })),
        paths: paths.map((p) => ({
          id: p._id,
          title: p.title,
          status: p.status,
          route: `/learning/paths/${p._id}`,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function listAssessments(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    if (req.query.courseId) filter.courseId = req.query.courseId;
    const rows = await learningService.LearningAssessment.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createAssessment(req, res) {
  try {
    const row = await learningService.LearningAssessment.create({
      organizationId: orgId(req),
      courseId: req.body?.courseId || null,
      title: req.body?.title,
      description: req.body?.description || '',
      passScorePercent: req.body?.passScorePercent ?? 70,
      maxAttempts: req.body?.maxAttempts ?? 3,
      questions: req.body?.questions || [],
      createdBy: userId(req),
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function submitAssessment(req, res) {
  try {
    const result = await learningService.scoreAssessmentAttempt({
      organizationId: orgId(req),
      userId: userId(req),
      assessmentId: req.params.id,
      answers: req.body?.answers || [],
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

async function listCertificates(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    if (req.query.mine === '1') filter.userId = userId(req);
    const rows = await learningService.LearningCertificate.find(filter)
      .sort({ issuedAt: -1 })
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function issueCertificate(req, res) {
  try {
    const courseId = req.body?.courseId;
    if (!isMongoObjectIdString(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course id',
        code: 'INVALID_COURSE_ID',
      });
    }
    const targetUserId = req.body?.userId || userId(req);
    const isSelf = String(targetUserId) === String(userId(req));
    const role = resolveLearningRole(req.user);
    if (!isSelf && !canAuthorLearning(role)) {
      return res.status(403).json({
        success: false,
        message: 'Learning author access is required to issue certificates for others.',
        code: 'LEARNING_AUTHOR_REQUIRED',
      });
    }

    if (isSelf) {
      const progress = await learningService.LearningProgress.findOne({
        organizationId: orgId(req),
        userId: targetUserId,
        courseId,
      }).lean();
      if (!progress || Number(progress.percentComplete || 0) < 100) {
        return res.status(400).json({
          success: false,
          message: 'Complete the course before claiming a certificate.',
          code: 'COURSE_NOT_COMPLETE',
        });
      }
    }

    const existing = await learningService.LearningCertificate.findOne({
      organizationId: orgId(req),
      userId: targetUserId,
      courseId,
    });
    if (existing) {
      return res.json({ success: true, data: existing, code: 'ALREADY_ISSUED' });
    }

    const cert = await learningService.issueCertificate({
      organizationId: orgId(req),
      userId: targetUserId,
      courseId,
      title: req.body?.title,
    });
    return res.status(201).json({ success: true, data: cert });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function contentLibrary(req, res) {
  try {
    const objects = await learningService.LearningObject.find({ organizationId: orgId(req) })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    const courseIds = [...new Set(objects.map((o) => String(o.courseId)).filter(Boolean))];
    const courses = await learningService.LearningCourse.find({
      _id: { $in: courseIds },
      organizationId: orgId(req),
    })
      .select('title status')
      .lean();
    const byCourse = Object.fromEntries(courses.map((c) => [String(c._id), c]));
    const data = objects.map((o) => ({
      ...o,
      course: byCourse[String(o.courseId)] || null,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { persistMulterUpload, LEARNING_MAX_UPLOAD_BYTES } = require('../middleware/uploadMiddleware');
    const maxBytes =
      typeof LEARNING_MAX_UPLOAD_BYTES === 'number'
        ? LEARNING_MAX_UPLOAD_BYTES
        : parseInt(process.env.LEARNING_MAX_FILE_SIZE || String(100 * 1024 * 1024), 10);
    const uploadResult = await persistMulterUpload(req, 'learning', {
      maxFileSize: maxBytes,
    });
    return res.status(201).json({
      success: true,
      data: {
        url: uploadResult.url,
        storagePath: uploadResult.storagePath,
        filename: uploadResult.storedFileName,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

async function listPrograms(req, res) {
  try {
    const filter = { organizationId: orgId(req) };
    const role = resolveLearningRole(req.user);
    if (!canAuthorLearning(role)) {
      filter.status = COURSE_STATUSES.PUBLISHED;
    }
    const rows = await learningService.LearningProgram.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createProgram(req, res) {
  try {
    const { title, description, pathIds } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const program = await learningService.createProgram({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      description,
      pathIds,
    });
    return res.status(201).json({ success: true, data: program });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getProgram(req, res) {
  try {
    const programId = requireProgramId(req, res);
    if (!programId) return;
    const data = await learningService.getProgramDetail({
      organizationId: orgId(req),
      programId,
    });
    if (!data) return res.status(404).json({ success: false, message: 'Program not found' });
    const role = resolveLearningRole(req.user);
    if (!canAuthorLearning(role) && data.status !== COURSE_STATUSES.PUBLISHED) {
      return res.status(404).json({ success: false, message: 'Program not found' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function addProgramPath(req, res) {
  try {
    const programId = requireProgramId(req, res);
    if (!programId) return;
    const pathId = req.body?.pathId;
    if (!isMongoObjectIdString(pathId)) {
      return res.status(400).json({ success: false, message: 'pathId is required' });
    }
    const program = await learningService.addPathToProgram({
      organizationId: orgId(req),
      programId,
      pathId,
    });
    return res.json({ success: true, data: program });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' || err.code === 'PATH_NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function publishProgram(req, res) {
  try {
    const programId = requireProgramId(req, res);
    if (!programId) return;
    const program = await learningService.publishProgram({
      organizationId: orgId(req),
      programId,
    });
    return res.json({ success: true, data: program });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'PROGRAM_EMPTY' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function createCohort(req, res) {
  try {
    const programId = requireProgramId(req, res);
    if (!programId) return;
    const { title, startAt, endAt, memberUserIds } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const cohort = await learningService.createCohort({
      organizationId: orgId(req),
      userId: userId(req),
      programId,
      title,
      startAt,
      endAt,
      memberUserIds,
    });
    return res.status(201).json({ success: true, data: cohort });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function setCohortMembers(req, res) {
  try {
    const cohortId = requireCohortId(req, res);
    if (!cohortId) return;
    const cohort = await learningService.setCohortMembers({
      organizationId: orgId(req),
      cohortId,
      memberUserIds: req.body?.memberUserIds || req.body?.userIds || [],
    });
    return res.json({ success: true, data: cohort });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function launchCohort(req, res) {
  try {
    const cohortId = requireCohortId(req, res);
    if (!cohortId) return;
    const data = await learningService.launchCohort({
      organizationId: orgId(req),
      cohortId,
      assignedBy: userId(req),
    });
    const pathResults = data.pathResults || [];
    for (const pathBlock of pathResults) {
      for (const row of pathBlock.results || []) {
        if (!row.ok) continue;
        emitNotification({
          eventType: domainEvents.LEARNING_ENROLLED,
          entity: {
            type: 'LearningCohort',
            id: String(cohortId),
            title: 'Cohort enrollment',
            pathId: pathBlock.pathId,
            learnerUserId: String(row.userId),
            dueAt: data.cohort?.endAt || null,
          },
          organizationId: orgId(req),
          triggeredBy: userId(req),
          sourceAppKey: 'LMS',
        }).catch(() => {});
      }
    }
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const code = err.code;
    const status =
      code === 'NOT_FOUND' ? 404
        : ['COHORT_EMPTY', 'PROGRAM_EMPTY', 'PROGRAM_NOT_PUBLISHED', 'COHORT_CLOSED'].includes(code)
          ? 400
          : 500;
    return res.status(status).json({ success: false, message: err.message, code });
  }
}

async function listLiveSessions(req, res) {
  try {
    const role = resolveLearningRole(req.user);
    const data = await learningService.listLiveSessions({
      organizationId: orgId(req),
      userId: userId(req),
      canAuthor: canAuthorLearning(role),
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createLiveSession(req, res) {
  try {
    const { title, description, courseId, startsAt, endsAt, meetingUrl, attendeeUserIds } =
      req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const session = await learningService.createLiveSession({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      description,
      courseId,
      startsAt,
      endsAt,
      meetingUrl,
      attendeeUserIds,
    });
    return res.status(201).json({ success: true, data: session });
  } catch (err) {
    const status =
      err.code === 'STARTS_AT_REQUIRED' || err.code === 'COURSE_NOT_FOUND' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function registerLiveSession(req, res) {
  try {
    const sessionId = req.params.id;
    if (!isMongoObjectIdString(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }
    const session = await learningService.registerForLiveSession({
      organizationId: orgId(req),
      sessionId,
      userId: userId(req),
    });
    return res.json({ success: true, data: session });
  } catch (err) {
    const status =
      err.code === 'NOT_FOUND' ? 404 : err.code === 'SESSION_CANCELLED' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function cancelLiveSession(req, res) {
  try {
    const sessionId = req.params.id;
    if (!isMongoObjectIdString(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }
    const session = await learningService.cancelLiveSession({
      organizationId: orgId(req),
      sessionId,
    });
    return res.json({ success: true, data: session });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function listSkillsCatalog(req, res) {
  try {
    const data = await learningService.listSkillsAndBadges({ organizationId: orgId(req) });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createSkill(req, res) {
  try {
    const { title, description } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const skill = await learningService.createSkill({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      description,
    });
    return res.status(201).json({ success: true, data: skill });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createBadge(req, res) {
  try {
    const { title, description, skillId, courseId } = req.body || {};
    if (!title) return res.status(400).json({ success: false, message: 'title is required' });
    const badge = await learningService.createBadge({
      organizationId: orgId(req),
      userId: userId(req),
      title,
      description,
      skillId,
      courseId,
    });
    return res.status(201).json({ success: true, data: badge });
  } catch (err) {
    const status =
      err.code === 'SKILL_NOT_FOUND' || err.code === 'COURSE_NOT_FOUND' ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function myBadges(req, res) {
  try {
    const data = await learningService.listMyBadges({
      organizationId: orgId(req),
      userId: userId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function awardBadge(req, res) {
  try {
    const badgeId = req.params.id;
    if (!isMongoObjectIdString(badgeId)) {
      return res.status(400).json({ success: false, message: 'Invalid badge id' });
    }
    const targetUserId = req.body?.userId;
    if (!isMongoObjectIdString(targetUserId)) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const row = await learningService.awardBadgeManual({
      organizationId: orgId(req),
      badgeId,
      userId: targetUserId,
      awardedBy: userId(req),
    });
    return res.status(201).json({ success: true, data: row });
  } catch (err) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function notifyOverdue(req, res) {
  try {
    const rows = await learningService.listOverdueForNotify({ organizationId: orgId(req) });
    let sent = 0;
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      await emitNotification({
        eventType: domainEvents.LEARNING_ASSIGNMENT_OVERDUE,
        entity: {
          type: 'LearningEnrollment',
          id: row.enrollmentId,
          title: row.courseTitle || 'Learning assignment overdue',
          courseId: row.courseId,
          learnerUserId: row.userId,
          dueAt: row.dueAt,
        },
        organizationId: orgId(req),
        triggeredBy: userId(req),
        sourceAppKey: 'LMS',
      }).then(() => {
        sent += 1;
      }).catch(() => {});
    }
    return res.json({ success: true, data: { overdue: rows.length, notified: sent } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

const learningAcademyConfigService = require('../services/learning/learningAcademyConfigService');
const learningAcademyAccessService = require('../services/learning/learningAcademyAccessService');
const learningAcademyCatalogService = require('../services/learning/learningAcademyCatalogService');
const { deriveLearnerAudience } = require('../services/learning/learningAudienceService');

async function getAcademyConfig(req, res) {
  try {
    const data = await learningAcademyConfigService.getAcademyConfig(orgId(req));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateAcademyConfig(req, res) {
  try {
    const data = await learningAcademyConfigService.updateAcademyConfig(orgId(req), req.body || {});
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getAcademyBranding(req, res) {
  try {
    const data = await learningAcademyConfigService.getAcademyConfig(orgId(req));
    return res.json({
      success: true,
      data: {
        enabled: data.enabled,
        name: data.name,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        faviconUrl: data.faviconUrl,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function academyCatalog(req, res) {
  try {
    const data = await learningAcademyCatalogService.listAcademyCatalog({
      organizationId: orgId(req),
      user: req.user,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function academyMyLearning(req, res) {
  return myLearning(req, res);
}

async function academyMe(req, res) {
  try {
    const [access, audience, config] = await Promise.all([
      learningAcademyAccessService.getAccessRecord(orgId(req), userId(req)),
      deriveLearnerAudience(req.user),
      learningAcademyConfigService.getAcademyConfig(orgId(req)),
    ]);
    return res.json({
      success: true,
      data: {
        access,
        audience,
        academy: {
          enabled: config.enabled,
          name: config.name,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function inviteAcademyLearner(req, res) {
  try {
    const targetUserId = req.body?.userId;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    const data = await learningAcademyAccessService.inviteAcademyLearner({
      organizationId: orgId(req),
      userId: targetUserId,
      invitedBy: userId(req),
      peopleId: req.body?.peopleId || null,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function acceptAcademyInvite(req, res) {
  try {
    const data = await learningAcademyAccessService.acceptAcademyInvite({
      organizationId: orgId(req),
      userId: userId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function suspendAcademyLearner(req, res) {
  try {
    const data = await learningAcademyAccessService.suspendAcademyAccess({
      organizationId: orgId(req),
      userId: req.params.userId,
      actorUserId: userId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function revokeAcademyLearner(req, res) {
  try {
    const data = await learningAcademyAccessService.revokeAcademyAccess({
      organizationId: orgId(req),
      userId: req.params.userId,
      actorUserId: userId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function restoreAcademyLearner(req, res) {
  try {
    const data = await learningAcademyAccessService.restoreAcademyAccess({
      organizationId: orgId(req),
      userId: req.params.userId,
      actorUserId: userId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message, code: err.code });
  }
}

async function listAcademyLearners(req, res) {
  try {
    const data = await learningAcademyAccessService.listAcademyLearners(orgId(req), {
      status: req.query?.status,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  health,
  getSeatUsage,
  getAnalytics,
  getCompliance,
  listCourses,
  createCourse,
  getCourse,
  addModule,
  addLearningObject,
  launchLearningObject,
  publishCourse,
  enroll,
  unenroll,
  myLearning,
  explore,
  getContextual,
  setCourseContext,
  aiRecommend,
  aiSummarizeCourse,
  completeLesson,
  assignCourse,
  assignPath,
  listPaths,
  getPath,
  createPath,
  publishPath,
  enrollInPath,
  listPrograms,
  getProgram,
  createProgram,
  addProgramPath,
  publishProgram,
  createCohort,
  setCohortMembers,
  launchCohort,
  listLiveSessions,
  createLiveSession,
  registerLiveSession,
  cancelLiveSession,
  listSkillsCatalog,
  createSkill,
  createBadge,
  myBadges,
  awardBadge,
  notifyOverdue,
  listAssessments,
  createAssessment,
  submitAssessment,
  listCertificates,
  issueCertificate,
  uploadMedia,
  searchLearning,
  contentLibrary,
  getAcademyConfig,
  updateAcademyConfig,
  getAcademyBranding,
  academyCatalog,
  academyMyLearning,
  academyMe,
  inviteAcademyLearner,
  acceptAcademyInvite,
  suspendAcademyLearner,
  revokeAcademyLearner,
  restoreAcademyLearner,
  listAcademyLearners,
};
