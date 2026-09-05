import { useEffect, useState } from "react";
import { getChains } from "../lib/api";
import { StatusChip, type PolicyStatus } from "./StatusChip";
import { HashChip } from "./HashChip";
import type { ChainSummary } from "../lib/types";

interface Props {
  refreshKey: number;
}

const VISIBLE = 4;

// Small, deliberately duplicated rather than imported from AdminDashboard —
// this pass is scoped to the Storefront screen only.
function deriveChainStatus(chain: ChainSummary): PolicyStatus {
  if (chain.lastType === "EXECUTION") {
    return String(chain.lastResult ?? "") === "blocked" ? "deny" : "allow";
  }
  if (chain.lastType === "CART") return "step_up";
  return "neutral";
}

export function ActivityStrip({ refreshKey }: Props) {
  const [chains, setChains] = useState<ChainSummary[]>([]);

  useEffect(() => {
    getChains(VISIBLE)
      .then(setChains)
      .catch(() => setChains([]));
  }, [refreshKey]);

  if (chains.length === 0) return null;

  return (
    <div className="panel panel-quiet activity-strip">
      <div className="panel-header">
        <h2>Recent activity</h2>
        <span className="hint">From the mandate ledger</span>
      </div>
      <div className="activity-row">
        {chains.slice(0, VISIBLE).map((c) => (
          <div key={c.chainId} className="activity-card">
            <StatusChip status={deriveChainStatus(c)} />
            <p className="activity-ask" title={c.rawAsk}>
              {c.rawAsk ?? "—"}
            </p>
            <HashChip value={c.chainId} />
            <span className="activity-time mono">{new Date(c.lastActivityAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
