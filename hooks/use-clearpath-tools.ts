'use client';

import { useEffect, useRef } from 'react';
import {
  auditPlan,
  exactGeometry,
  type PlanningConstraints,
  type RouteProposal,
} from '@/lib/planning-engine';
import {
  proposalIsCurrent,
  visiblePlan,
  type PlanningSession,
} from '@/lib/planning-session';

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ToolActions = {
  focusIssue: (issueId: string) => void;
  setConstraints: (constraints: PlanningConstraints) => PlanningSession;
  generateAlternatives: () => PlanningSession;
  stageProposal: (proposalId: string) => PlanningSession;
  requestApproval: (proposalId: string) => PlanningSession;
  rejectProposal: (proposalId: string) => PlanningSession;
  undo: () => PlanningSession;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: ToolDefinition,
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

function objectInput(
  input: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new Error('Tool input must be a JSON object.');
  const value = input as Record<string, unknown>;
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length)
    throw new Error(`Unexpected input field(s): ${extra.join(', ')}.`);
  return value;
}
function stringField(input: unknown, field: string): string {
  const value = objectInput(input, [field])[field];
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${field} must be a non-empty string.`);
  if (value.length > 256)
    throw new Error(`${field} must contain at most 256 characters.`);
  return value;
}
function conciseProposal(proposal: RouteProposal) {
  return {
    proposalId: proposal.id,
    status: proposal.status,
    changes: proposal.changes,
    before: proposal.before.metrics,
    after: proposal.after.metrics,
    deltas: proposal.deltas,
    resolvedIssueIds: proposal.resolvedIssueIds,
    remainingIssueIds: proposal.remainingIssueIds,
    preservedConstraints: proposal.preservedConstraints,
    explanation: proposal.explanation,
    tradeoffs: proposal.tradeoffs,
  };
}

export function buildToolDefinitions(
  session: PlanningSession,
  actions: ToolActions,
): ToolDefinition[] {
  const plan = visiblePlan(session);
  const audit = auditPlan(plan, session.baseline);
  const maximumCapacity = session.committed.objects.reduce(
    (sum, object) => sum + object.capacity,
    0,
  );
  const tools: ToolDefinition[] = [
    {
      name: 'get_plan_summary',
      title: 'Get plan summary',
      description:
        'Read the current plan version, constraint state, calculated route metrics, and proposal status.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        objectInput(input, []);
        return {
          planId: plan.id,
          versionId: plan.versionId,
          committedVersionId: session.committed.versionId,
          stagedProposalId: session.staged?.id ?? null,
          viewing: session.staged ? 'staged-proposal' : 'committed-plan',
          constraints: session.constraints,
          metrics: audit.metrics,
          openIssueIds: audit.issues.map((issue) => issue.id),
          heuristicDisclaimer: audit.disclaimer,
        };
      },
    },
    {
      name: 'get_plan_geometry',
      title: 'Get plan geometry',
      description:
        'Read exact plan dimensions, scale, walls, route coordinates, physical destination and terminal-contact model, objects, locks, capacity contributions, and required zones.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        objectInput(input, []);
        return exactGeometry(plan);
      },
    },
    {
      name: 'audit_access_routes',
      title: 'Audit access routes',
      description:
        'Calculate route intersections, clear width, turning-zone overlap, door approach conflicts, capacity, route length, and heuristic score from current geometry.',
      inputSchema: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['all', 'critical', 'review'] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        const value = objectInput(input, ['severity']);
        const severity = value.severity ?? 'all';
        if (
          severity !== 'all' &&
          severity !== 'critical' &&
          severity !== 'review'
        )
          throw new Error('severity must be all, critical, or review.');
        return {
          versionId: plan.versionId,
          metrics: audit.metrics,
          issues:
            severity === 'all'
              ? audit.issues
              : audit.issues.filter((issue) => issue.severity === severity),
          heuristicDisclaimer: audit.disclaimer,
        };
      },
    },
    {
      name: 'focus_audit_issue',
      title: 'Focus audit issue',
      description:
        'Visibly focus one currently open geometry-derived audit issue in the studio.',
      inputSchema: {
        type: 'object',
        properties: {
          issueId: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            description:
              'A currently open issue ID returned by audit_access_routes.',
          },
        },
        required: ['issueId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const issueId = stringField(input, 'issueId');
        const issue = audit.issues.find((item) => item.id === issueId);
        if (!issue)
          throw new Error(
            'Issue is not open in the visible plan. Re-audit before focusing.',
          );
        actions.focusIssue(issueId);
        return {
          focusedIssueId: issue.id,
          objectId: issue.objectId,
          title: issue.title,
        };
      },
    },
    {
      name: 'set_planning_constraints',
      title: 'Set planning constraints',
      description:
        'Set the required minimum seat capacity and invalidate proposals generated under older constraints.',
      inputSchema: {
        type: 'object',
        properties: {
          minimumCapacity: {
            type: 'integer',
            minimum: 0,
            maximum: maximumCapacity,
            description:
              'Required active seat capacity; lowering it does not request removal.',
          },
        },
        required: ['minimumCapacity'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const value = objectInput(input, ['minimumCapacity']).minimumCapacity;
        if (!Number.isInteger(value) || (value as number) < 0)
          throw new Error(
            'minimumCapacity must be a non-negative whole number.',
          );
        if ((value as number) > maximumCapacity)
          throw new Error(
            `minimumCapacity cannot exceed available capacity ${maximumCapacity}.`,
          );
        const next = actions.setConstraints({
          minimumCapacity: value as number,
        });
        return { constraints: next.constraints, proposalsCleared: true };
      },
    },
    {
      name: 'generate_route_alternatives',
      title: 'Generate route-clearance layout alternatives',
      description:
        'Available in the studio. Run bounded deterministic geometry search under current locks and capacity. Furniture changes clear the selected fixed route; route geometry remains fixed in this version. Results are reviewable proposals and never commit geometry.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        objectInput(input, []);
        const next = actions.generateAlternatives();
        return {
          baselineVersionId: next.committed.versionId,
          alternatives: next.alternatives.map(conciseProposal),
        };
      },
    },
    {
      name: 'get_audit_history',
      title: 'Get audit history',
      description:
        'Read real chronological planning events with actors, versions, proposal IDs, and outcomes.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        objectInput(input, []);
        return { events: session.history };
      },
    },
  ];
  if (session.alternatives.length)
    tools.push(
      {
        name: 'stage_route_proposal',
        title: 'Stage route proposal',
        description:
          'Available after generation. Stage one current proposal as a visible ghost preview without changing committed geometry.',
        inputSchema: {
          type: 'object',
          properties: {
            proposalId: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              description:
                'A current proposal ID returned by generate_route_alternatives.',
            },
          },
          required: ['proposalId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const proposalId = stringField(input, 'proposalId');
          const next = actions.stageProposal(proposalId);
          return {
            staged: true,
            committed: false,
            comparison: conciseProposal(next.staged!),
          };
        },
      },
      {
        name: 'compare_plan_versions',
        title: 'Compare plan versions',
        description:
          'Available after generation. Read exact metrics, changes, resolved and remaining issues, status, and trade-offs for a current proposal.',
        inputSchema: {
          type: 'object',
          properties: {
            proposalId: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              description: 'A current generated or staged proposal ID.',
            },
          },
          required: ['proposalId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: (input) => {
          const proposalId = stringField(input, 'proposalId');
          const proposal =
            session.staged?.id === proposalId
              ? session.staged
              : session.alternatives.find((item) => item.id === proposalId);
          if (!proposal || !proposalIsCurrent(session, proposal))
            throw new Error('Proposal is unavailable or stale.');
          return conciseProposal(proposal);
        },
      },
    );
  if (session.staged && proposalIsCurrent(session, session.staged))
    tools.push(
      {
        name: 'apply_staged_plan',
        title: 'Request staged plan approval',
        description:
          'Available for a current staged proposal. Record an agent approval request and open the comparison; this tool never commits geometry. Only the visible human approval button can commit.',
        inputSchema: {
          type: 'object',
          properties: {
            proposalId: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              description: 'The currently staged proposal ID.',
            },
          },
          required: ['proposalId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const proposalId = stringField(input, 'proposalId');
          if (
            session.staged?.id !== proposalId ||
            !proposalIsCurrent(session, session.staged)
          )
            throw new Error(
              'The staged proposal is stale, rejected, or unavailable.',
            );
          actions.requestApproval(proposalId);
          return {
            proposalId,
            approvalRequired: true,
            committed: false,
            instruction:
              'Review the visible comparison and use the human approval button to commit.',
          };
        },
      },
      {
        name: 'reject_staged_plan',
        title: 'Reject staged plan',
        description:
          'Available for a current staged proposal. Reject it and invalidate generated alternatives while preserving committed geometry exactly.',
        inputSchema: {
          type: 'object',
          properties: {
            proposalId: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              description: 'The currently staged proposal ID.',
            },
          },
          required: ['proposalId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const proposalId = stringField(input, 'proposalId');
          if (session.staged?.id !== proposalId)
            throw new Error('The proposal is rejected, stale, or not staged.');
          const next = actions.rejectProposal(proposalId);
          return {
            rejected: true,
            proposalId,
            committedVersionId: next.committed.versionId,
          };
        },
      },
    );
  if (session.undoStack.length)
    tools.push({
      name: 'undo_plan_change',
      title: 'Undo plan change',
      description:
        'Available after a human-approved application. Restore the exact prior geometry, activity state, capacity, and locks.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        objectInput(input, []);
        const next = actions.undo();
        return {
          undone: true,
          restoredVersionId: next.committed.versionId,
          metrics: auditPlan(next.committed, next.baseline).metrics,
        };
      },
    });
  return tools;
}

export function useClearPathTools(
  session: PlanningSession,
  actions: ToolActions,
) {
  const sessionRef = useRef(session);
  const actionsRef = useRef(actions);
  useEffect(() => {
    sessionRef.current = session;
    actionsRef.current = actions;
  }, [session, actions]);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    for (const definition of buildToolDefinitions(
      sessionRef.current,
      actionsRef.current,
    )) {
      const tool: ToolDefinition = {
        ...definition,
        execute: (input) =>
          buildToolDefinitions(sessionRef.current, actionsRef.current)
            .find((candidate) => candidate.name === definition.name)
            ?.execute(input) ??
          (() => {
            throw new Error(
              `${definition.name} is not available in the current state.`,
            );
          })(),
      };
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch((error: unknown) =>
          console.error(`Failed to register ${tool.name}`, error),
        );
      } catch (error) {
        console.error(`Failed to register ${tool.name}`, error);
      }
    }
    return () => lifecycle.abort();
  }, [
    session.revision,
    session.alternatives.length,
    session.staged?.id,
    session.undoStack.length,
  ]);
}
