# Agentic Storefront — Track 01 Build

Full spec lives in `docs/`. Read the relevant doc before touching a module — don't rely on this file alone.

- `docs/track1-context.md` — why this track, protocol context (ACP/AP2/UAP/x402), judging rubric.
- `docs/track1-agentic-storefront-architecture.md` — the actual spec: component diagram, sequence diagram, data model, TypeScript interfaces, build order (section 5).

## Non-negotiable design rule

The LLM never calls Razorpay directly. It only proposes actions (via `search_catalog` / `propose_cart` tools). Every proposal must pass through the Policy Engine (pure TypeScript, no model call) before the Razorpay Adapter executes anything. Do not add a tool that lets the model charge a card, issue a refund, or bypass the policy check — this is the core architectural claim of the whole project and it must hold structurally, not just by convention.

## Build order (see architecture doc section 5 for full detail)

1. Catalog service (in-memory or Mongo — see current phase decision below)
2. Policy Engine — pure functions, unit-tested, zero LLM/network calls
3. Mandate Ledger — hash-chained append-only records + a `verifyChain()` script
4. Razorpay Adapter — typed wrapper around Orders/Payments/Refunds (test mode only)
5. Agent Orchestrator — OpenAI tool-use loop, narrow read-heavy tool set
6. Failure Injector — staged decline/out-of-stock/cap-breach + recovery flow
7. Admin/Audit Dashboard — live ledger view, policy-decision feed, consent revoke

Work one phase at a time. Commit when a phase's own tests pass before starting the next.

## Stack

- Backend: Node.js + TypeScript
- Frontend: React + TypeScript
- DB: MongoDB (or in-memory for a fast first pass — confirm which before scaffolding)
- LLM: OpenAI API, tool use / function calling (deviates from `docs/` spec, which specifies Claude — see note below)
- Payments: Razorpay Node SDK, test-mode keys only

## Razorpay integration choice

Direct Node SDK (`razorpay` npm package) against test-mode keys, not the official `razorpay-mcp-server` — the doc's other listed option. Chosen for control/debuggability during solo buildathon development; swapping to the MCP server is listed as a stretch goal in the doc (section 7) and would only require reimplementing `src/razorpay/razorpay.client.ts`, since the rest of the app depends on the `RazorpayAdapter` interface, not the SDK directly.

## Deviation from docs/

The architecture and context docs specify Claude for the Agent Orchestrator's tool-use loop (and `docs/track1-context.md` leans on the real Razorpay/NPCI-on-Claude pilot as pitch narrative). This project uses **OpenAI** instead — a deliberate choice made outside the doc, not an error. If you're writing the README's architecture-decision section, call this out explicitly rather than silently following the doc's wording.

## Secrets

Real keys live in `.env.local`, never in code, never in a commit. See `.env.example` for the required variable names. Do not read or print `.env.local` contents.

## Current phase

<!-- update this line as you progress, e.g. "Phase 2: Policy Engine — in progress" -->
Phase 1: Catalog service — done (backend scaffolded, 18 SKUs seeded to MongoDB Atlas, `/catalog/feed.json` and `/catalog/agent-meta/:sku` verified live).
Phase 2: Policy Engine + Mandate Ledger — done (pure `evaluate()` with 9 unit tests; hash-chain logic with 8 unit tests; `verifyChain` CLI and tamper-detection both verified live against Atlas).
Phase 3: Razorpay Adapter — done (direct Node SDK, dependency-injected client for testability; 11 unit tests on mapping/error-propagation; `createOrder`/`createPaymentLink` verified live against real test-mode Razorpay via a manual ALLOW-only stub of the policy check; `capturePayment`/`refund` covered by mocked-client tests only, pending a real authorized payment id).
Phase 4: Agent Orchestrator + Chat UI — done. Backend: consent CRUD + Mongo model, `orders` collection (extended with userId/merchantId for daily-cap queries), OpenAI tool-use loop (`search_catalog`/`get_agent_meta`/`propose_cart`, no charge tool), orchestrator wiring the real Policy Engine + real Mandate Ledger + real Razorpay Adapter end to end per the sequence diagram, 17 new unit tests (cart-builder + orchestrator branching with mocked deps), fixed a real bug (unhandled async route errors were crashing the whole process — added `asyncHandler` + global error middleware). Frontend: Vite/React/TS app with Consent Setup screen and Chat UI, verified rendering and end-to-end request flow live via headless Chromium. **Blocked only by**: `OPENAI_API_KEY` in `.env.local` is still a placeholder (`your-ap...`, not a real `sk-...` key) — everything up to the OpenAI call is proven working; paste a real key to unblock. Money movement uses `createOrder` + `createPaymentLink` (user pays via a Razorpay-hosted link), not embedded Checkout.js capture — a deliberate scope simplification for this pass; `capturePayment`/`refund` remain wired but only exercised by mocked tests. Phase 5: Failure Injector — done. `X-Force-Failure: decline | out_of_stock | cap_breach` header (parsed in `orchestrator/failure-injector.ts`), a matching dropdown in the Chat UI (single-shot, resets after each send). Each mode adapted honestly to this build's payment-link architecture (see note below) rather than the doc's literal direct-capture wording: `decline` writes a break EXECUTION record then succeeds via an automatic real retry; `out_of_stock` writes a break record then substitutes an in-stock same-category item (falls back to a graceful denial if none exists); `cap_breach` proportionally inflates the cart total to just over `spendCapPerTxn`, guaranteeing STEP_UP regardless of the real item price, while keeping items × qty consistent with the ledger's recorded total. 20 new unit tests (cart inflation math, header parsing, all three orchestrator branches with mocked deps) — 57 tests total, typecheck clean. All three modes verified live end-to-end against real Mongo + real test-mode Razorpay: each produced the correct break/resolution record pair and `verifyChain` confirmed every resulting chain intact. Phase 6: Admin/Audit Dashboard — done. Backend: `/admin/chains` (ledger table rows, aggregated per chainId), `/admin/chains/:chainId` (full record list + a live `verifyChain` call — the actual "run it live" demo hook from the doc), `/admin/decisions` (EXECUTION-record feed), `/admin/kill-switch` (GET/POST) — the first live trigger for Phase 2's previously-dormant kill switch module. 5 new unit tests (kill-switch + one orchestrator test proving kill-switch-engaged denies a cart), 62 tests total. Frontend: new Admin/Audit Dashboard tab (chains table, click-to-expand chain detail with live integrity verification, decisions feed, kill-switch toggle, consent-revoke) — verified live end-to-end via headless Chromium against real backend data (screenshots confirm the toggle round-trips through the real API). Phase 7: README + demo script — not started.

## Frontend visual design system

Redesigned as a presentation-layer-only pass (no backend/policy/ledger/orchestrator changes) around a "ledger crossed with authorization document" concept:

- **Typography**: IBM Plex Mono (Google Fonts) for anything that's data — amounts, hashes, mandate/order/chain IDs — with `font-variant-numeric: tabular-nums`; Manrope for UI chrome and copy. Tokens and usage in `frontend/src/index.css`.
- **Accent color**: a deep ink-indigo (`--accent`), not the amber/ochre a "wax-seal" concept might suggest — deliberately, because policy-decision semantics (ALLOW/DENY/STEP_UP = green/red/**amber**) needed a hue distinct from the brand accent, and amber was already spoken for. Indigo keeps the "signed/authorized in ink" metaphor without the clash.
- **Neutrals**: warm "ledger paper" tones (light) / warm near-black (dark), not flat grey. Both themes defined via CSS custom properties on `:root`, redefined under `prefers-color-scheme` and `[data-theme]` (no toggle UI wired up yet, but the token plumbing supports adding one).
- **Reusable primitives**: `StatusChip` (ALLOW/DENY/STEP_UP/neutral) and `HashChip` (truncated monospace hash/id with click-to-copy) in `frontend/src/components/`.
- **Chat UI**: three distinct object types instead of one bubble style — solid user bubbles, plain-text "agent" notes, and bordered ledger-style `record-card`s for tool-call/policy-check/execution events. The "agent is working" state is a stylized `TOOL CALL` card with cycling stage text — presentational only; the backend resolves a message in one round trip and doesn't stream real intermediate tool-call events, so don't read those labels as literal telemetry.
- **Consent screen**: reframed as a one-time "Mandate authorization" moment (large tabular-nums spend-cap sliders, category allowlist as toggle pills, a "sealed" confirmation animation). The inline revoke button was removed from this screen on purpose — revoke now lives solely on the Admin Dashboard, so this screen is only ever a "grant," never a "revoke," moment.
- **Admin Dashboard**: per-row status chips derived client-side from existing `/admin/chains` and `/admin/decisions` fields (`lastType`/`lastResult`) — a display-only heuristic, not a new backend concept. Revoke consent is a weightier two-click-confirm danger button in its own labeled control group, distinct from routine navigation.
- **Demo data**: `backend/src/orchestrator/seed-demo-activity.script.ts` (`npm run seed-demo-activity`) seeds five realistic purchase sessions (allowed, denied, step-up-pending, decline-recovery, out-of-stock-substitution) against real Mongo + real test-mode Razorpay via a stub LLM loop, so the Admin Dashboard and ledger aren't an empty shell. Unlike the throwaway smoke-test scripts from earlier phases, this one is meant to be re-run and kept.
- Verified live in both themes via headless Chromium (screenshots) with zero console errors; backend test suite (62 tests) untouched and still green.