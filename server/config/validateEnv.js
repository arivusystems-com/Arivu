/**
 * Environment validation for production. Keep failures loud and early.
 *
 * Platform LLM keys/defaults: prefer Control Plane → Platform AI (DB).
 * Env keys remain a fallback. Legacy ASTRA_* v1 flags are ignored by Astra v2.
 */
const { productionClientUrlError } = require('../utils/clientUrl');

function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultProvider = String(
    process.env.AI_DEFAULT_LLM_PROVIDER || 'anthropic'
  ).toLowerCase();
  const vectorStore = String(process.env.AI_VECTOR_STORE || 'atlas').toLowerCase();

  if (!['openai', 'azure_openai', 'anthropic', 'gemini', 'openrouter', 'nvidia', 'bedrock'].includes(defaultProvider)) {
    console.warn(`⚠️  Unknown AI_DEFAULT_LLM_PROVIDER=${defaultProvider}. Prefer Control Plane → Platform AI defaults; env is fallback only.`);
  }

  if (!['atlas', 'mongo', 'memory', 'qdrant'].includes(vectorStore)) {
    console.warn(`⚠️  Unknown AI_VECTOR_STORE=${vectorStore}. Valid values: atlas, mongo, memory, qdrant.`);
  }

  // Astra v2 platform flags (see docs/ASTRA_V2_ARCHITECTURE.md).
  const astraV2 = String(process.env.ASTRA_V2 ?? 'true').toLowerCase();
  const astraV2Shadow = String(process.env.ASTRA_V2_SHADOW ?? 'false').toLowerCase();
  if (['0', 'false', 'no', 'off'].includes(astraV2)) {
    console.warn('⚠️  ASTRA_V2 is disabled. AI traffic falls back to legacy server/services/ai until re-enabled.');
  }
  if (['1', 'true', 'yes', 'on'].includes(astraV2Shadow)) {
    console.warn('⚠️  ASTRA_V2_SHADOW is on. Astra v2 runs for comparison but its answers are NOT surfaced to users.');
  }

  // Legacy flags — safe to remove from .env when on Astra v2.
  const legacyAstraFlags = [
    'ASTRA_PIPELINE_V2',
    'ASTRA_AUTOPILOT_V1',
    'ASTRA_SUPER_AGENTS_V1',
    'ENABLE_ASTRA_SUPER_AGENT_SCHEDULER',
    'ASTRA_COACH_V1',
    'ASTRA_COACH_LLM',
  ];
  const presentLegacy = legacyAstraFlags.filter((key) => process.env[key] !== undefined && process.env[key] !== '');
  if (presentLegacy.length) {
    console.warn(
      `⚠️  Legacy Astra env vars present (${presentLegacy.join(', ')}). Astra v2 uses ASTRA_V2 / ASTRA_V2_SHADOW; these can be removed.`
    );
  }

  if (vectorStore === 'atlas' && process.env.AI_ATLAS_VECTOR_INDEX === '') {
    console.warn('⚠️  AI_ATLAS_VECTOR_INDEX is empty. Atlas vector search will use the default index name.');
  }

  if (isProd) {
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 24) {
      console.error('❌ FATAL: production requires JWT_SECRET (use a long random string, e.g. openssl rand -base64 48).');
      process.exit(1);
    }
    const clientUrlError = productionClientUrlError();
    if (clientUrlError) {
      console.error(`❌ FATAL: ${clientUrlError}.`);
      process.exit(1);
    }
    if (process.env.DISABLE_SECURITY === 'true') {
      console.error('❌ FATAL: DISABLE_SECURITY cannot be true in production.');
      process.exit(1);
    }
    if (process.env.RBAC_V2 === 'true' || process.env.SHARING_V1 === 'true') {
      console.warn(
        '⚠️  RBAC_V2 and/or SHARING_V1 are enabled globally. Prefer per-org flags until migration is complete.'
      );
    }
    if (process.env.PORTAL_FRAMEWORK_V1 === 'true') {
      console.warn(
        '⚠️  PORTAL_FRAMEWORK_V1 is enabled globally. Prefer per-org portalFrameworkV1Enabled until cutover.'
      );
    }
    if (defaultProvider === 'openai' && !process.env.OPENAI_API_KEY && !process.env.AI_OPENAI_API_KEY) {
      console.warn('⚠️  OpenAI is the env default AI provider but OPENAI_API_KEY is not set. Configure Control Plane → Platform AI or set the env key.');
    }
    if (defaultProvider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  Anthropic is the env default AI provider but ANTHROPIC_API_KEY is not set. Configure Control Plane → Platform AI or set the env key.');
    }
    if (defaultProvider === 'openrouter' && !process.env.OPENROUTER_API_KEY && !process.env.AI_OPENROUTER_API_KEY) {
      console.warn('⚠️  OpenRouter is the env default AI provider but OPENROUTER_API_KEY is not set. Configure Control Plane → Platform AI or set the env key.');
    }
    if (defaultProvider === 'nvidia' && !process.env.NVIDIA_API_KEY && !process.env.AI_NVIDIA_API_KEY) {
      console.warn('⚠️  NVIDIA is the env default AI provider but NVIDIA_API_KEY is not set. Configure Control Plane → Platform AI or set the env key.');
    }
    if (vectorStore === 'atlas' && !process.env.AI_ATLAS_VECTOR_INDEX) {
      console.warn('⚠️  AI_VECTOR_STORE=atlas uses Atlas Vector Search index ai_vector_chunks_embedding by default. Set AI_ATLAS_VECTOR_INDEX if your index uses another name.');
    }
  }
}

module.exports = { validateEnv };
