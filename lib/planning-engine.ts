export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type PlanObjectKind = 'desk' | 'storage' | 'destination';
export type Severity = 'critical' | 'review';

export type PlanObject = Rect & {
  id: string; name: string; kind: PlanObjectKind; rotation: number; locked: boolean; capacity: number;
};
export type Zone = Rect & { id: string; name: string; kind: 'door-approach' };
export type TurningZone = { id: string; name: string; center: Point; radius: number };
export type FloorPlan = {
  id: string; versionId: string; name: string; width: number; height: number; unit: 'cm'; pixelsPerCm: number;
  walls: Array<{ id: string; start: Point; end: Point }>; entrance: Point; destination: Point; route: Point[];
  objects: PlanObject[]; turningZones: TurningZone[]; doorZones: Zone[];
};
export type PlanningConstraints = { minimumCapacity: number };
export type AuditIssue = {
  id: string; type: 'route-blocked' | 'narrow-clearance' | 'turning-zone' | 'door-approach';
  title: string; description: string; severity: Severity; objectId: string; measuredCm?: number; requiredCm?: number;
};
export type PlanMetrics = {
  score: number; capacity: number; openIssues: number; criticalIssues: number; reviewIssues: number;
  minimumClearanceCm: number; routeLengthCm: number; movedObjects: number;
};
export type AuditResult = { planVersionId: string; metrics: PlanMetrics; issues: AuditIssue[]; disclaimer: string };
export type Movement = { objectId: string; objectName: string; from: Point; to: Point; distanceCm: number };
export type MetricDeltas = { [K in keyof PlanMetrics]: number };
export type RouteProposal = {
  id: string; baselineVersionId: string; proposedPlan: FloorPlan; movements: Movement[]; before: AuditResult; after: AuditResult;
  deltas: MetricDeltas; resolvedIssueIds: string[]; remainingIssueIds: string[]; preservedConstraints: string[];
  explanation: string; tradeoffs: string[]; objective: number;
};
export type AuditActor = 'human' | 'agent' | 'system';
export type AuditEvent = {
  id: string; timestamp: string; actor: AuditActor; action: string; planId: string; proposalId?: string; summary: string;
  beforeVersionId?: string; afterVersionId?: string; result: 'successful' | 'rejected' | 'failed' | 'undone';
};

export const THRESHOLDS = { routeClearanceCm: 90, routeHalfWidthCm: 45, turningDiameterCm: 150, criticalClearanceCm: 60 } as const;
const deskPositions = [
  [230, 150], [360, 150], [490, 150], [620, 150], [230, 270], [360, 270], [490, 270], [620, 270],
  [230, 390], [360, 390], [490, 390], [600, 430],
] as const;

export function createClassroomPlan(): FloorPlan {
  return {
    id: 'north-hall-classroom', versionId: 'north-hall-v1', name: 'North Hall classroom',
    width: 900, height: 600, unit: 'cm', pixelsPerCm: 1,
    walls: [
      { id: 'north', start: { x: 20, y: 20 }, end: { x: 880, y: 20 } },
      { id: 'east', start: { x: 880, y: 20 }, end: { x: 880, y: 580 } },
      { id: 'south-a', start: { x: 880, y: 580 }, end: { x: 170, y: 580 } },
      { id: 'south-b', start: { x: 20, y: 580 }, end: { x: 60, y: 580 } },
      { id: 'west', start: { x: 20, y: 580 }, end: { x: 20, y: 20 } },
    ],
    entrance: { x: 100, y: 570 }, destination: { x: 710, y: 85 },
    route: [{ x: 100, y: 570 }, { x: 150, y: 520 }, { x: 150, y: 85 }, { x: 710, y: 85 }, { x: 710, y: 500 }],
    objects: [
      { id: 'presentation-wall', name: 'Presentation wall', kind: 'destination', x: 220, y: 38, width: 500, height: 55, rotation: 0, locked: true, capacity: 0 },
      ...deskPositions.map(([x, y], index): PlanObject => ({ id: `desk-${index + 1}`, name: `Desk ${index + 1}`, kind: 'desk', x, y, width: 94, height: 64, rotation: 0, locked: index === 0, capacity: 2 })),
      { id: 'storage', name: 'Storage cabinet', kind: 'storage', x: 655, y: 330, width: 110, height: 105, rotation: 0, locked: false, capacity: 0 },
    ],
    turningZones: [{ id: 'destination-turn', name: 'Destination turning zone', center: { x: 710, y: 500 }, radius: 75 }],
    doorZones: [{ id: 'entry-approach', name: 'Entrance approach and recovery', kind: 'door-approach', x: 45, y: 455, width: 155, height: 125 }],
  };
}

function orientation(a: Point, b: Point, c: Point): number { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function between(a: number, b: number, value: number): boolean { return value >= Math.min(a, b) - 1e-9 && value <= Math.max(a, b) + 1e-9; }
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c); const o2 = orientation(a, b, d); const o3 = orientation(c, d, a); const o4 = orientation(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (Math.abs(o1) < 1e-9 && between(a.x, b.x, c.x) && between(a.y, b.y, c.y)) ||
    (Math.abs(o2) < 1e-9 && between(a.x, b.x, d.x) && between(a.y, b.y, d.y)) ||
    (Math.abs(o3) < 1e-9 && between(c.x, d.x, a.x) && between(c.y, d.y, a.y)) ||
    (Math.abs(o4) < 1e-9 && between(c.x, d.x, b.x) && between(c.y, d.y, b.y));
}
export function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  if (a.x >= rect.x && a.x <= rect.x + rect.width && a.y >= rect.y && a.y <= rect.y + rect.height) return true;
  if (b.x >= rect.x && b.x <= rect.x + rect.width && b.y >= rect.y && b.y <= rect.y + rect.height) return true;
  const tl = { x: rect.x, y: rect.y }; const tr = { x: rect.x + rect.width, y: rect.y }; const br = { x: rect.x + rect.width, y: rect.y + rect.height }; const bl = { x: rect.x, y: rect.y + rect.height };
  return segmentsIntersect(a, b, tl, tr) || segmentsIntersect(a, b, tr, br) || segmentsIntersect(a, b, br, bl) || segmentsIntersect(a, b, bl, tl);
}
export function pointSegmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x; const dy = b.y - a.y; const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
export function segmentRectDistance(a: Point, b: Point, rect: Rect): number {
  if (segmentIntersectsRect(a, b, rect)) return 0;
  const corners = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }];
  const pointRect = (p: Point) => Math.hypot(Math.max(rect.x - p.x, 0, p.x - rect.x - rect.width), Math.max(rect.y - p.y, 0, p.y - rect.y - rect.height));
  return Math.min(pointRect(a), pointRect(b), ...corners.map((corner) => pointSegmentDistance(corner, a, b)));
}
export function rectsOverlap(a: Rect, b: Rect): boolean { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }
export function circleOverlapsRect(center: Point, radius: number, rect: Rect): boolean {
  const x = Math.max(rect.x, Math.min(center.x, rect.x + rect.width)); const y = Math.max(rect.y, Math.min(center.y, rect.y + rect.height));
  return Math.hypot(center.x - x, center.y - y) < radius;
}
export function routeLength(route: Point[]): number { return route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - route[index].x, point.y - route[index].y), 0); }
export function planCapacity(plan: FloorPlan): number { return plan.objects.reduce((sum, object) => sum + object.capacity, 0); }

export function auditPlan(plan: FloorPlan, baseline?: FloorPlan): AuditResult {
  const issues: AuditIssue[] = []; let closest = Number.POSITIVE_INFINITY; let closestObject: PlanObject | undefined;
  for (const object of plan.objects.filter((item) => item.kind !== 'destination')) {
    let distance = Number.POSITIVE_INFINITY; let intersects = false;
    for (let index = 1; index < plan.route.length; index += 1) {
      const segmentDistance = segmentRectDistance(plan.route[index - 1], plan.route[index], object);
      distance = Math.min(distance, segmentDistance); intersects ||= segmentDistance === 0;
    }
    if (distance < closest) { closest = distance; closestObject = object; }
    if (intersects) issues.push({ id: `route-blocked:${object.id}`, type: 'route-blocked', title: `${object.name} blocks the route`, description: `The route centerline intersects ${object.name}.`, severity: 'critical', objectId: object.id, measuredCm: 0, requiredCm: THRESHOLDS.routeClearanceCm });
    for (const zone of plan.turningZones) if (circleOverlapsRect(zone.center, zone.radius, object)) issues.push({ id: `turning-zone:${zone.id}:${object.id}`, type: 'turning-zone', title: `${object.name} overlaps turning space`, description: `${object.name} overlaps the ${THRESHOLDS.turningDiameterCm} cm ${zone.name.toLowerCase()}.`, severity: 'review', objectId: object.id, requiredCm: THRESHOLDS.turningDiameterCm });
    for (const zone of plan.doorZones) if (rectsOverlap(zone, object)) issues.push({ id: `door-approach:${zone.id}:${object.id}`, type: 'door-approach', title: `${object.name} conflicts with the entrance`, description: `${object.name} overlaps the ${zone.name.toLowerCase()}.`, severity: 'critical', objectId: object.id });
  }
  const clearance = Number.isFinite(closest) ? Math.round(closest * 2) : plan.width;
  if (closestObject && clearance < THRESHOLDS.routeClearanceCm && !issues.some((issue) => issue.type === 'route-blocked' && issue.objectId === closestObject?.id)) {
    issues.push({ id: `narrow-clearance:${closestObject.id}`, type: 'narrow-clearance', title: `Narrow clearance beside ${closestObject.name}`, description: `Measured ${clearance} cm clear width; the planning threshold is ${THRESHOLDS.routeClearanceCm} cm.`, severity: clearance < THRESHOLDS.criticalClearanceCm ? 'critical' : 'review', objectId: closestObject.id, measuredCm: clearance, requiredCm: THRESHOLDS.routeClearanceCm });
  }
  const critical = issues.filter((issue) => issue.severity === 'critical').length; const review = issues.length - critical;
  const capacity = planCapacity(plan); const baselineCapacity = baseline ? planCapacity(baseline) : capacity;
  const moved = baseline ? plan.objects.filter((object) => { const original = baseline.objects.find((item) => item.id === object.id); return original && (original.x !== object.x || original.y !== object.y); }).length : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - critical * 22 - review * 7 - Math.max(0, THRESHOLDS.routeClearanceCm - clearance) * 0.25 - moved * 2 - Math.max(0, baselineCapacity - capacity) * 4)));
  return { planVersionId: plan.versionId, issues: issues.sort((a, b) => (a.severity === b.severity ? a.id.localeCompare(b.id) : a.severity === 'critical' ? -1 : 1)), metrics: { score, capacity, openIssues: issues.length, criticalIssues: critical, reviewIssues: review, minimumClearanceCm: clearance, routeLengthCm: Math.round(routeLength(plan.route)), movedObjects: moved }, disclaimer: 'Explainable planning heuristic only; requirements vary by jurisdiction and require qualified review.' };
}

const clonePlan = (plan: FloorPlan): FloorPlan => structuredClone(plan);
const withinBounds = (object: PlanObject, plan: FloorPlan): boolean => object.x >= 20 && object.y >= 20 && object.x + object.width <= plan.width - 20 && object.y + object.height <= plan.height - 20;
export function isValidPlan(plan: FloorPlan): boolean { return plan.objects.every((object, index) => withinBounds(object, plan) && plan.objects.slice(index + 1).every((other) => !rectsOverlap(object, other))); }
function metricDeltas(before: PlanMetrics, after: PlanMetrics): MetricDeltas { return Object.fromEntries(Object.keys(before).map((key) => [key, after[key as keyof PlanMetrics] - before[key as keyof PlanMetrics]])) as MetricDeltas; }
export function generateRouteAlternatives(plan: FloorPlan, constraints: PlanningConstraints, limit = 3): RouteProposal[] {
  if (!Number.isInteger(constraints.minimumCapacity) || constraints.minimumCapacity < 0) throw new Error('minimumCapacity must be a non-negative whole number.');
  if (constraints.minimumCapacity > planCapacity(plan)) throw new Error(`Minimum capacity ${constraints.minimumCapacity} exceeds the current capacity of ${planCapacity(plan)}.`);
  const before = auditPlan(plan, plan);
  const problematic = [...new Set(before.issues.map((issue) => issue.objectId))]
    .map((id) => plan.objects.find((object) => object.id === id))
    .filter((object): object is PlanObject => object !== undefined && !object.locked);
  const candidates = problematic.flatMap((object) => {
    const points: Point[] = [];
    for (const distance of [60, 120, 180]) for (const [dx, dy] of [[distance, 0], [-distance, 0], [0, distance], [0, -distance]]) points.push({ x: object.x + dx, y: object.y + dy });
    return points.map((to) => ({ object, to }));
  });
  const moveSets: Array<Array<{ object: PlanObject; to: Point }>> = candidates.map((candidate) => [candidate]);
  for (let first = 0; first < candidates.length; first += 1) for (let second = first + 1; second < candidates.length; second += 1) if (candidates[first].object.id !== candidates[second].object.id) moveSets.push([candidates[first], candidates[second]]);
  const proposals: RouteProposal[] = []; const signatures = new Set<string>();
  for (const moves of moveSets) {
    const proposedPlan = clonePlan(plan); const movements: Movement[] = [];
    for (const move of moves) { const target = proposedPlan.objects.find((object) => object.id === move.object.id); if (!target || target.locked) continue; const from = { x: target.x, y: target.y }; target.x = move.to.x; target.y = move.to.y; movements.push({ objectId: target.id, objectName: target.name, from, to: move.to, distanceCm: Math.round(Math.hypot(move.to.x - from.x, move.to.y - from.y)) }); }
    if (!isValidPlan(proposedPlan) || planCapacity(proposedPlan) < constraints.minimumCapacity || movements.length !== moves.length) continue;
    proposedPlan.versionId = `${plan.versionId}-candidate`; const after = auditPlan(proposedPlan, plan); const distance = movements.reduce((sum, movement) => sum + movement.distanceCm, 0);
    const objective = (after.metrics.score - before.metrics.score) * 10 + (before.metrics.criticalIssues - after.metrics.criticalIssues) * 100 - movements.length * 12 - distance * 0.04;
    if (objective <= 0 || after.metrics.score <= before.metrics.score) continue;
    const signature = movements.map((movement) => `${movement.objectId}:${movement.to.x},${movement.to.y}`).sort().join('|'); if (signatures.has(signature)) continue; signatures.add(signature);
    const id = `proposal-${signature.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`; proposedPlan.versionId = `${plan.versionId}-${id}`;
    proposals.push({ id, baselineVersionId: plan.versionId, proposedPlan, movements, before, after: { ...after, planVersionId: proposedPlan.versionId }, deltas: metricDeltas(before.metrics, after.metrics), resolvedIssueIds: before.issues.filter((issue) => !after.issues.some((candidate) => candidate.id === issue.id)).map((issue) => issue.id), remainingIssueIds: after.issues.map((issue) => issue.id), preservedConstraints: [`Capacity ${after.metrics.capacity} ≥ required ${constraints.minimumCapacity}`, 'Locked objects unchanged', 'Objects remain in bounds', 'Objects do not overlap'], explanation: `Ranked by a deterministic objective: accessibility gain ${after.metrics.score - before.metrics.score}, ${movements.length} move(s), and ${distance} cm total movement.`, tradeoffs: movements.length > 1 ? ['More objects move to obtain a larger accessibility gain.'] : ['Single-object change minimizes disruption.'], objective: Math.round(objective * 100) / 100 });
  }
  const ranked = proposals.sort((a, b) => b.objective - a.objective || a.id.localeCompare(b.id)).slice(0, limit);
  if (ranked.length === 0) throw new Error('No improving proposal satisfies the current locks, boundaries, overlap rules, and capacity constraint. Unlock an obstructing object or revise the constraint.');
  return ranked;
}
export function exactGeometry(plan: FloorPlan) { return { planId: plan.id, versionId: plan.versionId, dimensions: { width: plan.width, height: plan.height, unit: plan.unit }, entrance: plan.entrance, destination: plan.destination, route: plan.route, objects: plan.objects.map(({ id, name, kind, x, y, width, height, rotation, locked, capacity }) => ({ id, name, kind, x, y, width, height, rotation, locked, capacity })), turningZones: plan.turningZones, doorZones: plan.doorZones }; }
export function toggleObjectLock(plan: FloorPlan, objectId: string, locked: boolean): FloorPlan {
  const next = clonePlan(plan); const object = next.objects.find((item) => item.id === objectId); if (!object) throw new Error(`Object ${objectId} does not exist.`); if (object.kind === 'destination' && !locked) throw new Error('The primary destination is permanently locked.'); object.locked = locked; return next;
}
