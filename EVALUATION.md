# ClearPath WebMCP evaluation

Date: 2026-09-03. Automated evaluation uses the imperative `document.modelContext` contract, calculated classroom fixture, Vitest contract tests, and mock-host Chromium workflows. “Pass” means direct tool execution and returned/visible state matched the expectation; it does not prove that ChatGPT selected the tool from natural language and does not mean legal accessibility certification.

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

- Vitest: 3 files, 61 tests passing locally.
- Chromium: 8 mock-host browser workflows passing locally in 51.9 seconds.
- Landing-page tool absence and studio-only tool registration: passing.
- Dynamic `apply_staged_plan` lifecycle: passing.
- Unsupported/no-WebMCP human workflow: passing.
- Destination-aware clearance, terminal contact, plan diagnostics, full fingerprint invalidation, capacity-preserving ranking, explicit removal/restoration, runtime human-only commit, and narrow-layout actions: passing.

CI for the final working tree has not run because the changes are not committed or pushed. The deployed URL has not been verified against this source revision.

## Honest gaps

## Native ChatGPT/WebMCP verification

The automated browser does not provide ChatGPT's native WebMCP host. These checks must be performed manually against the deployed build; all remain **pending manual verification**:

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
