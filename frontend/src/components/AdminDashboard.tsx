import { useEffect, useState } from "react";
import { getChainDetail, getChains, getDecisions, getKillSwitch, revokeConsent, setKillSwitch } from "../lib/api";
import type { ChainDetail, ChainSummary, MandateRecord } from "../lib/types";

interface Props {
  userId: string;
  merchantId: string;
}

function formatDecision(record: MandateRecord): string {
  const result = (record.payload.result as string | undefined) ?? (record.payload.reason as string | undefined);
  return result ?? "—";
}

export function AdminDashboard({ userId, merchantId }: Props) {
  const [chains, setChains] = useState<ChainSummary[]>([]);
  const [decisions, setDecisions] = useState<MandateRecord[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [chainDetail, setChainDetail] = useState<ChainDetail | null>(null);
  const [killSwitchEngaged, setKillSwitchEngaged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  }, [merchantId]);

  async function selectChain(chainId: string) {
    setSelectedChainId(chainId);
    try {
      const detail = await getChainDetail(chainId);
      setChainDetail(detail);
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

  async function handleRevoke() {
    setBusy(true);
    try {
      await revokeConsent(userId, merchantId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin">
      <div className="admin-controls panel">
        <div>
          <strong>Kill switch for {merchantId}:</strong> {killSwitchEngaged ? "ENGAGED — all purchases blocked" : "off"}
          <button onClick={handleToggleKillSwitch} disabled={busy} className={killSwitchEngaged ? "" : "danger"}>
            {killSwitchEngaged ? "Disengage" : "Engage kill switch"}
          </button>
        </div>
        <div>
          <button onClick={handleRevoke} disabled={busy} className="danger">
            Revoke consent for {userId}
          </button>
        </div>
        <button onClick={refresh} disabled={busy}>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="admin-grid">
        <div className="panel">
          <h2>Mandate ledger — recent chains</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ask</th>
                  <th>Records</th>
                  <th>Last type</th>
                  <th>Last result</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {chains.map((c) => (
                  <tr
                    key={c.chainId}
                    onClick={() => selectChain(c.chainId)}
                    className={c.chainId === selectedChainId ? "selected" : ""}
                  >
                    <td title={c.chainId}>{c.rawAsk ?? c.chainId.slice(0, 8)}</td>
                    <td>{c.recordCount}</td>
                    <td>{c.lastType}</td>
                    <td>{String(c.lastResult ?? "—")}</td>
                    <td>{new Date(c.lastActivityAt).toLocaleTimeString()}</td>
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
              <p>
                <strong>Chain integrity:</strong>{" "}
                {chainDetail.verification.valid
                  ? `intact — ${chainDetail.verification.length} record(s) verified`
                  : `BROKEN at seq ${chainDetail.verification.brokenAtSeq}: ${chainDetail.verification.reason}`}
              </p>
              <ol>
                {chainDetail.records.map((r) => (
                  <li key={r.seq}>
                    <strong>{r.type}</strong> — {JSON.stringify(r.payload)}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Policy decisions</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>Result</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr key={`${d.chainId}-${d.seq}`}>
                    <td title={d.chainId}>{d.chainId.slice(0, 8)}</td>
                    <td>{formatDecision(d)}</td>
                    <td>{new Date(d.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
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
