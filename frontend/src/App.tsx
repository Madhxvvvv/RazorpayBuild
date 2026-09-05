import { useEffect, useState } from "react";
import "./index.css";
import { ConsentSetup } from "./components/ConsentSetup";
import { Chat } from "./components/Chat";
import { AdminDashboard } from "./components/AdminDashboard";
import { ActivityStrip } from "./components/ActivityStrip";
import { getConsent } from "./lib/api";
import type { Consent, FailureMode } from "./lib/types";

const USER_ID = "Aditi Verma";
const MERCHANT_ID = "GreenCart";

type Tab = "storefront" | "admin";

function App() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [tab, setTab] = useState<Tab>("storefront");
  const [forcedFailure, setForcedFailure] = useState<FailureMode | "">("");
  const [activityTick, setActivityTick] = useState(0);

  useEffect(() => {
    getConsent(USER_ID, MERCHANT_ID)
      .then(setConsent)
      .catch(() => setConsent(null));
  }, []);

  return (
    <div className="app">
      <header>
        <div className="wordmark">
          <span className="wordmark-glyph" aria-hidden="true" />
          <span className="wordmark-text">Warden</span>
        </div>
        <p className="tagline">Every purchase your shopping agent makes — bounded by policy, logged, and provable.</p>
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
        <>
          <main>
            <ConsentSetup userId={USER_ID} merchantId={MERCHANT_ID} consent={consent} onConsentChange={setConsent} />
            <Chat
              userId={USER_ID}
              merchantId={MERCHANT_ID}
              consent={consent}
              forcedFailure={forcedFailure}
              onConsumeForcedFailure={() => setForcedFailure("")}
              onActivity={() => setActivityTick((t) => t + 1)}
            />
          </main>
          <ActivityStrip refreshKey={activityTick} />
        </>
      ) : (
        <AdminDashboard
          userId={USER_ID}
          merchantId={MERCHANT_ID}
          forcedFailure={forcedFailure}
          onForcedFailureChange={setForcedFailure}
        />
      )}
    </div>
  );
}

export default App;
