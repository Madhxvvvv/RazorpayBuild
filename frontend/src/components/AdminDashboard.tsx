import { useEffect, useState, type CSSProperties } from "react";
import { getChainDetail, getChains, getDecisions, getKillSwitch, revokeConsent, setKillSwitch } from "../lib/api";
import { StatusChip, type PolicyStatus } from "./StatusChip";
import { HashChip } from "./HashChip";
import type { ChainDetail, ChainSummary, FailureMode, MandateRecord } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
  forcedFailure: FailureMode | "";
  onForcedFailureChange: (value: FailureMode | "") => void;
}

const VISIBLE_ROWS = 8;

const FAILURE_MODE_OPTIONS: Array<{ value: FailureMode | ""; label: string }> = [
  { value: "", label: "None" },
  { value: "out_of_stock", label: "Force: out of stock" },
  { value: "decline", label: "Force: payment decline" },
  { value: "cap_breach", label: "Force: over spending cap" },
];

const STATUS_VAR: Record<PolicyStatus, string> = {
  allow: "var(--allow)",
  deny: "var(--deny)",
  step_up: "var(--stepup)",
  neutral: "var(--border-strong)",
};

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

function statusEdge(status: PolicyStatus): CSSProperties {
  return { boxShadow: `inset 3px 0 0 ${STATUS_VAR[status]}` };
}

export function AdminDashboard({ userId, merchantId, forcedFailure, onForcedFailureChange }: Props) {
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
      <div className="panel panel-quiet admin-controls">
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
        <div className="panel panel-lead">
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
                {chains.slice(0, VISIBLE_ROWS).map((c) => {
                  const status = deriveChainStatus(c);
                  return (
                    <tr key={c.chainId} onClick={() => selectChain(c.chainId)} className={c.chainId === selectedChainId ? "selected" : ""}>
                      <td style={statusEdge(status)}>
                        <StatusChip status={status} />
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
                  );
                })}
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
            <div className="chain-detail log-enter">
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

        <div className="panel panel-quiet">
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
                      <td style={statusEdge(status)}>
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

      <div className="panel panel-quiet test-controls">
        <div className="panel-header">
          <div className="test-controls-title">
            <h2>Test &amp; demo controls</h2>
            <span className="test-controls-badge">Internal</span>
          </div>
        </div>
        <p className="hint">
          Not part of the live product surface — forces one purchase-flow failure so its recovery is visible in the
          ledger above.
        </p>
        <label className="failure-select">
          Force a failure scenario
          <select value={forcedFailure} onChange={(e) => onForcedFailureChange(e.target.value as FailureMode | "")}>
            {FAILURE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
