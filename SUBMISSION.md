# Devpost submission draft

## Elevator pitch

ClearPath turns an opaque floor-plan canvas into a shared workspace where a person and their AI agent can audit accessible routes, explore constrained layout alternatives, compare measurable trade-offs, and approve reversible improvements together.

## Inspiration

Browser agents are increasingly capable, but visual editing surfaces remain difficult to use reliably: the meaningful state lives in geometry, selection, constraints, and history rather than ordinary page text. Accessibility planning also requires context and judgment that should remain human-controlled. ClearPath connects those two problems.

## What it does

A venue planner opens a classroom, clinic, or café floor plan and sees route score, capacity, clearance, and prioritized issues. An agent can use WebMCP to read the exact spatial state, highlight a problem, stage a layout improvement, open a before/after comparison, and apply the proposal. Locked objects remain fixed, capacity is preserved, every change is visible, and the human can reject or undo it.

## Why WebMCP is the right fit

Without WebMCP, an agent must infer geometry from a canvas or reproduce a fragile sequence of pointer operations. ClearPath exposes the plan's real domain operations directly from the live page. The agent and person share the same current venue, selected issue, staged proposal, metrics, and history. `apply_staged_plan` is dynamically available only when there is something visible to approve.

## How it creates a better experience

The agent searches structured alternatives quickly while the human protects design intent and owns consequential decisions. Instead of an unexplained automatic redesign, ClearPath provides a visible proposal, quantified trade-offs, preserved constraints, plain-language reasoning, approval, and undo.

## Implementation

ClearPath uses imperative `document.modelContext.registerTool()` calls on the top-level page. Six core tools are registered for reading, auditing, focusing, staging, comparing, and undoing. A seventh commit tool is registered dynamically only during the staged state. The tool layer reuses the application's typed planning engine and React actions, validates every input at execution time, annotates read-only tools, and unregisters tools with `AbortSignal` lifecycle cleanup.

The planning engine is deterministic and fully client-side. Automated tests verify that every seeded venue improves route score and clearance without losing capacity, that staged and applied metrics agree, and that impossible capacity requests fail without corrupting state.

## Impact

ClearPath demonstrates how agent-native visual tools could help small venues, schools, clinics, event teams, and accessibility professionals explore layouts earlier and more collaboratively. It is explicitly a planning aid rather than compliance certification.

