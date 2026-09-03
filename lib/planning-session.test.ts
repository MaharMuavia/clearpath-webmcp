import { beforeEach, describe, expect, it } from 'vitest';
import { createClassroomPlan, toggleObjectLock } from './planning-engine';
import {
  applyStagedProposal,
  createPlanningSession,
  generateAlternatives,
  proposalIsCurrent,
  rejectStagedProposal,
  requestProposalApproval,
  setConstraints,
  setObjectLock,
  stageProposal,
  undoLastChange,
  type EventFactory,
  type PlanningSession,
} from './planning-session';
import type { FloorPlan } from './planning-engine';

let sequence = 0;
const events: EventFactory = (event) => ({
  ...event,
  id: `event-${++sequence}`,
  timestamp: `2026-01-01T00:00:${String(sequence).padStart(2, '0')}Z`,
});

function generatedSession(): PlanningSession {
  return generateAlternatives(
    createPlanningSession(createClassroomPlan(), events),
    'agent',
    events,
  );
}

describe('versioned planning session', () => {
  beforeEach(() => {
    sequence = 0;
  });

  it('records an agent approval request without committing geometry', () => {
    const generated = generatedSession();
    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
      events,
    );
    const committed = structuredClone(staged.committed);
    const requested = requestProposalApproval(
      staged,
      staged.staged!.id,
      events,
    );
    expect(requested.committed).toEqual(committed);
    expect(requested.history.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'approval_requested',
      proposalId: staged.staged!.id,
      beforeVersionId: staged.committed.versionId,
      afterVersionId: staged.staged!.proposedPlan.versionId,
      result: 'successful',
    });
  });

  it('applies only by a separate human action and undoes exact full state', () => {
    const initial = createPlanningSession(createClassroomPlan(), events);
    const original = structuredClone(initial.committed);
    const generated = generateAlternatives(initial, 'agent', events);
    const proposal = generated.alternatives[0];
    const staged = stageProposal(generated, proposal.id, 'agent', events);
    const applied = applyStagedProposal(staged, proposal.id, 'human', events);
    expect(applied.committed).toEqual(proposal.proposedPlan);
    expect(applied.history.at(-1)).toMatchObject({
      actor: 'human',
      action: 'proposal_applied',
    });
    expect(() =>
      applyStagedProposal(applied, proposal.id, 'human', events),
    ).toThrow('rejected, stale');
    const restored = undoLastChange(applied, 'human', events);
    expect(restored.history.at(-1)).toMatchObject({
      actor: 'human',
      action: 'plan_change_undone',
    });
    expect(restored.committed).toEqual(original);
    expect(restored.alternatives).toEqual([]);
    expect(restored.staged).toBeNull();
    expect(() =>
      stageProposal(
        { ...restored, alternatives: [proposal] },
        proposal.id,
        'agent',
        events,
      ),
    ).toThrow('unavailable or stale');
  });

  it('enforces the human approval boundary at runtime', () => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const staged = stageProposal(generated, proposal.id, 'agent', events);
    expect(() =>
      applyStagedProposal(
        staged,
        proposal.id,
        'agent' as unknown as 'human',
        events,
      ),
    ).toThrow('Only a visible human approval action');
    expect(staged.committed.versionId).toBe('north-hall-v1');
  });

  it('makes undo available only while an approved snapshot exists', () => {
    const initial = createPlanningSession(createClassroomPlan(), events);
    expect(() => undoLastChange(initial, 'human', events)).toThrow(
      'There is no applied change to undo',
    );
    const generated = generateAlternatives(initial, 'agent', events);
    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
      events,
    );
    const applied = applyStagedProposal(
      staged,
      staged.staged!.id,
      'human',
      events,
    );
    expect(applied.undoStack).toHaveLength(1);
    const undone = undoLastChange(applied, 'human', events);
    expect(undone.undoStack).toHaveLength(0);
    expect(() => undoLastChange(undone, 'human', events)).toThrow(
      'There is no applied change to undo',
    );
  });

  it('undo restores removed activity, capacity, locks, and coordinates exactly', () => {
    const constrained = setConstraints(
      createPlanningSession(createClassroomPlan(), events),
      { minimumCapacity: 22 },
      'human',
      events,
    );
    const generated = generateAlternatives(constrained, 'agent', events);
    const removal = generated.alternatives.find((proposal) =>
      proposal.changes.some((change) => change.type === 'remove'),
    )!;
    const original = structuredClone(generated.committed);
    const applied = applyStagedProposal(
      stageProposal(generated, removal.id, 'agent', events),
      removal.id,
      'human',
      events,
    );
    expect(applied.committed.objects.some((object) => !object.active)).toBe(
      true,
    );
    expect(undoLastChange(applied, 'human', events).committed).toEqual(
      original,
    );
  });

  it('rejects and invalidates every generated proposal without changing committed geometry', () => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const staged = stageProposal(generated, proposal.id, 'agent', events);
    const committed = structuredClone(staged.committed);
    const rejected = rejectStagedProposal(staged, 'human', events);
    expect(rejected.history.at(-1)).toMatchObject({
      actor: 'human',
      action: 'proposal_rejected',
    });
    expect(rejected.committed).toEqual(committed);
    expect(rejected.alternatives).toEqual([]);
    expect(() => stageProposal(rejected, proposal.id, 'agent', events)).toThrow(
      'unavailable or stale',
    );
  });

  it('invalidates stale proposals after a lock change even if alternatives are retained externally', () => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const changed = setObjectLock(generated, 'desk-8', true, 'human', events);
    expect(changed.alternatives).toEqual([]);
    const tampered = { ...changed, alternatives: [proposal] };
    expect(() => stageProposal(tampered, proposal.id, 'agent', events)).toThrow(
      'unavailable or stale',
    );
  });

  it('invalidates stale proposals after a capacity change', () => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const changed = setConstraints(
      generated,
      { minimumCapacity: 22 },
      'human',
      events,
    );
    expect(changed.staged).toBeNull();
    expect(changed.alternatives).toEqual([]);
    expect(() =>
      stageProposal(
        { ...changed, alternatives: [proposal] },
        proposal.id,
        'agent',
        events,
      ),
    ).toThrow('unavailable or stale');
  });

  it('rejects stale proposals after committed geometry changes', () => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const changedGeometry = structuredClone(generated.committed);
    changedGeometry.objects.find((object) => object.id === 'desk-8')!.x += 10;
    expect(() =>
      stageProposal(
        { ...generated, committed: changedGeometry },
        proposal.id,
        'agent',
        events,
      ),
    ).toThrow('unavailable or stale');
  });

  it.each([
    ['dimensions', (plan: FloorPlan) => void (plan.height += 1)],
    ['wall', (plan: FloorPlan) => void (plan.walls[0].end.x += 1)],
    ['entrance', (plan: FloorPlan) => void (plan.entrance.x += 1)],
    ['destination', (plan: FloorPlan) => void (plan.destination.x += 1)],
    ['route', (plan: FloorPlan) => void (plan.route[1].y += 1)],
    ['object size', (plan: FloorPlan) => void (plan.objects[1].width += 1)],
    [
      'turning zone',
      (plan: FloorPlan) => void (plan.turningZones[0].radius += 1),
    ],
    ['door zone', (plan: FloorPlan) => void (plan.doorZones[0].height += 1)],
  ])('invalidates proposals after a %s context change', (_name, mutate) => {
    const generated = generatedSession();
    const proposal = generated.alternatives[0];
    const committed = structuredClone(generated.committed);
    mutate(committed);
    expect(proposalIsCurrent({ ...generated, committed }, proposal)).toBe(
      false,
    );
  });

  it('a failed search preserves committed geometry and constraints', () => {
    let initial = createPlanningSession(createClassroomPlan(), events);
    for (const id of ['desk-1', 'desk-2', 'desk-3']) {
      initial = {
        ...initial,
        committed: toggleObjectLock(initial.committed, id, true),
      };
    }
    const committed = structuredClone(initial.committed);
    try {
      generateAlternatives(initial, 'agent', events);
      throw new Error('Expected proposal generation to fail.');
    } catch (error) {
      const failed = (error as Error & { session: PlanningSession }).session;
      expect(failed.committed).toEqual(committed);
      expect(failed.constraints).toEqual(initial.constraints);
      expect(failed.history.at(-1)?.result).toBe('failed');
    }
  });

  it('records chronological system, agent, and human actions', () => {
    const generated = generatedSession();
    const staged = stageProposal(
      generated,
      generated.alternatives[0].id,
      'agent',
      events,
    );
    const applied = applyStagedProposal(
      staged,
      staged.staged!.id,
      'human',
      events,
    );
    expect(applied.history.map((event) => event.actor)).toEqual([
      'system',
      'agent',
      'agent',
      'human',
    ]);
    const timestamps = applied.history.map((event) => event.timestamp);
    expect(timestamps).toEqual(timestamps.toSorted());
  });
});
