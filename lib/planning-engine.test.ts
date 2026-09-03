import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS,
  auditPlan,
  createClassroomPlan,
  generateRouteAlternatives,
  isValidPlan,
  planCapacity,
  pointSegmentDistance,
  rectsOverlap,
  segmentIntersectsRect,
  segmentsIntersect,
  toggleObjectLock,
} from './planning-engine';

describe('computational geometry', () => {
  it('detects segment intersection, distance, and rectangle collisions', () => {
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ),
    ).toBe(true);
    expect(
      segmentIntersectsRect(
        { x: 0, y: 5 },
        { x: 20, y: 5 },
        { x: 8, y: 2, width: 4, height: 6 },
      ),
    ).toBe(true);
    expect(
      pointSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(5);
  });
});

describe('classroom model invariants', () => {
  it('has a physically valid, non-overlapping baseline with useful overlap diagnostics', () => {
    const plan = createClassroomPlan();
    const overlaps: string[] = [];
    for (let first = 0; first < plan.objects.length; first += 1) {
      for (let second = first + 1; second < plan.objects.length; second += 1) {
        const a = plan.objects[first];
        const b = plan.objects[second];
        if (a.active && b.active && rectsOverlap(a, b))
          overlaps.push(`${a.id} overlaps ${b.id}`);
      }
    }
    expect(
      overlaps,
      `Overlapping active object pairs:\n${overlaps.join('\n')}`,
    ).toEqual([]);
    expect(isValidPlan(createClassroomPlan())).toBe(true);
  });

  it('connects the entrance to the destination and only contacts destination geometry terminally', () => {
    const plan = createClassroomPlan();
    expect(plan.route[0]).toEqual(plan.entrance);
    expect(plan.route.at(-1)).toEqual(plan.destination);
    const destination = plan.objects.find(
      (object) => object.kind === 'destination',
    )!;
    for (let index = 1; index < plan.route.length - 1; index += 1) {
      expect(
        segmentIntersectsRect(
          plan.route[index - 1],
          plan.route[index],
          destination,
        ),
      ).toBe(false);
    }
    expect(
      segmentIntersectsRect(
        plan.route.at(-2)!,
        plan.route.at(-1)!,
        destination,
      ),
    ).toBe(true);
  });

  it('keeps every required zone inside the usable plan boundary', () => {
    const plan = createClassroomPlan();
    for (const zone of plan.doorZones) {
      expect(zone.x).toBeGreaterThanOrEqual(20);
      expect(zone.y).toBeGreaterThanOrEqual(20);
      expect(zone.x + zone.width).toBeLessThanOrEqual(plan.width - 20);
      expect(zone.y + zone.height).toBeLessThanOrEqual(plan.height - 20);
    }
    for (const zone of plan.turningZones) {
      expect(zone.center.x - zone.radius).toBeGreaterThanOrEqual(20);
      expect(zone.center.y - zone.radius).toBeGreaterThanOrEqual(20);
      expect(zone.center.x + zone.radius).toBeLessThanOrEqual(plan.width - 20);
      expect(zone.center.y + zone.radius).toBeLessThanOrEqual(plan.height - 20);
    }
  });
});

describe('geometry-derived audit', () => {
  it('detects every corridor intrusion even when no object intersects the centerline', () => {
    const audit = auditPlan(createClassroomPlan());
    const corridorIssues = audit.issues.filter(
      (issue) => issue.type === 'route-corridor',
    );
    expect(corridorIssues.map((issue) => issue.objectId)).toEqual([
      'desk-1',
      'desk-2',
      'desk-3',
    ]);
    expect(audit.issues.some((issue) => issue.type === 'route-blocked')).toBe(
      false,
    );
    expect(audit.metrics.minimumCenterlineClearanceCm).toBeGreaterThan(0);
    expect(audit.metrics.minimumClearWidthCm).toBeLessThan(
      THRESHOLDS.requiredClearWidthCm,
    );
  });

  it('reports stable issue IDs and deterministic metrics', () => {
    const plan = createClassroomPlan();
    expect(auditPlan(plan, plan)).toEqual(auditPlan(plan, plan));
  });

  it('excludes inactive objects from capacity, collisions, and route conflicts', () => {
    const plan = createClassroomPlan();
    const desk = plan.objects.find((object) => object.id === 'desk-1')!;
    desk.active = false;
    desk.x = plan.objects.find((object) => object.id === 'desk-2')!.x;
    desk.y = plan.objects.find((object) => object.id === 'desk-2')!.y;
    expect(isValidPlan(plan)).toBe(true);
    expect(planCapacity(plan)).toBe(22);
    expect(
      auditPlan(plan).issues.some((issue) => issue.objectId === desk.id),
    ).toBe(false);
  });
});

describe('bounded proposal search', () => {
  it('coordinates at least three changes and clears all critical issues when feasible', () => {
    const plan = createClassroomPlan();
    const top = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3)[0];
    expect(top.changes.length).toBeGreaterThanOrEqual(3);
    expect(top.status).toBe('threshold-satisfied');
    expect(top.after.metrics.criticalIssues).toBe(0);
    expect(top.after.metrics.minimumClearWidthCm).toBeGreaterThanOrEqual(
      THRESHOLDS.requiredClearWidthCm,
    );
    expect(top.after.metrics.capacity).toBeGreaterThanOrEqual(24);
    expect(isValidPlan(top.proposedPlan)).toBe(true);
  });

  it('returns distinct deterministic alternatives with recalculated metrics', () => {
    const plan = createClassroomPlan();
    const first = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    const second = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    expect(first).toEqual(second);
    expect(
      new Set(first.map((proposal) => JSON.stringify(proposal.changes))).size,
    ).toBe(first.length);
    for (const proposal of first) {
      expect(proposal.after.metrics).toEqual(
        auditPlan(proposal.proposedPlan, plan).metrics,
      );
      expect(isValidPlan(proposal.proposedPlan)).toBe(true);
    }
  });

  it('completes inside its explicit state bound in reasonable time', () => {
    const start = performance.now();
    const proposals = generateRouteAlternatives(
      createClassroomPlan(),
      { minimumCapacity: 24 },
      3,
      {
        maxEvaluatedStates: 500,
      },
    );
    expect(performance.now() - start).toBeLessThan(2_000);
    expect(proposals).toHaveLength(3);
  });

  it('never changes locked objects', () => {
    const plan = createClassroomPlan();
    const lockedBefore = plan.objects.filter((object) => object.locked);
    for (const proposal of generateRouteAlternatives(
      plan,
      { minimumCapacity: 24 },
      3,
    )) {
      for (const locked of lockedBefore) {
        expect(
          proposal.proposedPlan.objects.find(
            (object) => object.id === locked.id,
          ),
        ).toEqual(locked);
      }
    }
  });

  it('makes minimum capacity materially alter valid top-ranked changes', () => {
    const plan = createClassroomPlan();
    const fullCapacity = generateRouteAlternatives(
      plan,
      { minimumCapacity: 24 },
      3,
    );
    const reducedCapacity = generateRouteAlternatives(
      plan,
      { minimumCapacity: 22 },
      3,
    );
    expect(
      fullCapacity.every((proposal) => proposal.after.metrics.capacity === 24),
    ).toBe(true);
    expect(
      fullCapacity.every((proposal) =>
        proposal.changes.every((change) => change.type === 'move'),
      ),
    ).toBe(true);
    expect(reducedCapacity[0].after.metrics.capacity).toBe(22);
    expect(
      reducedCapacity[0].changes.some((change) => change.type === 'remove'),
    ).toBe(true);
    expect(reducedCapacity[0].tradeoffs.join(' ')).toContain(
      'Capacity decreases',
    );
    const restored = generateRouteAlternatives(
      reducedCapacity[0].proposedPlan,
      { minimumCapacity: 24 },
      1,
    )[0];
    expect(restored.changes.some((change) => change.type === 'restore')).toBe(
      true,
    );
    expect(restored.after.metrics.capacity).toBe(24);
    expect(restored.status).toBe('threshold-satisfied');
  });

  it('labels bounded incomplete results as partial improvements', () => {
    const proposals = generateRouteAlternatives(
      createClassroomPlan(),
      { minimumCapacity: 24 },
      3,
      {
        maxDepth: 2,
      },
    );
    expect(
      proposals.every((proposal) => proposal.status === 'partial-improvement'),
    ).toBe(true);
    expect(
      proposals.every((proposal) => proposal.after.metrics.criticalIssues > 0),
    ).toBe(true);
  });

  it('fails safely for impossible capacity and immovable obstructions', () => {
    const plan = createClassroomPlan();
    const snapshot = structuredClone(plan);
    expect(() =>
      generateRouteAlternatives(plan, { minimumCapacity: 25 }),
    ).toThrow('exceeds the current capacity');
    let locked = plan;
    for (const id of ['desk-1', 'desk-2', 'desk-3'])
      locked = toggleObjectLock(locked, id, true);
    expect(() =>
      generateRouteAlternatives(locked, { minimumCapacity: 24 }),
    ).toThrow('No improving proposal');
    expect(plan).toEqual(snapshot);
  });
});
