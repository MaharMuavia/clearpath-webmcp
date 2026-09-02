'use client';

import {
  Accessibility,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  DoorOpen,
  Eye,
  FileCheck2,
  History,
  Layers3,
  Lock,
  Map,
  MousePointer2,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClearPathTools } from '@/hooks/use-clearpath-tools';
import {
  createRouteProposal,
  getAuditIssues,
  getPlanMetrics,
  SCENARIOS,
  type PlanMetrics,
  type PlanPhase,
  type ScenarioId,
} from '@/lib/planning';

const desks = [
  [245, 130],
  [365, 130],
  [485, 130],
  [605, 130],
  [245, 235],
  [365, 235],
  [485, 235],
  [605, 235],
  [245, 340],
  [365, 340],
  [485, 340],
  [605, 340],
];

export default function Home() {
  const [scenario, setScenario] = useState<ScenarioId>('classroom');
  const [selectedIssueId, setSelectedIssueId] = useState('bottleneck-storage');
  const [phase, setPhase] = useState<PlanPhase>('baseline');
  const [view, setView] = useState<'plan' | 'compare' | 'history'>('plan');
  const [announcement, setAnnouncement] = useState(
    'Plan ready for a shared human-agent review.',
  );
  const current = SCENARIOS[scenario];
  const metrics = useMemo(
    () => getPlanMetrics(scenario, phase),
    [scenario, phase],
  );
  const issues = useMemo(
    () => getAuditIssues(scenario, phase),
    [scenario, phase],
  );
  const baselineMetrics = useMemo(
    () => getPlanMetrics(scenario, 'baseline'),
    [scenario],
  );

  const selectScenario = useCallback((next: ScenarioId) => {
    setScenario(next);
    setPhase('baseline');
    setView('plan');
    const firstIssue = getAuditIssues(next, 'baseline')[0];
    setSelectedIssueId(firstIssue?.id ?? '');
    setAnnouncement(`${SCENARIOS[next].name} loaded with its original audit.`);
  }, []);

  const focusIssue = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);
    setView('plan');
    setAnnouncement(`Focused issue ${issueId} on the visible floor plan.`);
  }, []);

  const stageProposal = useCallback(
    (minimumSeats: number) => {
      const proposal = createRouteProposal(scenario, minimumSeats);
      setPhase('staged');
      setView('plan');
      setSelectedIssueId('');
      setAnnouncement(`Proposal staged: ${proposal.summary}`);
      return proposal;
    },
    [scenario],
  );

  const applyProposal = useCallback(() => {
    setPhase('applied');
    setAnnouncement('Staged proposal applied. Undo remains available.');
  }, []);

  const undo = useCallback(() => {
    setPhase('baseline');
    setView('plan');
    const firstIssue = getAuditIssues(scenario, 'baseline')[0];
    setSelectedIssueId(firstIssue?.id ?? '');
    setAnnouncement('Original floor plan restored.');
  }, [scenario]);

  const showComparison = useCallback(() => setView('compare'), []);

  useClearPathTools(
    { scenarioId: scenario, venueName: current.name, phase, metrics, issues },
    { focusIssue, stageProposal, applyProposal, undo, showComparison },
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#edf2ec] text-[#17221b]">
      <LandingHero />
      <div id="studio" className="scroll-mt-0 border-t border-[#cbd7ce]">
        <header className="flex h-[68px] items-center justify-between border-b border-[#d4ddd4] bg-[#f8faf6]/95 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-[#163f31] text-[#eaffbd] shadow-sm">
              <Route className="size-[19px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-[-0.02em]">
                  ClearPath
                </span>
                <Badge className="h-[18px] bg-[#e8f6c9] px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#315c22]">
                  WebMCP
                </Badge>
              </div>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#718078]">
                Human + agent spatial planning
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9d7c9] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#456052]">
              <span className="size-1.5 rounded-full bg-[#2b9b5c] shadow-[0_0_0_3px_#dcf4e5]" />
              7 site tools designed
            </span>
            <Button
              onClick={undo}
              disabled={phase === 'baseline'}
              variant="outline"
              className="h-8 border-[#c9d7c9] bg-white text-xs"
            >
              <Undo2 /> Undo
            </Button>
            <Button
              onClick={() => setView('history')}
              className="h-8 bg-[#163f31] px-3 text-xs text-white hover:bg-[#225a46]"
            >
              View audit trail <ArrowRight />
            </Button>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-68px)] grid-cols-1 lg:grid-cols-[235px_minmax(560px,1fr)_310px]">
          <aside className="hidden border-r border-[#d4ddd4] bg-[#f5f8f2] p-4 lg:flex lg:flex-col">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a887e]">
              Venue projects
            </p>
            <div className="space-y-1.5">
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((key) => {
                const item = SCENARIOS[key];
                const active = scenario === key;
                const itemIssues = getAuditIssues(key, 'baseline').length;
                return (
                  <button
                    aria-label={`Open ${item.name} project`}
                    key={key}
                    onClick={() => selectScenario(key)}
                    className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-[#b7cbb9] bg-white shadow-[0_5px_18px_rgba(35,62,45,0.08)]' : 'border-transparent hover:bg-white/70'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-bold">{item.name}</p>
                        <p className="mt-0.5 text-[10px] text-[#728077]">
                          {item.type}
                        </p>
                      </div>
                      <span
                        className={`mt-1 size-2 rounded-full ${itemIssues > 2 ? 'bg-[#e97a48]' : 'bg-[#e5ad36]'}`}
                      />
                    </div>
                    <div className="mt-3 flex gap-3 text-[10px] font-semibold text-[#607067]">
                      <span>{item.capacity} seats</span>
                      <span>{itemIssues} issues</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-auto rounded-2xl bg-[#173f31] p-4 text-white shadow-[0_12px_28px_rgba(23,63,49,0.18)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="grid size-8 place-items-center rounded-lg bg-white/10">
                  <Bot className="size-4 text-[#dfff9a]" />
                </div>
                <Sparkles className="size-4 text-[#dfff9a]" />
              </div>
              <p className="text-[13px] font-bold">
                Designed for shared decisions
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/65">
                The agent reads structured geometry. You keep control of
                constraints and every committed change.
              </p>
              <button className="mt-3 text-[10px] font-bold text-[#dfff9a]">
                Why WebMCP →
              </button>
            </div>
          </aside>

          <section className="min-w-0 p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#76837b]">
                  <Map className="size-3.5" /> Live floor plan{' '}
                  <span className="text-[#b7c1ba]">/</span> Ground floor
                </div>
                <h1 className="text-2xl font-bold tracking-[-0.04em]">
                  {current.name}
                </h1>
              </div>
              <div className="flex items-center rounded-xl border border-[#d2ddd2] bg-white p-1 shadow-sm">
                <ViewButton
                  active={view === 'plan'}
                  onClick={() => setView('plan')}
                >
                  Plan
                </ViewButton>
                <ViewButton
                  active={view === 'compare'}
                  onClick={() => setView('compare')}
                >
                  Compare
                </ViewButton>
                <ViewButton
                  active={view === 'history'}
                  onClick={() => setView('history')}
                >
                  History
                </ViewButton>
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
              <Metric
                icon={<Accessibility />}
                value={String(metrics.score)}
                suffix="/100"
                label="Route score"
                tone="lime"
              />
              <Metric
                icon={<Users />}
                value={String(metrics.capacity)}
                suffix=" seats"
                label="Current capacity"
                tone="green"
              />
              <Metric
                icon={<CircleAlert />}
                value={String(metrics.openIssues)}
                suffix=" open"
                label="Planning issues"
                tone="orange"
              />
            </div>

            {view === 'plan' && (
              <PlanCanvas
                phase={phase}
                selectedIssueId={selectedIssueId}
                scenario={scenario}
              />
            )}
            {view === 'compare' && (
              <ComparePanel
                baseline={baselineMetrics}
                current={metrics}
                hasProposal={phase !== 'baseline'}
                onStage={() => stageProposal(Math.max(1, current.capacity - 2))}
              />
            )}
            {view === 'history' && (
              <HistoryPanel phase={phase} venueName={current.name} />
            )}
          </section>

          <aside className="border-l border-[#d4ddd4] bg-[#f8faf6] p-4 sm:p-5">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#79867e]">
                  Live audit
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em]">
                  Agent-readable issues
                </h2>
              </div>
              <span className="grid size-8 place-items-center rounded-xl bg-[#e9f4d7] text-[#3e6a2d]">
                <Accessibility className="size-4" />
              </span>
            </div>
            <div className="space-y-2">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => focusIssue(issue.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedIssueId === issue.id ? 'border-[#d6ad8e] bg-[#fffaf5] shadow-sm' : 'border-[#dfe5dd] bg-white hover:border-[#cbd6ca]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold">{issue.title}</p>
                    <Badge
                      variant="outline"
                      className={`h-[18px] px-1.5 text-[9px] ${issue.severity === 'critical' ? 'border-[#f2c1a7] bg-[#fff0e8] text-[#ae4e28]' : 'border-[#ead9a6] bg-[#fff9df] text-[#8a6512]'}`}
                    >
                      {issue.severity === 'critical' ? 'Critical' : 'Review'}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-[#718078]">
                    {issue.description}
                  </p>
                </button>
              ))}
              {issues.length === 0 && (
                <div className="rounded-xl border border-[#bbd8bd] bg-[#f0f9ed] p-4 text-center">
                  <Check className="mx-auto size-5 text-[#37824f]" />
                  <p className="mt-2 text-[11px] font-bold">
                    No route issues remain
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-[#c8d7c9] bg-white p-4 shadow-[0_8px_28px_rgba(32,62,43,0.07)]">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-[#173f31] text-[#e4ffa7]">
                  <Bot className="size-3.5" />
                </span>
                <div>
                  <p className="text-[11px] font-bold">Ask your agent</p>
                  <p className="text-[9px] text-[#7b887f]">
                    Shared state, visible changes
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#f1f5ee] p-3 text-[10px] leading-relaxed text-[#45564b]">
                “Fix the route to the primary destination. Keep{' '}
                {Math.max(1, current.capacity - 2)} seats and don’t move locked
                objects.”
              </div>
              <div className="mt-3 flex items-center gap-2 text-[9px] font-semibold text-[#607067]">
                <Check className="size-3.5 text-[#3b8a55]" /> Agent stages
                changes before you approve
              </div>
              {phase === 'baseline' && (
                <Button
                  onClick={() =>
                    stageProposal(Math.max(1, current.capacity - 2))
                  }
                  className="mt-3 h-8 w-full bg-[#173f31] text-[10px] text-white hover:bg-[#255944]"
                >
                  <Sparkles /> Stage agent proposal
                </Button>
              )}
              {phase === 'staged' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    onClick={applyProposal}
                    className="h-8 bg-[#173f31] text-[10px] text-white"
                  >
                    <Check /> Approve
                  </Button>
                  <Button
                    onClick={undo}
                    variant="outline"
                    className="h-8 text-[10px]"
                  >
                    <X /> Reject
                  </Button>
                </div>
              )}
              {phase === 'applied' && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#e7f4df] p-2 text-[10px] font-bold text-[#356f41]">
                  <Check className="size-3.5" /> Change approved and applied
                </div>
              )}
            </div>
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#7a877f]">
                Design constraints
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['≥ 40 seats', 'Stage locked', 'Minimize moves'].map(
                  (constraint) => (
                    <Badge
                      key={constraint}
                      variant="outline"
                      className="border-[#ccd8cc] bg-white text-[9px] text-[#516359]"
                    >
                      <Lock className="size-2.5" />
                      {constraint}
                    </Badge>
                  ),
                )}
              </div>
            </div>
            <output
              aria-live="polite"
              className="mt-5 block rounded-lg border border-[#d8e2d7] bg-white p-2.5 text-[9px] leading-relaxed text-[#5d6f63]"
            >
              {announcement}
            </output>
            <p className="mt-4 border-t border-[#dce4dc] pt-4 text-[9px] leading-relaxed text-[#87938b]">
              Planning aid only. ClearPath does not certify compliance with
              local building codes or replace review by a qualified
              accessibility professional.
            </p>
          </aside>
        </section>
      </div>
      <LandingFooter />
    </main>
  );
}

function LandingHero() {
  const proof = [
    { value: '7', label: 'agent-ready tools' },
    { value: '0', label: 'silent edits' },
    { value: '100%', label: 'reviewable changes' },
  ];

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-[#f7f8f3] text-[#112119]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-60 [background-image:linear-gradient(#dfe5dc_1px,transparent_1px),linear-gradient(90deg,#dfe5dc_1px,transparent_1px)] [background-size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-36 top-20 -z-10 size-[520px] rounded-full bg-[#dfff85]/35 blur-[110px]"
      />

      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12"
      >
        <a
          href="#top"
          aria-label="ClearPath home"
          className="flex items-center gap-3"
        >
          <span className="grid size-10 place-items-center rounded-[13px] bg-[#102b20] text-[#dfff85] shadow-[0_8px_24px_rgba(16,43,32,0.2)]">
            <Route className="size-5" />
          </span>
          <span className="text-[17px] font-[750] tracking-[-0.04em]">
            ClearPath
          </span>
        </a>
        <div className="hidden items-center gap-8 text-[13px] font-[650] text-[#516158] md:flex">
          <a href="#platform" className="transition hover:text-[#112119]">
            Platform
          </a>
          <a href="#workflow" className="transition hover:text-[#112119]">
            How it works
          </a>
          <a href="#studio" className="transition hover:text-[#112119]">
            Live studio
          </a>
        </div>
        <a
          href="#studio"
          className="group inline-flex h-10 items-center gap-2 rounded-full bg-[#102b20] px-4 text-[12px] font-[750] text-white shadow-[0_8px_22px_rgba(16,43,32,0.18)] transition hover:-translate-y-0.5 hover:bg-[#193d2e]"
        >
          Launch studio{' '}
          <ArrowUpRight className="size-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </nav>

      <div
        id="top"
        className="mx-auto grid max-w-[1440px] items-center gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:pb-24 lg:pt-24"
      >
        <div className="landing-rise max-w-[650px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#bdcabf] bg-white/75 py-1.5 pl-2 pr-3 text-[11px] font-[750] uppercase tracking-[0.12em] text-[#405349] shadow-sm backdrop-blur">
            <span className="grid size-5 place-items-center rounded-full bg-[#dfff85] text-[#193b2b]">
              <Sparkles className="size-3" />
            </span>
            Built for the agentic web
          </div>
          <h1 className="max-w-[720px] text-[clamp(3.5rem,7vw,7.8rem)] font-[780] leading-[0.84] tracking-[-0.075em]">
            Access is
            <br />a design{' '}
            <span className="relative whitespace-nowrap text-[#2d694d]">
              decision.
              <svg
                aria-hidden="true"
                viewBox="0 0 330 20"
                className="absolute -bottom-2 left-0 w-full text-[#b4ed57]"
              >
                <path
                  d="M4 13 C80 2, 235 20, 326 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-9 max-w-[570px] text-[17px] font-[480] leading-7 text-[#53635a] sm:text-[19px]">
            ClearPath gives people and AI agents one shared canvas to audit
            spaces, stage safer routes, and approve every change before it
            becomes real.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#studio"
              className="group inline-flex h-13 items-center gap-3 rounded-full bg-[#102b20] px-6 text-[13px] font-[750] text-white shadow-[0_14px_32px_rgba(16,43,32,0.2)] transition hover:-translate-y-0.5 hover:bg-[#193d2e]"
            >
              Explore the live studio{' '}
              <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </a>
            <a
              href="#workflow"
              className="inline-flex h-13 items-center gap-2 rounded-full border border-[#bdc9c0] bg-white/70 px-5 text-[13px] font-[700] text-[#304238] backdrop-blur transition hover:border-[#8da092] hover:bg-white"
            >
              <ScanLine className="size-4" /> See the workflow
            </a>
          </div>
          <div className="mt-12 grid max-w-[520px] grid-cols-3 border-t border-[#ccd6ce] pt-6">
            {proof.map((item) => (
              <div key={item.label}>
                <p className="text-2xl font-[760] tracking-[-0.05em]">
                  {item.value}
                </p>
                <p className="mt-1 text-[10px] font-[650] uppercase tracking-[0.11em] text-[#738078]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-rise landing-rise-delay relative mx-auto w-full max-w-[810px] lg:mx-0">
          <div className="absolute -left-6 top-24 z-20 hidden w-[178px] rounded-2xl border border-white/70 bg-white/90 p-3.5 shadow-[0_24px_55px_rgba(25,54,39,0.16)] backdrop-blur xl:block">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-[750] uppercase tracking-[0.13em] text-[#718078]">
                Route score
              </span>
              <span className="size-2 rounded-full bg-[#52a566] shadow-[0_0_0_4px_#e1f1e4]" />
            </div>
            <p className="mt-3 text-4xl font-[780] tracking-[-0.07em]">
              94<span className="text-sm text-[#879189]">/100</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5ebe4]">
              <div className="h-full w-[94%] rounded-full bg-[#5aa35e]" />
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-[#bfcbbf] bg-[#e9eee7] shadow-[0_38px_100px_rgba(31,55,41,0.2)] ring-1 ring-white/80">
            <div className="flex h-12 items-center justify-between border-b border-[#d2ddd2] bg-white px-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-[#ff8a64]" />
                <span className="size-2.5 rounded-full bg-[#f0c45a]" />
                <span className="size-2.5 rounded-full bg-[#78b978]" />
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[#f0f4ef] px-3 py-1 text-[9px] font-[700] text-[#58665e]">
                <ShieldCheck className="size-3 text-[#3f8558]" /> Human approval
                required
              </div>
              <div className="w-12" />
            </div>
            <div className="grid min-h-[490px] grid-cols-[116px_1fr] sm:grid-cols-[155px_1fr]">
              <div className="border-r border-[#d1dbd1] bg-[#f7f9f5] p-3 sm:p-4">
                <div className="mb-5 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-[#153d2d] text-[#dfff85]">
                    <Route className="size-3.5" />
                  </span>
                  <span className="hidden text-[11px] font-[750] sm:block">
                    ClearPath
                  </span>
                </div>
                {['North Hall', 'Harbor Clinic', 'Juniper Café'].map(
                  (name, index) => (
                    <div
                      key={name}
                      className={`mb-2 rounded-xl p-2.5 ${index === 0 ? 'border border-[#c6d2c5] bg-white shadow-sm' : 'text-[#7c8880]'}`}
                    >
                      <p className="truncate text-[9px] font-[750]">{name}</p>
                      <p className="mt-1 text-[7px]">
                        {index === 0
                          ? '3 issues'
                          : index === 1
                            ? '2 issues'
                            : '1 issue'}
                      </p>
                    </div>
                  ),
                )}
              </div>
              <div className="min-w-0 p-3 sm:p-5">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <p className="text-[8px] font-[750] uppercase tracking-[0.14em] text-[#849088]">
                      Live floor plan
                    </p>
                    <p className="mt-1 text-base font-[780] sm:text-lg">
                      North Hall
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-[8px] font-[750] shadow-sm">
                    Agent online
                  </span>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    ['68', 'Route score'],
                    ['42', 'Seats'],
                    ['3', 'Issues'],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#d2dcd2] bg-white p-2.5"
                    >
                      <p className="text-base font-[780] sm:text-xl">{value}</p>
                      <p className="text-[7px] font-[650] uppercase tracking-[0.09em] text-[#7c8880]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="relative min-h-[315px] overflow-hidden rounded-2xl border border-[#c9d4c8] bg-[#fbfcf8] p-4 [background-image:linear-gradient(#e6ebe4_1px,transparent_1px),linear-gradient(90deg,#e6ebe4_1px,transparent_1px)] [background-size:22px_22px]">
                  <svg
                    viewBox="0 0 600 340"
                    className="h-full w-full"
                    aria-label="Preview of an accessible route through a floor plan"
                  >
                    <rect
                      x="35"
                      y="24"
                      width="530"
                      height="285"
                      rx="8"
                      fill="#fff"
                      stroke="#6f8277"
                      strokeWidth="3"
                    />
                    <path
                      d="M36 270 L115 270 L115 75 L455 75 L455 260"
                      fill="none"
                      stroke="#baf16a"
                      strokeWidth="26"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity=".36"
                    />
                    <path
                      d="M36 270 L115 270 L115 75 L455 75 L455 260"
                      fill="none"
                      stroke="#38794f"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="10 9"
                      className="route-dash"
                    />
                    {[0, 1, 2].flatMap((row) =>
                      [0, 1, 2].map((col) => (
                        <rect
                          key={`${row}-${col}`}
                          x={175 + col * 100}
                          y={118 + row * 60}
                          width="60"
                          height="32"
                          rx="6"
                          fill="#edf1eb"
                          stroke="#a8b6aa"
                        />
                      )),
                    )}
                    <circle
                      cx="38"
                      cy="270"
                      r="8"
                      fill="#163f31"
                      stroke="#dfff85"
                      strokeWidth="4"
                    />
                    <circle
                      cx="455"
                      cy="260"
                      r="8"
                      fill="#163f31"
                      stroke="#dfff85"
                      strokeWidth="4"
                    />
                    <rect
                      x="470"
                      y="218"
                      width="72"
                      height="52"
                      rx="7"
                      fill="#fff0e8"
                      stroke="#df6b3d"
                      strokeWidth="2"
                    />
                    <text
                      x="506"
                      y="248"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#a94725"
                    >
                      BLOCKED
                    </text>
                  </svg>
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-[#cad6ca] bg-white/95 p-2.5 shadow-lg backdrop-blur">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-lg bg-[#173f31] text-[#dfff85]">
                        <Bot className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-[8px] font-[750]">
                          Proposal ready to review
                        </p>
                        <p className="text-[7px] text-[#76837b]">
                          2 moves · capacity preserved
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-[#dfff85] px-2 py-1 text-[8px] font-[750] text-[#21452f]">
                      Compare
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-7 right-4 z-20 rounded-2xl border border-[#c7d3c8] bg-[#143a2b] p-4 text-white shadow-[0_22px_55px_rgba(20,58,43,0.3)] sm:right-8 sm:w-[240px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-[750] uppercase tracking-[0.13em] text-white/55">
                Agent action
              </span>
              <Check className="size-4 text-[#dfff85]" />
            </div>
            <p className="mt-2 text-[11px] font-[720]">
              Clearance improved by 49 cm
            </p>
            <p className="mt-1 text-[9px] text-white/55">
              Locked objects unchanged
            </p>
          </div>
        </div>
      </div>

      <div
        id="platform"
        className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12"
      >
        <div className="grid overflow-hidden rounded-[28px] border border-[#c6d2c7] bg-white md:grid-cols-3">
          <Feature
            icon={<ScanLine />}
            number="01"
            title="Audit what matters"
            copy="Agents read structured route constraints instead of guessing from pixels."
          />
          <Feature
            icon={<Layers3 />}
            number="02"
            title="Stage, never overwrite"
            copy="Every proposed move appears as a visual diff against the original plan."
          />
          <Feature
            icon={<FileCheck2 />}
            number="03"
            title="Approve with context"
            copy="Humans keep the final say, with metrics, rationale, and undo built in."
          />
        </div>
      </div>

      <div
        id="workflow"
        className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-12"
      >
        <div className="grid gap-8 rounded-[30px] bg-[#112c21] p-7 text-white sm:p-10 lg:grid-cols-[0.7fr_1.3fr] lg:p-14">
          <div>
            <p className="text-[10px] font-[750] uppercase tracking-[0.16em] text-[#dfff85]">
              A safer agent workflow
            </p>
            <h2 className="mt-4 max-w-sm text-4xl font-[760] leading-[1.02] tracking-[-0.055em] sm:text-5xl">
              AI speed.
              <br />
              Human judgment.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
              ClearPath turns an opaque agent action into a reviewable sequence
              anyone can understand.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkflowStep
              step="01"
              title="Ask naturally"
              copy="Describe the destination, capacity, and objects that cannot move."
            />
            <WorkflowStep
              step="02"
              title="Inspect the audit"
              copy="See bottlenecks ranked by severity on the shared canvas."
            />
            <WorkflowStep
              step="03"
              title="Compare the proposal"
              copy="Review every move and the measurable accessibility gain."
            />
            <WorkflowStep
              step="04"
              title="Approve or undo"
              copy="Apply intentionally. Roll back instantly if the result is wrong."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({
  icon,
  number,
  title,
  copy,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="group border-b border-[#d6dfd7] p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 sm:p-8">
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#eef4ea] text-[#2d694d] transition group-hover:bg-[#dfff85] [&_svg]:size-5">
          {icon}
        </span>
        <span className="text-[10px] font-[750] text-[#929c95]">{number}</span>
      </div>
      <h3 className="mt-8 text-xl font-[760] tracking-[-0.035em]">{title}</h3>
      <p className="mt-2 max-w-xs text-[13px] leading-5 text-[#6d7971]">
        {copy}
      </p>
    </article>
  );
}

function WorkflowStep({
  step,
  title,
  copy,
}: {
  step: string;
  title: string;
  copy: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition hover:border-[#dfff85]/40 hover:bg-white/[0.08]">
      <span className="text-[9px] font-[750] text-[#dfff85]">{step}</span>
      <h3 className="mt-5 text-base font-[730]">{title}</h3>
      <p className="mt-2 text-[11px] leading-5 text-white/50">{copy}</p>
    </article>
  );
}

function LandingFooter() {
  return (
    <footer className="flex flex-col items-start justify-between gap-4 bg-[#0d2119] px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-[10px] bg-[#dfff85] text-[#153629]">
          <Route className="size-4" />
        </span>
        <span className="text-sm font-[750]">ClearPath</span>
      </div>
      <p className="max-w-xl text-[10px] leading-5 text-white/45">
        A WebMCP-native accessibility planning prototype. Planning aid only—not
        a substitute for local code review or a qualified accessibility
        professional.
      </p>
    </footer>
  );
}

function PlanCanvas({
  phase,
  selectedIssueId,
  scenario,
}: {
  phase: PlanPhase;
  selectedIssueId: string;
  scenario: ScenarioId;
}) {
  const improved = phase !== 'baseline';
  const destination =
    scenario === 'classroom'
      ? 'PRESENTATION WALL'
      : scenario === 'clinic'
        ? 'EXAM ROOMS'
        : 'SERVICE COUNTER';
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[#ccd8cc] bg-[#fdfdfa] shadow-[0_16px_45px_rgba(39,65,48,0.08)]">
      <div className="flex h-11 items-center justify-between border-b border-[#dce4dc] bg-white px-3">
        <div className="flex items-center gap-1">
          <Tool icon={<MousePointer2 />} active />
          <Tool icon={<DoorOpen />} />
          <span className="mx-1 h-5 w-px bg-[#dce4dc]" />
          <button className="rounded-md px-2 py-1 text-[10px] font-semibold text-[#607067] hover:bg-[#eff4ee]">
            80%
          </button>
          <ChevronDown className="size-3 text-[#879289]" />
        </div>
        <div className="flex items-center gap-2">
          {phase === 'staged' && (
            <Badge className="animate-pulse bg-[#e7f5c4] text-[9px] text-[#426128]">
              <Eye /> Staged preview
            </Badge>
          )}
          {phase === 'applied' && (
            <Badge className="bg-[#dff1e4] text-[9px] text-[#306d45]">
              <Check /> Applied
            </Badge>
          )}
          <div className="hidden items-center gap-1.5 text-[10px] font-semibold text-[#67756c] sm:flex">
            <span className="size-2 rounded-sm bg-[#e97a48]" /> Blocked
            <span className="ml-1 size-2 rounded-sm bg-[#a8c966]" /> Clear
          </div>
        </div>
      </div>
      <div className="relative aspect-[1.5/1] min-h-[390px] bg-[linear-gradient(#e6ece5_1px,transparent_1px),linear-gradient(90deg,#e6ece5_1px,transparent_1px)] bg-[size:24px_24px] p-4">
        <svg
          viewBox="0 0 850 520"
          aria-labelledby="floor-plan-title"
          className="h-full w-full drop-shadow-[0_8px_20px_rgba(38,65,48,0.08)]"
        >
          <title id="floor-plan-title">
            Interactive venue floor plan with an accessible route
          </title>
          <rect
            x="70"
            y="42"
            width="710"
            height="430"
            rx="6"
            fill="#fffef9"
            stroke="#809487"
            strokeWidth="5"
          />
          <rect x="68" y="365" width="12" height="78" fill="#fffef9" />
          <path
            d="M70 365 A78 78 0 0 1 148 443"
            fill="none"
            stroke="#8ca094"
            strokeWidth="3"
            strokeDasharray="5 5"
          />
          <path
            d={
              improved
                ? 'M78 405 L176 405 L176 94 L655 94 L655 414'
                : 'M78 405 L176 405 L176 94 L655 94 L655 414'
            }
            fill="none"
            stroke={improved ? '#75b94f' : '#aacb62'}
            strokeWidth={improved ? 42 : 28}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.24"
          />
          <path
            d="M78 405 L176 405 L176 94 L655 94 L655 414"
            fill="none"
            stroke={improved ? '#418e4d' : '#6fa046'}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="10 9"
          />
          <circle
            cx="78"
            cy="405"
            r="10"
            fill="#183f31"
            stroke="#dfff9a"
            strokeWidth="5"
          />
          <circle
            cx="655"
            cy="414"
            r="10"
            fill="#183f31"
            stroke="#dfff9a"
            strokeWidth="5"
          />
          <rect
            x="214"
            y="56"
            width="410"
            height="50"
            rx="7"
            fill="#dfe9dc"
            stroke="#9eb19e"
            strokeWidth="2"
          />
          <text
            x="419"
            y="87"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#43574a"
          >
            {destination} · LOCKED
          </text>
          <g transform="translate(585 66)">
            <Lock width="16" height="16" color="#52675a" />
          </g>
          {desks.map(([baseX, y], index) => {
            const x = improved && index === 11 ? baseX - 55 : baseX;
            const highlighted =
              selectedIssueId.includes('desk') && index === 11;
            return (
              <g key={index} className="transition-all duration-700">
                {phase === 'staged' && index === 11 && (
                  <rect
                    x={baseX}
                    y={y}
                    width="76"
                    height="52"
                    rx="7"
                    fill="none"
                    stroke="#9fa9a1"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                    opacity="0.6"
                  />
                )}
                <rect
                  x={x}
                  y={y}
                  width="76"
                  height="52"
                  rx="7"
                  fill={
                    highlighted
                      ? '#fde2d5'
                      : improved && index === 11
                        ? '#e4f3dc'
                        : '#e9eee7'
                  }
                  stroke={
                    highlighted
                      ? '#df6b3d'
                      : improved && index === 11
                        ? '#57924e'
                        : '#a9b8aa'
                  }
                  strokeWidth={
                    highlighted || (improved && index === 11) ? 3 : 2
                  }
                />
                <circle
                  cx={x + 19}
                  cy={y + 64}
                  r="8"
                  fill="#f7f9f5"
                  stroke="#a9b8aa"
                  strokeWidth="2"
                />
                <circle
                  cx={x + 57}
                  cy={y + 64}
                  r="8"
                  fill="#f7f9f5"
                  stroke="#a9b8aa"
                  strokeWidth="2"
                />
              </g>
            );
          })}
          {phase === 'staged' && (
            <rect
              x="670"
              y="360"
              width="82"
              height="70"
              rx="8"
              fill="none"
              stroke="#9fa9a1"
              strokeWidth="2"
              strokeDasharray="6 6"
              opacity="0.65"
            />
          )}
          <rect
            x={improved ? 685 : 670}
            y={improved ? 260 : 360}
            width="82"
            height="70"
            rx="8"
            fill={improved ? '#e5f3dc' : '#fff0e8'}
            stroke={improved ? '#57924e' : '#df6b3d'}
            strokeWidth="3"
          />
          <text
            x={improved ? 726 : 711}
            y={improved ? 290 : 390}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fill={improved ? '#3e7040' : '#a94725'}
          >
            STORAGE
          </text>
          <text
            x={improved ? 726 : 711}
            y={improved ? 308 : 408}
            textAnchor="middle"
            fontSize="10"
            fill={improved ? '#3e7040' : '#a94725'}
          >
            {improved ? 'route cleared' : 'narrows route'}
          </text>
          {!improved && (
            <>
              <circle
                cx="670"
                cy="396"
                r="21"
                fill="none"
                stroke="#df6b3d"
                strokeWidth="3"
                strokeDasharray="5 5"
              />
              <line
                x1="660"
                y1="386"
                x2="680"
                y2="406"
                stroke="#df6b3d"
                strokeWidth="3"
              />
              <line
                x1="680"
                y1="386"
                x2="660"
                y2="406"
                stroke="#df6b3d"
                strokeWidth="3"
              />
            </>
          )}
        </svg>
        <div className="absolute bottom-5 left-5 flex items-center gap-2 rounded-xl border border-[#cbd7cb] bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <ShieldCheck className="size-4 text-[#37794e]" />
          <div>
            <p className="text-[10px] font-bold">Local planning model</p>
            <p className="text-[9px] text-[#748078]">
              No floor-plan data leaves this page
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparePanel({
  baseline,
  current,
  hasProposal,
  onStage,
}: {
  baseline: PlanMetrics;
  current: PlanMetrics;
  hasProposal: boolean;
  onStage: () => void;
}) {
  if (!hasProposal)
    return (
      <div className="grid min-h-[480px] place-items-center rounded-[20px] border border-[#ccd8cc] bg-white p-8 text-center">
        <div>
          <Eye className="mx-auto size-8 text-[#668071]" />
          <h2 className="mt-4 text-xl font-bold">Nothing to compare yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#718078]">
            Stage an agent proposal first. ClearPath will preserve the original
            and show every metric change side by side.
          </p>
          <Button onClick={onStage} className="mt-5 bg-[#173f31] text-white">
            <Sparkles /> Stage proposal
          </Button>
        </div>
      </div>
    );
  return (
    <div className="min-h-[480px] rounded-[20px] border border-[#ccd8cc] bg-white p-5 shadow-[0_16px_45px_rgba(39,65,48,0.08)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#748178]">
            Version comparison
          </p>
          <h2 className="mt-1 text-xl font-bold">Safer route, same capacity</h2>
        </div>
        <Badge className="bg-[#e7f5c4] text-[#3f662d]">
          +{current.score - baseline.score} score
        </Badge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <VersionCard title="Original plan" metrics={baseline} muted />
        <VersionCard title="Agent proposal" metrics={current} />
      </div>
      <div className="mt-4 rounded-xl bg-[#f1f6ef] p-4">
        <p className="text-[11px] font-bold">Change explanation</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[#65736a]">
          Two movable objects leave the constrained route. Locked destinations
          remain untouched, seat capacity is preserved, and minimum clearance
          increases by{' '}
          {current.minimumClearanceCm - baseline.minimumClearanceCm} cm.
        </p>
      </div>
    </div>
  );
}

function VersionCard({
  title,
  metrics,
  muted = false,
}: {
  title: string;
  metrics: PlanMetrics;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${muted ? 'border-[#dde4dc] bg-[#f7f9f5]' : 'border-[#bcd4b8] bg-[#f1f9ed]'}`}
    >
      <p className="text-[11px] font-bold">{title}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
        <div>
          <dt className="text-[#79857d]">Route score</dt>
          <dd className="mt-1 text-xl font-bold">{metrics.score}</dd>
        </div>
        <div>
          <dt className="text-[#79857d]">Clearance</dt>
          <dd className="mt-1 text-xl font-bold">
            {metrics.minimumClearanceCm}
            <span className="text-[9px]"> cm</span>
          </dd>
        </div>
        <div>
          <dt className="text-[#79857d]">Capacity</dt>
          <dd className="mt-1 font-bold">{metrics.capacity} seats</dd>
        </div>
        <div>
          <dt className="text-[#79857d]">Open issues</dt>
          <dd className="mt-1 font-bold">{metrics.openIssues}</dd>
        </div>
      </dl>
    </div>
  );
}

function HistoryPanel({
  phase,
  venueName,
}: {
  phase: PlanPhase;
  venueName: string;
}) {
  const events = [
    {
      title: 'Venue opened',
      detail: `${venueName} loaded into the shared planning session.`,
    },
    {
      title: 'Route audit completed',
      detail: 'Deterministic geometry checks returned prioritized issues.',
    },
    ...(phase !== 'baseline'
      ? [
          {
            title: 'Proposal staged',
            detail:
              'Movable objects repositioned; locked objects and capacity preserved.',
          },
        ]
      : []),
    ...(phase === 'applied'
      ? [
          {
            title: 'Human approval recorded',
            detail:
              'The reviewed proposal became the current plan. Undo remains available.',
          },
        ]
      : []),
  ];
  return (
    <div className="min-h-[480px] rounded-[20px] border border-[#ccd8cc] bg-white p-5 shadow-[0_16px_45px_rgba(39,65,48,0.08)]">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[#eaf3e3]">
          <History className="size-4 text-[#467250]" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#748178]">
            Reviewable history
          </p>
          <h2 className="text-xl font-bold">Human-agent audit trail</h2>
        </div>
      </div>
      <div className="mt-7 space-y-0">
        {events.map((event, index) => (
          <div key={event.title} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span className="grid size-6 place-items-center rounded-full bg-[#173f31] text-[9px] font-bold text-white">
                {index + 1}
              </span>
              {index < events.length - 1 && (
                <span className="h-12 w-px bg-[#cad8ca]" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold">{event.title}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#728078]">
                {event.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[11px] ${active ? 'bg-[#edf4ec] font-bold text-[#214737]' : 'font-semibold text-[#76837b] hover:bg-[#f2f5f0]'}`}
    >
      {children}
    </button>
  );
}

function Metric({
  icon,
  value,
  suffix,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  suffix: string;
  label: string;
  tone: 'lime' | 'green' | 'orange';
}) {
  const colors = {
    lime: 'bg-[#e9f4c8] text-[#42601f]',
    green: 'bg-[#dff0e4] text-[#2f6d46]',
    orange: 'bg-[#ffeadf] text-[#a84a26]',
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#d5dfd4] bg-white px-3 py-3 shadow-[0_5px_18px_rgba(38,63,46,0.04)] sm:px-4">
      <span
        className={`hidden size-9 shrink-0 place-items-center rounded-xl sm:grid [&_svg]:size-4 ${colors[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-semibold text-[#758179]">
          {label}
        </p>
        <p className="mt-0.5 text-lg font-bold tracking-[-0.04em]">
          {value}
          <span className="text-[10px] font-semibold text-[#809087]">
            {suffix}
          </span>
        </p>
      </div>
    </div>
  );
}

function Tool({
  icon,
  active = false,
}: {
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      aria-label="Canvas tool"
      className={`grid size-7 place-items-center rounded-md [&_svg]:size-3.5 ${active ? 'bg-[#173f31] text-white' : 'text-[#637068] hover:bg-[#eef3ec]'}`}
    >
      {icon}
    </button>
  );
}
