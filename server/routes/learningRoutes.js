'use strict';

const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const {
  requireLearningAuthor,
  requireLearningAdmin,
} = require('../middleware/requireLearningRole');
const {
  blockExternalLearningPrivileges,
  requireAcademyLearner,
} = require('../middleware/blockExternalLearningPrivileges');
const { uploadLearningSingle } = require('../middleware/uploadMiddleware');
const learningController = require('../controllers/learningController');

const router = express.Router();

router.use(protect);
router.use(resolveAppContext);

// Academy invite accept + branding: allowed before LMS entitlement (invite may have LMS DISABLED)
router.get('/academy/branding', learningController.getAcademyBranding);
router.post('/academy/accept', learningController.acceptAcademyInvite);

router.use(requireAppEntitlement);
router.use(blockExternalLearningPrivileges);

router.get('/health', learningController.health);
router.get('/search', learningController.searchLearning);
router.post(
  '/upload',
  requireLearningAuthor,
  uploadLearningSingle('file'),
  learningController.uploadMedia
);
router.get('/seats', requireLearningAdmin, learningController.getSeatUsage);
router.get('/analytics', requireLearningAdmin, learningController.getAnalytics);
router.get('/compliance', requireLearningAuthor, learningController.getCompliance);
router.get('/my-learning', learningController.myLearning);
router.get('/explore', learningController.explore);
router.get('/contextual', learningController.getContextual);
router.get('/ai/recommend', learningController.aiRecommend);
router.get('/courses/:id/ai-summary', learningController.aiSummarizeCourse);
router.get('/content-library', requireLearningAuthor, learningController.contentLibrary);

// Academy admin (Learning App)
router.get('/academy/config', requireLearningAdmin, learningController.getAcademyConfig);
router.put('/academy/config', requireLearningAdmin, learningController.updateAcademyConfig);
router.get('/academy/learners', requireLearningAdmin, learningController.listAcademyLearners);
router.post('/academy/learners/invite', requireLearningAdmin, learningController.inviteAcademyLearner);
router.post('/academy/learners/:userId/suspend', requireLearningAdmin, learningController.suspendAcademyLearner);
router.post('/academy/learners/:userId/revoke', requireLearningAdmin, learningController.revokeAcademyLearner);
router.post('/academy/learners/:userId/restore', requireLearningAdmin, learningController.restoreAcademyLearner);

// Academy learner surface (EXTERNAL)
router.get('/academy/me', requireAcademyLearner, learningController.academyMe);
router.get('/academy/catalog', requireAcademyLearner, learningController.academyCatalog);
router.get('/academy/my-learning', requireAcademyLearner, learningController.academyMyLearning);

router.get('/courses', requireLearningAuthor, learningController.listCourses);
router.post('/courses', requireLearningAuthor, learningController.createCourse);
router.get('/courses/:id', learningController.getCourse);
router.post('/courses/:id/modules', requireLearningAuthor, learningController.addModule);
router.post('/courses/:id/modules/:moduleId/objects', requireLearningAuthor, learningController.addLearningObject);
router.post('/courses/:id/objects/:objectId/launch', learningController.launchLearningObject);
router.post('/courses/:id/publish', requireLearningAuthor, learningController.publishCourse);
router.patch('/courses/:id/context', requireLearningAuthor, learningController.setCourseContext);
router.post('/courses/:id/enroll', learningController.enroll);
router.post('/courses/:id/assign', requireLearningAuthor, learningController.assignCourse);
router.post('/courses/:id/unenroll', learningController.unenroll);
router.post('/courses/:id/complete-lesson', learningController.completeLesson);

router.get('/paths', learningController.listPaths);
router.post('/paths', requireLearningAuthor, learningController.createPath);
router.get('/paths/:id', learningController.getPath);
router.post('/paths/:id/publish', requireLearningAuthor, learningController.publishPath);
router.post('/paths/:id/enroll', learningController.enrollInPath);
router.post('/paths/:id/assign', requireLearningAuthor, learningController.assignPath);

router.get('/programs', learningController.listPrograms);
router.post('/programs', requireLearningAuthor, learningController.createProgram);
router.get('/programs/:id', learningController.getProgram);
router.post('/programs/:id/paths', requireLearningAuthor, learningController.addProgramPath);
router.post('/programs/:id/publish', requireLearningAuthor, learningController.publishProgram);
router.post('/programs/:id/cohorts', requireLearningAuthor, learningController.createCohort);
router.put('/cohorts/:cohortId/members', requireLearningAuthor, learningController.setCohortMembers);
router.post('/cohorts/:cohortId/launch', requireLearningAuthor, learningController.launchCohort);

router.get('/live-sessions', learningController.listLiveSessions);
router.post('/live-sessions', requireLearningAuthor, learningController.createLiveSession);
router.post('/live-sessions/:id/register', learningController.registerLiveSession);
router.post('/live-sessions/:id/cancel', requireLearningAuthor, learningController.cancelLiveSession);

router.get('/skills', learningController.listSkillsCatalog);
router.post('/skills', requireLearningAuthor, learningController.createSkill);
router.post('/badges', requireLearningAuthor, learningController.createBadge);
router.get('/my-badges', learningController.myBadges);
router.post('/badges/:id/award', requireLearningAuthor, learningController.awardBadge);
router.post('/jobs/notify-overdue', requireLearningAdmin, learningController.notifyOverdue);

router.get('/assessments', learningController.listAssessments);
router.post('/assessments', requireLearningAuthor, learningController.createAssessment);
router.post('/assessments/:id/submit', learningController.submitAssessment);

router.get('/certificates', learningController.listCertificates);
router.post('/certificates', learningController.issueCertificate);

module.exports = router;
