#!/usr/bin/env node
/**
 * Dogfood: ensure Arivu Academy Learning readiness on a target organization.
 *
 * Usage:
 *   node scripts/seedArivuAcademyLearning.js
 *   node scripts/seedArivuAcademyLearning.js --orgSlug=arivu-systems
 *   node scripts/seedArivuAcademyLearning.js --orgId=...
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getMongoUris } = require('../lib/mongoConnect');
const Organization = require('../models/Organization');
const BillingSubscription = require('../models/commercial/BillingSubscription');
const { runWithTenantContext } = require('../utils/tenantContext');
const databaseConnectionManager = require('../utils/databaseConnectionManager');
const {
  grantOrgLearningCapacityEntitlement,
} = require('../services/commercial/entitlementService');
const {
  LEARNING_PLANS,
  LEARNING_PRIMARY_PLAN_KEY,
  PRODUCT_CODES,
} = require('../constants/commercialBilling');
const learningService = require('../services/learning/learningService');
const { COURSE_STATUSES } = require('../constants/learningConstants');

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function resolveTenantConnection(org) {
  const dbName = org?.database?.name;
  if (dbName) {
    try {
      await databaseConnectionManager.initializeMasterConnection();
      const conn = await databaseConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
      return { conn, dbName, mode: 'dedicated' };
    } catch (err) {
      console.warn('Tenant connection failed, using master:', err.message);
    }
  }
  return { conn: mongoose.connection, dbName: mongoose.connection.db?.databaseName || 'master', mode: 'master' };
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);

  const orgIdArg = arg('orgId');
  const orgSlug = arg('orgSlug');

  let org = null;
  if (orgIdArg) {
    org = await Organization.findById(orgIdArg);
  } else if (orgSlug) {
    org = await Organization.findOne({
      $or: [{ slug: orgSlug }, { slug: String(orgSlug).toLowerCase() }],
    });
  } else {
    org = await Organization.findOne({
      isTenant: true,
      $or: [
        { slug: 'arivu-systems' },
        { slug: 'arivu' },
        { name: /arivu academy/i },
        { name: /^arivu/i },
        { 'enabledApps.appKey': 'LMS' },
      ],
    }).sort({ updatedAt: -1 });

    if (!org) {
      org = await Organization.findOne({ isTenant: true }).sort({ updatedAt: -1 });
    }
  }

  if (!org) {
    const tenants = await Organization.find({ isTenant: true })
      .select('_id name slug')
      .limit(20)
      .lean();
    console.error('Organization not found. Pass --orgId=... or --orgSlug=...');
    if (tenants.length) {
      console.error('Tenant orgs:');
      for (const t of tenants) {
        console.error(`  --orgSlug=${t.slug || '(none)'}  --orgId=${t._id}  (${t.name})`);
      }
    }
    process.exit(1);
  }

  const enabledApps = Array.isArray(org.enabledApps) ? [...org.enabledApps] : [];
  const hasLms = enabledApps.some((e) => {
    const key = typeof e === 'string' ? e : e?.appKey;
    return String(key || '').toUpperCase() === 'LMS';
  });
  if (!hasLms) {
    enabledApps.push({ appKey: 'LMS', status: 'ACTIVE', enabledAt: new Date() });
    org.enabledApps = enabledApps;
    await org.save();
    console.log('Enabled LMS on org', org.name, String(org._id));
  } else {
    console.log('LMS already enabled on', org.name);
  }

  const subscription = await BillingSubscription.findOne({ organizationId: org._id });
  if (subscription) {
    const capacity = LEARNING_PLANS[LEARNING_PRIMARY_PLAN_KEY].capacity;
    await grantOrgLearningCapacityEntitlement({
      organizationId: org._id,
      subscriptionId: subscription._id,
      capacity,
    });
    console.log(`Granted Learning capacity entitlement: ${capacity} learner seats (${PRODUCT_CODES.LEARNING})`);
  } else {
    console.log('No commercial subscription — seat capacity soft-defaults to Growth until subscribed.');
  }

  const User = require('../models/User');
  const users = await User.find({
    organizationId: org._id,
    status: { $in: ['active', 'invited'] },
  })
    .select('_id email appAccess')
    .lean();
  for (const u of users) {
    const access = Array.isArray(u.appAccess) ? [...u.appAccess] : [];
    const idx = access.findIndex(
      (e) => String(e.appKey || '').toUpperCase() === 'LMS'
    );
    if (idx < 0) {
      access.push({
        appKey: 'LMS',
        roleKey: 'LEARNER',
        status: 'ACTIVE',
        grantedAt: new Date(),
      });
      await User.updateOne({ _id: u._id }, { $set: { appAccess: access } });
      console.log('Granted Learning LEARNER access to', u.email);
    } else if (!access[idx].roleKey) {
      access[idx] = {
        ...access[idx],
        roleKey: 'LEARNER',
        status: access[idx].status || 'ACTIVE',
      };
      await User.updateOne({ _id: u._id }, { $set: { appAccess: access } });
      console.log('Backfilled Learning roleKey LEARNER for', u.email);
    }
  }

  const { conn, dbName, mode } = await resolveTenantConnection(org);
  console.log(`Learning data → ${mode} db=${dbName}`);

  await runWithTenantContext(
    { organizationId: org._id, connection: conn, databaseName: dbName },
    async () => {
      async function ensurePublishedCourse({ title, description, modules }) {
        let course = await learningService.LearningCourse.findOne({
          organizationId: org._id,
          title,
        });
        if (!course) {
          course = await learningService.createCourse({
            organizationId: org._id,
            userId: null,
            title,
            description,
          });
        }

        for (const [modIndex, modSpec] of modules.entries()) {
          let mod = await learningService.LearningModule.findOne({
            organizationId: org._id,
            courseId: course._id,
            title: modSpec.title,
          });
          if (!mod) {
            mod = await learningService.addModule({
              organizationId: org._id,
              courseId: course._id,
              title: modSpec.title,
              sortOrder: modIndex,
            });
            console.log('  + module:', modSpec.title);
          }
          for (const [objIndex, obj] of modSpec.objects.entries()) {
            const existing = await learningService.LearningObject.findOne({
              organizationId: org._id,
              courseId: course._id,
              moduleId: mod._id,
              title: obj.title,
            });
            if (existing) continue;
            await learningService.addLearningObject({
              organizationId: org._id,
              courseId: course._id,
              moduleId: mod._id,
              type: obj.type,
              title: obj.title,
              body: obj.body || '',
              mediaUrl: obj.mediaUrl || null,
              sortOrder: objIndex,
            });
            console.log('  + object:', obj.type, obj.title);
          }
        }

        if (course.status !== COURSE_STATUSES.PUBLISHED) {
          course = await learningService.publishCourse({
            organizationId: org._id,
            courseId: course._id,
            userId: null,
          });
          console.log('Published course:', title, String(course._id));
        } else {
          console.log('Course ready:', title, String(course._id));
        }
        return course;
      }

      const course = await ensurePublishedCourse({
        title: 'Arivu Academy — Welcome to Learning',
        description: 'Dogfood starter course for Arivu Academy (TEXT + VIDEO + DOCUMENT).',
        modules: [
          {
            title: 'Getting started',
            objects: [
              {
                type: 'TEXT',
                title: 'Welcome',
                body: 'Welcome to Arivu Learning. Complete this lesson to verify the V1 core loop.',
              },
              {
                type: 'VIDEO',
                title: 'How Learning seats work',
                body: 'Watch this short overview, then continue.',
                mediaUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
              },
              {
                type: 'DOCUMENT',
                title: 'Learning product decision (excerpt)',
                body: 'Open the document link for the locked commercial model summary.',
                mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
              },
            ],
          },
        ],
      });

      const course2 = await ensurePublishedCourse({
        title: 'Arivu Academy — Publish your first course',
        description: 'Second course for sequential path dogfood.',
        modules: [
          {
            title: 'Author basics',
            objects: [
              {
                type: 'TEXT',
                title: 'Build → Publish → Enroll',
                body: 'Authors create modules and learning objects, publish the course, then learners enroll and progress.',
              },
            ],
          },
        ],
      });

      const assessmentTitle = 'Arivu Academy — Learning basics quiz';
      let assessment = await learningService.LearningAssessment.findOne({
        organizationId: org._id,
        title: assessmentTitle,
      });
      if (!assessment) {
        assessment = await learningService.LearningAssessment.create({
          organizationId: org._id,
          courseId: course._id,
          title: assessmentTitle,
          description: 'Dogfood quiz for the V1 assessment loop.',
          passScorePercent: 70,
          maxAttempts: 5,
          questions: [
            {
              prompt: 'Learning is a first-class Arivu App (not an add-on).',
              type: 'true_false',
              points: 1,
              options: [
                { id: 't', label: 'True', correct: true },
                { id: 'f', label: 'False', correct: false },
              ],
            },
            {
              prompt: 'Learning is billed by:',
              type: 'multiple_choice',
              points: 1,
              options: [
                { id: 'a', label: 'Every Arivu user', correct: false },
                { id: 'b', label: 'Learner seats', correct: true },
                { id: 'c', label: 'MAU only', correct: false },
              ],
            },
          ],
          createdBy: null,
        });
        console.log('Created sample assessment:', assessment._id);
      } else {
        if (!assessment.courseId) {
          assessment.courseId = course._id;
          await assessment.save();
        }
        console.log('Sample assessment already present:', assessment._id);
      }

      const pathTitle = 'Arivu Academy — Getting started path';
      let path = await learningService.LearningPath.findOne({
        organizationId: org._id,
        title: pathTitle,
      });
      const pathItems = [
        { courseId: course._id, required: true, sortOrder: 0 },
        { courseId: course2._id, required: true, sortOrder: 1 },
      ];
      if (!path) {
        path = await learningService.LearningPath.create({
          organizationId: org._id,
          title: pathTitle,
          description: 'Sequential dogfood path: Welcome → Publish your first course.',
          sequential: true,
          status: COURSE_STATUSES.PUBLISHED,
          items: pathItems,
          createdBy: null,
        });
        console.log('Created and published sample learning path:', path._id);
      } else {
        path.items = pathItems;
        path.sequential = true;
        path.status = COURSE_STATUSES.PUBLISHED;
        await path.save();
        console.log('Updated sample learning path:', path._id);
      }
    }
  );

  console.log('Arivu Academy Learning dogfood seed complete.');
  console.log('Loop: /learning → Explore → enroll → complete lessons → Assessments → claim certificate → Paths.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) { /* ignore */ }
  process.exit(1);
});
