import { useState } from "react";
import { sendMessage } from "../lib/api";
import type { ChatMessage, Consent, OrchestratorResult, ProposedCartItem } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
  consent: Consent | null;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function resultToMessage(result: OrchestratorResult): string {
  switch (result.type) {
    case "reply":
      return result.text;
    case "denied":
      return `I can't do that — ${result.reason}.`;
    case "step_up":
      return `That's ${formatRupees(result.totalInPaise)}, above your auto-approve limit (${result.reason}). Confirm to proceed?`;
    case "executed":
      return `Done — order ${result.razorpayOrderId} for ${formatRupees(result.amountInPaise)}. Pay here to complete: ${result.paymentLinkUrl}`;
  }
}

export function Chat({ userId, merchantId, consent }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chainId, setChainId] = useState<string | undefined>(undefined);
  const [pendingStepUp, setPendingStepUp] = useState<{ chainId: string; items: ProposedCartItem[] } | null>(null);
  const [busy, setBusy] = useState(false);

  function pushMessage(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, text }]);
  }

  function handleResult(result: OrchestratorResult) {
    setChainId(result.chainId);
    pushMessage("assistant", resultToMessage(result));
    if (result.type === "step_up") {
      setPendingStepUp({ chainId: result.chainId, items: result.items });
    } else {
      setPendingStepUp(null);
    }
  }

  async function handleSend(confirmStepUp = false) {
    const text = confirmStepUp ? "yes, confirm" : input.trim();
    if (!text || busy) return;
    if (!consent || consent.revoked) {
      pushMessage("system", "Set up consent before chatting — the agent has nothing it's allowed to spend.");
      return;
    }

    pushMessage("user", text);
    setInput("");
    setBusy(true);
    try {
      const result = await sendMessage({
        userId,
        merchantId,
        chainId: confirmStepUp ? pendingStepUp?.chainId : chainId,
        message: text,
        confirmStepUp,
      });
      handleResult(result);
    } catch (err) {
      pushMessage("system", `Something went wrong: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel chat-panel">
      <h2>Chat</h2>
      <div className="chat-log">
        {messages.length === 0 && <p className="hint">Try: "order me a protein bar under 300 rupees"</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>

      {pendingStepUp && (
        <div className="step-up-banner">
          <span>Above your auto-approve limit.</span>
          <button onClick={() => handleSend(true)} disabled={busy}>
            Confirm purchase
          </button>
        </div>
      )}

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(false)}
          placeholder="Ask the shopping assistant..."
          disabled={busy}
        />
        <button onClick={() => handleSend(false)} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
