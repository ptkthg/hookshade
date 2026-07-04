import { getToken } from "./auth";
import type {
  AnalysisDetail, AnalysisSummary, AuditPage,
  CurrentUser, Rule, RuleChange, RuleInput, RuleTestResult,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<string> {
  const data = await req<{ access_token: string }>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return data.access_token;
}

export const listAnalyses = () => req<AnalysisSummary[]>("/api/v1/analyses");

export function listAudit(params: { action?: string; limit?: number; offset?: number } = {}) {
  const q = new URLSearchParams();
  if (params.action) q.set("action", params.action);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const qs = q.toString();
  return req<AuditPage>(`/api/v1/audit${qs ? `?${qs}` : ""}`);
}
export const getAnalysis = (id: number) => req<AnalysisDetail>(`/api/v1/analyses/${id}`);

export const analyzeText = (content: string, context?: string) =>
  req<AnalysisDetail>("/api/v1/analyses/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, context }),
  });

export async function analyzeFile(file: File, context?: string): Promise<AnalysisDetail> {
  const form = new FormData();
  form.append("file", file);
  if (context) form.append("context", context);
  return req<AnalysisDetail>("/api/v1/analyses", { method: "POST", body: form });
}

// ---- Usuário atual (para gating de RBAC na UI) ----
export const getMe = () => req<CurrentUser>("/api/v1/auth/me");

// ---- Motor de regras editável (P1-3) ----
const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function listRules(params: { status?: string; category?: string } = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.category) q.set("category", params.category);
  const qs = q.toString();
  return req<Rule[]>(`/api/v1/rules${qs ? `?${qs}` : ""}`);
}
export const getRule = (id: number) => req<Rule>(`/api/v1/rules/${id}`);
export const getRuleHistory = (id: number) => req<RuleChange[]>(`/api/v1/rules/${id}/history`);
export const createRule = (r: RuleInput) => req<Rule>("/api/v1/rules", jsonBody("POST", r));
export const updateRule = (id: number, r: Partial<RuleInput>) =>
  req<Rule>(`/api/v1/rules/${id}`, jsonBody("PUT", r));
export const activateRule = (id: number, justification: string) =>
  req<Rule>(`/api/v1/rules/${id}/activate`, jsonBody("POST", { justification }));
export const deactivateRule = (id: number, justification: string) =>
  req<Rule>(`/api/v1/rules/${id}/deactivate`, jsonBody("POST", { justification }));
export const deleteRule = (id: number, justification: string) =>
  req<Rule>(`/api/v1/rules/${id}`, jsonBody("DELETE", { justification }));
export const testRule = (input: {
  analysis_id: number; category: string; severity: string; condition: Record<string, unknown>;
}) => req<RuleTestResult>("/api/v1/rules/test", jsonBody("POST", input));
