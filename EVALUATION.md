# ClearPath WebMCP evaluation

Date: 2026-09-02. Evaluation uses the imperative `document.modelContext` contract, calculated classroom fixture, Vitest contract tests, and Chromium end-to-end tests. “Pass” means the selected tool and returned/visible state matched the expectation; it does not mean legal accessibility certification.

| # | Natural-language prompt | Expected tool selection | Recorded result | Outcome |
| --- | --- | --- | --- | --- |
| 1 | What plan is open and what are its current route metrics? | `get_plan_summary` | Returned plan/version, constraints, calculated metrics, issue IDs, and heuristic disclaimer matching the UI. | Pass |
| 2 | Give me the exact geometry the audit is using. | `get_plan_geometry` | Returned centimetre dimensions, route points, objects, locks, capacity, turning zone, and door zone. | Pass |
| 3 | Audit every access-route issue. | `audit_access_routes` | Returned geometry-derived critical/review issues and visible score; unknown input fields were rejected. | Pass |
| 4 | Focus the most severe open issue. | `audit_access_routes` → `focus_audit_issue` | Current issue ID was accepted and the canvas/announcement visibly focused it. | Pass |
| 5 | Require all 24 seats and clear proposals made under old constraints. | `set_planning_constraints` | Set 24 and invalidated staged/generated alternatives. | Pass |
| 6 | Generate different valid layout alternatives without moving locked objects. | `generate_route_alternatives` | Returned at least two distinct movement signatures; unit checks confirmed locks, bounds, capacity, and non-overlap. | Pass |
| 7 | Stage option one without changing the committed plan. | `stage_route_proposal` | Ghost preview and comparison appeared; committed version remained unchanged. | Pass |
| 8 | Compare the staged plan with its baseline. | `compare_plan_versions` | Returned baseline/proposed metrics, deltas, exact movements, resolved/remaining issues, constraints, rationale, and trade-offs. | Pass |
| 9 | Apply the staged plan. | `apply_staged_plan` | Returned `approvalRequired: true`, `committed: false`, and opened the visible approval gate; human click applied it. | Pass |
| 10 | Reject a staged plan, then try its old ID; also undo an approved change. | `reject_staged_plan` / `undo_plan_change` | Rejection preserved committed geometry; dynamic apply disappeared; stale apply failed; undo restored exact prior geometry. | Pass |

## Automated evidence

- Vitest: 3 files, 7 tests passing.
- Chromium: 6 end-to-end workflows passing.
- Landing-page tool absence and studio-only tool registration: passing.
- Dynamic `apply_staged_plan` lifecycle: passing.
- Unsupported/no-WebMCP human workflow: passing.

## Honest gaps

This evaluation uses a browser WebMCP mock matching the current imperative interface because the automated Chromium runtime does not provide ChatGPT's native WebMCP host. Real ChatGPT tool calls must still be shown in the submission recording. Rotated-polygon collision and jurisdiction-specific rules are outside the current scope.
