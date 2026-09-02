import { describe, expect, it } from 'vitest';
import { auditPlan, createClassroomPlan, generateRouteAlternatives, isValidPlan, pointSegmentDistance, segmentIntersectsRect, segmentsIntersect, toggleObjectLock } from './planning-engine';

describe('computational geometry', () => {
  it('detects segment intersection, distance, and rectangle collisions', () => {
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 5 }, { x: 20, y: 5 }, { x: 8, y: 2, width: 4, height: 6 })).toBe(true);
    expect(pointSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});

describe('audit and proposal engine', () => {
  it('changes audit results when geometry changes and is deterministic', () => {
    const plan = createClassroomPlan();
    expect(auditPlan(plan, plan)).toEqual(auditPlan(plan, plan));
    const moved = structuredClone(plan); moved.objects.find((object) => object.id === 'storage')!.x = 770;
    expect(auditPlan(moved, plan).metrics).not.toEqual(auditPlan(plan, plan).metrics);
  });

  it('returns genuinely different valid alternatives that preserve locks, capacity, and bounds', () => {
    const plan = createClassroomPlan(); const lockedBefore = plan.objects.filter((object) => object.locked);
    const proposals = generateRouteAlternatives(plan, { minimumCapacity: 24 }, 3);
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    expect(new Set(proposals.map((proposal) => JSON.stringify(proposal.movements))).size).toBe(proposals.length);
    for (const proposal of proposals) {
      expect(isValidPlan(proposal.proposedPlan)).toBe(true);
      expect(proposal.after.metrics.capacity).toBeGreaterThanOrEqual(24);
      for (const locked of lockedBefore) expect(proposal.proposedPlan.objects.find((object) => object.id === locked.id)).toMatchObject({ x: locked.x, y: locked.y, locked: true });
      expect(proposal.after.metrics).toEqual(auditPlan(proposal.proposedPlan, plan).metrics);
    }
  });

  it('fails safely when constraints make improvement impossible', () => {
    const plan = createClassroomPlan(); const snapshot = structuredClone(plan);
    expect(() => generateRouteAlternatives(plan, { minimumCapacity: 25 })).toThrow('exceeds the current capacity');
    expect(plan).toEqual(snapshot);
    const locked = toggleObjectLock(plan, 'storage', true);
    expect(() => generateRouteAlternatives(locked, { minimumCapacity: 24 })).toThrow('No improving proposal');
  });
});
