import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/api";
import { StatusChip } from "./StatusChip";
import { HashChip } from "./HashChip";
import type { Consent, FailureMode, OrchestratorResult, ProposedCartItem } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
  consent: Consent | null;
  forcedFailure: FailureMode | "";
  onConsumeForcedFailure: () => void;
  onActivity: () => void;
}

type LogEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "system"; id: string; text: string }
  | { kind: "result"; id: string; result: OrchestratorResult };

const EXAMPLE_PROMPTS = [
  "Order me a protein bar under 300 rupees",
  "Get me 2 bags of atta",
  "Order a cold brew coffee",
];

// Presentational only — the backend resolves a message in one round trip and
// doesn't stream intermediate tool-call events, so this is a stylized "the
// agent is working" sequence, not a live feed of real orchestrator state.
const WORKING_STAGES = ["Reading request…", "Searching catalog…", "Checking policy…"];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="chat-empty">
      <span className="chat-empty-glyph" aria-hidden="true" />
      <p className="chat-empty-title">Ask Warden to shop for you</p>
      <p className="chat-empty-sub">
        It searches the catalog, proposes a cart, and only ever checks out within your mandate.
      </p>
      <div className="chat-empty-examples">
        {EXAMPLE_PROMPTS.map((example) => (
          <button key={example} type="button" className="example-chip" onClick={() => onPick(example)}>
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkingIndicator() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => Math.min(s + 1, WORKING_STAGES.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="record-card tool-call working log-enter">
      <div className="record-card-header">
        <span className="record-kind">TOOL CALL</span>
        <span className="working-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
      <p className="hint">{WORKING_STAGES[stage]}</p>
    </div>
  );
}

function ResultCard({ result, onConfirm, busy }: { result: OrchestratorResult; onConfirm: () => void; busy: boolean }) {
  if (result.type === "reply") {
    return (
      <div className="agent-note log-enter">
        <span className="agent-note-label">Agent</span>
        <p>{result.text}</p>
      </div>
    );
  }

  if (result.type === "denied") {
    return (
      <div className="record-card outcome-card outcome-deny">
        <div className="record-card-header">
          <span className="record-kind">POLICY CHECK</span>
          <StatusChip status="deny" />
        </div>
        <p>{result.reason}</p>
        {result.note && <p className="record-note">{result.note}</p>}
      </div>
    );
  }

  if (result.type === "step_up") {
    return (
      <div className="record-card outcome-card outcome-stepup">
        <div className="record-card-header">
          <span className="record-kind">POLICY CHECK</span>
          <StatusChip status="step_up" />
        </div>
        <dl className="record-fields">
          <div>
            <dt>Amount</dt>
            <dd className="amount">{formatRupees(result.totalInPaise)}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>{result.reason}</dd>
          </div>
          <div>
            <dt>Items</dt>
            <dd className="mono">{result.items.map((i: ProposedCartItem) => `${i.sku} ×${i.qty}`).join(", ")}</dd>
          </div>
        </dl>
        {result.note && <p className="record-note">{result.note}</p>}
        <button className="primary" onClick={onConfirm} disabled={busy}>
          Confirm purchase
        </button>
      </div>
    );
  }

  // executed — the payoff moment: a completed, policy-cleared purchase. This
  // is "the proof," so it gets the most visual weight of anything the chat
  // renders, not just another record card.
  return (
    <div className="record-card outcome-card outcome-allow">
      <div className="record-card-header">
        <span className="record-kind">EXECUTION</span>
        <StatusChip status="allow" />
      </div>
      <dl className="record-fields">
        <div>
          <dt>Order</dt>
          <dd>
            <HashChip value={result.razorpayOrderId} />
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="amount">{formatRupees(result.amountInPaise)}</dd>
        </div>
        <div>
          <dt>Chain</dt>
          <dd>
            <HashChip value={result.chainId} />
          </dd>
        </div>
      </dl>
      {result.note && <p className="record-note">{result.note}</p>}
      <a href={result.paymentLinkUrl} target="_blank" rel="noreferrer" className="payment-link">
        Complete payment →
      </a>
    </div>
  );
}

export function Chat({ userId, merchantId, consent, forcedFailure, onConsumeForcedFailure, onActivity }: Props) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [pendingStepUp, setPendingStepUp] = useState<{ chainId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log, busy]);

  function push(entry: LogEntry) {
    setLog((prev) => [...prev, entry]);
  }

  async function handleSend(confirmStepUp = false, overrideText?: string) {
    const text = confirmStepUp ? "Yes, confirm the purchase." : (overrideText ?? input.trim());
    if (!text || busy) return;
    if (!consent || consent.revoked) {
      push({ kind: "system", id: crypto.randomUUID(), text: "Set up consent before chatting — the agent has nothing it's allowed to spend." });
      return;
    }

    push({ kind: "user", id: crypto.randomUUID(), text });
    setInput("");
    setBusy(true);
    try {
      const result = await sendMessage({
        userId,
        merchantId,
        chainId: confirmStepUp ? pendingStepUp?.chainId : chainId,
        message: text,
        confirmStepUp,
        forcedFailure: forcedFailure || undefined,
      });
      setChainId(result.chainId);
      push({ kind: "result", id: crypto.randomUUID(), result });
      setPendingStepUp(result.type === "step_up" ? { chainId: result.chainId } : null);
      onConsumeForcedFailure();
      onActivity();
    } catch (err) {
      push({ kind: "system", id: crypto.randomUUID(), text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat-panel lead-panel">
      <div className="panel-header">
        <h2>Chat</h2>
      </div>

      <div className="chat-log">
        {log.length === 0 && <EmptyState onPick={(text) => setInput(text)} />}
        {log.map((entry) => {
          if (entry.kind === "user") {
            return (
              <div key={entry.id} className="user-bubble log-enter">
                {entry.text}
              </div>
            );
          }
          if (entry.kind === "system") {
            return (
              <div key={entry.id} className="system-note log-enter">
                {entry.text}
              </div>
            );
          }
          return <ResultCard key={entry.id} result={entry.result} onConfirm={() => handleSend(true)} busy={busy} />;
        })}
        {busy && <WorkingIndicator />}
        <div ref={logEndRef} />
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(false)}
          placeholder="Ask the shopping assistant..."
          disabled={busy}
        />
        <button className="primary" onClick={() => handleSend(false)} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
