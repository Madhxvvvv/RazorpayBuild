# Track 01 Context — AI Growth & Agentic Commerce

Trimmed from the full 5-track playbook to just what's relevant to this build. This is the companion doc `CLAUDE.md` points to for "why this track, protocol context, judging rubric" — read alongside `track1-agentic-storefront-architecture.md`, which is the actual spec.

---

## What's actually being judged

The selection process rubric: **code quality and architecture decisions, your ability to explain technical choices, a working demo, problem clarity, and GitHub documentation.** Nowhere does it reward scope. A narrow, deeply-instrumented system with honest metrics beats a broad system that "sort of works." The track's "the bar" line is a disguised eval spec — treat it as one.

What it secretly wants:

- **An audit trail as a first-class object**, not a logging afterthought — this is the Mandate Ledger in the architecture doc.
- **Honest failure handling** — don't cherry-pick a clean demo run. Show the system hit a wall and did something sane about it (the Failure Injector).

---

## Track 01 — AI Growth & Agentic Commerce

**The ask:** an agent that either grows a merchant's revenue on Razorpay's test-mode APIs, or makes a merchant transactable *by* an AI buyer, end to end.

### Why this track is real right now, not hackathon-generic

As of 2026 there are four separate, competing standards for "how does an AI agent pay for something," and Razorpay/NPCI are already shipping one of them in production:

- **NPCI's Unified Agent Protocol (UAP)** — India's own answer, still in development/consultation as of mid-2026. It repurposes **UPI Circle** (originally built so a primary UPI user could delegate spending-capped authority to a secondary human, e.g. a family member) and puts an AI agent in that secondary-user role. Three load-bearing pieces: a **central registry of verified agents**, **per-agent spending caps**, and **consent set up in advance** — no PIN/OTP per transaction, because the authorization already happened at delegation time. [Stellagent overview](https://stellagent.ai/insights/india-npci-unified-agent-protocol-upi), [Business Standard](https://www.business-standard.com/finance/news/india-may-allow-agentic-ai-led-upi-transactions-under-new-npci-protocol-126070801343_1.html)
- **Razorpay × NPCI have already launched a live pilot** on Claude (India AI Impact Summit, Feb 2026), using **UPI Reserve Pay**: the user sets a one-time, consent-based spending limit for a merchant, and within that limit the agent transacts without repeated auth, with full visibility/revocation for the user. Zomato, Swiggy and Zepto are live merchants in the pilot. [Razorpay blog](https://razorpay.com/blog/agentic-payments-and-npci/), [Stellagent](https://stellagent.ai/insights/razorpay-npci-agentic-upi)
- **ACP (Agentic Commerce Protocol)** — OpenAI + Stripe's open standard, live in ChatGPT's Instant Checkout. The agent **never touches payment credentials**: it gets a **Checkout Session** (merchant returns cart/pricing/payment-method options via an OpenAPI endpoint), then a **Shared Payment Token** — a short-lived, cryptographically-signed token — authorizes the merchant to charge, via a second **delegate-payment endpoint**. [ACP GitHub](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol), [Stripe docs](https://docs.stripe.com/agentic-commerce/acp)
- **AP2 (Agent Payments Protocol)** — Google's competing standard, an extension of **A2A** and interoperable with **MCP**. Core idea: **mandates** — cryptographically signed, tamper-evident **Verifiable Digital Credentials** forming a non-repudiable chain. **Checkout Mandates** (Open = constraints/goals before finalization, Closed = the specific finalized purchase) and **Payment Mandates** (Open = budget/instrument constraints, Closed = the specific authorized amount). The open→closed chain *is* the audit trail. [ap2-protocol.org](https://ap2-protocol.org/), [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- **x402** — Coinbase's HTTP-native micropayment standard, reviving HTTP 402 for agent-to-API payments, settling on-chain in stablecoins. Least directly relevant here (crypto rail, not card/UPI) — mention it for completeness, don't build against it. [x402 whitepaper](https://www.x402.org/x402-whitepaper.pdf)

Referencing these correctly in the architecture walkthrough is a cheap, high-signal way to prove real homework instead of a generic shopping-cart chatbot.

### What you're actually building against

Razorpay ships an **official MCP server** (`razorpay/razorpay-mcp-server`) with 35+ tools across Payments, Payment Links, Orders, Refunds, QR Codes, Settlements, and Payouts. [GitHub](https://github.com/razorpay/razorpay-mcp-server), [tools reference](https://razorpay.com/docs/mcp-server/tools-reference/)

### How to make it "insanely technical" instead of a chatbot demo

1. **Agent-readable catalog** — schema.org `Product`/`Offer` JSON-LD plus agent-specific fields (machine-readable refund policy, live inventory, eligibility constraints). Mirrors what ACP's checkout-session and UAP's registry both assume exists on the merchant side.
2. **A mandate ledger, AP2-style**, even without the official library — intent → cart mandate → payment mandate → execution, hash-chained so the log is tamper-evident.
3. **A policy engine, not `if` statements sprinkled in the agent loop** — spend caps, category allow/deny lists, step-up confirmation above a threshold, a kill switch, unit-tested independently of the LLM.
4. **One graceful failure, staged on purpose** — decline / out-of-stock / spend-cap breach, with the mandate ledger showing exactly where the chain broke and how it recovered.
5. **Pick a lane and go deep** — conversational checkout + agent-readable catalog + upsell, built well, beats a shallow pass at everything in the track.

Full component breakdown, sequence diagrams, data model, and code interfaces: see `track1-agentic-storefront-architecture.md`.

---

## Engineering bar (applies regardless of which direction inside the track you pick)

- **Separate the deterministic policy/guardrail layer from the LLM.** "Bounded," "gated" language is asking for this specifically.
- **Structured, queryable audit log**, not text logs.
- **A held-out or injected-failure test set**, committed to the repo, not generated live.
- **A README that states your architecture decisions and known failure modes up front.**

---

## Sources

- [NPCI's Unified Agent Protocol — Stellagent](https://stellagent.ai/insights/india-npci-unified-agent-protocol-upi)
- [India may allow agentic AI-led UPI transactions — Business Standard](https://www.business-standard.com/finance/news/india-may-allow-agentic-ai-led-upi-transactions-under-new-npci-protocol-126070801343_1.html)
- [Razorpay & NPCI: Agentic Payments for UPI on Claude — Razorpay Blog](https://razorpay.com/blog/agentic-payments-and-npci/)
- [Razorpay and NPCI launch agentic payments on Claude — Stellagent](https://stellagent.ai/insights/razorpay-npci-agentic-upi)
- [Agentic Commerce Protocol — GitHub](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Agentic Commerce Protocol — Stripe Docs](https://docs.stripe.com/agentic-commerce/acp)
- [AP2 Protocol Documentation](https://ap2-protocol.org/)
- [Announcing Agent Payments Protocol (AP2) — Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [x402 Whitepaper](https://www.x402.org/x402-whitepaper.pdf)
- [Razorpay MCP Server — GitHub](https://github.com/razorpay/razorpay-mcp-server)
- [Razorpay MCP Tools Reference](https://razorpay.com/docs/mcp-server/tools-reference/)
- [Razorpay AI Buildathon 2026 — Velonx](https://velonx.in/blog/razorpay-ai-buildathon-2026-tracks-eligibility-stipend-selection-process)