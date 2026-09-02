# ClearPath

ClearPath is a WebMCP-native accessibility planning studio where people and AI agents work on the same live floor plan. The human supplies goals, locks non-negotiable objects, reviews visual differences, and approves changes. The agent reads structured geometry, prioritizes route issues, and stages reversible improvements.

## Why WebMCP

A floor-plan canvas contains meaningful spatial state that is unreliable to reconstruct from DOM controls or screenshots. ClearPath exposes that state as focused browser tools. Every tool uses the same deterministic planning functions and React state as the visible interface, so tool calls produce immediate, reviewable changes on screen.

The current tool surface is:

| Tool | Purpose |
| --- | --- |
| `get_plan_summary` | Read the current venue, metrics, issues, and proposal state. |
| `audit_access_routes` | Return prioritized route issues and object references. |
| `focus_audit_issue` | Highlight one issue visibly on the floor plan. |
| `stage_route_improvement` | Create a reversible proposal while preserving locks and capacity. |
| `compare_plan_versions` | Open the before/after comparison and return its metrics. |
| `apply_staged_plan` | Commit a reviewed proposal. This tool is registered only while a proposal is staged. |
| `undo_plan_change` | Restore the original plan. |

Read-only tools use `readOnlyHint`. All inputs are narrow JSON Schemas and are validated again in the execution boundary. Unsupported browsers retain the complete human interface.

## Human-agent safety model

- Changes are staged before they can be applied.
- Locked objects and requested capacity are deterministic constraints.
- A visible comparison explains what moved and why.
- Applied changes remain undoable.
- Tool output is concise and contains object IDs rather than hidden instructions.
- Floor-plan state remains client-side.

ClearPath is a planning aid, not building-code certification or a substitute for a qualified accessibility professional.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the printed local URL in ChatGPT's built-in browser, or in a compatible Chrome build with WebMCP testing enabled.

## Verify

```bash
npm test
npm run build
```

## Hackathon work

This project was created from scratch during the 2026 WebMCP Challenge submission period. The repository includes the full application, deterministic planning engine, WebMCP integration, tests, branded social asset, submission copy, and demonstration script.

## License

MIT. See [LICENSE](LICENSE).

