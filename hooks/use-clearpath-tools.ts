'use client';

import { useEffect, useRef } from 'react';

import type { AuditIssue, PlanMetrics, PlanPhase, ScenarioId } from '@/lib/planning';

type ToolState = {
  scenarioId: ScenarioId;
  venueName: string;
  phase: PlanPhase;
  metrics: PlanMetrics;
  issues: AuditIssue[];
};

type ToolActions = {
  focusIssue: (issueId: string) => void;
  stageProposal: (minimumSeats: number) => unknown;
  applyProposal: () => void;
  undo: () => void;
  showComparison: () => void;
};

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: ToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

function objectInput(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Tool input must be a JSON object.');
  }
  return input as Record<string, unknown>;
}

export function useClearPathTools(state: ToolState, actions: ToolActions) {
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);

  useEffect(() => {
    stateRef.current = state;
    actionsRef.current = actions;
  }, [state, actions]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ToolDefinition) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch((error: unknown) => {
          console.error(`Failed to register ${tool.name}`, error);
        });
      } catch (error) {
        console.error(`Failed to register ${tool.name}`, error);
      }
    };

    register({
      name: 'get_plan_summary',
      title: 'Read current plan',
      description: 'Read the visible venue, route metrics, open audit issues, and current proposal state.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => {
        const current = stateRef.current;
        return { venue: current.venueName, phase: current.phase, metrics: current.metrics, issueIds: current.issues.map((issue) => issue.id) };
      },
    });

    register({
      name: 'audit_access_routes',
      title: 'Audit access routes',
      description: 'Audit the current floor plan and return prioritized route issues with object references.',
      inputSchema: {
        type: 'object',
        properties: { severity: { type: 'string', enum: ['all', 'critical', 'review'], description: 'Issue severity to include.' } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: (input) => {
        const value = objectInput(input);
        const severity = value.severity ?? 'all';
        if (typeof severity !== 'string' || !['all', 'critical', 'review'].includes(severity)) throw new Error('severity must be all, critical, or review.');
        const current = stateRef.current;
        const issues = severity === 'all' ? current.issues : current.issues.filter((issue) => issue.severity === severity);
        return { venue: current.venueName, score: current.metrics.score, issues };
      },
    });

    register({
      name: 'focus_audit_issue',
      title: 'Focus audit issue',
      description: 'Select and visibly highlight one current audit issue on the floor plan.',
      inputSchema: {
        type: 'object',
        properties: { issueId: { type: 'string', description: 'An issue ID returned by audit_access_routes.' } },
        required: ['issueId'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const value = objectInput(input);
        if (typeof value.issueId !== 'string') throw new Error('issueId is required.');
        const issue = stateRef.current.issues.find((item) => item.id === value.issueId);
        if (!issue) throw new Error('Issue is not open in the current plan.');
        actionsRef.current.focusIssue(issue.id);
        return { focused: issue.id, title: issue.title };
      },
    });

    register({
      name: 'stage_route_improvement',
      title: 'Stage route improvement',
      description: 'Stage a visible, reversible layout proposal that improves the primary route while respecting locked objects and seat capacity.',
      inputSchema: {
        type: 'object',
        properties: { minimumSeats: { type: 'integer', minimum: 1, description: 'Minimum seat capacity the proposal must preserve.' } },
        required: ['minimumSeats'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const value = objectInput(input);
        if (typeof value.minimumSeats !== 'number') throw new Error('minimumSeats must be a number.');
        return actionsRef.current.stageProposal(value.minimumSeats);
      },
    });

    register({
      name: 'compare_plan_versions',
      title: 'Compare plan versions',
      description: 'Open the visual comparison and return before-and-after route metrics for the staged or applied plan.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        const current = stateRef.current;
        if (current.phase === 'baseline') throw new Error('Stage a route improvement before comparing plans.');
        actionsRef.current.showComparison();
        return { comparisonVisible: true, current: current.metrics };
      },
    });

    register({
      name: 'undo_plan_change',
      title: 'Undo plan change',
      description: 'Restore the venue to its original floor plan and make the change visible immediately.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        if (stateRef.current.phase === 'baseline') throw new Error('The plan is already at its original version.');
        actionsRef.current.undo();
        return { restored: true, venue: stateRef.current.venueName };
      },
    });

    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (state.phase !== 'staged' || !context?.registerTool) return;
    const lifecycle = new AbortController();
    const applyTool: ToolDefinition = {
      name: 'apply_staged_plan',
      title: 'Apply staged plan',
      description: 'Commit the currently visible staged layout after the user has reviewed its changes and metrics.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => {
        if (stateRef.current.phase !== 'staged') throw new Error('There is no staged plan to apply.');
        const venue = stateRef.current.venueName;
        actionsRef.current.applyProposal();
        return { applied: true, venue, undoAvailable: true };
      },
    };
    try {
      void Promise.resolve(context.registerTool(applyTool, { signal: lifecycle.signal })).catch((error: unknown) => {
        console.error('Failed to register apply_staged_plan', error);
      });
    } catch (error) {
      console.error('Failed to register apply_staged_plan', error);
    }
    return () => lifecycle.abort();
  }, [state.phase]);
}
