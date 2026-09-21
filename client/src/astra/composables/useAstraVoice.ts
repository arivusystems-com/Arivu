import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNotifications } from '@/composables/useNotifications';

export type AstraVoiceListenState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'unsupported'
  | 'denied';

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
  readonly length: number;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike> & { readonly length: number };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

export type AstraVoiceEndReason = 'commit' | 'cancel' | 'error' | 'empty';

export interface AstraVoiceSessionHandlers {
  /** Called as interim + final transcript grows (full session text so far). */
  onTranscript?: (text: string) => void;
  /**
   * Fired when the listen session ends.
   * `commit` = user stopped or browser ended with usable text → caller should auto-send.
   * `cancel` / `empty` / `error` → restore prior draft; do not send.
   */
  onEnd?: (payload: { text: string; reason: AstraVoiceEndReason }) => void;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function resolveSpeechLang(locale: string): string {
  const raw = String(locale || 'en').trim().replace('_', '-');
  if (!raw) return 'en-US';
  if (raw.includes('-')) return raw;
  const map: Record<string, string> = {
    en: 'en-US',
    ar: 'ar-SA',
    de: 'de-DE',
    es: 'es-ES',
    fr: 'fr-FR',
    hi: 'hi-IN',
    it: 'it-IT',
    ja: 'ja-JP',
    ko: 'ko-KR',
    nl: 'nl-NL',
    pt: 'pt-BR',
    ru: 'ru-RU',
    zh: 'zh-CN',
  };
  return map[raw.toLowerCase()] || `${raw}-${raw.toUpperCase()}`;
}

/** Novelty / robotic macOS voices that read as “grandpa / cartoon”. */
const TTS_VOICE_BLOCKLIST = [
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'deranged',
  'fred',
  'good news',
  'hysterical',
  'junior',
  'kathy',
  'pipe organ',
  'princess',
  'ralph',
  'trinoids',
  'whisper',
  'zarvox',
];

const TTS_VOICE_PREFER = [
  'google us english',
  'google uk english female',
  'microsoft aria',
  'microsoft jenny',
  'microsoft guy',
  'microsoft sonia',
  'microsoft natasha',
  'samantha',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'veena',
  'raveena',
  'neural',
  'natural',
  'enhanced',
  'premium',
];

function scoreTtsVoice(voice: SpeechSynthesisVoice, lang: string): number {
  const name = String(voice.name || '').toLowerCase();
  const vLang = String(voice.lang || '').toLowerCase();
  const langBase = lang.toLowerCase().split('-')[0] || 'en';
  const langFull = lang.toLowerCase();

  if (TTS_VOICE_BLOCKLIST.some((b) => name.includes(b))) return -1000;

  let score = 0;
  if (vLang === langFull) score += 80;
  else if (vLang.startsWith(langBase)) score += 50;
  else if (vLang.startsWith('en') && langBase === 'en') score += 30;
  else return -500;

  for (const prefer of TTS_VOICE_PREFER) {
    if (name.includes(prefer)) score += 40;
  }
  // Prefer clearer modern system voices over legacy defaults.
  if (voice.localService === false) score += 15;
  if (/\bfemale\b/.test(name) || /\bwoman\b/.test(name)) score += 8;
  // Mild demotion for common elderly-sounding defaults.
  if (name.includes('daniel') || name.includes('alex') || name.includes('bruce')) score -= 12;
  if (name.includes('compact') || name.includes('eloquence')) score -= 25;

  return score;
}

function pickPreferredVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const voice of voices) {
    const score = scoreTtsVoice(voice, lang);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }
  return bestScore >= 0 ? best : null;
}

/** Strip markup / symbols that make browser TTS croak or drone. */
function sanitizeForSpeech(text: string): string {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~>]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ensureVoicesLoaded(): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    // Fallback if voiceschanged never fires.
    window.setTimeout(done, 400);
  });
}

/**
 * Browser STT + optional TTS for Astra composers.
 * World-class UX: tap mic → live transcript → silence/stop auto-commits; Esc cancels.
 */
export function useAstraVoice() {
  const { t, locale } = useI18n();
  const { warning, error: notifyError } = useNotifications();

  const listenState = ref<AstraVoiceListenState>(
    getSpeechRecognitionCtor() ? 'idle' : 'unsupported',
  );
  const interimText = ref('');
  const committedText = ref('');
  const speaking = ref(false);
  const speakingMessageId = ref<string | null>(null);

  const recognitionRef = shallowRef<SpeechRecognitionInstance | null>(null);
  const handlersRef = shallowRef<AstraVoiceSessionHandlers | null>(null);
  const endReasonRef = shallowRef<AstraVoiceEndReason>('commit');
  const intentionalStopRef = shallowRef(false);
  const utteranceRef = shallowRef<SpeechSynthesisUtterance | null>(null);
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const SILENCE_COMMIT_MS = 1600;

  function clearSilenceTimer() {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  }

  function armSilenceCommit() {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (!recognitionRef.value) return;
      if (!sessionText.value.trim()) return;
      abortListening('commit');
    }, SILENCE_COMMIT_MS);
  }

  const isListening = computed(
    () => listenState.value === 'listening' || listenState.value === 'requesting',
  );
  const voiceSupported = computed(() => listenState.value !== 'unsupported');
  const sessionText = computed(() => {
    const base = committedText.value.trim();
    const interim = interimText.value.trim();
    if (base && interim) return `${base} ${interim}`;
    return base || interim;
  });
  const ttsSupported = computed(
    () => typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined',
  );

  function emitTranscript() {
    handlersRef.value?.onTranscript?.(sessionText.value);
  }

  function finishSession(reason: AstraVoiceEndReason) {
    clearSilenceTimer();
    const text = sessionText.value.trim();
    const resolved: AstraVoiceEndReason =
      reason === 'commit' && !text ? 'empty' : reason;
    listenState.value = listenState.value === 'denied' ? 'denied' : 'idle';
    interimText.value = '';
    committedText.value = '';
    recognitionRef.value = null;
    intentionalStopRef.value = false;
    const handlers = handlersRef.value;
    handlersRef.value = null;
    handlers?.onEnd?.({ text, reason: resolved });
  }

  function stopSpeaking() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.value = null;
    speaking.value = false;
    speakingMessageId.value = null;
  }

  async function speakAnswer(messageId: string, text: string) {
    const body = sanitizeForSpeech(text);
    if (!body || !ttsSupported.value) return;
    if (speaking.value && speakingMessageId.value === messageId) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    await ensureVoicesLoaded();

    const lang = resolveSpeechLang(String(locale.value || 'en'));
    const utterance = new SpeechSynthesisUtterance(body);
    utterance.lang = lang;
    // Natural coworker pace — default OS voice often drones low (“grandpa”).
    utterance.rate = 1.05;
    utterance.pitch = 1.08;
    utterance.volume = 1;

    const preferred = pickPreferredVoice(lang);
    if (preferred) {
      utterance.voice = preferred;
      utterance.lang = preferred.lang || lang;
    }

    utterance.onend = () => {
      if (utteranceRef.value === utterance) {
        speaking.value = false;
        speakingMessageId.value = null;
        utteranceRef.value = null;
      }
    };
    utterance.onerror = () => {
      if (utteranceRef.value === utterance) {
        speaking.value = false;
        speakingMessageId.value = null;
        utteranceRef.value = null;
      }
    };
    utteranceRef.value = utterance;
    speaking.value = true;
    speakingMessageId.value = messageId;

    // Chrome: cancel→speak in the same tick often clips / distorts; defer one frame.
    window.setTimeout(() => {
      if (utteranceRef.value !== utterance) return;
      try {
        window.speechSynthesis.resume();
      } catch {
        /* ignore */
      }
      window.speechSynthesis.speak(utterance);
    }, 40);
  }

  function abortListening(reason: AstraVoiceEndReason = 'cancel') {
    const rec = recognitionRef.value;
    if (!rec) {
      if (isListening.value) finishSession(reason);
      return;
    }
    endReasonRef.value = reason;
    intentionalStopRef.value = true;
    try {
      if (reason === 'cancel' || reason === 'error') rec.abort();
      else rec.stop();
    } catch {
      finishSession(reason);
    }
  }

  function cancelListening() {
    abortListening('cancel');
  }

  function commitListening() {
    abortListening('commit');
  }

  async function startListening(handlers: AstraVoiceSessionHandlers = {}) {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      listenState.value = 'unsupported';
      warning(t('astra.micUnsupported'));
      return;
    }
    if (isListening.value) {
      commitListening();
      return;
    }

    stopSpeaking();
    clearSilenceTimer();
    handlersRef.value = handlers;
    endReasonRef.value = 'commit';
    intentionalStopRef.value = false;
    interimText.value = '';
    committedText.value = '';
    listenState.value = 'requesting';

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = resolveSpeechLang(String(locale.value || 'en'));
    recognitionRef.value = recognition;

    recognition.onstart = () => {
      listenState.value = 'listening';
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let newlyFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = String(result?.[0]?.transcript || '').trim();
        if (!piece) continue;
        if (result?.isFinal) newlyFinal = newlyFinal ? `${newlyFinal} ${piece}` : piece;
        else interim = interim ? `${interim} ${piece}` : piece;
      }
      if (newlyFinal) {
        committedText.value = committedText.value
          ? `${committedText.value} ${newlyFinal}`
          : newlyFinal;
      }
      interimText.value = interim;
      emitTranscript();
      if (sessionText.value.trim()) armSilenceCommit();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const code = String(event?.error || '');
      if (code === 'aborted' && intentionalStopRef.value) return;
      if (code === 'no-speech') {
        endReasonRef.value = 'empty';
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        listenState.value = 'denied';
        endReasonRef.value = 'error';
        notifyError(t('astra.micDenied'));
        return;
      }
      if (code === 'network') {
        endReasonRef.value = 'error';
        notifyError(t('astra.micNetworkError'));
        return;
      }
      endReasonRef.value = 'error';
    };

    recognition.onend = () => {
      const reason = endReasonRef.value;
      finishSession(reason);
    };

    try {
      recognition.start();
    } catch {
      listenState.value = 'idle';
      handlersRef.value = null;
      notifyError(t('astra.micStartFailed'));
    }
  }

  /** Toggle: idle → start; listening → commit (auto-send). */
  async function toggleListening(handlers: AstraVoiceSessionHandlers = {}) {
    if (isListening.value) {
      commitListening();
      return;
    }
    await startListening(handlers);
  }

  function onEscapeKey(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (!isListening.value) return;
    event.preventDefault();
    event.stopPropagation();
    cancelListening();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onEscapeKey, true);
  }

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onEscapeKey, true);
    }
    clearSilenceTimer();
    intentionalStopRef.value = true;
    try {
      recognitionRef.value?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.value = null;
    stopSpeaking();
  });

  return {
    listenState,
    isListening,
    voiceSupported,
    ttsSupported,
    interimText,
    sessionText,
    speaking,
    speakingMessageId,
    startListening,
    toggleListening,
    commitListening,
    cancelListening,
    speakAnswer,
    stopSpeaking,
  };
}
