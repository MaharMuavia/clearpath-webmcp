import {
  auditPlan,
  generateRouteAlternatives,
  proposalContextFingerprint,
  toggleObjectLock,
  type AuditActor,
  type AuditEvent,
  type FloorPlan,
  type PlanningConstraints,
  type RouteProposal,
} from './planning-engine';

export type PlanningSession = {
  baseline: FloorPlan;
  committed: FloorPlan;
  staged: RouteProposal | null;
  alternatives: RouteProposal[];
  constraints: PlanningConstraints;
  history: AuditEvent[];
  undoStack: FloorPlan[];
  revision: number;
};

export type EventFactory = (
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
) => AuditEvent;
export const browserEventFactory: EventFactory = (event) => ({
  ...event,
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
});

export function createPlanningSession(
  plan: FloorPlan,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  return {
    baseline: structuredClone(plan),
    committed: structuredClone(plan),
    staged: null,
    alternatives: [],
    constraints: { minimumCapacity: 24 },
    undoStack: [],
    revision: 0,
    history: [
      factory({
        actor: 'system',
        action: 'plan_opened',
        planId: plan.id,
        summary: `${plan.name} opened at ${plan.versionId}.`,
        afterVersionId: plan.versionId,
        result: 'successful',
      }),
    ],
  };
}

function record(
  session: PlanningSession,
  factory: EventFactory,
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
): PlanningSession {
  return { ...session, history: [...session.history, factory(event)] };
}

export function proposalIsCurrent(
  session: PlanningSession,
  proposal: RouteProposal,
): boolean {
  return (
    proposal.baselineVersionId === session.committed.versionId &&
    proposal.sessionRevision === session.revision &&
    proposal.contextFingerprint ===
      proposalContextFingerprint(session.committed, session.constraints)
  );
}

export function setConstraints(
  session: PlanningSession,
  constraints: PlanningConstraints,
  actor: AuditActor,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  if (
    !Number.isInteger(constraints.minimumCapacity) ||
    constraints.minimumCapacity < 0
  )
    throw new Error('Minimum capacity must be a non-negative whole number.');
  return record(
    {
      ...session,
      constraints,
      staged: null,
      alternatives: [],
      revision: session.revision + 1,
    },
    factory,
    {
      actor,
      action: 'constraints_updated',
      planId: session.committed.id,
      summary: `Minimum capacity set to ${constraints.minimumCapacity}; prior proposals invalidated.`,
      beforeVersionId: session.committed.versionId,
      afterVersionId: session.committed.versionId,
      result: 'successful',
    },
  );
}

export function setObjectLock(
  session: PlanningSession,
  objectId: string,
  locked: boolean,
  actor: AuditActor,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  const committed = toggleObjectLock(session.committed, objectId, locked);
  return record(
    {
      ...session,
      committed,
      staged: null,
      alternatives: [],
      revision: session.revision + 1,
    },
    factory,
    {
      actor,
      action: locked ? 'object_locked' : 'object_unlocked',
      planId: committed.id,
      summary: `${objectId} ${locked ? 'locked' : 'unlocked'} by the human; prior proposals invalidated.`,
      beforeVersionId: session.committed.versionId,
      afterVersionId: committed.versionId,
      result: 'successful',
    },
  );
}

export function generateAlternatives(
  session: PlanningSession,
  actor: AuditActor,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  try {
    const alternatives = generateRouteAlternatives(
      session.committed,
      session.constraints,
      3,
    ).map((proposal) => ({ ...proposal, sessionRevision: session.revision }));
    return record({ ...session, alternatives, staged: null }, factory, {
      actor,
      action: 'alternatives_generated',
      planId: session.committed.id,
      summary: `${alternatives.length} ranked route alternatives generated from ${session.committed.versionId} under context ${alternatives[0].contextFingerprint}.`,
      beforeVersionId: session.committed.versionId,
      afterVersionId: session.committed.versionId,
      result: 'successful',
    });
  } catch (error) {
    const failed = record(
      { ...session, alternatives: [], staged: null },
      factory,
      {
        actor,
        action: 'alternatives_generated',
        planId: session.committed.id,
        summary:
          error instanceof Error
            ? error.message
            : 'Proposal generation failed.',
        beforeVersionId: session.committed.versionId,
        afterVersionId: session.committed.versionId,
        result: 'failed',
      },
    );
    throw Object.assign(
      error instanceof Error ? error : new Error('Proposal generation failed.'),
      {
        session: failed,
      },
    );
  }
}

export function stageProposal(
  session: PlanningSession,
  proposalId: string,
  actor: AuditActor,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  const proposal = session.alternatives.find((item) => item.id === proposalId);
  if (!proposal || !proposalIsCurrent(session, proposal))
    throw new Error(
      'Proposal is unavailable or stale. Generate alternatives again.',
    );
  return record({ ...session, staged: proposal }, factory, {
    actor,
    action: 'proposal_staged',
    planId: session.committed.id,
    proposalId,
    summary: `${proposal.changes.length} exact change(s) staged for review; committed geometry is unchanged.`,
    beforeVersionId: session.committed.versionId,
    afterVersionId: proposal.proposedPlan.versionId,
    result: 'successful',
  });
}

export function requestProposalApproval(
  session: PlanningSession,
  proposalId: string,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  if (
    !session.staged ||
    session.staged.id !== proposalId ||
    !proposalIsCurrent(session, session.staged)
  )
    throw new Error('The staged proposal is stale, rejected, or unavailable.');
  return record(session, factory, {
    actor: 'agent',
    action: 'approval_requested',
    planId: session.committed.id,
    proposalId,
    summary: `Agent requested visible human review of ${proposalId}; no geometry was committed.`,
    beforeVersionId: session.committed.versionId,
    afterVersionId: session.staged.proposedPlan.versionId,
    result: 'successful',
  });
}

export function applyStagedProposal(
  session: PlanningSession,
  proposalId: string,
  actor: 'human',
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  if (
    !session.staged ||
    session.staged.id !== proposalId ||
    !proposalIsCurrent(session, session.staged)
  )
    throw new Error(
      'The proposal is rejected, stale, or not currently staged.',
    );
  const before = structuredClone(session.committed);
  const committed = structuredClone(session.staged.proposedPlan);
  return record(
    {
      ...session,
      committed,
      staged: null,
      alternatives: [],
      undoStack: [...session.undoStack, before],
      revision: session.revision + 1,
    },
    factory,
    {
      actor,
      action: 'proposal_applied',
      planId: committed.id,
      proposalId,
      summary: `Human approved and applied ${proposalId}.`,
      beforeVersionId: before.versionId,
      afterVersionId: committed.versionId,
      result: 'successful',
    },
  );
}

export function rejectStagedProposal(
  session: PlanningSession,
  actor: AuditActor,
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  if (!session.staged)
    throw new Error('There is no staged proposal to reject.');
  const proposal = session.staged;
  return record(
    {
      ...session,
      staged: null,
      alternatives: [],
      revision: session.revision + 1,
    },
    factory,
    {
      actor,
      action: 'proposal_rejected',
      planId: session.committed.id,
      proposalId: proposal.id,
      summary: `${proposal.id} rejected; committed geometry unchanged and prior proposals invalidated.`,
      beforeVersionId: session.committed.versionId,
      afterVersionId: session.committed.versionId,
      result: 'rejected',
    },
  );
}

export function undoLastChange(
  session: PlanningSession,
  actor: 'human',
  factory: EventFactory = browserEventFactory,
): PlanningSession {
  const restored = session.undoStack.at(-1);
  if (!restored) throw new Error('There is no applied change to undo.');
  const before = session.committed;
  return record(
    {
      ...session,
      committed: structuredClone(restored),
      staged: null,
      alternatives: [],
      undoStack: session.undoStack.slice(0, -1),
      revision: session.revision + 1,
    },
    factory,
    {
      actor,
      action: 'plan_change_undone',
      planId: restored.id,
      summary: `Restored exact geometry, activity state, capacity, and locks for ${restored.versionId}; prior proposals invalidated.`,
      beforeVersionId: before.versionId,
      afterVersionId: restored.versionId,
      result: 'undone',
    },
  );
}

export function visiblePlan(session: PlanningSession): FloorPlan {
  return session.staged?.proposedPlan ?? session.committed;
}
export function visibleAudit(session: PlanningSession) {
  return auditPlan(visiblePlan(session), session.baseline);
}
