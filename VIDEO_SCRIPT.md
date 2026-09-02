# ClearPath demo script — target 2:35

## 0:00–0:18 — The problem

“AI agents can fill forms, but a floor-plan canvas is different. Its meaning lives in geometry, constraints, and visual state. This classroom has a blocked accessible route, and ordinary browser automation cannot reliably reason about it.”

## 0:18–0:42 — Shared state

Show North Hall, the 68 route score, 42-seat capacity, and three issues. Open Site tools.

“ClearPath exposes the live plan through focused WebMCP tools. The person and agent share this exact page, venue, issue selection, and plan history.”

## 0:42–1:08 — Agent audit

Prompt: “Audit this plan and focus the most serious accessibility issue.”

Show `audit_access_routes` followed by `focus_audit_issue`. The storage bottleneck becomes selected.

“The agent receives structured object references rather than guessing from pixels, and its focus call updates the same interface I’m reviewing.”

## 1:08–1:38 — Constrained proposal

Prompt: “Stage a better route. Preserve at least 40 seats and do not move locked objects.”

Show the storage cabinet and desk move, ghost positions, score rise to 94, and staged badge.

“The planning engine rejects impossible constraints, preserves the locked presentation wall and all 42 seats, and stages changes before anything is committed.”

## 1:38–2:02 — Compare

Prompt: “Compare this proposal with the original.”

Show the comparison panel: score, clearance, capacity, open issues, and explanation.

“This is the collaboration boundary: the agent explores; the human reviews the visible trade-off.”

## 2:02–2:22 — Human approval and auditability

Click Approve or ask the agent to apply the staged plan. Open History, then Undo.

“The commit tool exists only while a proposal is staged. Approval is recorded, and every applied change remains reversible.”

## 2:22–2:35 — Close

“ClearPath shows what WebMCP unlocks beyond form filling: safe, agent-native collaboration inside complex visual software.”

