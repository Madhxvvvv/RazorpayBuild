import { useEffect, useState } from "react";
import { getChainDetail, getChains, getDecisions, getKillSwitch, revokeConsent, setKillSwitch } from "../lib/api";
import { StatusChip, type PolicyStatus } from "./StatusChip";
import { HashChip } from "./HashChip";
import type { ChainDetail, ChainSummary, MandateRecord } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
}

const VISIBLE_ROWS = 8;

function deriveChainStatus(chain: ChainSummary): PolicyStatus {
  if (chain.lastType === "EXECUTION") {
    return String(chain.lastResult ?? "") === "blocked" ? "deny" : "allow";
  }
  if (chain.lastType === "CART") return "step_up";
  return "neutral";
}

function deriveDecisionStatus(record: MandateRecord): { status: PolicyStatus; label: string } {
  const result = String(record.payload.result ?? record.payload.reason ?? "unknown");
  if (result === "blocked") return { status: "deny", label: "Deny" };
  if (result === "payment_link_created") return { status: "allow", label: "Allow" };
  if (result === "out_of_stock") return { status: "neutral", label: "Out of stock" };
  if (result === "razorpay_declined") return { status: "neutral", label: "Declined (retried)" };
  return { status: "neutral", label: result };
}

export function AdminDashboard({ userId, merchantId }: Props) {
  const [chains, setChains] = useState<ChainSummary[]>([]);
  const [decisions, setDecisions] = useState<MandateRecord[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [chainDetail, setChainDetail] = useState<ChainDetail | null>(null);
  const [killSwitchEngaged, setKillSwitchEngaged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeArmed, setRevokeArmed] = useState(false);

  async function refresh() {
    try {
      const [chainsResult, decisionsResult, killSwitchResult] = await Promise.all([
        getChains(20),
        getDecisions(20),
        getKillSwitch(merchantId),
      ]);
      setChains(chainsResult);
      setDecisions(decisionsResult);
      setKillSwitchEngaged(killSwitchResult.engaged);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function selectChain(chainId: string) {
    setSelectedChainId(chainId);
    try {
      setChainDetail(await getChainDetail(chainId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleToggleKillSwitch() {
    setBusy(true);
    try {
      const result = await setKillSwitch(merchantId, !killSwitchEngaged);
      setKillSwitchEngaged(result.engaged);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleRevokeClick() {
    if (!revokeArmed) {
      setRevokeArmed(true);
      setTimeout(() => setRevokeArmed(false), 4000);
      return;
    }
    setRevokeArmed(false);
    setBusy(true);
    revokeConsent(userId, merchantId)
      .then(() => refresh())
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false));
  }

  return (
    <div className="admin">
      <div className="panel admin-controls">
        <div className="control-group">
          <span className="field-label">Kill switch — {merchantId}</span>
          <div className="control-row">
            <StatusChip status={killSwitchEngaged ? "deny" : "allow"} label={killSwitchEngaged ? "Engaged" : "Off"} />
            <button onClick={handleToggleKillSwitch} disabled={busy}>
              {killSwitchEngaged ? "Disengage" : "Engage"}
            </button>
          </div>
        </div>

        <div className="control-group revoke-group">
          <span className="field-label">Authorization — {userId}</span>
          <button className={`danger revoke-btn ${revokeArmed ? "armed" : ""}`} onClick={handleRevokeClick} disabled={busy}>
            <span className="revoke-mark" aria-hidden="true" />
            {revokeArmed ? "Click again to confirm revoke" : "Revoke consent"}
          </button>
        </div>

        <button className="ghost" onClick={refresh} disabled={busy}>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="admin-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Mandate ledger</h2>
            <span className="hint">{chains.length} session(s)</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Ask</th>
                  <th>Chain</th>
                  <th>Records</th>
                  <th>Activity</th>
                </tr>
              </thead>
              <tbody>
                {chains.slice(0, VISIBLE_ROWS).map((c) => (
                  <tr key={c.chainId} onClick={() => selectChain(c.chainId)} className={c.chainId === selectedChainId ? "selected" : ""}>
                    <td>
                      <StatusChip status={deriveChainStatus(c)} />
                    </td>
                    <td className="truncate-cell" title={c.rawAsk}>
                      {c.rawAsk ?? "—"}
                    </td>
                    <td>
                      <HashChip value={c.chainId} />
                    </td>
                    <td className="mono">{c.recordCount}</td>
                    <td className="mono">{new Date(c.lastActivityAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
                {chains.length === 0 && (
                  <tr>
                    <td colSpan={5} className="hint">
                      No purchase sessions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {chainDetail && (
            <div className="chain-detail">
              <div className="chain-integrity">
                <StatusChip
                  status={chainDetail.verification.valid ? "allow" : "deny"}
                  label={chainDetail.verification.valid ? "Chain intact" : "Chain broken"}
                />
                <span className="hint">
                  {chainDetail.verification.valid
                    ? `${chainDetail.verification.length} record(s) verified`
                    : `broken at seq ${chainDetail.verification.brokenAtSeq} — ${chainDetail.verification.reason}`}
                </span>
              </div>
              <ol className="record-list">
                {chainDetail.records.map((r) => (
                  <li key={r.seq}>
                    <div className="record-list-row">
                      <span className="record-kind">{r.type}</span>
                      <HashChip value={r.hash} />
                    </div>
                    <pre className="mono record-payload">{JSON.stringify(r.payload, null, 0)}</pre>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Policy decisions</h2>
            <span className="hint">{decisions.length} recorded</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Chain</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {decisions.slice(0, VISIBLE_ROWS).map((d) => {
                  const { status, label } = deriveDecisionStatus(d);
                  return (
                    <tr key={`${d.chainId}-${d.seq}`}>
                      <td>
                        <StatusChip status={status} label={label} />
                      </td>
                      <td>
                        <HashChip value={d.chainId} />
                      </td>
                      <td className="mono">{new Date(d.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
                {decisions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="hint">
                      No decisions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
