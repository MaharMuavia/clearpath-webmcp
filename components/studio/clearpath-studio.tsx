'use client';

import {
  Accessibility,
  Bot,
  Check,
  Eye,
  History,
  Lock,
  Route,
  Sparkles,
  Undo2,
  Unlock,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { useClearPathTools } from '@/hooks/use-clearpath-tools';
import {
  auditPlan,
  createClassroomPlan,
  type AuditIssue,
  type FloorPlan,
  type PlanChange,
  type PlanningConstraints,
} from '@/lib/planning-engine';
import {
  applyStagedProposal,
  createPlanningSession,
  generateAlternatives,
  rejectStagedProposal,
  requestProposalApproval,
  setConstraints,
  setObjectLock,
  stageProposal,
  undoLastChange,
  visiblePlan,
  type PlanningSession,
} from '@/lib/planning-session';

type View = 'plan' | 'compare' | 'history';

function describeChange(change: PlanChange): string {
  if (change.type === 'move')
    return `${change.objectName} ${change.distanceCm} cm`;
  if (change.type === 'remove')
    return `${change.objectName} removed (${change.previousCapacity} seats)`;
  return `${change.objectName} restored (${change.restoredCapacity} seats)`;
}

function Button({
  className = '',
  variant = 'solid',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'solid' | 'outline';
}) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${variant === 'outline' ? 'border border-[#c9d7c9] bg-white text-[#294838]' : ''} ${className}`}
    />
  );
}
function Badge({
  className = '',
  variant = 'solid',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: 'solid' | 'outline' }) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${variant === 'outline' ? 'border border-[#cad6ca] bg-white' : ''} ${className}`}
    />
  );
}

export function ClearPathStudio() {
  const [session, setSession] = useState(() =>
    createPlanningSession(createClassroomPlan()),
  );
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    document.documentElement.dataset.clearpathReady = 'true';
    return () => {
      delete document.documentElement.dataset.clearpathReady;
    };
  }, []);
  const [view, setView] = useState<View>('plan');
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    'Structured plan loaded. Run or review the live geometry audit.',
  );
  const [error, setError] = useState<string | null>(null);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const plan = visiblePlan(session);
  const audit = useMemo(
    () => auditPlan(plan, session.baseline),
    [plan, session.baseline],
  );

  const transition = useCallback(
    (
      operation: (current: PlanningSession) => PlanningSession,
      message: (next: PlanningSession) => string,
    ) => {
      try {
        const next = operation(sessionRef.current);
        sessionRef.current = next;
        setSession(next);
        setError(null);
        setAnnouncement(message(next));
        return next;
      } catch (caught) {
        if (caught instanceof Error && 'session' in caught) {
          const failed = (caught as Error & { session: PlanningSession })
            .session;
          sessionRef.current = failed;
          setSession(failed);
        }
        const text =
          caught instanceof Error ? caught.message : 'The operation failed.';
        setError(text);
        setAnnouncement(text);
        throw caught;
      }
    },
    [],
  );
  const focusIssue = useCallback((issueId: string) => {
    setSelectedIssueId(issueId);
    setView('plan');
    setAnnouncement(`Focused ${issueId} on the shared canvas.`);
  }, []);
  const changeConstraints = useCallback(
    (constraints: PlanningConstraints) =>
      transition(
        (current) => setConstraints(current, constraints, 'agent'),
        (next) =>
          `Minimum capacity is now ${next.constraints.minimumCapacity}.`,
      ),
    [transition],
  );
  const makeAlternatives = useCallback(
    () =>
      transition(
        (current) => generateAlternatives(current, 'agent'),
        (next) =>
          `${next.alternatives.length} distinct geometry-derived alternatives generated.`,
      ),
    [transition],
  );
  const stage = useCallback(
    (proposalId: string) => {
      setApprovalRequested(false);
      setView('compare');
      return transition(
        (current) => stageProposal(current, proposalId, 'agent'),
        (next) =>
          `${next.staged?.id} staged without changing the committed plan.`,
      );
    },
    [transition],
  );
  const requestApproval = useCallback(
    (proposalId: string) => {
      setApprovalRequested(true);
      setView('compare');
      return transition(
        (current) => requestProposalApproval(current, proposalId),
        () =>
          'Agent approval request recorded. Review the exact changes, then approve or reject them here.',
      );
    },
    [transition],
  );
  const reject = useCallback(
    (proposalId: string) => {
      if (sessionRef.current.staged?.id !== proposalId)
        throw new Error('Proposal is not staged.');
      setApprovalRequested(false);
      return transition(
        (current) => rejectStagedProposal(current, 'human'),
        () => `${proposalId} rejected; committed geometry unchanged.`,
      );
    },
    [transition],
  );
  const undo = useCallback(
    () =>
      transition(
        (current) => undoLastChange(current, 'human'),
        (next) => `Restored exact plan version ${next.committed.versionId}.`,
      ),
    [transition],
  );
  const actions = {
    focusIssue,
    setConstraints: changeConstraints,
    generateAlternatives: makeAlternatives,
    stageProposal: stage,
    requestApproval,
    rejectProposal: reject,
    undo,
  };
  useClearPathTools(session, actions);

  const apply = () => {
    if (!session.staged) return;
    const id = session.staged.id;
    setApprovalRequested(false);
    transition(
      (current) => applyStagedProposal(current, id, 'human'),
      (next) =>
        `Human approval recorded. ${next.committed.versionId} is now committed.`,
    );
  };
  const updateCapacity = (value: number) => {
    try {
      transition(
        (current) =>
          setConstraints(current, { minimumCapacity: value }, 'human'),
        (next) =>
          `Minimum capacity set to ${next.constraints.minimumCapacity}.`,
      );
    } catch {
      /* surfaced by transition */
    }
  };
  const toggleLock = (objectId: string, locked: boolean) => {
    try {
      transition(
        (current) => setObjectLock(current, objectId, locked, 'human'),
        () => `${objectId} ${locked ? 'locked' : 'unlocked'}.`,
      );
    } catch {
      /* surfaced by transition */
    }
  };
  const generate = () => {
    try {
      makeAlternatives();
    } catch {
      /* surfaced by transition */
    }
  };
  const selectedIssue = audit.issues.find(
    (issue) => issue.id === selectedIssueId,
  );

  return (
    <main className="min-h-screen bg-[#edf2ec] text-[#17221b]">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#d4ddd4] bg-[#f8faf6] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#163f31] text-[#dfff9a]">
            <Route className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2 font-bold">
              ClearPath{' '}
              <Badge className="bg-[#e8f6c9] text-xs text-[#315c22]">
                WebMCP
              </Badge>
            </div>
            <p className="text-[10px] uppercase tracking-[.12em] text-[#718078]">
              Geometry planning studio
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!session.undoStack.length}
            onClick={() => {
              try {
                undo();
              } catch {
                /* surfaced */
              }
            }}
          >
            <Undo2 /> Undo
          </Button>
          <Button
            onClick={() => setView('history')}
            className="bg-[#163f31] text-white"
          >
            <History /> Audit trail
          </Button>
        </div>
      </header>
      <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="border-r border-[#d4ddd4] bg-[#f5f8f2] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#79867e]">
            Current project
          </p>
          <div className="mt-2 rounded-2xl border border-[#bdcdbf] bg-white p-4 shadow-sm">
            <p className="font-bold">North Hall</p>
            <p className="mt-1 text-xs text-[#718078]">
              Workshop classroom · 9 × 6 m
            </p>
            <p className="mt-3 text-xs font-semibold">
              Version {session.committed.versionId}
            </p>
          </div>
          <div className="mt-5">
            <label htmlFor="capacity" className="text-xs font-bold">
              Required seat capacity
            </label>
            <input
              id="capacity"
              type="number"
              min="0"
              max="24"
              value={session.constraints.minimumCapacity}
              onChange={(event) => updateCapacity(Number(event.target.value))}
              className="mt-2 h-10 w-full rounded-xl border border-[#c7d3c7] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            />
            <p className="mt-1 text-[10px] text-[#748178]">
              Current model capacity: {audit.metrics.capacity}
            </p>
          </div>
          <div className="mt-5">
            <p className="text-xs font-bold">Object locks</p>
            <div className="mt-2 max-h-72 space-y-1 overflow-auto">
              {session.committed.objects
                .filter((object) => object.kind !== 'destination')
                .map((object) => (
                  <button
                    key={object.id}
                    onClick={() => toggleLock(object.id, !object.locked)}
                    aria-label={`${object.locked ? 'Unlock' : 'Lock'} ${object.name}`}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-white focus-visible:outline-2"
                  >
                    <span>{object.name}</span>
                    {object.locked ? (
                      <Lock className="size-3.5 text-[#9a5a28]" />
                    ) : (
                      <Unlock className="size-3.5 text-[#668071]" />
                    )}
                  </button>
                ))}
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-[#173f31] p-4 text-white">
            <p className="flex items-center gap-2 text-xs font-bold">
              <Bot className="size-4 text-[#dfff9a]" /> Agent boundary
            </p>
            <p className="mt-2 text-[10px] leading-5 text-white/65">
              The agent may audit, generate, and stage. Only the visible human
              approval button commits geometry.
            </p>
          </div>
        </aside>
        <section className="min-w-0 p-3 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#748178]">
                Live structured plan
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-.04em]">
                North Hall classroom
              </h1>
            </div>
            <div
              role="tablist"
              aria-label="Studio views"
              className="flex rounded-xl border border-[#d2ddd2] bg-white p-1"
            >
              {(['plan', 'compare', 'history'] as View[]).map((item) => (
                <button
                  role="tab"
                  aria-selected={view === item}
                  key={item}
                  onClick={() => setView(item)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${view === item ? 'bg-[#edf4ec] text-[#214737]' : 'text-[#76837b]'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Heuristic score"
              value={`${audit.metrics.score}/100`}
            />
            <Metric
              label="Centered clear width"
              value={`${audit.metrics.minimumClearWidthCm} cm`}
            />
            <Metric
              label="Capacity"
              value={`${audit.metrics.capacity} seats`}
            />
            <Metric
              label="Open issues"
              value={String(audit.metrics.openIssues)}
            />
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-[#e7b69c] bg-[#fff0e8] p-3 text-xs text-[#8b3f24]"
            >
              {error}
            </div>
          )}
          {view === 'plan' && (
            <PlanCanvas
              plan={plan}
              committed={session.committed}
              staged={session.staged !== null}
              selectedObjectId={selectedIssue?.objectId ?? null}
            />
          )}
          {view === 'compare' && (
            <CompareView
              session={session}
              approvalRequested={approvalRequested}
              onApply={apply}
              onReject={() => session.staged && reject(session.staged.id)}
            />
          )}
          {view === 'history' && <HistoryView session={session} />}
        </section>
        <aside className="border-l border-[#d4ddd4] bg-[#f8faf6] p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#79867e]">
                Live audit
              </p>
              <h2 className="mt-1 text-lg font-bold">Calculated issues</h2>
            </div>
            <Accessibility className="size-5 text-[#397352]" />
          </div>
          <div className="mt-4 space-y-2">
            {audit.issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                active={selectedIssueId === issue.id}
                onFocus={() => focusIssue(issue.id)}
              />
            ))}
            {!audit.issues.length && (
              <div className="rounded-xl border border-[#bbd8bd] bg-[#f0f9ed] p-4 text-center text-xs font-bold">
                <Check className="mx-auto mb-2 size-5 text-[#37824f]" />
                No measured issues remain
              </div>
            )}
          </div>
          <Button
            onClick={generate}
            className="mt-4 w-full bg-[#173f31] text-white"
          >
            <Sparkles /> Generate alternatives
          </Button>
          {!!session.alternatives.length && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#79867e]">
                Ranked alternatives
              </p>
              {session.alternatives.map((proposal, index) => (
                <button
                  key={proposal.id}
                  onClick={() => {
                    try {
                      stage(proposal.id);
                    } catch {
                      /* surfaced */
                    }
                  }}
                  className="w-full rounded-xl border border-[#d4ddd4] bg-white p-3 text-left hover:border-[#93ad97] focus-visible:outline-2"
                >
                  <div className="flex justify-between gap-2 text-xs font-bold">
                    <span>Option {index + 1}</span>
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                  <p className="mt-2 text-[10px] text-[#718078]">
                    {proposal.changes.map(describeChange).join(' · ')}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-[#3f5948]">
                    Capacity {proposal.after.metrics.capacity} · Score{' '}
                    {proposal.after.metrics.score} · Clear width{' '}
                    {proposal.after.metrics.minimumClearWidthCm} cm
                  </p>
                </button>
              ))}
            </div>
          )}
          <output
            aria-live="polite"
            className="mt-5 block rounded-xl border border-[#d8e2d7] bg-white p-3 text-[10px] leading-5 text-[#5d6f63]"
          >
            {announcement}
          </output>
          <p className="mt-4 text-xs leading-5 text-[#87938b]">
            Planning heuristic only. ClearPath does not certify legal
            compliance; thresholds vary by jurisdiction.
          </p>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d5dfd4] bg-white p-3">
      <p className="text-[10px] text-[#758179]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
function ProposalStatusBadge({
  status,
}: {
  status: 'threshold-satisfied' | 'partial-improvement';
}) {
  return (
    <Badge
      className={
        status === 'threshold-satisfied'
          ? 'bg-[#e7f5c4] text-[#3f662d]'
          : 'bg-[#fff0d6] text-[#795b16]'
      }
    >
      {status === 'threshold-satisfied'
        ? 'Threshold satisfied'
        : 'Partial improvement'}
    </Badge>
  );
}
function IssueCard({
  issue,
  active,
  onFocus,
}: {
  issue: AuditIssue;
  active: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      onClick={onFocus}
      className={`w-full rounded-xl border p-3 text-left focus-visible:outline-2 ${active ? 'border-[#d48a62] bg-[#fff7f1]' : 'border-[#dfe5dd] bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold">{issue.title}</span>
        <Badge
          variant="outline"
          className={
            issue.severity === 'critical'
              ? 'border-[#eab393] text-[#9a4828]'
              : 'border-[#decf92] text-[#806317]'
          }
        >
          {issue.severity}
        </Badge>
      </div>
      <p className="mt-1 text-[10px] leading-4 text-[#718078]">
        {issue.description}
      </p>
    </button>
  );
}

function PlanCanvas({
  plan,
  committed,
  staged,
  selectedObjectId,
}: {
  plan: FloorPlan;
  committed: FloorPlan;
  staged: boolean;
  selectedObjectId: string | null;
}) {
  const route = plan.route.map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div className="overflow-hidden rounded-[20px] border border-[#ccd8cc] bg-[#fdfdfa] shadow-[0_16px_45px_rgba(39,65,48,.08)]">
      <div className="flex items-center justify-between border-b border-[#dce4dc] bg-white px-4 py-3 text-xs">
        <span className="font-bold">Geometry canvas · centimetres</span>
        {staged ? (
          <Badge className="bg-[#e7f5c4] text-[#426128]">
            <Eye /> Staged ghost preview
          </Badge>
        ) : (
          <Badge variant="outline">Committed geometry</Badge>
        )}
      </div>
      <div className="bg-[linear-gradient(#e6ece5_1px,transparent_1px),linear-gradient(90deg,#e6ece5_1px,transparent_1px)] bg-[size:24px_24px] p-3">
        <svg
          viewBox="0 0 900 600"
          aria-labelledby="plan-title plan-description"
          className="h-auto w-full"
        >
          <title id="plan-title">North Hall accessibility plan</title>
          <desc id="plan-description">
            A structured classroom plan showing committed or staged geometry.
            Removed objects are faded and crossed out; moved objects show their
            original dashed outline.
          </desc>
          {plan.walls.map((wall) => (
            <line
              key={wall.id}
              x1={wall.start.x}
              y1={wall.start.y}
              x2={wall.end.x}
              y2={wall.end.y}
              stroke="#63796b"
              strokeWidth="6"
            />
          ))}
          {plan.doorZones.map((zone) => (
            <rect
              key={zone.id}
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              fill="#85b6dc"
              fillOpacity=".12"
              stroke="#5684a8"
              strokeDasharray="8 6"
            />
          ))}
          {plan.turningZones.map((zone) => (
            <circle
              key={zone.id}
              cx={zone.center.x}
              cy={zone.center.y}
              r={zone.radius}
              fill="#bddd8b"
              fillOpacity=".16"
              stroke="#7ea14e"
              strokeDasharray="8 6"
            />
          ))}
          <polyline
            points={route}
            fill="none"
            stroke="#8bc34f"
            strokeOpacity=".2"
            strokeWidth="90"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={route}
            fill="none"
            stroke="#397352"
            strokeWidth="5"
            strokeDasharray="12 9"
            strokeLinejoin="round"
          />
          {plan.objects.map((object) => {
            const original =
              committed.objects.find((item) => item.id === object.id) ?? object;
            const moved =
              staged &&
              object.active &&
              (original.x !== object.x || original.y !== object.y);
            const removed = !object.active;
            const selected = object.id === selectedObjectId;
            const x = removed ? original.x : object.x;
            const y = removed ? original.y : object.y;
            return (
              <g
                key={object.id}
                aria-label={`${object.name}${removed ? ', removed from usable layout' : moved ? ', moved in staged proposal' : ''}`}
              >
                {moved && (
                  <rect
                    x={original.x}
                    y={original.y}
                    width={original.width}
                    height={original.height}
                    rx="7"
                    fill="none"
                    stroke="#8e9991"
                    strokeWidth="2"
                    strokeDasharray="7 6"
                  />
                )}
                <rect
                  x={x}
                  y={y}
                  width={object.width}
                  height={object.height}
                  rx="7"
                  fill={
                    selected
                      ? '#ffe4d6'
                      : object.kind === 'destination'
                        ? '#dfe9dc'
                        : moved
                          ? '#e4f3dc'
                          : '#e9eee7'
                  }
                  fillOpacity={removed ? '.35' : '1'}
                  stroke={
                    removed
                      ? '#a54e37'
                      : selected
                        ? '#d45f32'
                        : moved
                          ? '#57924e'
                          : '#9eb09f'
                  }
                  strokeDasharray={removed ? '7 5' : undefined}
                  strokeWidth={selected || moved || removed ? 3 : 2}
                />
                {removed && (
                  <>
                    <line
                      x1={x + 8}
                      y1={y + 8}
                      x2={x + object.width - 8}
                      y2={y + object.height - 8}
                      stroke="#a54e37"
                      strokeWidth="4"
                    />
                    <line
                      x1={x + object.width - 8}
                      y1={y + 8}
                      x2={x + 8}
                      y2={y + object.height - 8}
                      stroke="#a54e37"
                      strokeWidth="4"
                    />
                  </>
                )}
                <text
                  x={x + object.width / 2}
                  y={y + object.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#43574a"
                >
                  {removed
                    ? 'REMOVED'
                    : object.kind === 'desk'
                      ? object.id.replace('desk-', 'D')
                      : object.name.toUpperCase()}
                </text>
                {object.locked && (
                  <text
                    x={x + object.width - 8}
                    y={y + 14}
                    textAnchor="end"
                    fontSize="10"
                  >
                    🔒
                  </text>
                )}
              </g>
            );
          })}
          <circle
            cx={plan.entrance.x}
            cy={plan.entrance.y}
            r="10"
            fill="#173f31"
            stroke="#dfff9a"
            strokeWidth="5"
          />
          <circle
            cx={plan.destination.x}
            cy={plan.destination.y}
            r="10"
            fill="#173f31"
            stroke="#dfff9a"
            strokeWidth="5"
          />
        </svg>
      </div>
    </div>
  );
}

function CompareView({
  session,
  approvalRequested,
  onApply,
  onReject,
}: {
  session: PlanningSession;
  approvalRequested: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const proposal = session.staged;
  if (!proposal)
    return (
      <div className="grid min-h-[480px] place-items-center rounded-[20px] border border-[#ccd8cc] bg-white p-8 text-center">
        <div>
          <Eye className="mx-auto size-8 text-[#668071]" />
          <h2 className="mt-4 text-xl font-bold">Nothing staged</h2>
          <p className="mt-2 text-xs text-[#718078]">
            Generate alternatives and stage one to compare exact
            geometry-derived results.
          </p>
        </div>
      </div>
    );
  const remainingCritical = proposal.after.issues.find(
    (issue) => issue.severity === 'critical',
  );
  const capacityDelta =
    proposal.after.metrics.capacity - proposal.before.metrics.capacity;
  return (
    <div className="min-h-[480px] rounded-[20px] border border-[#ccd8cc] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#748178]">
            Human approval gate
          </p>
          <h2 className="mt-1 text-xl font-bold">
            Exact before / after comparison
          </h2>
        </div>
        <ProposalStatusBadge status={proposal.status} />
      </div>
      {approvalRequested && (
        <div className="mt-4 rounded-xl border border-[#c5d797] bg-[#f4fadf] p-3 text-xs font-bold">
          The agent requested approval. No geometry has been committed.
        </div>
      )}
      {remainingCritical && (
        <div className="mt-4 rounded-xl border border-[#e7b69c] bg-[#fff0e8] p-3 text-xs">
          <strong>Most important remaining issue:</strong>{' '}
          {remainingCritical.title}. This is a partial improvement, not a
          cleared route.
        </div>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MetricPanel
          title="Committed baseline"
          metrics={proposal.before.metrics}
        />
        <MetricPanel title="Staged proposal" metrics={proposal.after.metrics} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailList
          title="Exact changes"
          items={proposal.changes.map((change) => {
            if (change.type === 'move')
              return `${change.objectName}: (${change.from.x}, ${change.from.y}) → (${change.to.x}, ${change.to.y}), ${change.distanceCm} cm`;
            if (change.type === 'remove')
              return `${change.objectName}: removed from usable layout, −${change.previousCapacity} seats`;
            return `${change.objectName}: restored to usable layout at (${change.to.x}, ${change.to.y}), +${change.restoredCapacity} seats`;
          })}
        />
        <DetailList
          title="Issue outcome"
          items={[
            `Resolved: ${proposal.resolvedIssueIds.length ? proposal.resolvedIssueIds.join(', ') : 'none'}`,
            `Remaining: ${proposal.remainingIssueIds.length ? proposal.remainingIssueIds.join(', ') : 'none'}`,
          ]}
        />
      </div>
      <div className="mt-3 rounded-xl bg-[#f1f6ef] p-4 text-[10px] leading-5 text-[#65736a]">
        <p className="font-bold text-[#273b2f]">Capacity trade-off</p>
        <p>
          {capacityDelta < 0
            ? `${Math.abs(capacityDelta)} seats removed; final capacity ${proposal.after.metrics.capacity}.`
            : 'No capacity loss.'}
        </p>
        <p className="mt-2 font-bold text-[#273b2f]">Search rationale</p>
        <p>{proposal.explanation}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onApply} className="bg-[#173f31] text-white">
          <Check /> Approve and apply
        </Button>
        <Button variant="outline" onClick={onReject}>
          <X /> Reject proposal
        </Button>
      </div>
    </div>
  );
}
function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[#d6dfd5] p-4">
      <p className="text-xs font-bold">{title}</p>
      <ul className="mt-2 space-y-1 text-[10px] leading-4 text-[#65736a]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
function MetricPanel({
  title,
  metrics,
}: {
  title: string;
  metrics: ReturnType<typeof auditPlan>['metrics'];
}) {
  return (
    <div className="rounded-2xl border border-[#d6dfd5] bg-[#f7f9f5] p-4">
      <p className="text-xs font-bold">{title}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[#78857d]">Score</dt>
          <dd className="text-xl font-bold">{metrics.score}</dd>
        </div>
        <div>
          <dt className="text-[#78857d]">Centered clear width</dt>
          <dd className="text-xl font-bold">
            {metrics.minimumClearWidthCm} cm
          </dd>
        </div>
        <div>
          <dt className="text-[#78857d]">Critical / review</dt>
          <dd className="font-bold">
            {metrics.criticalIssues} / {metrics.reviewIssues}
          </dd>
        </div>
        <div>
          <dt className="text-[#78857d]">Capacity</dt>
          <dd className="font-bold">{metrics.capacity}</dd>
        </div>
      </dl>
    </div>
  );
}
function HistoryView({ session }: { session: PlanningSession }) {
  return (
    <div className="min-h-[480px] rounded-[20px] border border-[#ccd8cc] bg-white p-5">
      <div className="flex items-center gap-3">
        <History className="size-5 text-[#397352]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#748178]">
            Immutable event records
          </p>
          <h2 className="text-xl font-bold">Human-agent audit trail</h2>
        </div>
      </div>
      <ol className="mt-6 space-y-3">
        {[...session.history].reverse().map((event) => (
          <li key={event.id} className="rounded-xl border border-[#dce4dc] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold">
                {event.action.replaceAll('_', ' ')}
              </p>
              <Badge variant="outline">
                {event.actor} · {event.result}
              </Badge>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-[#718078]">
              {event.summary}
            </p>
            <p className="mt-2 text-[9px] text-[#8a958e]">
              {event.beforeVersionId ?? '—'} → {event.afterVersionId ?? '—'} ·{' '}
              {new Date(event.timestamp).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
