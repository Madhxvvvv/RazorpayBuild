import { useEffect, useState } from "react";
import "./index.css";
import { ConsentSetup } from "./components/ConsentSetup";
import { Chat } from "./components/Chat";
import { AdminDashboard } from "./components/AdminDashboard";
import { getConsent } from "./lib/api";
import type { Consent } from "./lib/types";

const USER_ID = "user-1";
const MERCHANT_ID = "merchant-1";

type Tab = "storefront" | "admin";

function App() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [tab, setTab] = useState<Tab>("storefront");

  useEffect(() => {
    getConsent(USER_ID, MERCHANT_ID)
      .then(setConsent)
      .catch(() => setConsent(null));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Agentic Storefront</h1>
        <p className="hint">Track 01 demo — {USER_ID} shopping at {MERCHANT_ID}</p>
        <nav className="tabs">
          <button className={tab === "storefront" ? "active" : ""} onClick={() => setTab("storefront")}>
            Storefront
          </button>
          <button className={tab === "admin" ? "active" : ""} onClick={() => setTab("admin")}>
            Admin / Audit Dashboard
          </button>
        </nav>
      </header>
      {tab === "storefront" ? (
        <main>
          <ConsentSetup userId={USER_ID} merchantId={MERCHANT_ID} consent={consent} onConsentChange={setConsent} />
          <Chat userId={USER_ID} merchantId={MERCHANT_ID} consent={consent} />
        </main>
      ) : (
        <AdminDashboard userId={USER_ID} merchantId={MERCHANT_ID} />
      )}
    </div>
  );
}

export default App;
