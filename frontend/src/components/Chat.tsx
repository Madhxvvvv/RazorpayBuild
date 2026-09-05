import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../lib/api";
import { StatusChip } from "./StatusChip";
import { HashChip } from "./HashChip";
import type { Consent, FailureMode, OrchestratorResult, ProposedCartItem } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
  consent: Consent | null;
}

type LogEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "system"; id: string; text: string }
  | { kind: "result"; id: string; result: OrchestratorResult };

const FAILURE_MODE_OPTIONS: Array<{ value: FailureMode | ""; label: string }> = [
  { value: "", label: "None" },
  { value: "out_of_stock", label: "Force: out of stock" },
  { value: "decline", label: "Force: payment decline" },
  { value: "cap_breach", label: "Force: over spending cap" },
];

// Presentational only — the backend resolves a message in one round trip and
// doesn't stream intermediate tool-call events, so this is a stylized "the
// agent is working" sequence, not a live feed of real orchestrator state.
const WORKING_STAGES = ["Reading request…", "Searching catalog…", "Checking policy…"];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function WorkingIndicator() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => Math.min(s + 1, WORKING_STAGES.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="record-card tool-call working">
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
      <div className="agent-note">
        <span className="agent-note-label">Agent</span>
        <p>{result.text}</p>
      </div>
    );
  }

  if (result.type === "denied") {
    return (
      <div className="record-card">
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
      <div className="record-card">
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

  // executed
  return (
    <div className="record-card">
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

export function Chat({ userId, merchantId, consent }: Props) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [pendingStepUp, setPendingStepUp] = useState<{ chainId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [forcedFailure, setForcedFailure] = useState<FailureMode | "">("");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log, busy]);

  function push(entry: LogEntry) {
    setLog((prev) => [...prev, entry]);
  }

  async function handleSend(confirmStepUp = false) {
    const text = confirmStepUp ? "Yes, confirm the purchase." : input.trim();
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
      setForcedFailure("");
    } catch (err) {
      push({ kind: "system", id: crypto.randomUUID(), text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <h2>Chat</h2>
        <label className="failure-select">
          Demo failure
          <select value={forcedFailure} onChange={(e) => setForcedFailure(e.target.value as FailureMode | "")}>
            {FAILURE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="chat-log">
        {log.length === 0 && <p className="hint">Try: "order me a protein bar under 300 rupees"</p>}
        {log.map((entry) => {
          if (entry.kind === "user") {
            return (
              <div key={entry.id} className="user-bubble">
                {entry.text}
              </div>
            );
          }
          if (entry.kind === "system") {
            return (
              <div key={entry.id} className="system-note">
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
