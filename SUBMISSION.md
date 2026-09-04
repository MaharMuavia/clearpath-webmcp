# Devpost submission draft

## Elevator pitch

ClearPath is a WebMCP-native accessibility planning studio that turns structured floor-plan geometry into measurable route audits, constraint-safe layout alternatives, and human-approved reversible changes.

## Inspiration

Visual planning surfaces hide their most important state in coordinates, topology, semantic zones, locks, constraints, and version history. Screenshots and DOM clicking cannot recover that state reliably. Accessibility decisions also need visible human judgment rather than silent automation. ClearPath connects both needs.

## What it does

ClearPath models one credible classroom in centimetres. A deterministic computational-geometry engine finds route intersections, centreline clearance, centred clear width, destination-wall clearance, turning-space overlap, entrance approach conflicts, active capacity, route length, and changed objects. The physical presentation wall is audited on every non-terminal route segment; only a verified perpendicular terminal contact receives a one-half-corridor approach exemption. A bounded beam search ranks valid move/removal/restoration combinations lexicographically while enforcing locks, capacity, boundaries, and non-overlap. Capacity loss is ranked before disruption, so lowering the minimum does not silently request seat removal.

The agent can read geometry, audit, focus an issue, set constraints, generate alternatives, stage a proposal, and compare exact versions. Staging never changes committed geometry. The dynamic apply tool only opens a visible approval gate; a human must approve the consequential change. Rejection preserves the committed plan and undo restores the exact previous geometry.

## Why WebMCP

WebMCP gives the agent structured route points, centimetre measurements, object IDs, locks, active capacity contributions, semantic zones, proposal changes, status, metric deltas, and version lineage. Those facts are not reliably available from pixels. The agent and human operate on the same state and see the same changes.

Tools use the current imperative `document.modelContext.registerTool()` interface, runtime input validation, narrow schemas with `additionalProperties: false`, accurate annotations, concise outputs, and `AbortSignal` cleanup. Tools register only on `/studio`; `apply_staged_plan` exists only while a current proposal is staged.

## Technical evidence

- Typed plan, object, route, zone, proposal, constraint, and audit-event domains.
- Model-driven SVG with staged ghost positions.
- Deterministic geometry and documented heuristic score.
- Bounded ranked proposal search with hard constraints.
- Exact committed/staged versions, stale-ID rejection, real events, and exact undo.
- 76 unit/contract tests and 9 Chromium workflows passing locally.
- CI is configured for type checking, lint, tests, build, and browser workflows. The final revision is committed locally; CI and deployment identifiers must be recorded from their actual runs before submission.
- `npm audit` reports zero vulnerabilities after compatible upgrades.

## Scope and disclaimer

The former clinic and café were removed because they did not contain independent geometry. One honest classroom scenario is stronger evidence than three scripted skins. ClearPath is a planning aid, not accessibility certification or a substitute for qualified local review.

Native ChatGPT WebMCP selection and deployment of the final source revision remain pending manual verification and must be completed before these materials are submitted.
