/**
 * SDLC multi-agent router — /sdlc/*.
 * Mirrors backend/routers/sdlc_router.py.
 *
 * AGENT PIPELINE:
 *   BA -> SA + PM (parallel) -> DEV LEAD -> DEV -> SECURITY -> QA -> SRE
 *
 * Workflow states:
 *   idle -> running_ba -> waiting_ba_approval
 *        -> running_sa -> waiting_sa_approval
 *        -> running_dev_lead -> waiting_dev_lead_approval
 *        -> running_rest -> done
 *
 * All four pipeline endpoints (start, approve-ba, approve-sa, approve-dev-lead)
 * use Server-Sent Events (SSE) so the frontend can display each agent's output
 * in real time as tokens arrive.
 *
 * SSE event protocol (one JSON object per data: line):
 *   {"t":"start","agent":"ba"}                            — agent beginning to stream
 *   {"t":"c","text":"..."}                                — text chunk for current agent
 *   {"t":"agent_done","agent":"dev"}                      — agent complete, next is about to start
 *   {"t":"done","state":"...","agent_outputs":{...},"jira_backlog":[...]}  — all done
 *   {"t":"stopped"}                                       — pipeline was aborted
 *   {"t":"error","message":"..."}                         — unexpected failure
 *
 * STOP / CHECKPOINT:
 *   POST /sdlc/{id}/stop    — aborts any in-flight streamAI(), sets state=idle
 *   POST /sdlc/{id}/restore — rolls back to a named checkpoint stage
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import {
  requireKnowledgeBase,
  requireSession,
  requireWorkflowState,
} from '../lib/guards.js';
import { callAI, streamAI } from '../services/ai/dispatcher.js';
import {
  ApproveRequestSchema,
  CRRequestSchema,
  RestoreRequestSchema,
  SDLCStateResponseSchema,
} from '../schemas/sdlc.schema.js';
import { ChatMessageSchema } from '../schemas/sessions.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';
import {
  registerAbort,
  abortSession,
  clearAbort,
} from '../lib/abortRegistry.js';

export const sdlcRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── SSE helpers ─────────────────────────────────────────

function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  };
}

type SdlcEvent =
  | { t: 'start'; agent: string }
  | { t: 'c'; text: string }
  | { t: 'agent_done'; agent: string }
  | { t: 'done'; state: string; agent_outputs: Record<string, unknown>; jira_backlog: unknown[] }
  | { t: 'stopped' }
  | { t: 'error'; message: string };

function sse(event: SdlcEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ─── Agent system instructions (verbatim from sdlc_router.py) ─
const AGENT_INSTRUCTIONS = {
  BA:
    'You are a Senior Business Analyst (BA) working on a banking/enterprise software project. ' +
    'Write a complete Business Requirements Document (BRD) including: ' +
    '## 1. Business Context & Problem Statement, ' +
    '## 2. Functional Requirements (FR), ' +
    '## 3. Non-Functional Requirements (NFR), ' +
    '## 4. User Stories (As a ... I want ... So that ...), ' +
    '## 5. Acceptance Criteria, ' +
    '## 6. Out of Scope. ' +
    'Use clear Markdown formatting. Do not fabricate technical information.',

  SA:
    'You are a Senior Solution Architect (SA). ' +
    'Write a System Architecture Document (SAD) including: ' +
    '## 1. High-Level Architecture Diagram (text/mermaid format), ' +
    '## 2. Component Design, ' +
    '## 3. API Contracts (endpoints, request/response), ' +
    '## 4. Data Model Changes (if any), ' +
    '## 5. Integration Points, ' +
    '## 6. Technology Decisions & Rationale. ' +
    'Use Markdown formatting. Stay aligned with the BRD and existing architecture.',

  DEV_LEAD:
    'You are a Principal Engineer / Tech Lead. ' +
    'Your task: REVIEW the SA Design and create an Implementation Plan for the dev team. ' +
    'Output must include: ' +
    '## 1. SA Review & Technical Concerns (unclear points or items needing clarification), ' +
    '## 2. Technical Debt & Risks, ' +
    '## 3. Implementation Breakdown (split tasks for developers), ' +
    '## 4. Code Standards & Patterns to follow, ' +
    '## 5. Testing Strategy (unit/integration/e2e), ' +
    '## 6. Definition of Done (DoD) for each task. ' +
    'Think critically and highlight real technical risks.',

  DEV:
    'You are a Senior Developer. ' +
    'Based on the SA Plan and Dev Lead guidance, write: ' +
    '## 1. Pseudocode / Code Structure for the main changes, ' +
    '## 2. Files/Modules to create or modify, ' +
    '## 3. Key Implementation Details (algorithms, patterns), ' +
    '## 4. Database Migration scripts (if needed), ' +
    '## 5. Environment Variables / Config to add. ' +
    'Write real, practical code samples (not placeholders). ' +
    'Use Markdown with clear code blocks.',

  SECURITY:
    'You are a Security Engineer / AppSec specialist in banking/enterprise security. ' +
    'Perform a comprehensive Security Review including: ' +
    '## 1. Threat Modeling (STRIDE: Spoofing/Tampering/Repudiation/Info Disclosure/DoS/Elevation), ' +
    '## 2. OWASP Top 10 Checklist (mark applicable items), ' +
    '## 3. Authentication & Authorization Review, ' +
    '## 4. Data Security (PII, encryption at rest/in transit), ' +
    '## 5. Input Validation & Injection Prevention, ' +
    '## 6. API Security (rate limiting, CORS, JWT, etc.), ' +
    '## 7. Compliance Considerations (PCI-DSS, GDPR if applicable), ' +
    '## 8. Security Action Items (CRITICAL / HIGH / MEDIUM / LOW). ' +
    'Reference specific CVE/CWE where applicable. Do not skip any risks.',

  QA:
    'You are a QA Engineer / SDET. ' +
    'Write a complete Test Plan including: ' +
    '## 1. Test Scope & Strategy, ' +
    '## 2. Test Cases (Happy Path, Edge Cases, Negative Cases), ' +
    '## 3. Performance Test Scenarios, ' +
    '## 4. Regression Test Checklist, ' +
    '## 5. Test Data Requirements, ' +
    '## 6. Exit Criteria. ' +
    'Format test cases as: | ID | Scenario | Steps | Expected | Priority |',

  SRE:
    'You are an SRE / DevOps Engineer. ' +
    'Create a Release Package including: ' +
    '## 1. Release Notes (What\'s New, Bug Fixes, Breaking Changes), ' +
    '## 2. Deployment Checklist (step-by-step), ' +
    '## 3. Infrastructure Changes (if any), ' +
    '## 4. Configuration Changes (.env, feature flags), ' +
    '## 5. Monitoring & Alerting (metrics to watch after deploy), ' +
    '## 6. Rollback Plan (detailed steps when rollback is needed), ' +
    '## 7. Post-Deploy Verification (smoke tests). ' +
    'Write like a real runbook, not generic advice.',

  PM:
    'Parse the SA Plan and Dev Lead Implementation Plan into a JIRA backlog JSON. ' +
    'Return only JSON, no extra text or markdown wrapper. ' +
    'Format: {"epics": [{"title": "Epic Title", "tasks": [{"title": "Task Title", ' +
    '"type": "backend|frontend|devops|security|testing", ' +
    '"story_points": 3, ' +
    '"subtasks": ["Subtask 1", "Subtask 2"]}]}]}',
} as const;

// ─── POST /sdlc/start  (SSE) ──────────────────────────────
// Streams BA output in real time.
sdlcRouter.post('/sdlc/start', async (c) => {
  const body = (await c.req.json()) as { session_id?: string; requirement?: string };
  const req = CRRequestSchema.parse(body);

  requireSession(req.session_id);
  const kb = requireKnowledgeBase();

  sessionsRepo.update(req.session_id, {
    workflowState: 'running_ba',
    agentOutputs: { requirement: req.requirement },
    jiraBacklog: [],
    name: `CR: ${req.requirement.slice(0, 40)}...`,
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const controller = registerAbort(req.session_id);
    try {
      await s.write(sse({ t: 'start', agent: 'ba' }));

      const chunks: string[] = [];
      for await (const chunk of streamAI(
        `CHANGE REQUEST:\n${req.requirement}\n\nCURRENT ARCHITECTURE (Project Context):\n${kb.project_summary}`,
        AGENT_INSTRUCTIONS.BA,
        controller.signal,
      )) {
        chunks.push(chunk);
        await s.write(sse({ t: 'c', text: chunk }));
      }

      if (controller.signal.aborted) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }

      const baResult = chunks.join('');
      const outputs = { requirement: req.requirement, ba: baResult };
      sessionsRepo.update(req.session_id, {
        agentOutputs: outputs,
        workflowState: 'waiting_ba_approval',
      });

      await s.write(sse({
        t: 'done',
        state: 'waiting_ba_approval',
        agent_outputs: outputs,
        jira_backlog: [],
      }));
    } catch (e) {
      await s.write(sse({ t: 'error', message: (e as Error).message }));
    } finally {
      clearAbort(req.session_id);
    }
  });
});

// ─── POST /sdlc/approve-ba  (SSE) ───────────────────────
// Streams SA output. PM (backlog JSON) runs blocking after SA stream completes.
sdlcRouter.post('/sdlc/approve-ba', async (c) => {
  const body = (await c.req.json()) as { session_id?: string; edited_content?: string };
  const req = ApproveRequestSchema.parse(body);

  const session = requireSession(req.session_id);
  requireWorkflowState(session, 'waiting_ba_approval');

  const outputs = { ...session.agentOutputs } as Record<string, unknown>;
  if (req.edited_content) outputs.ba = req.edited_content;
  const baContent = String(outputs.ba ?? '');
  const kb = requireKnowledgeBase();

  sessionsRepo.update(req.session_id, {
    workflowState: 'running_sa',
    agentOutputs: outputs,
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const controller = registerAbort(req.session_id);
    try {
      // ── SA (streamed) ──
      await s.write(sse({ t: 'start', agent: 'sa' }));

      const saChunks: string[] = [];
      for await (const chunk of streamAI(
        `BUSINESS REQUIREMENTS DOCUMENT:\n${baContent}\n\nCURRENT ARCHITECTURE:\n${kb.project_summary}`,
        AGENT_INSTRUCTIONS.SA,
        controller.signal,
      )) {
        saChunks.push(chunk);
        await s.write(sse({ t: 'c', text: chunk }));
      }

      if (controller.signal.aborted) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }

      const saResult = saChunks.join('');
      outputs.sa = saResult;

      // ── PM (blocking — JSON parsing, not streamed) ──
      const pmResult = await callAI(
        'PM',
        `SA PLAN:\n${saResult}`,
        AGENT_INSTRUCTIONS.PM,
        controller.signal,
      );

      if (controller.signal.aborted) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }

      let backlog: unknown[] = [];
      try {
        const cleaned = pmResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned) as { epics?: unknown[] };
        backlog = parsed.epics ?? [];
      } catch {
        backlog = [];
      }

      sessionsRepo.update(req.session_id, {
        agentOutputs: outputs,
        jiraBacklog: backlog,
        workflowState: 'waiting_sa_approval',
      });

      await s.write(sse({
        t: 'done',
        state: 'waiting_sa_approval',
        agent_outputs: outputs,
        jira_backlog: backlog,
      }));
    } catch (e) {
      await s.write(sse({ t: 'error', message: (e as Error).message }));
    } finally {
      clearAbort(req.session_id);
    }
  });
});

// ─── POST /sdlc/approve-sa  (SSE) ───────────────────────
// Streams Dev Lead output.
sdlcRouter.post('/sdlc/approve-sa', async (c) => {
  const body = (await c.req.json()) as { session_id?: string; edited_content?: string };
  const req = ApproveRequestSchema.parse(body);

  const session = requireSession(req.session_id);
  requireWorkflowState(session, 'waiting_sa_approval');

  const outputs = { ...session.agentOutputs } as Record<string, unknown>;
  if (req.edited_content) outputs.sa = req.edited_content;
  const saContent = String(outputs.sa ?? '');
  const baContent = String(outputs.ba ?? '');

  sessionsRepo.update(req.session_id, {
    workflowState: 'running_dev_lead',
    agentOutputs: outputs,
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const controller = registerAbort(req.session_id);
    try {
      await s.write(sse({ t: 'start', agent: 'dev_lead' }));

      const chunks: string[] = [];
      for await (const chunk of streamAI(
        `BUSINESS REQUIREMENTS DOCUMENT:\n${baContent}\n\nSYSTEM ARCHITECTURE DOCUMENT:\n${saContent}`,
        AGENT_INSTRUCTIONS.DEV_LEAD,
        controller.signal,
      )) {
        chunks.push(chunk);
        await s.write(sse({ t: 'c', text: chunk }));
      }

      if (controller.signal.aborted) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }

      const devLeadResult = chunks.join('');
      outputs.dev_lead = devLeadResult;

      sessionsRepo.update(req.session_id, {
        agentOutputs: outputs,
        workflowState: 'waiting_dev_lead_approval',
      });

      await s.write(sse({
        t: 'done',
        state: 'waiting_dev_lead_approval',
        agent_outputs: outputs,
        jira_backlog: session.jiraBacklog,
      }));
    } catch (e) {
      await s.write(sse({ t: 'error', message: (e as Error).message }));
    } finally {
      clearAbort(req.session_id);
    }
  });
});

// ─── POST /sdlc/approve-dev-lead  (SSE) ─────────────────
// Streams DEV → SECURITY → QA → SRE sequentially.
// agent_done events are emitted between agents; DB is saved after each.
sdlcRouter.post('/sdlc/approve-dev-lead', async (c) => {
  const body = (await c.req.json()) as { session_id?: string; edited_content?: string };
  const req = ApproveRequestSchema.parse(body);

  const session = requireSession(req.session_id);
  requireWorkflowState(session, 'waiting_dev_lead_approval');

  const outputs = { ...session.agentOutputs } as Record<string, unknown>;
  if (req.edited_content) outputs.dev_lead = req.edited_content;

  const devLeadContent = String(outputs.dev_lead ?? '');
  const saContent = String(outputs.sa ?? '');
  const baContent = String(outputs.ba ?? '');

  sessionsRepo.update(req.session_id, {
    workflowState: 'running_rest',
    agentOutputs: outputs,
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const controller = registerAbort(req.session_id);

    /** Stream a single agent. Returns the full output, or null if aborted. */
    async function streamAgent(
      agentKey: string,
      prompt: string,
      instruction: string,
    ): Promise<string | null> {
      await s.write(sse({ t: 'start', agent: agentKey }));
      const chunks: string[] = [];
      for await (const chunk of streamAI(prompt, instruction, controller.signal)) {
        chunks.push(chunk);
        await s.write(sse({ t: 'c', text: chunk }));
      }
      if (controller.signal.aborted) return null;
      return chunks.join('');
    }

    try {
      // ── DEV ──
      const devResult = await streamAgent(
        'dev',
        `SA PLAN:\n${saContent}\n\nDEV LEAD IMPLEMENTATION PLAN:\n${devLeadContent}`,
        AGENT_INSTRUCTIONS.DEV,
      );
      if (devResult === null) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }
      outputs.dev = devResult;
      sessionsRepo.update(req.session_id, { agentOutputs: { ...outputs } });
      await s.write(sse({ t: 'agent_done', agent: 'dev' }));

      // ── SECURITY ──
      const securityResult = await streamAgent(
        'security',
        `BUSINESS REQUIREMENTS:\n${baContent}\n\nSYSTEM ARCHITECTURE:\n${saContent}\n\nIMPLEMENTATION CODE/PLAN:\n${devResult}`,
        AGENT_INSTRUCTIONS.SECURITY,
      );
      if (securityResult === null) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }
      outputs.security = securityResult;
      sessionsRepo.update(req.session_id, { agentOutputs: { ...outputs } });
      await s.write(sse({ t: 'agent_done', agent: 'security' }));

      // ── QA ──
      const qaResult = await streamAgent(
        'qa',
        `BRD:\n${baContent}\n\nSA PLAN:\n${saContent}\n\nCODE PLAN:\n${devResult}\n\nSECURITY CONCERNS:\n${securityResult}`,
        AGENT_INSTRUCTIONS.QA,
      );
      if (qaResult === null) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }
      outputs.qa = qaResult;
      sessionsRepo.update(req.session_id, { agentOutputs: { ...outputs } });
      await s.write(sse({ t: 'agent_done', agent: 'qa' }));

      // ── SRE ──
      const sreResult = await streamAgent(
        'sre',
        `DEV CODE PLAN:\n${devResult}\n\nSECURITY REVIEW:\n${securityResult}\n\nQA TEST PLAN:\n${qaResult}`,
        AGENT_INSTRUCTIONS.SRE,
      );
      if (sreResult === null) {
        sessionsRepo.update(req.session_id, { workflowState: 'idle' });
        await s.write(sse({ t: 'stopped' }));
        return;
      }
      outputs.sre = sreResult;

      sessionsRepo.update(req.session_id, {
        agentOutputs: outputs,
        workflowState: 'done',
      });

      await s.write(sse({
        t: 'done',
        state: 'done',
        agent_outputs: outputs,
        jira_backlog: session.jiraBacklog,
      }));
    } catch (e) {
      await s.write(sse({ t: 'error', message: (e as Error).message }));
    } finally {
      clearAbort(req.session_id);
    }
  });
});

// ─── POST /sdlc/{session_id}/stop ────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/{session_id}/stop',
    tags: ['SDLC Agents'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: {
        content: json(
          z.object({
            status: z.string(),
            message: z.string(),
            agent_outputs: z.record(z.string(), z.unknown()),
          }),
        ),
        description: 'Pipeline stopped',
      },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const session = requireSession(session_id);

    abortSession(session_id);
    sessionsRepo.update(session_id, { workflowState: 'idle' });

    const updated = sessionsRepo.get(session_id);
    return c.json(
      {
        status: 'stopped',
        message: 'Pipeline stopped.',
        agent_outputs: (updated?.agentOutputs ?? session.agentOutputs) as Record<string, unknown>,
      },
      200,
    );
  },
);

// ─── POST /sdlc/{session_id}/restore ─────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'post',
    path: '/sdlc/{session_id}/restore',
    tags: ['SDLC Agents'],
    request: {
      params: z.object({ session_id: z.string() }),
      body: { content: json(RestoreRequestSchema) },
    },
    responses: {
      200: { content: json(SDLCStateResponseSchema), description: 'Checkpoint restored' },
      400: { content: json(ErrorSchema), description: 'Bad checkpoint or session not found' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const { checkpoint } = c.req.valid('json');
    const session = requireSession(session_id);

    const existing = { ...session.agentOutputs } as Record<string, unknown>;

    let keptOutputs: Record<string, unknown>;
    let restoredState: string;
    let clearBacklog: boolean;

    switch (checkpoint) {
      case 'ba':
        keptOutputs = { requirement: existing.requirement, ba: existing.ba };
        restoredState = 'waiting_ba_approval';
        clearBacklog = true;
        break;
      case 'sa':
        keptOutputs = {
          requirement: existing.requirement,
          ba: existing.ba,
          sa: existing.sa,
        };
        restoredState = 'waiting_sa_approval';
        clearBacklog = true;
        break;
      case 'dev_lead':
        keptOutputs = {
          requirement: existing.requirement,
          ba: existing.ba,
          sa: existing.sa,
          dev_lead: existing.dev_lead,
        };
        restoredState = 'waiting_dev_lead_approval';
        clearBacklog = false;
        break;
    }

    for (const key of Object.keys(keptOutputs)) {
      if (keptOutputs[key] === undefined) delete keptOutputs[key];
    }

    const updated = sessionsRepo.update(session_id, {
      agentOutputs: keptOutputs,
      workflowState: restoredState,
      ...(clearBacklog ? { jiraBacklog: [] } : {}),
    });

    return c.json(
      {
        session_id,
        workflow_state: updated?.workflowState ?? restoredState,
        agent_outputs: (updated?.agentOutputs ?? keptOutputs) as Record<string, unknown>,
        jira_backlog: updated?.jiraBacklog ?? [],
      },
      200,
    );
  },
);

// ─── GET /sdlc/{session_id}/state ────────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sdlc/{session_id}/state',
    tags: ['SDLC Agents'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: { content: json(SDLCStateResponseSchema), description: 'State' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const session = requireSession(session_id);
    return c.json(
      {
        session_id,
        workflow_state: session.workflowState,
        agent_outputs: session.agentOutputs as Record<string, unknown>,
        jira_backlog: session.jiraBacklog,
      },
      200,
    );
  },
);

// ─── GET /sdlc/{session_id}/history ──────────────────────
sdlcRouter.openapi(
  createRoute({
    method: 'get',
    path: '/sdlc/{session_id}/history',
    tags: ['SDLC Agents'],
    request: { params: z.object({ session_id: z.string() }) },
    responses: {
      200: {
        content: json(
          z.object({
            session_id: z.string(),
            chat_history: z.array(ChatMessageSchema),
          }),
        ),
        description: 'History',
      },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  (c) => {
    const { session_id } = c.req.valid('param');
    const session = requireSession(session_id);
    return c.json(
      {
        session_id,
        chat_history: session.chatHistory,
      },
      200,
    );
  },
);
