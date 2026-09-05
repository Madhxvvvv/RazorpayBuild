import { useState } from "react";
import { getConsent, upsertConsent } from "../lib/api";
import type { Consent } from "../lib/types";

const ALL_CATEGORIES = ["food", "beverages", "groceries", "personal-care", "stationery", "electronics"];

interface Props {
  userId: string;
  merchantId: string;
  consent: Consent | null;
  onConsentChange: (consent: Consent | null) => void;
}

/** Calm at low usage of the adjustable range, warning as it climbs toward the max — reuses the same
 *  allow/step-up/deny hues as the policy-decision chips so "what color means" stays consistent app-wide. */
function capFillColor(pct: number): string {
  if (pct < 0.6) return "var(--allow)";
  if (pct < 0.85) return "var(--stepup)";
  return "var(--deny)";
}

function CapSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const pct = (value - min) / (max - min);
  return (
    <div className="cap-stat">
      <label htmlFor={id}>{label}</label>
      <div className="cap-value amount">₹{value.toLocaleString("en-IN")}</div>
      <div className="range-wrap">
        <div className="range-fill" style={{ width: `${pct * 100}%`, background: capFillColor(pct) }} />
        <input
          id={id}
          type="range"
          className="range-input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

export function ConsentSetup({ userId, merchantId, consent, onConsentChange }: Props) {
  const [spendCapPerTxn, setSpendCapPerTxn] = useState(500);
  const [spendCapPerDay, setSpendCapPerDay] = useState(2000);
  const [categories, setCategories] = useState<string[]>(["food", "beverages", "groceries"]);
  const [expiresAt, setExpiresAt] = useState("2026-12-31");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAuthorized, setJustAuthorized] = useState(false);
  const [editing, setEditing] = useState(false);

  const isActive = Boolean(consent && !consent.revoked);
  const showForm = editing || !consent;

  function toggleCategory(category: string) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }

  function openEditor() {
    if (consent) {
      setSpendCapPerTxn(consent.spendCapPerTxn / 100);
      setSpendCapPerDay(consent.spendCapPerDay / 100);
      setCategories(consent.categoryAllowlist);
      setExpiresAt(consent.expiresAt.slice(0, 10));
    }
    setEditing(true);
  }

  async function handleAuthorize() {
    setBusy(true);
    setError(null);
    try {
      const saved = await upsertConsent({
        userId,
        merchantId,
        spendCapPerTxn: spendCapPerTxn * 100,
        spendCapPerDay: spendCapPerDay * 100,
        categoryAllowlist: categories,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      onConsentChange(saved);
      setEditing(false);
      setJustAuthorized(true);
      setTimeout(() => setJustAuthorized(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh() {
    setBusy(true);
    setError(null);
    try {
      const current = await getConsent(userId, merchantId);
      onConsentChange(current);
    } catch {
      onConsentChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel consent-panel lead-panel">
      <div className="panel-header">
        <div className="mandate-title">
          <span className="mandate-mark" aria-hidden="true" />
          <h2>Mandate authorization</h2>
        </div>
        <span className={`status-badge ${isActive ? "status-badge-active" : "status-badge-idle"}`}>
          {isActive && <span className="status-pulse" aria-hidden="true" />}
          {isActive ? "Active" : "Not authorized"}
        </span>
      </div>

      {!showForm && consent && (
        <div className="consent-compact log-enter">
          <div className="consent-compact-row">
            <div>
              <span className="field-label">Per transaction</span>
              <div className="amount compact-amount">₹{(consent.spendCapPerTxn / 100).toLocaleString("en-IN")}</div>
            </div>
            <div>
              <span className="field-label">Per day</span>
              <div className="amount compact-amount">₹{(consent.spendCapPerDay / 100).toLocaleString("en-IN")}</div>
            </div>
          </div>
          <div className="category-pills quiet">
            {consent.categoryAllowlist.map((c) => (
              <span key={c} className="pill pill-active pill-static">
                {c}
              </span>
            ))}
          </div>
          <div className="consent-summary mono">expires {new Date(consent.expiresAt).toLocaleDateString()}</div>
          <div className="button-row">
            <button className="ghost" onClick={openEditor} disabled={busy}>
              Edit mandate
            </button>
            <button className="ghost" onClick={handleRefresh} disabled={busy}>
              Refresh status
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="log-enter">
          <p className="hint">
            A one-time spending authorization — standing in for UPI Reserve Pay / NPCI's UAP. Set limits once; the
            agent transacts within them without asking again, and you can revoke instantly from the Admin Dashboard.
          </p>

          <div className="cap-grid">
            <CapSlider id="cap-txn" label="Per transaction" value={spendCapPerTxn} min={100} max={3000} step={50} onChange={setSpendCapPerTxn} />
            <CapSlider id="cap-day" label="Per day" value={spendCapPerDay} min={500} max={10000} step={100} onChange={setSpendCapPerDay} />
          </div>

          <div className="category-block">
            <span className="field-label">Allowed categories</span>
            <div className="category-pills">
              {ALL_CATEGORIES.map((category) => {
                const active = categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    className={`pill ${active ? "pill-active" : ""}`}
                    onClick={() => toggleCategory(category)}
                    aria-pressed={active}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="field-label expiry-field">
            Expires
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>

          <div className="button-row">
            <button className="primary authorize-btn" onClick={handleAuthorize} disabled={busy}>
              {isActive ? "Update authorization" : "Authorize"}
            </button>
            {consent && (
              <button className="ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
            )}
            {!consent && (
              <button className="ghost" onClick={handleRefresh} disabled={busy}>
                Refresh status
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      )}

      {justAuthorized && (
        <div className="seal-banner" role="status">
          <span className="seal-mark" aria-hidden="true" />
          Authorization sealed
        </div>
      )}
    </div>
  );
}
