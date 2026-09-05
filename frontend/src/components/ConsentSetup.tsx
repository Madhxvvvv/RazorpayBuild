import { useState } from "react";
import { getConsent, revokeConsent, upsertConsent } from "../lib/api";
import type { Consent } from "../lib/types";

const ALL_CATEGORIES = ["food", "beverages", "groceries", "personal-care", "stationery", "electronics"];

interface Props {
  userId: string;
  merchantId: string;
  consent: Consent | null;
  onConsentChange: (consent: Consent | null) => void;
}

export function ConsentSetup({ userId, merchantId, consent, onConsentChange }: Props) {
  const [spendCapPerTxn, setSpendCapPerTxn] = useState("500");
  const [spendCapPerDay, setSpendCapPerDay] = useState("2000");
  const [categories, setCategories] = useState<string[]>(["food", "beverages", "groceries"]);
  const [expiresAt, setExpiresAt] = useState("2026-12-31");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(category: string) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const saved = await upsertConsent({
        userId,
        merchantId,
        spendCapPerTxn: Math.round(Number(spendCapPerTxn) * 100),
        spendCapPerDay: Math.round(Number(spendCapPerDay) * 100),
        categoryAllowlist: categories,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      onConsentChange(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    setError(null);
    try {
      const revoked = await revokeConsent(userId, merchantId);
      onConsentChange(revoked);
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
    <div className="panel">
      <h2>Consent &amp; spend caps</h2>
      <p className="hint">
        One-time setup, standing in for UPI Reserve Pay / NPCI's UAP — a spending limit set up front, not per-transaction OTP.
      </p>

      <div className="field-row">
        <label>
          Per-transaction cap (₹)
          <input value={spendCapPerTxn} onChange={(e) => setSpendCapPerTxn(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Per-day cap (₹)
          <input value={spendCapPerDay} onChange={(e) => setSpendCapPerDay(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Expires
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
      </div>

      <fieldset>
        <legend>Allowed categories</legend>
        {ALL_CATEGORIES.map((category) => (
          <label key={category} className="checkbox">
            <input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} />
            {category}
          </label>
        ))}
      </fieldset>

      <div className="button-row">
        <button onClick={handleSave} disabled={busy}>
          Save consent
        </button>
        <button onClick={handleRevoke} disabled={busy || !consent} className="danger">
          Revoke consent
        </button>
        <button onClick={handleRefresh} disabled={busy}>
          Refresh status
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="status">
        {consent ? (
          <>
            <p>
              <strong>Status:</strong> {consent.revoked ? "REVOKED" : "active"} · caps ₹{consent.spendCapPerTxn / 100}/txn, ₹
              {consent.spendCapPerDay / 100}/day · categories: {consent.categoryAllowlist.join(", ")}
            </p>
          </>
        ) : (
          <p>No consent on file yet for {userId} / {merchantId}.</p>
        )}
      </div>
    </div>
  );
}
