/**
 * PostHog AI product events.
 * Dynamic import only — same pattern as posthogOnboarding.ts.
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

export type AiFeedbackProps = {
  abilityKey: string
  rating: 'up' | 'down'
  provider?: string | null
  model?: string | null
  found?: boolean | null
  sourceType?: string | null
  sourceId?: string | null
}

export function captureAiFeedback(props: AiFeedbackProps) {
  capture('ai_feedback', {
    ability_key: props.abilityKey,
    rating: props.rating,
    provider: props.provider || undefined,
    model: props.model || undefined,
    found: props.found ?? undefined,
    source_type: props.sourceType || undefined,
    source_id: props.sourceId || undefined,
  })

  if (props.abilityKey === 'draft_reply') {
    capture(props.rating === 'up' ? 'ai_draft_accepted' : 'ai_draft_rejected', {
      provider: props.provider || undefined,
      model: props.model || undefined,
      source_id: props.sourceId || undefined,
    })
  }
}

export function captureAiAbilityUsed(props: {
  abilityKey: string
  provider?: string | null
  model?: string | null
  found?: boolean | null
  keyMode?: string | null
  tokens?: number | null
  latencyMs?: number | null
  creditsBalance?: number | null
}) {
  capture('ai_ability_used', {
    ability_key: props.abilityKey,
    provider: props.provider || undefined,
    model: props.model || undefined,
    found: props.found ?? undefined,
    key_mode: props.keyMode || undefined,
    tokens: props.tokens ?? undefined,
    latency_ms: props.latencyMs ?? undefined,
    credits_balance: props.creditsBalance ?? undefined,
  })
}

export function captureAiProviderError(props: {
  abilityKey: string
  provider?: string | null
  model?: string | null
  code?: string | null
  keyMode?: string | null
}) {
  capture('ai_provider_error', {
    ability_key: props.abilityKey,
    provider: props.provider || undefined,
    model: props.model || undefined,
    code: props.code || undefined,
    key_mode: props.keyMode || undefined,
  })
}

export function captureAiDraftAccepted(props: {
  provider?: string | null
  model?: string | null
  sourceId?: string | null
  via?: 'send' | 'feedback'
}) {
  capture('ai_draft_accepted', {
    provider: props.provider || undefined,
    model: props.model || undefined,
    source_id: props.sourceId || undefined,
    via: props.via || 'send',
  })
}

export type AstraSurface =
  | 'copilot'
  | 'command_palette'
  | 'context_sidebar'
  | 'record_panel'
  | 'email_meeting_assist'
  | 'side_panel'
  | 'astra-studio'

export function captureAstraAskInvoked(props: {
  surface: AstraSurface
  moduleKey?: string | null
  recordId?: string | null
  promptLength?: number | null
}) {
  capture('astra_ask_invoked', {
    surface: props.surface,
    module_key: props.moduleKey || undefined,
    record_id: props.recordId || undefined,
    prompt_length: props.promptLength ?? undefined,
  })
}

export function captureAstraActionCompleted(props: {
  surface: AstraSurface
  actionKind?: string | null
  actionId?: string | null
  moduleKey?: string | null
  recordId?: string | null
}) {
  capture('astra_action_completed', {
    surface: props.surface,
    action_kind: props.actionKind || undefined,
    action_id: props.actionId || undefined,
    module_key: props.moduleKey || undefined,
    record_id: props.recordId || undefined,
  })
}

export function captureAstraVoiceStarted(props: {
  surface: AstraSurface
}) {
  capture('astra_voice_started', {
    surface: props.surface,
  })
}

export function captureAstraVoiceCommitted(props: {
  surface: AstraSurface
  promptLength?: number | null
}) {
  capture('astra_voice_committed', {
    surface: props.surface,
    prompt_length: props.promptLength ?? undefined,
  })
}

export function captureAstraVoiceCancelled(props: {
  surface: AstraSurface
  reason?: string | null
}) {
  capture('astra_voice_cancelled', {
    surface: props.surface,
    reason: props.reason || undefined,
  })
}

export function captureAstraTtsPlayed(props: {
  surface: AstraSurface
}) {
  capture('astra_tts_played', {
    surface: props.surface,
  })
}

export function captureAstraActionRejected(props: {
  surface: AstraSurface
  actionKind?: string | null
  actionId?: string | null
  reason?: string | null
}) {
  capture('astra_action_rejected', {
    surface: props.surface,
    action_kind: props.actionKind || undefined,
    action_id: props.actionId || undefined,
    reason: props.reason || undefined,
  })
}

export function captureAstraAutomationCreated(props: {
  surface: AstraSurface
  automationKind?: string | null
  automationId?: string | null
  moduleKey?: string | null
}) {
  capture('astra_automation_created', {
    surface: props.surface,
    automation_kind: props.automationKind || undefined,
    automation_id: props.automationId || undefined,
    module_key: props.moduleKey || undefined,
  })
}
