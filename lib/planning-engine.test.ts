import { describe, expect, it } from 'vitest';
import {
  THRESHOLDS,
  auditPlan,
  createClassroomPlan,
  distanceFromRouteToDestination,
  distanceFromRouteToWalls,
  exactGeometry,
  generateRouteAlternatives,
  hasValidTerminalDestinationContact,
  isValidPlan,
  planCapacity,
  pointSegmentDistance,
  proposalContextFingerprint,
  rectsOverlap,
  segmentIntersectsRect,
  segmentRectDistance,
  segmentSegmentDistance,
  segmentsIntersect,
  toggleObjectLock,
  validatePlan,
  type FloorPlan,
} from './planning-engine';

const destinationObject = (plan: FloorPlan) =>
  plan.objects.find((object) => object.kind === 'destination')!;

function coordinatedFixture(): FloorPlan {
  const plan = createClassroomPlan();
  plan.objects = plan.objects.filter(
    (object) =>
      object.kind === 'destination' ||
      ['desk-1', 'desk-2', 'desk-3'].includes(object.id),
  );
  for (const desk of plan.objects.filter((object) => object.kind === 'desk')) {
    desk.y = 200;
    desk.locked = false;
  }
  return plan;
}

describe('computational geometry', () => {
  it('detects crossing and collinear segment intersection', () => {
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ),
    ).toBe(true);
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
        { x: 15, y: 0 },
      ),
    ).toBe(true);
  });

  it('calculates point, segment, rectangle, and wall distance', () => {
    expect(
      pointSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(5);
    expect(
      segmentSegmentDistance(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 8 },
        { x: 10, y: 8 },
      ),
    ).toBe(8);
    expect(
      segmentRectDistance(
        { x: 0, y: 5 },
        { x: 5, y: 5 },
        { x: 8, y: 2, width: 4, height: 6 },
      ),
    ).toBe(3);
    expect(distanceFromRouteToWalls(createClassroomPlan())).toBeGreaterThan(45);
  });

  it('detects rectangle intersection and strict object overlap', () => {
    expect(
      segmentIntersectsRect(
        { x: 0, y: 5 },
        { x: 20, y: 5 },
        { x: 8, y: 2, width: 4, height: 6 },
      ),
    ).toBe(true);
    expect(
      rectsOverlap(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 0, width: 10, height: 10 },
      ),
    ).toBe(false);
  });
});

describe('destination-aware route geometry', () => {
  it('connects the entrance to the destination through perpendicular terminal contact', () => {
    const plan = createClassroomPlan();
    expect(plan.route[0]).toEqual(plan.entrance);
    expect(plan.route.at(-1)).toEqual(plan.destination);
    expect(
      hasValidTerminalDestinationContact(plan, destinationObject(plan)),
    ).toBe(true);
    expect(
      segmentIntersectsRect(
        plan.route.at(-2)!,
        plan.route.at(-1)!,
        destinationObject(plan),
      ),
    ).toBe(true);
    expect(distanceFromRouteToDestination(plan, destinationObject(plan))).toBe(
      THRESHOLDS.routeHalfWidthCm,
    );
  });

  it('audits destination geometry beside non-terminal route segments', () => {
    const plan = createClassroomPlan();
    plan.route = [
      plan.entrance,
      { x: 150, y: 520 },
      { x: 150, y: 105 },
      { x: 710, y: 105 },
      plan.destination,
    ];
    expect(distanceFromRouteToDestination(plan, destinationObject(plan))).toBe(
      12,
    );
    expect(auditPlan(plan).issues).toContainEqual(
      expect.objectContaining({
        id: 'route-corridor:presentation-wall',
        measuredCm: 24,
      }),
    );
  });

  it('does not exempt a parallel or penetrating final segment', () => {
    const plan = createClassroomPlan();
    plan.route = [plan.entrance, { x: 760, y: 93 }, plan.destination];
    expect(
      hasValidTerminalDestinationContact(plan, destinationObject(plan)),
    ).toBe(false);
    expect(auditPlan(plan).issues).toContainEqual(
      expect.objectContaining({
        id: 'route-blocked:presentation-wall',
        measuredCm: 0,
      }),
    );
  });

  it('prevents threshold claims when immutable destination geometry obstructs the corridor', () => {
    const plan = createClassroomPlan();
    plan.route = [
      plan.entrance,
      { x: 150, y: 520 },
      { x: 150, y: 105 },
      { x: 710, y: 105 },
      plan.destination,
    ];
    const proposals = generateRouteAlternatives(plan, { minimumCapacity: 24 });
    expect(
      proposals.every(
        (proposal) =>
          proposal.status === 'partial-improvement' &&
          proposal.remainingIssueIds.includes(
            'route-corridor:presentation-wall',
          ),
      ),
    ).toBe(true);
  });

  it('uses the same route and destination geometry in structured output', () => {
    const plan = createClassroomPlan();
    expect(exactGeometry(plan)).toMatchObject({
      route: plan.route,
      destination: plan.destination,
      objects: expect.arrayContaining([
        expect.objectContaining({
          id: 'presentation-wall',
          kind: 'destination',
        }),
      ]),
    });
  });
});

describe('plan validation and audit zones', () => {
  it('accepts the valid fixture and reports actionable validation errors', () => {
    expect(validatePlan(createClassroomPlan())).toEqual({
      valid: true,
      errors: [],
    });
    const plan = createClassroomPlan();
    plan.width = 0;
    plan.route = [plan.entrance];
    plan.objects[1].width = -1;
    plan.objects[2].capacity = 1.5;
    plan.objects[3].id = plan.objects[2].id;
    plan.turningZones[0].radius = 0;
    const errors = validatePlan(plan).errors.join(' ');
    expect(errors).toContain('Plan width');
    expect(errors).toContain('Route must contain at least two');
    expect(errors).toContain('dimensions');
    expect(errors).toContain('capacity');
    expect(errors).toContain('Duplicate object ID');
    expect(errors).toContain('positive radius');
  });

  it('validates route endpoints, walls, zones, and locked proposal state', () => {
    const reference = createClassroomPlan();
    const plan = structuredClone(reference);
    plan.route[0] = { x: plan.route[0].x + 1, y: plan.route[0].y };
    plan.route[plan.route.length - 1] = {
      x: plan.route.at(-1)!.x,
      y: plan.route.at(-1)!.y + 1,
    };
    plan.walls[0].start.x = Number.NaN;
    plan.doorZones[0].x = 0;
    plan.objects.find((object) => object.id === 'desk-4')!.x += 1;
    const errors = validatePlan(plan, reference).errors.join(' ');
    expect(errors).toContain('Route start');
    expect(errors).toContain('Route end');
    expect(errors).toContain('north endpoints');
    expect(errors).toContain('entry-approach');
    expect(errors).toContain('desk-4 is locked');
  });

  it('detects turning zones, door zones, bounds, and active overlap', () => {
    const turning = createClassroomPlan();
    Object.assign(
      turning.objects.find((object) => object.id === 'storage')!,
      { x: 720, y: 150 },
    );
    expect(
      auditPlan(turning).issues.some((issue) => issue.type === 'turning-zone'),
    ).toBe(true);

    const door = createClassroomPlan();
    Object.assign(
      door.objects.find((object) => object.id === 'desk-1')!,
      { x: 80, y: 480 },
    );
    expect(
      auditPlan(door).issues.some((issue) => issue.type === 'door-approach'),
    ).toBe(true);

    const invalid = createClassroomPlan();
    invalid.objects.find((object) => object.id === 'desk-1')!.x = 10;
    expect(isValidPlan(invalid)).toBe(false);
    const overlap = createClassroomPlan();
    Object.assign(
      overlap.objects.find((object) => object.id === 'desk-1')!,
      { x: 420, y: 130 },
    );
    expect(isValidPlan(overlap)).toBe(false);
  });

  it('excludes inactive objects from capacity, collisions, and route conflicts', () => {
    const plan = createClassroomPlan();
    const desk = plan.objects.find((object) => object.id === 'desk-3')!;
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

describe('proposal context fingerprints', () => {
  it.each([
    ['plan ID', (plan: FloorPlan) => void (plan.id += '-changed')],
    ['version', (plan: FloorPlan) => void (plan.versionId += '-changed')],
    ['dimensions', (plan: FloorPlan) => void (plan.width += 1)],
    ['scale', (plan: FloorPlan) => void (plan.pixelsPerCm += 1)],
    ['walls', (plan: FloorPlan) => void (plan.walls[0].start.x += 1)],
    ['entrance', (plan: FloorPlan) => void (plan.entrance.x += 1)],
    ['destination', (plan: FloorPlan) => void (plan.destination.x += 1)],
    ['route', (plan: FloorPlan) => void (plan.route[1].x += 1)],
    ['object coordinates', (plan: FloorPlan) => void (plan.objects[1].x += 1)],
    [
      'object dimensions',
      (plan: FloorPlan) => void (plan.objects[1].width += 1),
    ],
    [
      'object rotation',
      (plan: FloorPlan) => void (plan.objects[1].rotation += 90),
    ],
    [
      'lock',
      (plan: FloorPlan) =>
        void (plan.objects[1].locked = !plan.objects[1].locked),
    ],
    ['activity', (plan: FloorPlan) => void (plan.objects[1].active = false)],
    ['capacity', (plan: FloorPlan) => void (plan.objects[1].capacity += 1)],
    [
      'turning zone',
      (plan: FloorPlan) => void (plan.turningZones[0].radius += 1),
    ],
    ['door zone', (plan: FloorPlan) => void (plan.doorZones[0].width += 1)],
  ])('changes when %s changes', (_name, mutate) => {
    const baseline = createClassroomPlan();
    const changed = structuredClone(baseline);
    mutate(changed);
    expect(
      proposalContextFingerprint(changed, { minimumCapacity: 24 }),
    ).not.toBe(proposalContextFingerprint(baseline, { minimumCapacity: 24 }));
  });

  it('changes with constraints and ignores irrelevant array ordering', () => {
    const baseline = createClassroomPlan();
    const reordered = structuredClone(baseline);
    reordered.objects.reverse();
    reordered.walls.reverse();
    reordered.turningZones.reverse();
    reordered.doorZones.reverse();
    expect(proposalContextFingerprint(reordered, { minimumCapacity: 24 })).toBe(
      proposalContextFingerprint(baseline, { minimumCapacity: 24 }),
    );
    expect(
      proposalContextFingerprint(baseline, { minimumCapacity: 22 }),
    ).not.toBe(proposalContextFingerprint(baseline, { minimumCapacity: 24 }));
  });
});

describe('bounded proposal search', () => {
  it('finds a full-capacity threshold-satisfied fixture proposal', () => {
    const plan = createClassroomPlan();
    const top = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3)[0];
    expect(top.status).toBe('threshold-satisfied');
    expect(top.after.metrics).toMatchObject({
      capacity: 24,
      criticalIssues: 0,
      minimumClearWidthCm: THRESHOLDS.requiredClearWidthCm,
    });
    expect(isValidPlan(top.proposedPlan)).toBe(true);
  });

  it('coordinates three objects when the geometry requires it', () => {
    const plan = coordinatedFixture();
    const top = generateRouteAlternatives(plan, { minimumCapacity: 6 }, 1)[0];
    expect(top.changes).toHaveLength(3);
    expect(top.changes.every((change) => change.type === 'move')).toBe(true);
    expect(top.status).toBe('threshold-satisfied');
    expect(top.after.metrics.capacity).toBe(6);
  });

  it('returns distinct deterministic alternatives with recalculated metrics', () => {
    const plan = createClassroomPlan();
    const first = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    const second = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    expect(first).toEqual(second);
    expect(
      new Set(first.map((proposal) => JSON.stringify(proposal.changes))).size,
    ).toBe(first.length);
    for (const proposal of first)
      expect(proposal.after.metrics).toEqual(
        auditPlan(proposal.proposedPlan, plan).metrics,
      );
  });

  it('preserves capacity by default even when the minimum is lower', () => {
    const plan = createClassroomPlan();
    const at24 = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    const at22 = generateRouteAlternatives(plan, { minimumCapacity: 22 }, 10);
    expect(
      at24.every((proposal) => proposal.after.metrics.capacity === 24),
    ).toBe(true);
    expect(at22[0].after.metrics.capacity).toBe(24);
    const removal = at22.find(
      (proposal) => proposal.after.metrics.capacity === 22,
    )!;
    expect(removal).toBeDefined();
    expect(removal.changes.some((change) => change.type === 'remove')).toBe(
      true,
    );
    expect(removal.tradeoffs.join(' ')).toContain(
      'Capacity decreases by 2 seats',
    );
    expect(at22[0].after.metrics.score).toBeGreaterThan(
      removal.after.metrics.score,
    );
    expect(at22.map((proposal) => proposal.after.metrics.score)).toEqual(
      at22
        .map((proposal) => proposal.after.metrics.score)
        .toSorted((a, b) => b - a),
    );
  });

  it('restores an inactive desk to valid geometry and capacity', () => {
    const plan = createClassroomPlan();
    const removal = generateRouteAlternatives(
      plan,
      { minimumCapacity: 22 },
      10,
    ).find((proposal) => proposal.after.metrics.capacity === 22)!;
    const restored = generateRouteAlternatives(
      removal.proposedPlan,
      { minimumCapacity: 24 },
      1,
    )[0];
    expect(restored.changes.some((change) => change.type === 'restore')).toBe(
      true,
    );
    expect(restored.after.metrics.capacity).toBe(24);
    expect(restored.status).toBe('threshold-satisfied');
    expect(isValidPlan(restored.proposedPlan)).toBe(true);
  });

  it('labels depth-limited results as partial improvements', () => {
    const proposals = generateRouteAlternatives(
      coordinatedFixture(),
      { minimumCapacity: 6 },
      3,
      { maxDepth: 2 },
    );
    expect(
      proposals.every((proposal) => proposal.status === 'partial-improvement'),
    ).toBe(true);
    expect(
      proposals.every((proposal) => proposal.after.metrics.criticalIssues > 0),
    ).toBe(true);
  });

  it('enforces state bounds, locks, impossible capacity, and invalid baselines', () => {
    const plan = createClassroomPlan();
    const start = performance.now();
    expect(
      generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3, {
        maxEvaluatedStates: 50,
      }).length,
    ).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(2_000);
    expect(() =>
      generateRouteAlternatives(plan, { minimumCapacity: 25 }),
    ).toThrow('exceeds the maximum available capacity');
    expect(() =>
      generateRouteAlternatives(toggleObjectLock(plan, 'desk-3', true), {
        minimumCapacity: 24,
      }),
    ).toThrow('No improving proposal');
    const invalid = structuredClone(plan);
    invalid.route = [invalid.entrance];
    expect(() =>
      generateRouteAlternatives(invalid, { minimumCapacity: 24 }),
    ).toThrow('Route must contain at least two points');
  });
});
