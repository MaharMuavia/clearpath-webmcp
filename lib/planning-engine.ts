export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type PlanObjectKind = 'desk' | 'storage' | 'destination';
export type Severity = 'critical' | 'review';

export type PlanObject = Rect & {
  id: string;
  name: string;
  kind: PlanObjectKind;
  rotation: number;
  locked: boolean;
  active: boolean;
  capacity: number;
};
export type Zone = Rect & { id: string; name: string; kind: 'door-approach' };
export type TurningZone = {
  id: string;
  name: string;
  center: Point;
  radius: number;
};
export type FloorPlan = {
  id: string;
  versionId: string;
  name: string;
  width: number;
  height: number;
  unit: 'cm';
  pixelsPerCm: number;
  walls: Array<{ id: string; start: Point; end: Point }>;
  entrance: Point;
  destination: Point;
  route: Point[];
  objects: PlanObject[];
  turningZones: TurningZone[];
  doorZones: Zone[];
};
export type PlanningConstraints = { minimumCapacity: number };
export type AuditIssue = {
  id: string;
  type: 'route-blocked' | 'route-corridor' | 'turning-zone' | 'door-approach';
  title: string;
  description: string;
  severity: Severity;
  objectId: string;
  measuredCm?: number;
  requiredCm?: number;
};
export type PlanMetrics = {
  score: number;
  capacity: number;
  openIssues: number;
  criticalIssues: number;
  reviewIssues: number;
  minimumCenterlineClearanceCm: number;
  minimumClearWidthCm: number;
  /** Backward-compatible alias for minimumClearWidthCm. */
  minimumClearanceCm: number;
  routeLengthCm: number;
  changedObjects: number;
  movedObjects: number;
};
export type AuditResult = {
  planVersionId: string;
  metrics: PlanMetrics;
  issues: AuditIssue[];
  disclaimer: string;
};
export type MoveChange = {
  type: 'move';
  objectId: string;
  objectName: string;
  from: Point;
  to: Point;
  distanceCm: number;
};
export type RemoveChange = {
  type: 'remove';
  objectId: string;
  objectName: string;
  previousCapacity: number;
};
export type RestoreChange = {
  type: 'restore';
  objectId: string;
  objectName: string;
  to: Point;
  restoredCapacity: number;
  distanceCm: number;
};
export type PlanChange = MoveChange | RemoveChange | RestoreChange;
export type MetricDeltas = { [K in keyof PlanMetrics]: number };
export type ProposalStatus = 'threshold-satisfied' | 'partial-improvement';
export type SearchLimits = {
  maxDepth: number;
  beamWidth: number;
  maxCandidatesPerObject: number;
  maxEvaluatedStates: number;
};
export type RouteProposal = {
  id: string;
  baselineVersionId: string;
  contextFingerprint: string;
  sessionRevision: number | null;
  proposedPlan: FloorPlan;
  changes: PlanChange[];
  before: AuditResult;
  after: AuditResult;
  deltas: MetricDeltas;
  resolvedIssueIds: string[];
  remainingIssueIds: string[];
  preservedConstraints: string[];
  explanation: string;
  tradeoffs: string[];
  status: ProposalStatus;
};
export type AuditActor = 'human' | 'agent' | 'system';
export type AuditEvent = {
  id: string;
  timestamp: string;
  actor: AuditActor;
  action: string;
  planId: string;
  proposalId?: string;
  summary: string;
  beforeVersionId?: string;
  afterVersionId?: string;
  result: 'successful' | 'rejected' | 'failed' | 'undone';
};

export const THRESHOLDS = {
  requiredClearWidthCm: 90,
  routeClearanceCm: 90,
  routeHalfWidthCm: 45,
  turningDiameterCm: 150,
  criticalClearWidthCm: 60,
} as const;
export const DEFAULT_SEARCH_LIMITS: SearchLimits = {
  maxDepth: 4,
  beamWidth: 72,
  maxCandidatesPerObject: 7,
  maxEvaluatedStates: 1_500,
};

const deskPositions = [
  [240, 130],
  [420, 130],
  [600, 130],
  [240, 300],
  [420, 300],
  [600, 300],
  [240, 405],
  [420, 405],
  [600, 405],
  [240, 500],
  [420, 500],
  [600, 500],
] as const;

export function createClassroomPlan(): FloorPlan {
  const entrance = { x: 115, y: 570 };
  const destination = { x: 710, y: 93 };
  return {
    id: 'north-hall-classroom',
    versionId: 'north-hall-v1',
    name: 'North Hall classroom',
    width: 900,
    height: 600,
    unit: 'cm',
    pixelsPerCm: 1,
    walls: [
      { id: 'north', start: { x: 20, y: 20 }, end: { x: 880, y: 20 } },
      { id: 'east', start: { x: 880, y: 20 }, end: { x: 880, y: 580 } },
      { id: 'south-a', start: { x: 880, y: 580 }, end: { x: 170, y: 580 } },
      { id: 'south-b', start: { x: 20, y: 580 }, end: { x: 60, y: 580 } },
      { id: 'west', start: { x: 20, y: 580 }, end: { x: 20, y: 20 } },
    ],
    entrance,
    destination,
    route: [
      entrance,
      { x: 150, y: 520 },
      { x: 150, y: 105 },
      { x: 710, y: 105 },
      destination,
    ],
    objects: [
      {
        id: 'presentation-wall',
        name: 'Presentation wall',
        kind: 'destination',
        x: 220,
        y: 38,
        width: 500,
        height: 55,
        rotation: 0,
        locked: true,
        active: true,
        capacity: 0,
      },
      ...deskPositions.map(
        ([x, y], index): PlanObject => ({
          id: `desk-${index + 1}`,
          name: `Desk ${index + 1}`,
          kind: 'desk',
          x,
          y,
          width: 100,
          height: 64,
          rotation: 0,
          locked: index === 3,
          active: true,
          capacity: 2,
        }),
      ),
      {
        id: 'storage',
        name: 'Storage cabinet',
        kind: 'storage',
        x: 760,
        y: 315,
        width: 100,
        height: 105,
        rotation: 0,
        locked: false,
        active: true,
        capacity: 0,
      },
    ],
    turningZones: [
      {
        id: 'destination-turn',
        name: 'Destination turning zone',
        center: { x: 790, y: 170 },
        radius: 75,
      },
    ],
    doorZones: [
      {
        id: 'entry-approach',
        name: 'Entrance approach and recovery',
        kind: 'door-approach',
        x: 45,
        y: 455,
        width: 155,
        height: 125,
      },
    ],
  };
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function between(a: number, b: number, value: number): boolean {
  return value >= Math.min(a, b) - 1e-9 && value <= Math.max(a, b) + 1e-9;
}
export function segmentsIntersect(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (
    ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
    ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))
  )
    return true;
  return (
    (Math.abs(o1) < 1e-9 && between(a.x, b.x, c.x) && between(a.y, b.y, c.y)) ||
    (Math.abs(o2) < 1e-9 && between(a.x, b.x, d.x) && between(a.y, b.y, d.y)) ||
    (Math.abs(o3) < 1e-9 && between(c.x, d.x, a.x) && between(c.y, d.y, a.y)) ||
    (Math.abs(o4) < 1e-9 && between(c.x, d.x, b.x) && between(c.y, d.y, b.y))
  );
}
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  if (
    a.x >= rect.x &&
    a.x <= rect.x + rect.width &&
    a.y >= rect.y &&
    a.y <= rect.y + rect.height
  )
    return true;
  if (
    b.x >= rect.x &&
    b.x <= rect.x + rect.width &&
    b.y >= rect.y &&
    b.y <= rect.y + rect.height
  )
    return true;
  const tl = { x: rect.x, y: rect.y };
  const tr = { x: rect.x + rect.width, y: rect.y };
  const br = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bl = { x: rect.x, y: rect.y + rect.height };
  return (
    segmentsIntersect(a, b, tl, tr) ||
    segmentsIntersect(a, b, tr, br) ||
    segmentsIntersect(a, b, br, bl) ||
    segmentsIntersect(a, b, bl, tl)
  );
}
export function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
export function segmentRectDistance(a: Point, b: Point, rect: Rect): number {
  if (segmentIntersectsRect(a, b, rect)) return 0;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  const pointRect = (p: Point) =>
    Math.hypot(
      Math.max(rect.x - p.x, 0, p.x - rect.x - rect.width),
      Math.max(rect.y - p.y, 0, p.y - rect.y - rect.height),
    );
  return Math.min(
    pointRect(a),
    pointRect(b),
    ...corners.map((corner) => pointSegmentDistance(corner, a, b)),
  );
}
export function segmentSegmentDistance(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
export function circleOverlapsRect(
  center: Point,
  radius: number,
  rect: Rect,
): boolean {
  const x = Math.max(rect.x, Math.min(center.x, rect.x + rect.width));
  const y = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - x, center.y - y) < radius;
}
export function routeLength(route: Point[]): number {
  return route
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point.x - route[index].x, point.y - route[index].y),
      0,
    );
}
export function planCapacity(plan: FloorPlan): number {
  return plan.objects.reduce(
    (sum, object) => sum + (object.active ? object.capacity : 0),
    0,
  );
}

function distanceFromRouteToObject(route: Point[], object: Rect): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1)
    distance = Math.min(
      distance,
      segmentRectDistance(route[index - 1], route[index], object),
    );
  return distance;
}
function distanceFromRouteToWalls(plan: FloorPlan): number {
  let distance = Number.POSITIVE_INFINITY;
  for (let routeIndex = 1; routeIndex < plan.route.length; routeIndex += 1) {
    for (const wall of plan.walls)
      distance = Math.min(
        distance,
        segmentSegmentDistance(
          plan.route[routeIndex - 1],
          plan.route[routeIndex],
          wall.start,
          wall.end,
        ),
      );
  }
  return distance;
}

export function auditPlan(plan: FloorPlan, baseline?: FloorPlan): AuditResult {
  const issues: AuditIssue[] = [];
  const activeObstacles = plan.objects.filter(
    (object) => object.active && object.kind !== 'destination',
  );
  const objectClearances = activeObstacles.map((object) => ({
    object,
    centerlineClearanceCm: distanceFromRouteToObject(plan.route, object),
  }));
  for (const { object, centerlineClearanceCm } of objectClearances) {
    const clearWidthCm = Math.round(centerlineClearanceCm * 2);
    if (centerlineClearanceCm === 0) {
      issues.push({
        id: `route-blocked:${object.id}`,
        type: 'route-blocked',
        title: `${object.name} blocks the route`,
        description: `The route centerline intersects ${object.name}.`,
        severity: 'critical',
        objectId: object.id,
        measuredCm: 0,
        requiredCm: THRESHOLDS.requiredClearWidthCm,
      });
    } else if (clearWidthCm < THRESHOLDS.requiredClearWidthCm) {
      issues.push({
        id: `route-corridor:${object.id}`,
        type: 'route-corridor',
        title: `${object.name} intrudes into the route corridor`,
        description: `${Math.round(centerlineClearanceCm)} cm from centerline gives a ${clearWidthCm} cm centered clear width; ${THRESHOLDS.requiredClearWidthCm} cm is required.`,
        severity:
          clearWidthCm < THRESHOLDS.criticalClearWidthCm
            ? 'critical'
            : 'review',
        objectId: object.id,
        measuredCm: clearWidthCm,
        requiredCm: THRESHOLDS.requiredClearWidthCm,
      });
    }
    for (const zone of plan.turningZones)
      if (circleOverlapsRect(zone.center, zone.radius, object))
        issues.push({
          id: `turning-zone:${zone.id}:${object.id}`,
          type: 'turning-zone',
          title: `${object.name} overlaps turning space`,
          description: `${object.name} overlaps the ${THRESHOLDS.turningDiameterCm} cm ${zone.name.toLowerCase()}.`,
          severity: 'review',
          objectId: object.id,
          requiredCm: THRESHOLDS.turningDiameterCm,
        });
    for (const zone of plan.doorZones)
      if (rectsOverlap(zone, object))
        issues.push({
          id: `door-approach:${zone.id}:${object.id}`,
          type: 'door-approach',
          title: `${object.name} conflicts with the entrance`,
          description: `${object.name} overlaps the ${zone.name.toLowerCase()}.`,
          severity: 'critical',
          objectId: object.id,
        });
  }
  const minimumCenterlineClearanceCm = Math.round(
    Math.min(
      distanceFromRouteToWalls(plan),
      ...objectClearances.map((item) => item.centerlineClearanceCm),
    ),
  );
  const minimumClearWidthCm = minimumCenterlineClearanceCm * 2;
  const criticalIssues = issues.filter(
    (issue) => issue.severity === 'critical',
  ).length;
  const reviewIssues = issues.length - criticalIssues;
  const capacity = planCapacity(plan);
  const baselineCapacity = baseline ? planCapacity(baseline) : capacity;
  const changedObjects = baseline
    ? plan.objects.filter((object) => {
        const original = baseline.objects.find((item) => item.id === object.id);
        return (
          original !== undefined &&
          (original.x !== object.x ||
            original.y !== object.y ||
            original.active !== object.active)
        );
      }).length
    : 0;
  const movedObjects = baseline
    ? plan.objects.filter((object) => {
        const original = baseline.objects.find((item) => item.id === object.id);
        return (
          original !== undefined &&
          (original.x !== object.x || original.y !== object.y)
        );
      }).length
    : 0;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          criticalIssues * 22 -
          reviewIssues * 7 -
          Math.max(0, THRESHOLDS.requiredClearWidthCm - minimumClearWidthCm) *
            0.25 -
          changedObjects * 2 -
          Math.max(0, baselineCapacity - capacity) * 4,
      ),
    ),
  );
  return {
    planVersionId: plan.versionId,
    issues: issues.sort((a, b) =>
      a.severity === b.severity
        ? a.id.localeCompare(b.id)
        : a.severity === 'critical'
          ? -1
          : 1,
    ),
    metrics: {
      score,
      capacity,
      openIssues: issues.length,
      criticalIssues,
      reviewIssues,
      minimumCenterlineClearanceCm,
      minimumClearWidthCm,
      minimumClearanceCm: minimumClearWidthCm,
      routeLengthCm: Math.round(routeLength(plan.route)),
      changedObjects,
      movedObjects,
    },
    disclaimer:
      'Explainable planning heuristic only; requirements vary by jurisdiction and require qualified review.',
  };
}

const clonePlan = (plan: FloorPlan): FloorPlan => structuredClone(plan);
const withinBounds = (object: PlanObject, plan: FloorPlan): boolean =>
  !object.active ||
  (object.x >= 20 &&
    object.y >= 20 &&
    object.x + object.width <= plan.width - 20 &&
    object.y + object.height <= plan.height - 20);
export function isValidPlan(plan: FloorPlan): boolean {
  const active = plan.objects.filter((object) => object.active);
  return active.every(
    (object, index) =>
      withinBounds(object, plan) &&
      active.slice(index + 1).every((other) => !rectsOverlap(object, other)),
  );
}
function metricDeltas(before: PlanMetrics, after: PlanMetrics): MetricDeltas {
  return Object.fromEntries(
    Object.keys(before).map((key) => [
      key,
      after[key as keyof PlanMetrics] - before[key as keyof PlanMetrics],
    ]),
  ) as MetricDeltas;
}

function stablePlanContext(
  plan: FloorPlan,
  constraints: PlanningConstraints,
): string {
  return JSON.stringify({
    versionId: plan.versionId,
    constraints,
    thresholds: THRESHOLDS,
    route: plan.route,
    objects: [...plan.objects]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        ({ id, x, y, width, height, rotation, locked, active, capacity }) => ({
          id,
          x,
          y,
          width,
          height,
          rotation,
          locked,
          active,
          capacity,
        }),
      ),
  });
}
export function proposalContextFingerprint(
  plan: FloorPlan,
  constraints: PlanningConstraints,
): string {
  let hash = 2_166_136_261;
  for (const character of stablePlanContext(plan, constraints)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `ctx-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

type SearchState = {
  plan: FloorPlan;
  changes: PlanChange[];
  audit: AuditResult;
  changedObjectIds: Set<string>;
};
type SearchRank = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
function searchRank(
  state: SearchState,
  constraints: PlanningConstraints,
): SearchRank {
  const routeBlocking = state.audit.issues.filter(
    (issue) => issue.type === 'route-blocked',
  ).length;
  const clearanceDeficit = Math.max(
    0,
    THRESHOLDS.requiredClearWidthCm - state.audit.metrics.minimumClearWidthCm,
  );
  const otherCritical = state.audit.issues.filter(
    (issue) => issue.severity === 'critical' && issue.type !== 'route-blocked',
  ).length;
  const distance = state.changes.reduce(
    (sum, change) => sum + (change.type === 'remove' ? 0 : change.distanceCm),
    0,
  );
  return [
    routeBlocking,
    clearanceDeficit === 0 ? 0 : 1,
    clearanceDeficit,
    otherCritical,
    state.audit.metrics.reviewIssues,
    state.audit.metrics.capacity >= constraints.minimumCapacity ? 0 : 1,
    state.changes.length,
    distance + state.audit.metrics.routeLengthCm / 100_000,
  ];
}
function compareRanks(a: SearchRank, b: SearchRank): number {
  for (let index = 0; index < a.length; index += 1) {
    const difference = a[index] - b[index];
    if (difference !== 0) return difference;
  }
  return 0;
}
function stateSignature(state: SearchState): string {
  return state.plan.objects
    .map(
      (object) =>
        `${object.id}:${object.active ? 1 : 0}:${object.x}:${object.y}`,
    )
    .sort()
    .join('|');
}
function changeSignature(changes: PlanChange[]): string {
  return changes
    .map((change) =>
      change.type === 'remove'
        ? `${change.objectId}:remove`
        : `${change.objectId}:${change.type}:${change.to.x},${change.to.y}`,
    )
    .sort()
    .join('|');
}
function candidateChanges(
  object: PlanObject,
  allowRemoval: boolean,
): PlanChange[] {
  const offsets = [
    [0, 80],
    [0, 100],
    [0, 120],
    [-80, 0],
    [80, 0],
    [-80, 80],
    [80, 80],
    [-120, 0],
    [120, 0],
  ] as const;
  if (!object.active)
    return offsets.slice(0, 3).map(([dx, dy]) => ({
      type: 'restore',
      objectId: object.id,
      objectName: object.name,
      to: { x: object.x + dx, y: object.y + dy },
      restoredCapacity: object.capacity,
      distanceCm: Math.round(Math.hypot(dx, dy)),
    }));
  const moves: PlanChange[] = offsets.map(([dx, dy]) => ({
    type: 'move',
    objectId: object.id,
    objectName: object.name,
    from: { x: object.x, y: object.y },
    to: { x: object.x + dx, y: object.y + dy },
    distanceCm: Math.round(Math.hypot(dx, dy)),
  }));
  return allowRemoval && object.kind === 'desk'
    ? [
        {
          type: 'remove',
          objectId: object.id,
          objectName: object.name,
          previousCapacity: object.capacity,
        },
        ...moves,
      ]
    : moves;
}
function applyChange(plan: FloorPlan, change: PlanChange): FloorPlan | null {
  const next = clonePlan(plan);
  const object = next.objects.find((item) => item.id === change.objectId);
  if (!object || object.locked) return null;
  if (change.type === 'restore') {
    if (object.active) return null;
    object.active = true;
    object.x = change.to.x;
    object.y = change.to.y;
  } else if (!object.active) return null;
  else if (change.type === 'remove') object.active = false;
  else {
    object.x = change.to.x;
    object.y = change.to.y;
  }
  return isValidPlan(next) ? next : null;
}
function proposalStatus(
  audit: AuditResult,
  constraints: PlanningConstraints,
): ProposalStatus {
  return audit.metrics.criticalIssues === 0 &&
    audit.metrics.minimumClearWidthCm >= THRESHOLDS.requiredClearWidthCm &&
    audit.metrics.capacity >= constraints.minimumCapacity
    ? 'threshold-satisfied'
    : 'partial-improvement';
}

export function generateRouteAlternatives(
  plan: FloorPlan,
  constraints: PlanningConstraints,
  limit = 3,
  searchLimits: Partial<SearchLimits> = {},
): RouteProposal[] {
  if (
    !Number.isInteger(constraints.minimumCapacity) ||
    constraints.minimumCapacity < 0
  )
    throw new Error('minimumCapacity must be a non-negative whole number.');
  const maximumAvailableCapacity = plan.objects.reduce(
    (sum, object) => sum + object.capacity,
    0,
  );
  if (constraints.minimumCapacity > maximumAvailableCapacity)
    throw new Error(
      `Minimum capacity ${constraints.minimumCapacity} exceeds the current capacity of ${maximumAvailableCapacity}.`,
    );
  if (!isValidPlan(plan))
    throw new Error(
      'Proposal generation requires a physically valid baseline plan.',
    );
  const limits = { ...DEFAULT_SEARCH_LIMITS, ...searchLimits };
  const before = auditPlan(plan, plan);
  const contextFingerprint = proposalContextFingerprint(plan, constraints);
  const problematic = [
    ...new Set([
      ...before.issues.map((issue) => issue.objectId),
      ...plan.objects
        .filter((object) => !object.active && object.capacity > 0)
        .map((object) => object.id),
    ]),
  ]
    .map((id) => plan.objects.find((object) => object.id === id))
    .filter(
      (object): object is PlanObject =>
        object !== undefined &&
        !object.locked &&
        (object.active || object.capacity > 0),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const initial: SearchState = {
    plan: clonePlan(plan),
    changes: [],
    audit: before,
    changedObjectIds: new Set(),
  };
  let frontier = [initial];
  let evaluatedStates = 0;
  const seen = new Set([stateSignature(initial)]);
  const results: SearchState[] = [];
  const beforeRank = searchRank(initial, constraints);
  for (
    let depth = 1;
    depth <= limits.maxDepth && frontier.length > 0;
    depth += 1
  ) {
    const next: SearchState[] = [];
    for (const state of frontier)
      for (const originalObject of problematic) {
        if (state.changedObjectIds.has(originalObject.id)) continue;
        const currentObject = state.plan.objects.find(
          (object) => object.id === originalObject.id,
        );
        if (!currentObject) continue;
        const allowRemoval =
          currentObject.active &&
          planCapacity(state.plan) - currentObject.capacity >=
            constraints.minimumCapacity;
        for (const change of candidateChanges(
          currentObject,
          allowRemoval,
        ).slice(0, limits.maxCandidatesPerObject)) {
          if (evaluatedStates >= limits.maxEvaluatedStates) break;
          evaluatedStates += 1;
          const candidatePlan = applyChange(state.plan, change);
          if (
            !candidatePlan ||
            planCapacity(candidatePlan) < constraints.minimumCapacity
          )
            continue;
          const candidate: SearchState = {
            plan: candidatePlan,
            changes: [...state.changes, change],
            audit: auditPlan(candidatePlan, plan),
            changedObjectIds: new Set([
              ...state.changedObjectIds,
              change.objectId,
            ]),
          };
          const signature = stateSignature(candidate);
          if (seen.has(signature)) continue;
          seen.add(signature);
          next.push(candidate);
          if (compareRanks(searchRank(candidate, constraints), beforeRank) < 0)
            results.push(candidate);
        }
      }
    frontier = next
      .sort(
        (a, b) =>
          compareRanks(
            searchRank(a, constraints),
            searchRank(b, constraints),
          ) ||
          changeSignature(a.changes).localeCompare(changeSignature(b.changes)),
      )
      .slice(0, limits.beamWidth);
    if (evaluatedStates >= limits.maxEvaluatedStates) break;
  }
  const ranked = results
    .sort(
      (a, b) =>
        compareRanks(searchRank(a, constraints), searchRank(b, constraints)) ||
        changeSignature(a.changes).localeCompare(changeSignature(b.changes)),
    )
    .slice(0, limit);
  if (ranked.length === 0)
    throw new Error(
      'No improving proposal satisfies the current locks, boundaries, overlap rules, search limits, and capacity constraint. Unlock an obstructing object or revise the constraint.',
    );
  return ranked.map((state) => {
    const signature = changeSignature(state.changes);
    const id = `proposal-${signature.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    const proposedPlan = clonePlan(state.plan);
    proposedPlan.versionId = `${plan.versionId}-${id}`;
    const after = { ...state.audit, planVersionId: proposedPlan.versionId };
    const capacityLoss = before.metrics.capacity - after.metrics.capacity;
    const status = proposalStatus(after, constraints);
    return {
      id,
      baselineVersionId: plan.versionId,
      contextFingerprint,
      sessionRevision: null,
      proposedPlan,
      changes: state.changes,
      before,
      after,
      deltas: metricDeltas(before.metrics, after.metrics),
      resolvedIssueIds: before.issues
        .filter(
          (issue) =>
            !after.issues.some((candidate) => candidate.id === issue.id),
        )
        .map((issue) => issue.id),
      remainingIssueIds: after.issues.map((issue) => issue.id),
      preservedConstraints: [
        `Capacity ${after.metrics.capacity} ≥ required ${constraints.minimumCapacity}`,
        'Locked objects unchanged',
        'Active objects remain in bounds',
        'Active objects do not overlap',
      ],
      explanation:
        status === 'threshold-satisfied'
          ? `Bounded beam search found a threshold-satisfied plan after ${state.changes.length} coordinated change(s). Ranking prioritizes route blockers, required clear width, other critical issues, review issues, capacity, disruption, and distance in that order.`
          : `Bounded beam search found a partial improvement after ${state.changes.length} coordinated change(s). The remaining issues are reported and this proposal is not described as cleared.`,
      tradeoffs: [
        ...(capacityLoss > 0
          ? [
              `Capacity decreases by ${capacityLoss} seat${capacityLoss === 1 ? '' : 's'}; the removed desk is explicit and reversible.`,
            ]
          : capacityLoss < 0
            ? [
                `Capacity increases by ${Math.abs(capacityLoss)} seats through an explicit desk restoration.`,
              ]
            : ['All current seating capacity is preserved.']),
        `${state.changes.length} object${state.changes.length === 1 ? '' : 's'} changed.`,
      ],
      status,
    };
  });
}

export function exactGeometry(plan: FloorPlan) {
  return {
    planId: plan.id,
    versionId: plan.versionId,
    dimensions: { width: plan.width, height: plan.height, unit: plan.unit },
    entrance: plan.entrance,
    destination: plan.destination,
    route: plan.route,
    objects: plan.objects.map(
      ({
        id,
        name,
        kind,
        x,
        y,
        width,
        height,
        rotation,
        locked,
        active,
        capacity,
      }) => ({
        id,
        name,
        kind,
        x,
        y,
        width,
        height,
        rotation,
        locked,
        active,
        capacity,
      }),
    ),
    turningZones: plan.turningZones,
    doorZones: plan.doorZones,
  };
}
export function toggleObjectLock(
  plan: FloorPlan,
  objectId: string,
  locked: boolean,
): FloorPlan {
  const next = clonePlan(plan);
  const object = next.objects.find((item) => item.id === objectId);
  if (!object) throw new Error(`Object ${objectId} does not exist.`);
  if (object.kind === 'destination' && !locked)
    throw new Error('The primary destination is permanently locked.');
  object.locked = locked;
  return next;
}
