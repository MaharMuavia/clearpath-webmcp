import { describe, expect, it, vi } from 'vitest';
import { createClassroomPlan } from '@/lib/planning-engine';
import {
  applyStagedProposal,
  createPlanningSession,
  generateAlternatives,
  rejectStagedProposal,
  stageProposal,
  undoLastChange,
  type PlanningSession,
} from '@/lib/planning-session';
import { buildToolDefinitions } from './use-clearpath-tools';

function actions(session: PlanningSession) {
  return {
    focusIssue: vi.fn(),
    setConstraints: vi.fn(() => session),
    generateAlternatives: vi.fn(() => session),
    stageProposal: vi.fn(() => session),
    requestApproval: vi.fn(() => session),
    rejectProposal: vi.fn(() => session),
    undo: vi.fn(() => session),
  };
}
const names = (session: PlanningSession) =>
  buildToolDefinitions(session, actions(session))
    .map((tool) => tool.name)
    .sort();

describe('WebMCP contracts', () => {
  it('exposes the exact state-aware tool surface', () => {
    const baseline = createPlanningSession(createClassroomPlan());
    expect(names(baseline)).toEqual(
      [
        'audit_access_routes',
        'focus_audit_issue',
        'generate_route_alternatives',
        'get_audit_history',
        'get_plan_geometry',
        'get_plan_summary',
        'set_planning_constraints',
      ].sort(),
    );

    const generated = generateAlternatives(baseline, 'agent');
    expect(names(generated)).toEqual(
      [
        ...names(baseline),
        'compare_plan_versions',
        'stage_route_proposal',
      ].sort(),
    );

    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
    );
    expect(names(staged)).toEqual(
      [...names(generated), 'apply_staged_plan', 'reject_staged_plan'].sort(),
    );

    const applied = applyStagedProposal(staged, staged.staged!.id, 'human');
    expect(names(applied)).toEqual(
      [...names(baseline), 'undo_plan_change'].sort(),
    );
    expect(names(undoLastChange(applied, 'human'))).toEqual(names(baseline));
    expect(names(rejectStagedProposal(staged, 'human'))).toEqual(
      names(baseline),
    );
  });

  it('returns explicit status and changes and validates execution inputs', () => {
    const baseline = createPlanningSession(createClassroomPlan());
    const generated = generateAlternatives(baseline, 'agent');
    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
    );
    const tools = buildToolDefinitions(staged, actions(staged));
    expect(() =>
      tools
        .find((tool) => tool.name === 'get_plan_summary')!
        .execute({ extra: true }),
    ).toThrow('Unexpected input');
    expect(
      tools
        .find((tool) => tool.name === 'compare_plan_versions')!
        .execute({ proposalId: staged.staged!.id }),
    ).toMatchObject({
      status: staged.staged!.status,
      before: staged.staged!.before.metrics,
      after: staged.staged!.after.metrics,
      changes: staged.staged!.changes,
    });
  });

  it('keeps apply as an approval request that cannot commit geometry', () => {
    const baseline = createPlanningSession(createClassroomPlan());
    const generated = generateAlternatives(baseline, 'agent');
    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
    );
    const toolActions = actions(staged);
    const apply = buildToolDefinitions(staged, toolActions).find(
      (tool) => tool.name === 'apply_staged_plan',
    )!;
    expect(apply.execute({ proposalId: staged.staged!.id })).toMatchObject({
      approvalRequired: true,
      committed: false,
    });
    expect(toolActions.requestApproval).toHaveBeenCalledWith(staged.staged!.id);
  });
});
