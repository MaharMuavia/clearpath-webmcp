import { describe, expect, it } from 'vitest';
import { createClassroomPlan } from './planning-engine';
import { applyStagedProposal, createPlanningSession, generateAlternatives, rejectStagedProposal, stageProposal, undoLastChange, type EventFactory } from './planning-session';

let sequence = 0;
const events: EventFactory = (event) => ({ ...event, id: `event-${++sequence}`, timestamp: `2026-01-01T00:00:${String(sequence).padStart(2, '0')}Z` });

describe('versioned planning session', () => {
  it('stages exact metrics, applies only the staged proposal, and undoes exact geometry', () => {
    const initial = createPlanningSession(createClassroomPlan(), events); const original = structuredClone(initial.committed);
    const generated = generateAlternatives(initial, 'agent', events); const proposal = generated.alternatives[0];
    const staged = stageProposal(generated, proposal.id, 'agent', events);
    expect(staged.staged?.after.metrics).toEqual(proposal.after.metrics);
    const applied = applyStagedProposal(staged, proposal.id, 'human', events);
    expect(applied.committed).toEqual(proposal.proposedPlan);
    expect(() => applyStagedProposal(applied, proposal.id, 'human', events)).toThrow('rejected, stale');
    expect(undoLastChange(applied, 'human', events).committed).toEqual(original);
  });

  it('rejects a proposal without changing committed geometry', () => {
    const initial = createPlanningSession(createClassroomPlan(), events); const generated = generateAlternatives(initial, 'agent', events);
    const staged = stageProposal(generated, generated.alternatives[0].id, 'agent', events); const committed = structuredClone(staged.committed);
    expect(rejectStagedProposal(staged, 'human', events).committed).toEqual(committed);
  });
});
