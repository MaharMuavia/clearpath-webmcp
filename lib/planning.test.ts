import { describe, expect, it } from 'vitest';

import { createRouteProposal, getAuditIssues, getPlanMetrics, SCENARIOS } from './planning';

describe('ClearPath planning engine', () => {
  it('improves every seeded venue without reducing capacity', () => {
    for (const scenarioId of Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>) {
      const baseline = getPlanMetrics(scenarioId, 'baseline');
      const staged = getPlanMetrics(scenarioId, 'staged');

      expect(staged.score).toBeGreaterThan(baseline.score);
      expect(staged.minimumClearanceCm).toBeGreaterThan(baseline.minimumClearanceCm);
      expect(staged.capacity).toBe(baseline.capacity);
      expect(staged.openIssues).toBeLessThan(baseline.openIssues);
    }
  });

  it('keeps an applied plan identical to its reviewed staged proposal', () => {
    expect(getPlanMetrics('classroom', 'applied')).toEqual(getPlanMetrics('classroom', 'staged'));
    expect(getAuditIssues('classroom', 'applied')).toEqual(getAuditIssues('classroom', 'staged'));
  });

  it('rejects proposals that exceed venue capacity', () => {
    expect(() => createRouteProposal('classroom', 43)).toThrow('at most 42 seats');
    expect(() => createRouteProposal('classroom', 0)).toThrow('positive whole number');
  });

  it('returns a reviewable proposal with preserved constraints', () => {
    const proposal = createRouteProposal('classroom', 40);

    expect(proposal.proposalId).toBe('classroom-route-a');
    expect(proposal.metrics.capacity).toBe(42);
    expect(proposal.preservedConstraints).toContain('At least 40 seats');
    expect(proposal.preservedConstraints).toContain('Locked objects unchanged');
  });
});

