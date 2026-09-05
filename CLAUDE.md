# Warden — Track 01 Build

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
5. Agent Orchestrator — Groq tool-use loop, narrow read-heavy tool set
6. Failure Injector — staged decline/out-of-stock/cap-breach + recovery flow
7. Admin/Audit Dashboard — live ledger view, policy-decision feed, consent revoke

Work one phase at a time. Commit when a phase's own tests pass before starting the next.

## Stack

- Backend: Node.js + TypeScript
- Frontend: React + TypeScript
- DB: MongoDB (or in-memory for a fast first pass — confirm which before scaffolding)
- LLM: Groq API (`openai/gpt-oss-20b`), via the `openai` SDK pointed at Groq's OpenAI-compatible endpoint — see note below. Deviates from `docs/` spec, which specifies Claude.
- Payments: Razorpay Node SDK, test-mode keys only

## Razorpay integration choice

Direct Node SDK (`razorpay` npm package) against test-mode keys, not the official `razorpay-mcp-server` — the doc's other listed option. Chosen for control/debuggability during solo buildathon development; swapping to the MCP server is listed as a stretch goal in the doc (section 7) and would only require reimplementing `src/razorpay/razorpay.client.ts`, since the rest of the app depends on the `RazorpayAdapter` interface, not the SDK directly.

## Deviation from docs/

The architecture and context docs specify Claude for the Agent Orchestrator's tool-use loop (and `docs/track1-context.md` leans on the real Razorpay/NPCI-on-Claude pilot as pitch narrative). This project uses **Groq** instead (originally OpenAI, then swapped to Groq — see below) — a deliberate choice made outside the doc, not an error. If you're writing the README's architecture-decision section, call this out explicitly rather than silently following the doc's wording.

## LLM provider: OpenAI → Groq swap

Originally built against OpenAI (`gpt-4o-mini`). Swapped to **Groq** (`openai/gpt-oss-20b`) because Groq's free tier (no credit card, 14,400 requests/day) comfortably covers demo/dev usage, versus OpenAI requiring paid billing credits. Groq's API is OpenAI-SDK-compatible, so the swap was small and contained: `backend/src/orchestrator/groq-client.ts` replaces the old `openai-client.ts` (same `openai` npm package, just pointed at `https://api.groq.com/openai/v1` with a `GROQ_API_KEY`), and `server.ts` was updated to use it. `orchestrator/llm-loop.ts` and `tools.ts` needed **zero changes** — they only depend on the OpenAI SDK's types, not on OpenAI's API being the actual backend, which is exactly what made this swap cheap. Known tradeoff: open-weight models are somewhat less consistent than GPT-4o-mini at strictly following a tool-call JSON schema every time — worth watching for occasional malformed/skipped tool calls during the live demo. Env var is now `GROQ_API_KEY` (+ optional `GROQ_MODEL`, defaults to `openai/gpt-oss-20b`) — `OPENAI_API_KEY`/`OPENAI_MODEL` are no longer read anywhere.

**Model selection, discovered live, not from docs:** `llama-3.3-70b-versatile` (Groq's most commonly documented model at the time this was written) has since been deprecated/removed — confirmed by querying `GET https://api.groq.com/openai/v1/models` directly, which is the reliable way to check what's actually available rather than trusting docs/blog posts that go stale. `openai/gpt-oss-120b` is listed as tool-calling-capable but failed live with `400 Tool call validation failed: attempted to call tool 'commentary' which was not in request.tools` — a known quirk of OpenAI's open-weight "Harmony" response format (internal reasoning channels like `commentary`) not translating cleanly through Groq's tool-calling proxy for this app's plain function-calling setup. `openai/gpt-oss-20b` works correctly and is what's wired in now. If Groq changes its catalog again, query the `/models` endpoint first before picking a replacement, and smoke-test tool-calling directly (a bare `chat.completions.create` with one tool) before wiring it into the orchestrator.

## Secrets

Real keys live in `.env.local`, never in code, never in a commit. See `.env.example` for the required variable names. Do not read or print `.env.local` contents.

## Current phase

<!-- update this line as you progress, e.g. "Phase 2: Policy Engine — in progress" -->
Phase 1: Catalog service — done (backend scaffolded, 18 SKUs seeded to MongoDB Atlas, `/catalog/feed.json` and `/catalog/agent-meta/:sku` verified live).
Phase 2: Policy Engine + Mandate Ledger — done (pure `evaluate()` with 9 unit tests; hash-chain logic with 8 unit tests; `verifyChain` CLI and tamper-detection both verified live against Atlas).
Phase 3: Razorpay Adapter — done (direct Node SDK, dependency-injected client for testability; 11 unit tests on mapping/error-propagation; `createOrder`/`createPaymentLink` verified live against real test-mode Razorpay via a manual ALLOW-only stub of the policy check; `capturePayment`/`refund` covered by mocked-client tests only, pending a real authorized payment id).
Phase 4: Agent Orchestrator + Chat UI — done. Backend: consent CRUD + Mongo model, `orders` collection (extended with userId/merchantId for daily-cap queries), OpenAI tool-use loop (`search_catalog`/`get_agent_meta`/`propose_cart`, no charge tool), orchestrator wiring the real Policy Engine + real Mandate Ledger + real Razorpay Adapter end to end per the sequence diagram, 17 new unit tests (cart-builder + orchestrator branching with mocked deps), fixed a real bug (unhandled async route errors were crashing the whole process — added `asyncHandler` + global error middleware). Frontend: Vite/React/TS app with Consent Setup screen and Chat UI, verified rendering and end-to-end request flow live via headless Chromium. **Blocked only by**: `OPENAI_API_KEY` in `.env.local` is still a placeholder (`your-ap...`, not a real `sk-...` key) — everything up to the OpenAI call is proven working; paste a real key to unblock. Money movement uses `createOrder` + `createPaymentLink` (user pays via a Razorpay-hosted link), not embedded Checkout.js capture — a deliberate scope simplification for this pass; `capturePayment`/`refund` remain wired but only exercised by mocked tests. Phase 5: Failure Injector — done. `X-Force-Failure: decline | out_of_stock | cap_breach` header (parsed in `orchestrator/failure-injector.ts`), a matching dropdown in the Chat UI (single-shot, resets after each send). Each mode adapted honestly to this build's payment-link architecture (see note below) rather than the doc's literal direct-capture wording: `decline` writes a break EXECUTION record then succeeds via an automatic real retry; `out_of_stock` writes a break record then substitutes an in-stock same-category item (falls back to a graceful denial if none exists); `cap_breach` proportionally inflates the cart total to just over `spendCapPerTxn`, guaranteeing STEP_UP regardless of the real item price, while keeping items × qty consistent with the ledger's recorded total. 20 new unit tests (cart inflation math, header parsing, all three orchestrator branches with mocked deps) — 57 tests total, typecheck clean. All three modes verified live end-to-end against real Mongo + real test-mode Razorpay: each produced the correct break/resolution record pair and `verifyChain` confirmed every resulting chain intact. Phase 6: Admin/Audit Dashboard — done. Backend: `/admin/chains` (ledger table rows, aggregated per chainId), `/admin/chains/:chainId` (full record list + a live `verifyChain` call — the actual "run it live" demo hook from the doc), `/admin/decisions` (EXECUTION-record feed), `/admin/kill-switch` (GET/POST) — the first live trigger for Phase 2's previously-dormant kill switch module. 5 new unit tests (kill-switch + one orchestrator test proving kill-switch-engaged denies a cart), 62 tests total. Frontend: new Admin/Audit Dashboard tab (chains table, click-to-expand chain detail with live integrity verification, decisions feed, kill-switch toggle, consent-revoke) — verified live end-to-end via headless Chromium against real backend data (screenshots confirm the toggle round-trips through the real API). Phase 7: README + demo script — done. Root `README.md`: architecture diagrams (system + purchase-flow, the latter updated to reflect the payment-link decision rather than the doc's original capture-based wording), component table, setup/run instructions, an 8-step demo script hitting the doc's section-6 rubric talking points, known limitations, and the architecture-decisions section (OpenAI/Claude, direct-SDK/MCP, payment-link/capture) consolidated from this file. Build plan (section 5) is now fully complete.

## Real bug found and fixed post-launch: stray system env var was shadowing `.env.local`

`OPENAI_API_KEY` was set as a **Windows User-level environment variable** (`[Environment]::GetEnvironmentVariable("OPENAI_API_KEY","User")`) holding the old placeholder value — unrelated to this repo. `dotenv.config()` never overrides a variable that already exists in `process.env`, so every edit to `.env.local` was silently ignored no matter how correctly it was saved; the file itself was fine the whole time. Fixed by adding `override: true` to every `dotenv.config({ path: ... })` call (`server.ts` and all four standalone scripts) so `.env.local` is always authoritative, matching what this file already documents as the source of truth for secrets. If a similar "I edited .env.local and nothing changed" report ever comes up again on a machine, check for a shadowing system/shell-level env var first (`node -e "console.log(process.env.<VAR>)"` before requiring dotenv) rather than assuming the file save failed.

With the real key in place, the chat endpoint now authenticates successfully (no more 401) but returns a 429 from OpenAI: `You have no credits remaining` — an OpenAI account billing issue, not a code problem. Add billing/credits at https://platform.openai.com/settings/organization/billing/ to unblock the live conversational flow end to end.

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

## Second visual/structural pass — de-hackathon-ify + real hierarchy

Frontend-only again (backend test suite re-verified green, unchanged). Key moves:

- **Demo identity**: `USER_ID`/`MERCHANT_ID` in `App.tsx` changed from `"user-1"`/`"merchant-1"` to `"Aditi Verma"`/`"GreenCart"` — realistic values, still literally the functional ids sent to the backend (no id/display-name split needed; `encodeURIComponent` in `api.ts` already handles the space). `backend/src/orchestrator/seed-demo-activity.script.ts`'s hardcoded identity constants were updated to match and the script was re-run, so the Admin Dashboard has fresh demo data under the new identity rather than orphaned old rows. This is the one backend-folder file this pass touched — two string literals in a demo-seeding script, not app logic.
- **Demo controls relocated**: the `X-Force-Failure` dropdown moved out of the Chat panel entirely into a new "Test & Demo Controls" section on the Admin Dashboard (dashed border, "Internal" tag, explanatory subtext) — state for it now lives in `App.tsx` and is passed down to both `Chat` (reads it, consumes/resets it after sending) and `AdminDashboard` (sets it).
- **Progressive disclosure on Consent**: once a mandate is active, the panel shows a compact read-only summary (amounts, categories, expiry) instead of the full editing form; an "Edit mandate" ghost button expands into the sliders/pills, prefilled from the current consent rather than hardcoded defaults.
- **Dynamic spend-cap sliders**: custom-styled range inputs (`.range-wrap`/`.range-fill` layered behind a transparent native `<input type=range>`) whose fill color shifts calm→warning→danger (reusing `--allow`/`--stepup`/`--deny`) as the chosen value climbs the slider's own min–max range. This is a presentation-only "progress" visualization tied to the cap-setting control itself, not a live feed of actual daily spend — no new backend endpoint was added to keep this pass frontend-only.
- **Status chips are now solid fills**, not tinted text (`--bg-raised` as the on-color, since it's always the opposite lightness of the accent colors in both themes) — applied consistently to the ACTIVE mandate badge (new `.status-badge` family, with a pulsing dot) and the ALLOW/DENY/STEP_UP chips throughout, plus a colored left-edge accent on ledger/decision table rows. This is the "second, considered accent system" for state — deliberately three hues (green/amber/red) rather than one, since they need to stay individually meaningful, unified under one bold badge treatment distinct from the single ink-indigo brand accent.
- **Visual hierarchy via `.panel-lead` / `.panel-quiet` classes**: Consent and Chat panels lead on the Storefront screen; on the Admin Dashboard, Mandate Ledger leads while Policy Decisions, the kill-switch/revoke controls bar, and Test & Demo Controls all recede.
- **New wordmark**: a CSS `clip-path` shield glyph + bold tight-tracked "Warden" text, replacing the old small-diamond-plus-bold-text treatment. Tabs are now a pill-style segmented control (filled active state) instead of an underline.
- **Real empty/working states in Chat**: an empty-state glyph + heading + clickable example prompts (fill the input, don't auto-send) instead of a single hint line; the existing `TOOL CALL` working-indicator card carried over.
- **Motion**: a `.log-enter` fade/slide-up keyframe applied to every chat log entry and to consent-panel state swaps; relies on the pre-existing global `prefers-reduced-motion` override (collapses animation duration to ~0) rather than a new guard.
- Verified live across both themes via headless Chromium, including a real controlled-range-input value change (had to use the native `HTMLInputElement` value setter + dispatched `input` event in the test script — directly setting `.value` doesn't fire React's tracked `onChange`).