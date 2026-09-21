'use strict';

/**
 * astraV2Controller — HTTP surface for the Astra v2 platform.
 * Tenant + auth are enforced by upstream middleware; this layer only adapts
 * req/res to the orchestrator and autonomous service.
 */

const astra = require('../services/astra');
const { runOrchestrator } = require('../services/astra/orchestrator/runOrchestrator');
const autonomousService = require('../services/astra/autonomous/autonomousService');
const personalMemoryService = require('../services/astra/memory/personalMemoryService');
const orgMemoryService = require('../services/astra/memory/orgMemoryService');
const conversationStore = require('../services/astra/memory/conversationStore');
const sessionMemory = require('../services/astra/memory/sessionMemory');
const { normalizeFocus } = require('../services/astra/context/normalizeFocus');
const { openStream, sendDelta, closeStream, failStream } = require('../services/astra/experience/sse');
const tenantCatalog = require('../services/astra/agents/tenantCatalogService');
const { writeSettingsAuditFromRequest } = require('../services/settingsAuditService');

async function auditAiCatalog(req, overrides) {
  try {
    await writeSettingsAuditFromRequest(req, {
      surface: 'ai',
      ...overrides,
    });
  } catch {
    /* soft-fail */
  }
}

function orgId(req) {
  return req.user?.organizationId || req.organizationId || null;
}

function userId(req) {
  return req.user?._id || req.user?.id || null;
}

function handleError(res, error) {
  const status = error?.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error?.message || 'Astra request failed',
    code: error?.code || 'ASTRA_V2_ERROR',
  });
}

async function getStatus(req, res) {
  try {
    const summary = astra.bootstrapAstra();
    return res.json({
      success: true,
      enabled: astra.flags.isAstraV2Enabled(),
      shadow: astra.flags.isAstraV2Shadow(),
      tools: summary.tools,
      agents: summary.agents,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function ask(req, res) {
  try {
    const organizationId = orgId(req);
    const uid = userId(req);
    const focus = normalizeFocus(req.body?.focus, {
      moduleKey: req.body?.moduleKey,
      recordId: req.body?.recordId,
      name: req.body?.recordName || req.body?.focus?.name || null,
    });
    const moduleKey = req.body?.moduleKey || focus?.moduleKey || null;
    const query = req.body?.query || req.body?.prompt || '';

    const thread = await conversationStore.ensureConversation({
      organizationId,
      userId: uid,
      conversationId: req.body?.conversationId || null,
      titleHint: query,
      moduleKey: moduleKey || '',
      recordId: focus?.recordId || req.body?.recordId || '',
    });
    const conversationId = String(thread._id);

    // Always prefer the request's page focus for this turn (side panel / record page).
    if (organizationId && conversationId && focus?.kind) {
      sessionMemory.setFocus(organizationId, conversationId, focus);
    }

    const clientHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = clientHistory.length
      ? clientHistory
      : conversationStore.toLlmHistory(thread);

    const agentRegistry = await tenantCatalog.resolveAgentRegistryForOrg(organizationId);
    const result = await runOrchestrator(
      {
        organizationId,
        userId: uid,
        query,
        surface: req.body?.surface || 'chat',
        agent: req.body?.agent || undefined,
        entity: req.body?.entity || moduleKey || undefined,
        limit: req.body?.limit,
        history,
        conversationId,
        focus,
        canvasId: req.body?.canvasId || undefined,
        targetWidgetId: req.body?.targetWidgetId || req.body?.flags?.targetWidgetId || undefined,
        flags: req.body?.flags || undefined,
        steps: req.body?.steps,
        workflow: req.body?.workflow,
      },
      {
        agentRegistry,
        vectorStore: (() => {
          try {
            return require('../services/ai/vector/vectorStoreRegistry').getVectorStore();
          } catch {
            return null;
          }
        })(),
      },
    );

    const summary = await conversationStore.appendTurn({
      organizationId,
      userId: uid,
      conversationId,
      userMessage: query,
      assistantMessage: {
        body: result.answer,
        structured: {
          blocks: result.blocks || [],
          suggestions: result.suggestions || [],
          proposals: result.proposals || result.actions || [],
          intent: result.intent || null,
        },
      },
    });

    return res.json({
      success: true,
      ...result,
      conversationId,
      conversationTitle: summary?.title || thread.title,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function askStream(req, res) {
  try {
    openStream(res);
    const organizationId = orgId(req);
    const agentRegistry = await tenantCatalog.resolveAgentRegistryForOrg(organizationId);
    const result = await runOrchestrator(
      {
        organizationId,
        userId: userId(req),
        query: req.query?.query || req.body?.query || '',
        surface: req.query?.surface || 'chat',
        agent: req.query?.agent || req.body?.agent || undefined,
        history: [],
      },
      {
        agentRegistry,
        vectorStore: (() => {
          try {
            return require('../services/ai/vector/vectorStoreRegistry').getVectorStore();
          } catch {
            return null;
          }
        })(),
      },
    );
    // Non-token streaming: emit the final grounded answer as one delta + done.
    sendDelta(res, result.answer);
    return closeStream(res, {
      intent: result.intent,
      claims: result.claims,
      toolResult: result.toolResult,
    });
  } catch (error) {
    return failStream(res, error);
  }
}

async function listTools(req, res) {
  try {
    const organizationId = orgId(req);
    if (!organizationId) {
      astra.ensureBootstrapped();
      return res.json({ success: true, tools: astra.toolRegistry.listTools() });
    }
    const tools = await tenantCatalog.listToolsForOrg(organizationId);
    return res.json({ success: true, tools });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listAgents(req, res) {
  try {
    const organizationId = orgId(req);
    if (!organizationId) {
      astra.ensureBootstrapped();
      const tools = astra.toolRegistry.listTools();
      const toolsByName = new Map(tools.map((t) => [t.name, t]));
      const agents = astra.agentRegistry.listAgents().map((agent) => ({
        name: agent.name,
        title: agent.title,
        description: agent.description,
        autonomy: agent.autonomy,
        systemHint: agent.systemHint,
        tools: Array.isArray(agent.tools) ? agent.tools : [],
        toolDetails: (Array.isArray(agent.tools) ? agent.tools : []).map((toolName) => {
          const tool = toolsByName.get(toolName);
          return tool || {
            name: toolName,
            family: 'unknown',
            risk: 'read',
            description: '',
            missing: true,
          };
        }),
        enabled: true,
        isCustomized: false,
        canRevert: true,
        defaultKey: agent.name,
      }));
      return res.json({
        success: true,
        agents,
        tools,
        meta: { agentCount: agents.length, toolCount: tools.length, tenantOwned: false },
      });
    }

    const [agents, tools] = await Promise.all([
      tenantCatalog.listAgentsForOrg(organizationId),
      tenantCatalog.listToolsForOrg(organizationId),
    ]);
    return res.json({
      success: true,
      agents,
      tools,
      meta: {
        agentCount: agents.length,
        toolCount: tools.length,
        tenantOwned: true,
        customizedAgents: agents.filter((a) => a.isCustomized).length,
        customizedTools: tools.filter((t) => t.isCustomized).length,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const key = req.params.key;
    const agent = await tenantCatalog.getAgentForOrg(organizationId, key);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `Agent not found: ${key}`,
        code: 'ASTRA_AGENT_NOT_FOUND',
      });
    }
    return res.json({ success: true, agent });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const agent = await tenantCatalog.createAgentForOrg(organizationId, req.body || {}, userId(req));
    await auditAiCatalog(req, {
      action: 'create',
      entityType: 'astra_agent',
      summary: `Created agent ${agent.key}`,
      after: { key: agent.key, title: agent.title, tools: agent.tools },
    });
    return res.status(201).json({ success: true, agent });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const { before, agent } = await tenantCatalog.updateAgentForOrg(
      organizationId,
      req.params.key,
      req.body || {},
      userId(req),
    );
    await auditAiCatalog(req, {
      action: 'update',
      entityType: 'astra_agent',
      summary: `Updated agent ${agent.key}`,
      before: {
        title: before.title,
        description: before.description,
        systemHint: before.systemHint,
        autonomy: before.autonomy,
        tools: before.toolAllowlist,
        enabled: before.enabled,
      },
      after: {
        title: agent.title,
        description: agent.description,
        systemHint: agent.systemHint,
        autonomy: agent.autonomy,
        tools: agent.tools,
        enabled: agent.enabled,
      },
    });
    return res.json({ success: true, agent });
  } catch (error) {
    return handleError(res, error);
  }
}

async function revertAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const { before, agent } = await tenantCatalog.revertAgentForOrg(
      organizationId,
      req.params.key,
      userId(req),
    );
    await auditAiCatalog(req, {
      action: 'update',
      entityType: 'astra_agent',
      summary: `Reverted agent ${agent.key} to default`,
      before: { title: before.title, tools: before.toolAllowlist, isCustomized: before.isCustomized },
      after: { title: agent.title, tools: agent.tools, isCustomized: agent.isCustomized },
    });
    return res.json({ success: true, agent });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const before = await tenantCatalog.deleteAgentForOrg(organizationId, req.params.key);
    await auditAiCatalog(req, {
      action: 'delete',
      entityType: 'astra_agent',
      summary: `Deleted agent ${before.key}`,
      before: { key: before.key, title: before.title },
    });
    return res.json({ success: true, deleted: true, key: before.key });
  } catch (error) {
    return handleError(res, error);
  }
}

async function tryAgent(req, res) {
  try {
    const organizationId = orgId(req);
    const uid = userId(req);
    const key = String(req.params.key || '').trim();
    const query = String(req.body?.query || req.body?.prompt || '').trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'query is required',
        code: 'ASTRA_TRY_QUERY_REQUIRED',
      });
    }
    const agent = await tenantCatalog.getAgentForOrg(organizationId, key);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `Agent not found: ${key}`,
        code: 'ASTRA_AGENT_NOT_FOUND',
      });
    }
    const agentRegistry = await tenantCatalog.resolveAgentRegistryForOrg(organizationId);
    const result = await runOrchestrator(
      {
        organizationId,
        userId: uid,
        query,
        surface: req.body?.surface || 'settings',
        agent: key,
        history: [],
      },
      { agentRegistry },
    );
    return res.json({
      success: true,
      agentKey: key,
      answer: result.answer,
      intent: result.intent,
      meta: result.meta || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateTool(req, res) {
  try {
    const organizationId = orgId(req);
    const { before, tool } = await tenantCatalog.updateToolForOrg(
      organizationId,
      req.params.name,
      req.body || {},
      userId(req),
    );
    await auditAiCatalog(req, {
      action: 'update',
      entityType: 'astra_tool',
      summary: `Updated tool ${tool.name}`,
      before: {
        title: before.title,
        description: before.description,
        enabled: before.enabled,
      },
      after: {
        title: tool.title,
        description: tool.description,
        enabled: tool.enabled,
      },
    });
    return res.json({ success: true, tool });
  } catch (error) {
    return handleError(res, error);
  }
}

async function revertTool(req, res) {
  try {
    const organizationId = orgId(req);
    const { before, tool } = await tenantCatalog.revertToolForOrg(
      organizationId,
      req.params.name,
      userId(req),
    );
    await auditAiCatalog(req, {
      action: 'update',
      entityType: 'astra_tool',
      summary: `Reverted tool ${tool.name} to default`,
      before: { title: before.title, description: before.description, enabled: before.enabled },
      after: { title: tool.title, description: tool.description, enabled: tool.enabled },
    });
    return res.json({ success: true, tool });
  } catch (error) {
    return handleError(res, error);
  }
}

async function confirmAction(req, res) {
  try {
    astra.ensureBootstrapped();
    const toolName = String(req.body?.toolName || req.body?.kind || '').trim();
    if (!toolName) {
      return res.status(400).json({ success: false, message: 'toolName is required', code: 'ASTRA_CONFIRM_TOOL_REQUIRED' });
    }
    const organizationId = orgId(req);
    if (organizationId && !(await tenantCatalog.isToolEnabledForOrg(organizationId, toolName))) {
      return res.status(403).json({
        success: false,
        message: `Tool disabled for this organization: ${toolName}`,
        code: 'ASTRA_TOOL_DISABLED',
      });
    }
    const tool = astra.toolRegistry.getTool(toolName);
    if (!tool) {
      return res.status(404).json({ success: false, message: `Unknown tool: ${toolName}`, code: 'ASTRA_TOOL_NOT_FOUND' });
    }

    const payload =
      (req.body?.payload && typeof req.body.payload === 'object' && req.body.payload)
      || (req.body?.fields && typeof req.body.fields === 'object' && req.body.fields)
      || {};
    const conversationId = String(req.body?.conversationId || '').trim();
    const proposalId = String(req.body?.proposalId || '').trim();
    const uid = userId(req);

    const result = await tool.run(
      { ...payload, confirmed: true },
      {
        organizationId,
        userId: uid,
        surface: req.body?.surface || 'chat',
        toolRegistry: astra.toolRegistry,
        deps: {},
      },
    );

    if (result?.created === false || result?.error || result?.ok === false || result?.sent === false) {
      return res.status(400).json({
        success: false,
        message: result?.guidance || 'Action failed',
        code: result?.error || 'ASTRA_CONFIRM_FAILED',
        result,
      });
    }

    try {
      const { applyLearnedProfileUpdate } = require('../services/astra/agents/learnedProfileService');
      const agentKey = String(req.body?.agent || 'coworker').trim() || 'coworker';
      await applyLearnedProfileUpdate({
        organizationId,
        agentKey,
        signal: 'accept',
        phrase: String(req.body?.summary || toolName).slice(0, 120),
        toolChain: [toolName],
      });
    } catch {
      /* soft */
    }

    const { recordPathFor } = require('../services/astra/tools/moduleCatalog');
    const moduleKey = String(
      req.body?.moduleKey
      || payload?.moduleKey
      || result?.moduleKey
      || (toolName === 'calendar.createEvent' ? 'events'
        : toolName === 'crm.tasks.create' ? 'tasks'
          : toolName === 'crm.deals.create' ? 'deals'
            : toolName === 'crm.cases.create' ? 'cases'
              : toolName === 'crm.people.create' ? 'people'
                : toolName === 'crm.organizations.create' ? 'organizations'
                  : toolName === 'module.update' || toolName === 'module.create'
                    ? (payload?.moduleKey || '')
                    : '')
      || '',
    ).trim() || undefined;
    const recordId = String(
      result?.id || result?.recordId || result?._id || '',
    ).trim() || undefined;
    const href = recordId && moduleKey ? recordPathFor(moduleKey, recordId) : null;
    const navigateLabel = moduleKey === 'events'
      ? 'View event'
      : moduleKey === 'tasks'
        ? 'View task'
        : moduleKey === 'deals'
          ? 'View deal'
          : moduleKey === 'cases'
            ? 'View case'
            : moduleKey === 'people'
              ? 'View contact'
              : moduleKey === 'organizations'
                ? 'View organization'
                : (href ? 'Open record' : null);
    const message = result?.guidance || result?.summary || 'Action confirmed';

    if (
      conversationId
      && organizationId
      && result?.created === true
      && toolName === 'calendar.createEvent'
    ) {
      const sessionMemory = require('../services/astra/memory/sessionMemory');
      sessionMemory.setFocus(organizationId, conversationId, {
        kind: 'events',
        moduleKey: 'events',
        id: recordId || undefined,
        name: result.title || payload.title || undefined,
        startDateTime: payload.startDateTime || undefined,
        endDateTime: payload.endDateTime || undefined,
      });
    }

    if (conversationId && organizationId && uid && proposalId) {
      await conversationStore.resolveProposal({
        organizationId,
        userId: uid,
        conversationId,
        proposalId,
        status: 'completed',
        recordId: recordId || null,
        href: href || null,
        navigateLabel: navigateLabel || null,
        rationale: message,
        assistantBody: message,
      });
    } else if (conversationId && organizationId && uid) {
      await conversationStore.appendTurn({
        organizationId,
        userId: uid,
        conversationId,
        userMessage: '',
        assistantMessage: {
          body: message,
          structured: {
            blocks: [],
            suggestions: [],
            proposals: [],
            navigate: href
              ? { href, label: navigateLabel, recordId }
              : null,
          },
        },
      });
    }

    return res.json({
      success: true,
      message,
      result,
      recordId: recordId || null,
      moduleKey: moduleKey || null,
      href: href || null,
      navigateLabel: navigateLabel || null,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getNextBestActions(req, res) {
  try {
    const nba = await autonomousService.nextBestActions({
      organizationId: orgId(req),
      userId: userId(req),
      surface: req.query?.surface || 'home',
      moduleKey: req.query?.moduleKey || null,
      recordId: req.query?.recordId || null,
      recordName: req.query?.recordName || null,
    });
    return res.json({ success: true, ...nba });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listGoals(req, res) {
  try {
    const goals = await autonomousService.listGoals({
      organizationId: orgId(req),
      userId: userId(req),
      status: req.query?.status || 'active',
    });
    return res.json({ success: true, goals });
  } catch (error) {
    return handleError(res, error);
  }
}

async function createGoal(req, res) {
  try {
    const goal = await autonomousService.createGoal({
      organizationId: orgId(req),
      userId: userId(req),
      title: req.body?.title,
      description: req.body?.description,
      surface: req.body?.surface,
      target: req.body?.target,
      dueAt: req.body?.dueAt,
    });
    return res.status(201).json({ success: true, goal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updateGoal(req, res) {
  try {
    const goal = await autonomousService.updateGoal({
      organizationId: orgId(req),
      goalId: req.params.goalId,
      patch: req.body || {},
    });
    if (!goal) return res.status(404).json({ success: false, message: 'Goal not found' });
    return res.json({ success: true, goal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getMemory(req, res) {
  try {
    const personal = await personalMemoryService.getPersonalMemory({
      organizationId: orgId(req),
      userId: userId(req),
    });
    const org = await orgMemoryService.listOrgMemory({
      organizationId: orgId(req),
      scope: req.query?.scope || 'grounding',
    });
    return res.json({ success: true, personal, org });
  } catch (error) {
    return handleError(res, error);
  }
}

async function putMemory(req, res) {
  try {
    const personal = await personalMemoryService.updatePersonalMemory({
      organizationId: orgId(req),
      userId: userId(req),
      patch: req.body || {},
    });
    return res.json({ success: true, personal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function listConversations(req, res) {
  try {
    const result = await conversationStore.listConversations({
      organizationId: orgId(req),
      userId: userId(req),
      limit: req.query?.limit,
      cursor: req.query?.cursor,
    });
    return res.json({
      success: true,
      conversations: result.conversations,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getConversation(req, res) {
  try {
    const conversation = await conversationStore.getConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteConversation(req, res) {
  try {
    const ok = await conversationStore.deleteConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
    });
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteAllConversations(req, res) {
  try {
    const scope = String(req.query?.scope || req.body?.scope || 'all').toLowerCase();
    let before = null;
    if (req.query?.before || req.body?.before) {
      before = new Date(req.query?.before || req.body?.before);
    } else if (scope === 'older' || scope === 'before_today') {
      const now = new Date();
      before = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const deleted = await conversationStore.deleteAllConversations({
      organizationId: orgId(req),
      userId: userId(req),
      before,
    });
    return res.json({ success: true, deleted });
  } catch (error) {
    return handleError(res, error);
  }
}

async function renameConversation(req, res) {
  try {
    const conversation = await conversationStore.renameConversation({
      organizationId: orgId(req),
      userId: userId(req),
      conversationId: req.params.conversationId,
      title: req.body?.title,
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found', code: 'ASTRA_CONVERSATION_NOT_FOUND' });
    }
    return res.json({ success: true, conversation });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getCapIndex(req, res) {
  try {
    const { buildCapIndex } = require('../services/astra/tools/capIndex');
    const { loadOrgKnowledgeSources } = require('../services/astra/retrieval/groundedRetriever');
    const organizationId = orgId(req);
    const knowledgeSources = await loadOrgKnowledgeSources(organizationId);
    const capIndex = await buildCapIndex(organizationId, { knowledgeSources });
    return res.json({ success: true, capIndex });
  } catch (error) {
    return handleError(res, error);
  }
}

async function masterPropose(req, res) {
  try {
    const master = require('../services/astra/agents/masterAgentService');
    const { loadOrgKnowledgeSources } = require('../services/astra/retrieval/groundedRetriever');
    const organizationId = orgId(req);
    const knowledgeSources = await loadOrgKnowledgeSources(organizationId);
    const proposal = await master.proposeAgent({
      organizationId,
      instruction: req.body?.instruction || req.body?.prompt || '',
      knowledgeSources,
    });
    await auditAiCatalog(req, {
      action: 'ai.master.propose',
      resourceType: 'astra_agent',
      after: { action: proposal.action, key: proposal.candidateKey || proposal.existingKey },
    });
    return res.json({ success: true, proposal });
  } catch (error) {
    return handleError(res, error);
  }
}

async function masterCreate(req, res) {
  try {
    const master = require('../services/astra/agents/masterAgentService');
    const organizationId = orgId(req);
    const uid = userId(req);
    let proposal = req.body?.proposal || null;
    if (!proposal && (req.body?.instruction || req.body?.prompt)) {
      proposal = await master.proposeAgent({
        organizationId,
        instruction: req.body.instruction || req.body.prompt,
      });
    }
    const result = await master.createAgentFromProposal({
      organizationId,
      userId: uid,
      proposal,
      key: req.body?.key || null,
    });
    await auditAiCatalog(req, {
      action: 'ai.master.create',
      resourceType: 'astra_agent',
      resourceId: result.key,
      after: result,
    });
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getKnowledgeSources(req, res) {
  try {
    const svc = require('../services/astra/knowledge/knowledgeSourcesService');
    const data = await svc.getKnowledgeSources(orgId(req));
    return res.json({ success: true, ...data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function putKnowledgeSources(req, res) {
  try {
    const svc = require('../services/astra/knowledge/knowledgeSourcesService');
    const data = await svc.updateKnowledgeSources(orgId(req), req.body || {}, userId(req));
    await auditAiCatalog(req, {
      action: 'ai.knowledge_sources.update',
      resourceType: 'astra_knowledge_sources',
      after: data.sources,
    });
    return res.json({ success: true, ...data });
  } catch (error) {
    return handleError(res, error);
  }
}

async function addKnowledgeWebsitePage(req, res) {
  try {
    const svc = require('../services/astra/knowledge/knowledgeSourcesService');
    const page = await svc.addWebsitePage(orgId(req), req.body || {}, userId(req));
    await auditAiCatalog(req, {
      action: 'ai.knowledge_sources.website_add',
      resourceType: 'website_page',
      resourceId: page?.id,
      after: page,
    });
    return res.status(201).json({ success: true, page });
  } catch (error) {
    return handleError(res, error);
  }
}

async function deleteKnowledgeWebsitePage(req, res) {
  try {
    const svc = require('../services/astra/knowledge/knowledgeSourcesService');
    await svc.deleteWebsitePage(orgId(req), req.params.pageId);
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  getStatus,
  ask,
  askStream,
  confirmAction,
  listTools,
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  revertAgent,
  deleteAgent,
  tryAgent,
  updateTool,
  revertTool,
  getNextBestActions,
  getMemory,
  putMemory,
  listGoals,
  createGoal,
  updateGoal,
  listConversations,
  getConversation,
  deleteConversation,
  deleteAllConversations,
  renameConversation,
  getCapIndex,
  masterPropose,
  masterCreate,
  getKnowledgeSources,
  putKnowledgeSources,
  addKnowledgeWebsitePage,
  deleteKnowledgeWebsitePage,
};
