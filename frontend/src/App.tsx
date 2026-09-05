import { useEffect, useState } from "react";
import "./index.css";
import { ConsentSetup } from "./components/ConsentSetup";
import { Chat } from "./components/Chat";
import { getConsent } from "./lib/api";
import type { Consent } from "./lib/types";

const USER_ID = "user-1";
const MERCHANT_ID = "merchant-1";

function App() {
  const [consent, setConsent] = useState<Consent | null>(null);

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
      </header>
      <main>
        <ConsentSetup userId={USER_ID} merchantId={MERCHANT_ID} consent={consent} onConsentChange={setConsent} />
        <Chat userId={USER_ID} merchantId={MERCHANT_ID} consent={consent} />
      </main>
    </div>
  );
}

export default App;
