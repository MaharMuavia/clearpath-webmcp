# ClearPath — final pre-submission remediation prompt

Paste everything below into a fresh Claude Code session opened at the repo root.

---

You are doing the final pre-submission hardening pass on ClearPath, a WebMCP hackathon
submission at this repo root. An audit has already been run; the findings below are
**verified against the actual code and a live run of the engine**, not guesses. Do not
re-derive them — fix them.

Ground rules for this pass:

- **Never weaken a claim by deleting the feature it describes.** Where docs and code
  disagree, decide which one is right, fix that side, and make the other match.
- **Every numeric claim in a doc must be produced by a test that asserts it.** If you
  write a number in README/SUBMISSION/EVALUATION/VIDEO_SCRIPT, there must be a
  corresponding `expect(...)` on that exact value. No exceptions.
- Run `npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run build`
  after each group. Do not report a group done until you have pasted the passing output.
- Do not add features, scenarios, dependencies, or docs the task does not name.
- Keep all existing tests and public function signatures working.

Work through the groups in order. Report per group: what changed, what you verified, what
you deliberately left alone.

---

## GROUP 1 — Blockers (do these first; the submission fails without them)

**1.1 The deployed URL is dead.**
`https://clearpath-access.hanzlakhan2266.chatgpt.site/studio` returns **HTTP 401
Unauthorized**. `README.md` links it twice in the hero as "Open the deployed application"
and "Launch the deployed studio". A judge clicking either gets a 401.
Do not attempt to fix the hosting yourself. Instead:
  - Verify the current status yourself with a request to both `/` and `/studio` and report
    the exact status codes.
  - If still 401: remove the two dead hero links and replace them with a single honest
    line stating the app runs locally via `npm ci && npm run dev`, and add a
    `## Deployment` section stating the deployment is not yet publicly reachable and the
    URL must be re-verified before submission.
  - Also remove or de-link the same URL from `app/layout.tsx`'s `metadataBase` **only if**
    you replace it with a working origin; otherwise leave `metadataBase` alone and note it.
  - Leave a single, unmissable `> **BEFORE SUBMITTING:**` callout at the top of README
    listing: redeploy, re-verify both URLs return 200, re-verify CI is green on the pushed
    commit, and record the CI run URL.

**1.2 The headline coordinate in the docs is wrong.**
`README.md:65` and `VIDEO_SCRIPT.md:31` both say the top proposal moves Desk 3 from
`(600, 130)` to **`(520, 130)`**. The engine actually produces **`(530, 130)`**
(offset table entry `[-70, 0]`; `(520,130)` comes from `[-80, 0]` and ranks *second*
on movement distance). The video script would be narrated wrong on camera and the demo
would visibly contradict the README.
Fix: change both docs to `(530, 130)` with `distanceCm: 70`, and add a test that asserts
the top proposal's exact `changes[0]` object for the fixture at `minimumCapacity: 24`.

Verified engine output for the fixture (use these as your source of truth):
```
BASELINE: score=61 capacity=24 openIssues=1 criticalIssues=1 reviewIssues=0
          minimumCenterlineClearanceCm=10 minimumClearWidthCm=20 routeLengthCm=1048
ISSUES:   route-corridor:desk-3 (critical, measuredCm=20)
min=24 →  1. desk-3 (600,130)→(530,130) 70cm  threshold-satisfied cap=24 score=98 cw=90
          2. desk-3 (600,130)→(710,430) 320cm threshold-satisfied cap=24 score=98 cw=90
          3. desk-3 (600,130)→(760,130) 160cm partial-improvement cap=24 score=88 cw=90
min=22 →  1. (530,130) ts cap=24 score=98  2. (710,430) ts cap=24 score=98
          3. desk-3 remove  ts cap=22 score=90
```

---

## GROUP 2 — Integrity: the human-in-the-loop claim is not actually enforced

**2.1 Agent actions are recorded in the audit trail as `human`.** This is the most
damaging finding, because the whole pitch is "a person commits it."
`components/studio/clearpath-studio.tsx:192-199` (`undo`) and `:180-191` (`reject`) hardcode
`'human'` as the actor. Both are wired into `actions` and are reachable from the
`undo_plan_change` and `reject_staged_plan` WebMCP tools. So an agent-initiated undo or
rejection is written into `session.history` as `actor: 'human'`.
Also, `undoLastChange` in `lib/planning-session.ts:312` takes `actor: 'human'` but — unlike
`applyStagedProposal:238` — has **no runtime guard** rejecting a non-human actor.
Fix all of it:
  - Thread the real actor through: UI button handlers pass `'human'`, WebMCP tool paths pass
    `'agent'`. Add an `actor` parameter to the `undo` and `rejectProposal` entries in
    `ToolActions` (`hooks/use-clearpath-tools.ts:24-32`), or give the studio separate
    human/agent callbacks — your call, but the tool path must not be able to write `'human'`.
  - Widen `undoLastChange`'s actor type to `AuditActor` (undo is genuinely agent-permitted;
    only *commit* is human-only) and keep the human-only runtime guard on
    `applyStagedProposal`.
  - Add tests asserting that a tool-driven undo and a tool-driven reject each produce an
    event with `actor: 'agent'`, and that a UI-driven one produces `actor: 'human'`. The
    existing session tests call `undoLastChange(session, 'human')` directly and therefore
    never exercise the tool path — that is why this was invisible.

**2.2 README claims test coverage that does not exist.**
`README.md:65` ends: "These values are derived by the engine and asserted independently in
tests." Grep confirms **no test asserts** score 61, score 98, 1048 cm, 20 cm, 90 cm, or the
Desk 3 coordinate. Only `capacity` is asserted (`lib/planning-engine.test.ts:404,440`).
Fix by making the claim true, not by deleting it: add a fixture-regression test in
`lib/planning-engine.test.ts` that asserts every number quoted in README §"Real geometry and
scoring" — baseline metrics object, baseline issue id/severity/measuredCm, and the top three
proposals' id, status, capacity, score, clear width, and exact `changes`.

**2.3 Test counts contradict each other across the docs.**
Actual: **64** Vitest tests in 3 files, **8** Playwright tests. `README.md:127` says 64
(correct). `SUBMISSION.md:30` says 61. `EVALUATION.md:20` says 61. Make all three say the
real number *after* you have added the tests from 1.2/2.1/2.2, and re-run to get the final
count rather than guessing it.

**2.4 The "Threshold satisfied" gate is documented more loosely than it is implemented.**
`README.md` says a proposal is labelled Threshold satisfied "only when it has zero critical
issues, reaches the 90 cm planning threshold, and preserves the configured minimum capacity."
But `satisfiesPlanningThresholds` (`lib/planning-engine.ts:1017`) *also* requires
`audit.issues.length === 0` — i.e. zero **review** issues too. That stricter rule is what
makes proposal 3 above `partial-improvement` despite hitting 90 cm. Update the README to
state the real condition (zero open issues of any severity, ≥90 cm, ≥ minimum capacity).

**2.5 The documented score formula does not match the code.**
README lists "2 per moved object". `auditPlan` subtracts `changedObjects * 2`, and
`changedObjects` counts objects whose `x`, `y`, **or `active`** differ from baseline — so
removals and restorations are penalised too, while `movedObjects` (position only) is computed
and never used in the score. Either change the doc to "2 per changed object (moved, removed,
or restored)" or change the code to use `movedObjects`. Pick one, say which, and make the
score test cover the removal case so the choice is pinned.

---

## GROUP 3 — Correctness and spec conformance

**3.1 The per-execution `AbortSignal` is ignored.**
Both the [WebMCP draft](https://webmachinelearning.github.io/webmcp/) and the
[Chrome imperative API docs](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
define `execute(inputObject, { signal })`. `ToolDefinition.execute` in
`hooks/use-clearpath-tools.ts:22` is typed `(input: unknown) => unknown` and never receives
or honours the signal. `generate_route_alternatives` is the one genuinely long-running tool
(bounded beam search, up to 1,500 states) and is completely uncancellable.
Fix: widen the signature to `(input: unknown, options?: { signal?: AbortSignal }) => unknown`,
thread the signal into `generateRouteAlternatives` via an optional `signal` on `SearchLimits`
or a new parameter, and check `signal.aborted` inside the beam-search state loop, throwing on
abort **without mutating session state**. Add a unit test that aborts mid-search and asserts
committed geometry and constraints are untouched.
*(The return value is fine — the spec serialises `Promise<any>` to JSON, so returning plain
objects is conformant. Do not change that.)*

**3.2 Overlap validation exempts the destination entirely.**
`lib/planning-engine.ts:773-781` skips the overlap check whenever *either* object has
`kind === 'destination'`. A desk can therefore be validly placed on top of the presentation
wall. It is not reachable today only because no entry in the offset table has a negative
`dy`. Tighten it so destination-vs-destination is exempt (or drop the exemption entirely
if nothing depends on it) while furniture-vs-destination overlap is rejected, and add a test
that places a desk over the presentation wall and expects `validatePlan` to fail.

**3.3 Half the candidate offset table is dead code.**
`candidateChanges` (`lib/planning-engine.ts:955`) defines **14** offsets, but
`DEFAULT_SEARCH_LIMITS.maxCandidatesPerObject = 7` and the call site does
`.slice(0, limits.maxCandidatesPerObject)` — so offsets 8–14 are never evaluated, and when a
removal candidate is prepended only **6** moves are tried. Additionally `[110, 300]` and
`[160, 110]` are unexplained fixture-tuned magic numbers that happen to manufacture the
"three distinct options" the demo shows.
Fix: delete the unreachable offsets or raise the limit so they are reachable (state which and
why), and add a short comment deriving the surviving offsets from the geometry (desk pitch,
corridor half-width, minimum furniture separation) rather than leaving them as bare numbers.
Re-run the fixture and update any doc numbers this changes — including 1.2's.

**3.4 Two different rounding paths for the same measurement.**
Per-issue: `clearWidthCm = Math.round(centerlineClearanceCm * 2)`
(`planning-engine.ts:~522`). Metric: `minimumClearWidthCm = Math.round(centerline) * 2`
(`:~575`). For a clearance of 10.4 cm these give **21** and **20**, so an issue card and the
metric tile can disagree by 1 cm on screen and in tool output. Round once, in one place, and
add a test with a deliberately fractional clearance asserting the issue's `measuredCm` equals
`minimumClearWidthCm`.

**3.5 The canvas is not actually model-driven.**
README says the studio "renders the plan directly from current model data", but
`clearpath-studio.tsx:598` hardcodes `viewBox="0 0 900 600"`. Use
`viewBox={\`0 0 ${plan.width} ${plan.height}\`}`.

---

## GROUP 4 — Accessibility (this is an accessibility product; judges will check)

**4.1 Eight muted text colours fail WCAG AA.** All are used at 9–12px, which is *normal*
text and therefore needs **4.5:1**, not 3:1. Measured against the actual backgrounds:

| Colour | on white | on `#f8faf6` | on `#edf2ec` |
|---|---|---|---|
| `#8a958e` (history timestamps, 9px) | **3.10** | 2.95 | 2.73 |
| `#87938b` (heuristic disclaimer) | **3.19** | 3.04 | 2.82 |
| `#79867e` | **3.80** | 3.62 | 3.35 |
| `#78857d` | **3.85** | 3.67 | 3.40 |
| `#76837b` | **3.96** | 3.77 | 3.49 |
| `#758179` | **4.06** | 3.87 | 3.58 |
| `#748178` | **4.07** | 3.88 | 3.59 |
| `#718078` (most common muted text) | **4.15** | 3.95 | 3.66 |

Darken each until it clears **4.5:1 against the darkest background it is actually rendered
on** (`#edf2ec`, not white) — `#5d6f63` (4.72 on page) and `#65736a` (4.39 on page, still
short) show the neighbourhood you need; go darker than both. Keep the palette coherent —
collapse these eight near-identical greys into two or three tokens. Then add a unit test
that computes the WCAG contrast ratio for every foreground/background token pair used in the
studio and fails below 4.5:1, so this cannot regress.

**4.2 The tabs are not real tabs.** `clearpath-studio.tsx:369-383` uses `role="tablist"` and
`role="tab"` with `aria-selected`, but there is no `aria-controls`, no `role="tabpanel"` on
any of the three rendered views, no `id` wiring, and no roving `tabindex` or arrow-key
handling. This fails the ARIA Authoring Practices tab pattern. Either implement the pattern
fully (ids, `aria-controls`, `tabpanel` + `aria-labelledby`, roving tabindex, Left/Right/Home/
End keys) or drop the tab roles and ship plain buttons with `aria-pressed`. Add a Playwright
assertion for whichever you choose.

**4.3 SVG semantics are not exposed.** `<svg>` at `:597` has `aria-labelledby` but no
`role="img"`; and each object `<g>` at `:675` carries an `aria-label` with **no role**, which
most assistive tech does not expose at all. Add `role="img"` to the svg and give each `<g>`
an explicit role (or move the label onto a `<title>` child of the group). Then have the
staged/moved/removed state announced somewhere a screen reader reaches without the SVG — the
existing `aria-live` region is the natural place.

---

## GROUP 5 — Hygiene

- `.gitignore` does not cover `test-results/` or `playwright-report/`. `test-results/` is
  already untracked-and-present. Add both.
- `EVALUATION.md` has an empty `## Honest gaps` heading immediately followed by another `##`.
  Fill it with the real residual gaps or delete the heading.
- `clearpath-studio.tsx:317` hardcodes `max="24"` on the capacity input while
  `use-clearpath-tools.ts:87` derives `maximumCapacity` from the model. Derive it in both.
- `CompareView`'s capacity trade-off prints "No capacity loss." when capacity *increases*
  via a restoration. Handle the positive-delta case.
- `proposalContextFingerprint` (`:865`) iterates code points with `for...of` but hashes with
  `charCodeAt(0)`, so any non-BMP character in a plan name hashes only its high surrogate.
  Use `codePointAt(0)`. (32-bit FNV-1a is acceptable for this scope — do not replace it,
  but say so in the README's safety section instead of calling it just "a deterministic
  fingerprint".)
- There is no `not-found` or error boundary and no `robots`/`sitemap`. Add them only if
  Group 1–4 are fully green and verified; they are the lowest priority here.

---

## Final gate

Before you report done:

1. Paste passing output for `npm run typecheck`, `npm run lint`, `npm test`,
   `npm run test:e2e`, `npm run build`, and `npm audit --audit-level=high`.
2. Re-run the fixture and confirm **every** number in README, SUBMISSION.md,
   EVALUATION.md and VIDEO_SCRIPT.md matches the engine's real output.
3. List any claim in those four docs you could not substantiate, and either soften it to
   what is true or delete it. Do not leave an unverifiable claim standing.
4. Commit on a branch with a message describing the fixes. Do not push or open a PR
   unless asked.
