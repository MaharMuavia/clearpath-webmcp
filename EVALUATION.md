# ClearPath WebMCP evaluation

Date: 2026-09-04. Automated evaluation uses the imperative `document.modelContext` contract, calculated classroom fixture, Vitest contract tests, and mock-host Chromium workflows. “Pass” means direct tool execution and returned/visible state matched the expectation; it does not prove that ChatGPT selected the tool from natural language and does not mean legal accessibility certification.

| #   | Scenario prompt                                                             | Expected tool selection                     | Automated contract result                                                                                                                                          | Outcome |
| --- | --------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | What plan is open and what are its current route metrics?                   | `get_plan_summary`                          | Returned plan/version, constraints, calculated metrics, issue IDs, and heuristic disclaimer matching the UI.                                                       | Pass    |
| 2   | Give me the exact geometry the audit is using.                              | `get_plan_geometry`                         | Returned centimetre dimensions/scale, walls, route points, physical destination and terminal-contact rule, objects, locks, capacity, turning zone, and door zone.  | Pass    |
| 3   | Audit every access-route issue.                                             | `audit_access_routes`                       | Returned geometry-derived critical/review issues and visible score; unknown input fields were rejected.                                                            | Pass    |
| 4   | Focus the most severe open issue.                                           | `audit_access_routes` → `focus_audit_issue` | Current issue ID was accepted and the canvas/announcement visibly focused it.                                                                                      | Pass    |
| 5   | Require all 24 seats and clear proposals made under old constraints.        | `set_planning_constraints`                  | Set 24 and invalidated staged/generated alternatives.                                                                                                              | Pass    |
| 6   | Generate different valid layout alternatives without moving locked objects. | `generate_route_alternatives`               | Returned two distinct full-capacity alternatives at minimum 24; checks confirmed locks, bounds, capacity, non-overlap, deterministic ordering, and bounded search. | Pass    |
| 7   | Stage option one without changing the committed plan.                       | `stage_route_proposal`                      | Ghost preview and comparison appeared; committed version remained unchanged.                                                                                       | Pass    |
| 8   | Compare the staged plan with its baseline.                                  | `compare_plan_versions`                     | Returned status, baseline/proposed metrics, deltas, exact move/removal changes, resolved/remaining issues, constraints, rationale, and trade-offs.                 | Pass    |
| 9   | Apply the staged plan.                                                      | `apply_staged_plan`                         | Returned `approvalRequired: true`, `committed: false`, and opened the visible approval gate; human click applied it.                                               | Pass    |
| 10  | Reject a staged plan, then try its old ID; also undo an approved change.    | `reject_staged_plan` / `undo_plan_change`   | Rejection preserved committed geometry; dynamic apply disappeared; stale apply failed; undo restored exact prior geometry.                                         | Pass    |

## Automated evidence

- Vitest: 5 files, 76 tests passing locally.
- Chromium: 9 workflows passing locally against the final working tree.
- Landing-page tool absence and studio-only tool registration: passing.
- Dynamic `apply_staged_plan` lifecycle: passing.
- Unsupported/no-WebMCP human workflow: passing.
- Destination-aware clearance, terminal contact, plan diagnostics, full fingerprint invalidation, capacity-preserving ranking, explicit removal/restoration, runtime human-only commit, and narrow-layout actions: passing.

The public deployment was verified on 2026-09-04 against source commit `8e323b019acb0d774c03d63497bea32691efb0ac`.

## Deployed-build verification (mock host)

The checks in this section were run on 2026-09-04 against the **live deployment** at
`https://clearpath-access.hanzlakhan2266.chatgpt.site`, not against a local development server.
They close a specific gap: the Chromium workflows above exercise `npm run dev` on localhost, so
until now nothing confirmed that the built and deployed bundle registers and behaves identically.

Method and its limits, stated plainly: the testing browser did not expose `document.modelContext`
(WebMCP was unavailable), so a mock host was installed on the page and each tool's `execute` was
invoked directly by name. **This is mock-host evidence against the deployed build. It is not
native-host evidence, and it says nothing about whether an agent selects the correct tool from
natural language** — that remains the first row of the next section.

| Deployed-build check | Observed |
| --- | --- |
| Tool registration on `/studio` | 7 base tools |
| Tool registration on `/` | 0 tools |
| Dynamic surface after `generate_route_alternatives` | 9 tools (`stage_route_proposal`, `compare_plan_versions` appear) |
| Dynamic surface while staged | 11 tools (`apply_staged_plan`, `reject_staged_plan` appear) |
| Baseline metrics | score 61, 20 cm centred clear width, 24 seats, 1,048 cm route, one critical `route-corridor:desk-3` |
| Top proposal | `desk-3` (600, 130) → (530, 130), 70 cm, 90 cm clear width, 24 seats, score 98, threshold-satisfied |
| Committed version after staging | unchanged at `north-hall-v1` |
| Agent `apply_staged_plan` | returned `approvalRequired: true`, `committed: false`; committed version **unchanged** at `north-hall-v1` |
| Human approval click | committed advanced to `north-hall-v1-proposal-desk-3-move-530-130`; score 98, 90 cm, 0 open issues |
| `undo_plan_change` | restored `north-hall-v1`; score 61, 20 cm, 24 seats |
| Tool surface after undo | `undo_plan_change` withdrawn; 7 tools |

Every figure above matches the values documented in `README.md`, recomputed by the deployed engine
rather than read from a fixture.

The audit trail recorded for that sequence was:

```text
system/plan_opened/successful
human/object_locked/successful           (visible UI lock toggle)
agent/alternatives_generated/successful  (tool call)
agent/proposal_staged/successful         (tool call)
agent/approval_requested/successful      (tool call)
human/proposal_applied/successful        (visible approval button)
agent/plan_change_undone/undone          (tool call)
```

Actor attribution is therefore correct in the deployed build: UI-initiated actions record `human`,
tool-initiated actions record `agent`, and only the visible approval button advanced the committed
version.

Tools not exercised in this deployed run, and still covered only by the local suites above:
`get_plan_geometry`, `audit_access_routes`, `focus_audit_issue`, `set_planning_constraints`,
`compare_plan_versions`, `reject_staged_plan`, and stale-proposal-ID rejection.

## Honest gaps

Native ChatGPT tool discovery and selection remain untested in this environment. Rotated-object collision uses axis-aligned bounds, the planning thresholds are not jurisdiction-specific rules, and browser-local state is not multi-user persistence.

## Native ChatGPT/WebMCP verification

No browser available in this environment provides ChatGPT's native WebMCP host, so none of the ten
checks below has been run. They must be performed manually against the deployed build and all
remain **pending manual verification**.

These are deliberately not inferred from the section above. The deployed-build results show that the
shipped application registers the expected tools and enforces the approval boundary when a host
calls `execute` — so if a native host shows no tools, that points at host availability or
enablement rather than at application behaviour. It does **not** establish that ChatGPT discovers
the tools or selects the right one from natural language, which is what these rows measure.

| Check                                          | Result                      |
| ---------------------------------------------- | --------------------------- |
| Tool discovery on `/studio` and absence on `/` | Pending manual verification |
| Correct natural-language tool selection        | Pending manual verification |
| Multi-tool audit and focus workflow            | Pending manual verification |
| Constraint handling                            | Pending manual verification |
| Alternative generation                         | Pending manual verification |
| Staging and comparison                         | Pending manual verification |
| Human approval request without commit          | Pending manual verification |
| Re-audit after human application               | Pending manual verification |
| History, including approval request            | Pending manual verification |
| Exact undo                                     | Pending manual verification |

Rotated-polygon collision and jurisdiction-specific rules are outside the current scope. Native ChatGPT results must not be inferred from the passing mock host.
