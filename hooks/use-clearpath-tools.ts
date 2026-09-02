'use client';

import { useEffect, useRef } from 'react';
import { auditPlan, exactGeometry, type PlanningConstraints, type RouteProposal } from '@/lib/planning-engine';
import { visiblePlan, type PlanningSession } from '@/lib/planning-session';

export type ToolDefinition = {
  name: string; title: string; description: string; inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown;
};
type ToolActions = {
  focusIssue: (issueId: string) => void;
  setConstraints: (constraints: PlanningConstraints) => PlanningSession;
  generateAlternatives: () => PlanningSession;
  stageProposal: (proposalId: string) => PlanningSession;
  requestApproval: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => PlanningSession;
  undo: () => PlanningSession;
};

declare global { interface Document { modelContext?: { registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void> } } }

function objectInput(input: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Tool input must be a JSON object.');
  const value = input as Record<string, unknown>; const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error(`Unexpected input field(s): ${extra.join(', ')}.`);
  return value;
}
function stringField(input: unknown, field: string): string {
  const value = objectInput(input, [field])[field]; if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} must be a non-empty string.`); return value;
}
function conciseProposal(proposal: RouteProposal) {
  return { proposalId: proposal.id, movements: proposal.movements, before: proposal.before.metrics, after: proposal.after.metrics, deltas: proposal.deltas, resolvedIssueIds: proposal.resolvedIssueIds, remainingIssueIds: proposal.remainingIssueIds, preservedConstraints: proposal.preservedConstraints, explanation: proposal.explanation, tradeoffs: proposal.tradeoffs };
}

export function buildToolDefinitions(session: PlanningSession, actions: ToolActions): ToolDefinition[] {
  const plan = visiblePlan(session); const audit = auditPlan(plan, session.baseline);
  const tools: ToolDefinition[] = [
    { name: 'get_plan_summary', title: 'Get plan summary', description: 'Read the current plan version, constraint state, calculated route metrics, and proposal status.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => { objectInput(input, []); return { planId: plan.id, versionId: plan.versionId, committedVersionId: session.committed.versionId, stagedProposalId: session.staged?.id ?? null, constraints: session.constraints, metrics: audit.metrics, openIssueIds: audit.issues.map((issue) => issue.id), heuristicDisclaimer: audit.disclaimer }; } },
    { name: 'get_plan_geometry', title: 'Get plan geometry', description: 'Read agent-meaningful plan dimensions, route coordinates, objects, locks, capacity contributions, and required zones.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => { objectInput(input, []); return exactGeometry(plan); } },
    { name: 'audit_access_routes', title: 'Audit access routes', description: 'Calculate route intersections, clear width, turning-zone overlap, door approach conflicts, capacity, route length, and heuristic score from current geometry.', inputSchema: { type: 'object', properties: { severity: { type: 'string', enum: ['all', 'critical', 'review'] } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => { const value = objectInput(input, ['severity']); const severity = value.severity ?? 'all'; if (severity !== 'all' && severity !== 'critical' && severity !== 'review') throw new Error('severity must be all, critical, or review.'); return { versionId: plan.versionId, metrics: audit.metrics, issues: severity === 'all' ? audit.issues : audit.issues.filter((issue) => issue.severity === severity), heuristicDisclaimer: audit.disclaimer }; } },
    { name: 'focus_audit_issue', title: 'Focus audit issue', description: 'Visibly focus one currently open geometry-derived audit issue in the studio.', inputSchema: { type: 'object', properties: { issueId: { type: 'string' } }, required: ['issueId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const issueId = stringField(input, 'issueId'); const issue = audit.issues.find((item) => item.id === issueId); if (!issue) throw new Error('Issue is not open in the visible plan. Re-audit before focusing.'); actions.focusIssue(issueId); return { focusedIssueId: issue.id, objectId: issue.objectId, title: issue.title }; } },
    { name: 'set_planning_constraints', title: 'Set planning constraints', description: 'Set the required minimum seat capacity and invalidate proposals generated under older constraints.', inputSchema: { type: 'object', properties: { minimumCapacity: { type: 'integer', minimum: 0 } }, required: ['minimumCapacity'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const value = objectInput(input, ['minimumCapacity']).minimumCapacity; if (!Number.isInteger(value) || (value as number) < 0) throw new Error('minimumCapacity must be a non-negative whole number.'); const next = actions.setConstraints({ minimumCapacity: value as number }); return { constraints: next.constraints, proposalsCleared: true }; } },
    { name: 'generate_route_alternatives', title: 'Generate route alternatives', description: 'Run bounded deterministic geometry search and rank different valid movements under current locks and capacity.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { objectInput(input, []); const next = actions.generateAlternatives(); return { baselineVersionId: next.committed.versionId, alternatives: next.alternatives.map(conciseProposal) }; } },
    { name: 'stage_route_proposal', title: 'Stage route proposal', description: 'Stage one generated proposal as a ghosted visual preview without changing committed geometry.', inputSchema: { type: 'object', properties: { proposalId: { type: 'string' } }, required: ['proposalId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const proposalId = stringField(input, 'proposalId'); const next = actions.stageProposal(proposalId); return { staged: true, comparison: conciseProposal(next.staged!) }; } },
    { name: 'compare_plan_versions', title: 'Compare plan versions', description: 'Return exact baseline and staged metrics, deltas, movements, resolved issues, remaining issues, and trade-offs.', inputSchema: { type: 'object', properties: { proposalId: { type: 'string' } }, required: ['proposalId'], additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => { const proposalId = stringField(input, 'proposalId'); const proposal = session.staged?.id === proposalId ? session.staged : session.alternatives.find((item) => item.id === proposalId); if (!proposal) throw new Error('Proposal is unavailable or stale.'); return conciseProposal(proposal); } },
    { name: 'reject_staged_plan', title: 'Reject staged plan', description: 'Reject the currently staged proposal while preserving the committed plan exactly.', inputSchema: { type: 'object', properties: { proposalId: { type: 'string' } }, required: ['proposalId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const proposalId = stringField(input, 'proposalId'); if (session.staged?.id !== proposalId) throw new Error('The proposal is rejected, stale, or not staged.'); const next = actions.rejectProposal(proposalId); return { rejected: true, proposalId, committedVersionId: next.committed.versionId }; } },
    { name: 'undo_plan_change', title: 'Undo plan change', description: 'Undo the most recent human-approved plan application and restore its exact prior geometry.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { objectInput(input, []); const next = actions.undo(); return { undone: true, restoredVersionId: next.committed.versionId, metrics: auditPlan(next.committed, next.baseline).metrics }; } },
    { name: 'get_audit_history', title: 'Get audit history', description: 'Read real chronological planning events with actors, versions, proposal IDs, and outcomes.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: (input) => { objectInput(input, []); return { events: session.history }; } },
  ];
  if (session.staged) tools.push({ name: 'apply_staged_plan', title: 'Request staged plan approval', description: 'Open the exact staged comparison for human approval. This tool never commits geometry; the visible human Approve button performs the consequential change.', inputSchema: { type: 'object', properties: { proposalId: { type: 'string' } }, required: ['proposalId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input) => { const proposalId = stringField(input, 'proposalId'); if (session.staged?.id !== proposalId || session.staged.baselineVersionId !== session.committed.versionId) throw new Error('The staged proposal is stale, rejected, or unavailable.'); actions.requestApproval(proposalId); return { proposalId, approvalRequired: true, committed: false, instruction: 'Review the visible comparison and use the human Approve button to commit.' }; } });
  return tools;
}

export function useClearPathTools(session: PlanningSession, actions: ToolActions) {
  const sessionRef = useRef(session); const actionsRef = useRef(actions);
  useEffect(() => { sessionRef.current = session; actionsRef.current = actions; }, [session, actions]);
  useEffect(() => {
    const context = document.modelContext; if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const definition of buildToolDefinitions(sessionRef.current, actionsRef.current)) {
      const tool: ToolDefinition = { ...definition, execute: (input) => buildToolDefinitions(sessionRef.current, actionsRef.current).find((candidate) => candidate.name === definition.name)?.execute(input) ?? (() => { throw new Error(`${definition.name} is not available in the current state.`); })() };
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch((error: unknown) => console.error(`Failed to register ${tool.name}`, error)); } catch (error) { console.error(`Failed to register ${tool.name}`, error); }
    }
    return () => lifecycle.abort();
  }, [session.staged?.id]);
}
