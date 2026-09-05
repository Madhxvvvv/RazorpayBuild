import type { ChainDetail, ChainSummary, Consent, FailureMode, MandateRecord, OrchestratorResult } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `request to ${path} failed with status ${res.status}`);
  }
  return body as T;
}

export function getConsent(userId: string, merchantId: string): Promise<Consent> {
  return request(`/consent/${encodeURIComponent(userId)}/${encodeURIComponent(merchantId)}`);
}

export function upsertConsent(input: {
  userId: string;
  merchantId: string;
  spendCapPerTxn: number;
  spendCapPerDay: number;
  categoryAllowlist: string[];
  expiresAt: string;
}): Promise<Consent> {
  return request("/consent", { method: "POST", body: JSON.stringify(input) });
}

export function revokeConsent(userId: string, merchantId: string): Promise<Consent> {
  return request("/consent/revoke", { method: "POST", body: JSON.stringify({ userId, merchantId }) });
}

export function sendMessage(input: {
  userId: string;
  merchantId: string;
  chainId?: string;
  message: string;
  confirmStepUp?: boolean;
  forcedFailure?: FailureMode;
}): Promise<OrchestratorResult> {
  const { forcedFailure, ...body } = input;
  return request("/orchestrator/message", {
    method: "POST",
    body: JSON.stringify(body),
    headers: forcedFailure ? { "X-Force-Failure": forcedFailure } : undefined,
  });
}

export function getChains(limit = 50): Promise<ChainSummary[]> {
  return request(`/admin/chains?limit=${limit}`);
}

export function getChainDetail(chainId: string): Promise<ChainDetail> {
  return request(`/admin/chains/${encodeURIComponent(chainId)}`);
}

export function getDecisions(limit = 50): Promise<MandateRecord[]> {
  return request(`/admin/decisions?limit=${limit}`);
}

export function getKillSwitch(merchantId: string): Promise<{ merchantId: string; engaged: boolean }> {
  return request(`/admin/kill-switch/${encodeURIComponent(merchantId)}`);
}

export function setKillSwitch(merchantId: string, engaged: boolean): Promise<{ merchantId: string; engaged: boolean }> {
  return request("/admin/kill-switch", { method: "POST", body: JSON.stringify({ merchantId, engaged }) });
}
