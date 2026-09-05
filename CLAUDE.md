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
Phase 4: Agent Orchestrator + Chat UI — done. Backend: consent CRUD + Mongo model, `orders` collection (extended with userId/merchantId for daily-cap queries), OpenAI tool-use loop (`search_catalog`/`get_agent_meta`/`propose_cart`, no charge tool), orchestrator wiring the real Policy Engine + real Mandate Ledger + real Razorpay Adapter end to end per the sequence diagram, 17 new unit tests (cart-builder + orchestrator branching with mocked deps), fixed a real bug (unhandled async route errors were crashing the whole process — added `asyncHandler` + global error middleware). Frontend: Vite/React/TS app with Consent Setup screen and Chat UI, verified rendering and end-to-end request flow live via headless Chromium. **Blocked only by**: `OPENAI_API_KEY` in `.env.local` is still a placeholder (`your-ap...`, not a real `sk-...` key) — everything up to the OpenAI call is proven working; paste a real key to unblock. Money movement uses `createOrder` + `createPaymentLink` (user pays via a Razorpay-hosted link), not embedded Checkout.js capture — a deliberate scope simplification for this pass; `capturePayment`/`refund` remain wired but only exercised by mocked tests. Phase 5: Failure Injector — not started.