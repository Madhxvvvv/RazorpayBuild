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

export function ConsentSetup({ userId, merchantId, consent, onConsentChange }: Props) {
  const [spendCapPerTxn, setSpendCapPerTxn] = useState(500);
  const [spendCapPerDay, setSpendCapPerDay] = useState(2000);
  const [categories, setCategories] = useState<string[]>(["food", "beverages", "groceries"]);
  const [expiresAt, setExpiresAt] = useState("2026-12-31");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAuthorized, setJustAuthorized] = useState(false);

  function toggleCategory(category: string) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
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

  const isActive = Boolean(consent && !consent.revoked);

  return (
    <div className="panel consent-panel">
      <div className="panel-header">
        <div className="mandate-title">
          <span className="mandate-mark" aria-hidden="true" />
          <h2>Mandate authorization</h2>
        </div>
        <span className={`chip ${isActive ? "chip-allow" : "chip-neutral"}`}>{isActive ? "Active" : "Not authorized"}</span>
      </div>
      <p className="hint">
        A one-time spending authorization — standing in for UPI Reserve Pay / NPCI's UAP. Set limits once; the agent
        transacts within them without asking again, and you can revoke instantly from the Admin Dashboard.
      </p>

      <div className="cap-grid">
        <div className="cap-stat">
          <label htmlFor="cap-txn">Per transaction</label>
          <div className="cap-value amount">₹{spendCapPerTxn.toLocaleString("en-IN")}</div>
          <input
            id="cap-txn"
            type="range"
            min={100}
            max={3000}
            step={50}
            value={spendCapPerTxn}
            onChange={(e) => setSpendCapPerTxn(Number(e.target.value))}
          />
        </div>
        <div className="cap-stat">
          <label htmlFor="cap-day">Per day</label>
          <div className="cap-value amount">₹{spendCapPerDay.toLocaleString("en-IN")}</div>
          <input
            id="cap-day"
            type="range"
            min={500}
            max={10000}
            step={100}
            value={spendCapPerDay}
            onChange={(e) => setSpendCapPerDay(Number(e.target.value))}
          />
        </div>
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
        <button className="ghost" onClick={handleRefresh} disabled={busy}>
          Refresh status
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {justAuthorized && (
        <div className="seal-banner" role="status">
          <span className="seal-mark" aria-hidden="true" />
          Authorization sealed
        </div>
      )}

      {consent && (
        <div className="consent-summary mono">
          {consent.userId} → {consent.merchantId} · {consent.categoryAllowlist.join(", ")} · expires{" "}
          {new Date(consent.expiresAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
