import { clearCsrfToken, getCsrfToken, setCsrfToken } from "./auth";
import type {
  AdminUser, AnalysisDetail, AnalysisSummary, AuditPage,
  CurrentUser, Rule, RuleChange, RuleInput, RuleTestResult,
} from "./types";

/* Rotas RELATIVAS: o browser fala só com a nossa origem (/api/*), que faz proxy
 * para o backend. Sem URL de backend no bundle, e o cookie de sessão é same-origin. */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Busca o token CSRF (uma vez) e o guarda em memória. */
async function ensureCsrf(): Promise<string> {
  const cached = getCsrfToken();
  if (cached) return cached;
  const res = await fetch("/api/v1/auth/csrf", { credentials: "include" });
  if (!res.ok) throw new Error("Não foi possível iniciar a sessão");
  const { csrf_token } = (await res.json()) as { csrf_token: string };
  setCsrfToken(csrf_token);
  return csrf_token;
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };

  // Só métodos mutáveis carregam CSRF — GET não precisa e buscar token em toda
  // leitura seria um round-trip a mais por request.
  if (MUTATING.has(method)) headers["X-CSRF-Token"] = await ensureCsrf();

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include", // manda o cookie httpOnly; é ele que autentica agora
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Autentica. O JWT não volta no corpo: ele fica no cookie httpOnly. */
export const login = (email: string, password: string) =>
  req<CurrentUser>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

/** Encerra a sessão no servidor (o JS não tem como apagar o cookie httpOnly). */
export async function logout(): Promise<void> {
  await req<void>("/api/v1/auth/logout", { method: "POST" });
  clearCsrfToken();
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

// ---- Gestão de usuários (admin) ----
export const listUsers = () => req<AdminUser[]>("/api/v1/users");
export const createUser = (u: { name: string; email: string; password: string; role: string }) =>
  req<AdminUser>("/api/v1/users", jsonBody("POST", u));
export const changeUserRole = (id: number, role: string) =>
  req<AdminUser>(`/api/v1/users/${id}/role`, jsonBody("PATCH", { role }));
export const changeUserStatus = (id: number, status: string) =>
  req<AdminUser>(`/api/v1/users/${id}/status`, jsonBody("PATCH", { status }));
export const resetUserPassword = (id: number, password: string) =>
  req<AdminUser>(`/api/v1/users/${id}/password`, jsonBody("PATCH", { password }));
