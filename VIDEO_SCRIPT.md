# ClearPath demo script — 2:45 target

## 0:00–0:15 — Establish the problem

Open `/studio` on the North Hall classroom. Point to the measured Desk 3 corridor intrusion, 10 cm minimum centreline clearance, 20 cm centred clear width, and the route/required zones drawn from the same model. Show that the presentation wall remains physical geometry and that the route approaches its target perpendicularly.

Say: “ClearPath is an accessibility planning aid. This is calculated geometry, not a scripted score and not legal certification.”

## 0:15–0:35 — Audit through real WebMCP

Prompt ChatGPT:

> Audit the current access route and focus the most severe measured issue.

Show the real `audit_access_routes` result: plan version, route length, clearance, capacity, score, object ID, severity, and measured/required values. Then show `focus_audit_issue` visibly highlighting the referenced object.

## 0:35–0:55 — Prove structured state

Prompt:

> Give me the exact geometry behind that issue, including the route points, object coordinates, locks, and required zones.

Briefly show `get_plan_geometry`. Emphasize that walls, terminal-contact semantics, object identity, centimetre coordinates, capacity contribution, locks, and semantic zones cannot be recovered reliably from pixels.

## 0:55–1:15 — Add human constraints

In the visible UI, lock Desk 8 and leave required capacity at 24. Then prompt:

> Respect my current locks and all 24 seats. Generate the two best route alternatives.

Show two different full-capacity `generate_route_alternatives` results. Point out the **Threshold satisfied** status, different change coordinates, search rationale, and trade-offs—not just differently worded copies. The top option moves Desk 3 from `(600, 130)` to `(520, 130)`, preserves 24 seats, reaches 90 cm centred clear width, clears all issues, and scores 98.

## 1:15–1:40 — Stage and compare

Prompt:

> Stage the highest-ranked alternative and compare it with the committed version.

Show the ghost rectangles at original positions and proposed objects at their generated coordinates. Show `compare_plan_versions`: before/after metrics, proposal status, exact changes, resolved/remaining issues, preserved constraints, and trade-offs.

## 1:40–2:00 — Human approval gate

Prompt:

> Request approval for this staged plan. Do not commit it silently.

Show `apply_staged_plan` returning `approvalRequired: true` and `committed: false`. The comparison opens. Explicitly click **Approve and apply** yourself.

Say: “The agent can prepare the decision. A person commits it.”

## 2:00–2:20 — Re-audit the applied geometry

Prompt:

> Re-audit the now-committed plan and explain exactly what changed.

Show that the returned version and metrics match the visible applied plan and that resolved issues changed because coordinates changed.

## 2:20–2:35 — History and exact undo

Prompt:

> Show the audit history, then undo the last approved plan change.

Show real actor/action/result/version records. Run undo and show the exact original geometry and metrics restored.

## 2:35–2:45 — Close on WebMCP

Say: “DOM clicking or screenshot interpretation cannot reliably reproduce route topology, centimetre clearance, hidden locks, version lineage, candidate validity, or exact deltas. WebMCP lets the agent reason over the same structured plan the human reviews.”

End on the ClearPath wordmark and disclaimer.

## Recording checklist

- Use real ChatGPT/WebMCP tool calls, not only UI clicks.
- Keep tool payloads readable long enough to see coordinates and deltas.
- Show two alternatives side by side.
- Do not call the heuristic a compliance score or certification.
- Do not imply rotated-object collision support or multi-user persistence.
