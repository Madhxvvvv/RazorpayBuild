import { useState } from "react";

function truncate(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function HashChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard access can be denied by the browser; truncated value is still visible
    }
  }

  return (
    <button type="button" className="hash-chip" onClick={handleClick} title={value} aria-label={`Copy ${value}`}>
      {copied ? <span className="copied">Copied</span> : <span>{truncate(value)}</span>}
    </button>
  );
}
