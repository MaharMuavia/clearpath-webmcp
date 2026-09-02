import { describe, expect, it, vi } from 'vitest';
import { createClassroomPlan } from '@/lib/planning-engine';
import { createPlanningSession, generateAlternatives, stageProposal } from '@/lib/planning-session';
import { buildToolDefinitions } from './use-clearpath-tools';

const noops = { focusIssue: vi.fn(), setConstraints: vi.fn(), generateAlternatives: vi.fn(), stageProposal: vi.fn(), requestApproval: vi.fn(), rejectProposal: vi.fn(), undo: vi.fn() };
describe('WebMCP contracts', () => {
  it('registers studio tools dynamically and validates execution inputs', () => {
    const baseline = createPlanningSession(createClassroomPlan()); const baseTools = buildToolDefinitions(baseline, noops);
    expect(baseTools.some((tool) => tool.name === 'apply_staged_plan')).toBe(false);
    const generated = generateAlternatives(baseline, 'agent'); const staged = stageProposal(generated, generated.alternatives[0].id, 'agent');
    const tools = buildToolDefinitions(staged, noops); expect(tools.some((tool) => tool.name === 'apply_staged_plan')).toBe(true);
    expect(() => tools.find((tool) => tool.name === 'get_plan_summary')!.execute({ extra: true })).toThrow('Unexpected input');
    expect(tools.find((tool) => tool.name === 'compare_plan_versions')!.execute({ proposalId: staged.staged!.id })).toMatchObject({ before: staged.staged!.before.metrics, after: staged.staged!.after.metrics, movements: staged.staged!.movements });
  });
});
