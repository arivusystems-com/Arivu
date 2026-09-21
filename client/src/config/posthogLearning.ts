/**
 * PostHog events for Learning app (LMS) — activation / core loop.
 */
type PostHog = typeof import('posthog-js').default

let posthogModulePromise: Promise<PostHog> | null = null

function loadPosthog(): Promise<PostHog> | null {
  if (!import.meta.env.VITE_POSTHOG_KEY) return null
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js').then((m) => m.default)
  }
  return posthogModulePromise
}

function capture(event: string, properties: Record<string, unknown> = {}) {
  const loader = loadPosthog()
  if (!loader) return
  void loader.then((posthog) => {
    try {
      posthog.capture(event, properties)
    } catch {
      /* optional */
    }
  })
}

function oncePerSession(key: string): boolean {
  try {
    const storageKey = `ph-learning:${key}`
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}

export function captureLearningAppOpened(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('app-opened')) return
  capture('learning_app_opened', extra)
}

export function captureLearningHomeViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('home-viewed')) return
  capture('learning_home_viewed', extra)
}

export function captureLearningModuleVisited(
  moduleKey: string,
  extra: Record<string, unknown> = {}
) {
  const sessionKey = `module-${moduleKey}`
  if (!oncePerSession(sessionKey)) return
  capture('learning_module_visited', { module_key: moduleKey, ...extra })
}

export function captureLearningCoursePublished(extra: Record<string, unknown> = {}) {
  capture('learning_course_published', extra)
}

export function captureLearningEnrolled(extra: Record<string, unknown> = {}) {
  capture('learning_enrolled', extra)
}

export function captureLearningLessonCompleted(extra: Record<string, unknown> = {}) {
  capture('learning_lesson_completed', extra)
}

export function captureLearningCertificateClaimed(extra: Record<string, unknown> = {}) {
  capture('learning_certificate_claimed', extra)
}

export function captureLearningAssessmentSubmitted(extra: Record<string, unknown> = {}) {
  capture('learning_assessment_submitted', extra)
}
