export type ScenarioId = 'classroom' | 'clinic' | 'cafe';
export type PlanPhase = 'baseline' | 'staged' | 'applied';

export type AuditIssue = {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'review';
  objectId: string;
};

export type PlanMetrics = {
  score: number;
  capacity: number;
  openIssues: number;
  minimumClearanceCm: number;
  movedObjects: number;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  name: string;
  type: string;
  capacity: number;
  baselineScore: number;
  baselineClearanceCm: number;
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  classroom: {
    id: 'classroom',
    name: 'North Hall',
    type: 'Workshop classroom',
    capacity: 42,
    baselineScore: 68,
    baselineClearanceCm: 73,
  },
  clinic: {
    id: 'clinic',
    name: 'Harbor Clinic',
    type: 'Community clinic',
    capacity: 18,
    baselineScore: 76,
    baselineClearanceCm: 82,
  },
  cafe: {
    id: 'cafe',
    name: 'Juniper Café',
    type: 'Neighborhood café',
    capacity: 34,
    baselineScore: 61,
    baselineClearanceCm: 66,
  },
};

const BASE_ISSUES: Record<ScenarioId, AuditIssue[]> = {
  classroom: [
    { id: 'bottleneck-storage', title: 'Route bottleneck', description: 'Storage cabinet leaves 73 cm clearance near the presentation wall.', severity: 'critical', objectId: 'storage' },
    { id: 'turning-desk-12', title: 'Turning radius', description: 'Front-right desk overlaps the 150 cm turning zone.', severity: 'review', objectId: 'desk-12' },
    { id: 'door-recovery', title: 'Door approach', description: 'Entry approach is clear but has little recovery space.', severity: 'review', objectId: 'entrance' },
  ],
  clinic: [
    { id: 'reception-turn', title: 'Reception turn', description: 'The reception corner constrains a comfortable turning path.', severity: 'critical', objectId: 'reception' },
    { id: 'waiting-route', title: 'Waiting route', description: 'One waiting chair projects into the primary route.', severity: 'review', objectId: 'chair-4' },
  ],
  cafe: [
    { id: 'counter-route', title: 'Counter approach', description: 'The service queue crosses the accessible route.', severity: 'critical', objectId: 'counter' },
    { id: 'table-gap', title: 'Table clearance', description: 'Two tables leave a narrow passage to the rear seating.', severity: 'critical', objectId: 'table-6' },
    { id: 'door-swing', title: 'Door swing', description: 'A chair overlaps the entrance door recovery space.', severity: 'review', objectId: 'chair-2' },
    { id: 'restroom-route', title: 'Restroom route', description: 'The path changes direction twice in a constrained area.', severity: 'review', objectId: 'restroom' },
  ],
};

const RESOLVED_ISSUE_IDS: Record<ScenarioId, string[]> = {
  classroom: ['bottleneck-storage', 'turning-desk-12'],
  clinic: ['reception-turn'],
  cafe: ['counter-route', 'table-gap', 'door-swing'],
};

export function getAuditIssues(scenarioId: ScenarioId, phase: PlanPhase): AuditIssue[] {
  const issues = BASE_ISSUES[scenarioId];
  if (phase === 'baseline') return issues;
  const resolved = new Set(RESOLVED_ISSUE_IDS[scenarioId]);
  return issues.filter((issue) => !resolved.has(issue.id));
}

export function getPlanMetrics(scenarioId: ScenarioId, phase: PlanPhase): PlanMetrics {
  const scenario = SCENARIOS[scenarioId];
  const openIssues = getAuditIssues(scenarioId, phase).length;
  if (phase === 'baseline') {
    return {
      score: scenario.baselineScore,
      capacity: scenario.capacity,
      openIssues,
      minimumClearanceCm: scenario.baselineClearanceCm,
      movedObjects: 0,
    };
  }
  return {
    score: scenarioId === 'cafe' ? 91 : 94,
    capacity: scenario.capacity,
    openIssues,
    minimumClearanceCm: scenarioId === 'clinic' ? 116 : 122,
    movedObjects: scenarioId === 'cafe' ? 3 : 2,
  };
}

export function createRouteProposal(scenarioId: ScenarioId, minimumSeats: number) {
  const scenario = SCENARIOS[scenarioId];
  if (!Number.isInteger(minimumSeats) || minimumSeats < 1) {
    throw new Error('minimumSeats must be a positive whole number.');
  }
  if (minimumSeats > scenario.capacity) {
    throw new Error(`This plan supports at most ${scenario.capacity} seats.`);
  }
  const metrics = getPlanMetrics(scenarioId, 'staged');
  return {
    proposalId: `${scenarioId}-route-a`,
    title: 'Clear route, preserve capacity',
    summary: scenarioId === 'classroom'
      ? 'Move the storage cabinet east and shift the front-right desk 46 cm left.'
      : `Reposition ${metrics.movedObjects} movable objects outside the primary route.`,
    metrics,
    preservedConstraints: [`At least ${minimumSeats} seats`, 'Locked objects unchanged', 'Primary destination retained'],
  };
}

