import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { clearCsrfToken } from "@/lib/auth";

export const router = { push: vi.fn(), replace: vi.fn() };
export let pathname = "/nova-analise";
export function setPath(path: string) { pathname = path; }
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => pathname }));

export const me = { id: 1, name: "Demo fictício", email: "demo@hookshade.example", role: "demo" };
export const server = setupServer(
  http.get("*/api/health", () => HttpResponse.json({ status: "ok" })),
  http.get("*/api/v1/auth/config", () => HttpResponse.json({ demo_enabled: true })),
  http.get("*/api/v1/auth/csrf", () => HttpResponse.json({ csrf_token: "test-only-csrf-placeholder" })),
  http.get("*/api/v1/auth/me", () => HttpResponse.json(me)),
  http.get("*/api/v1/rules", () => HttpResponse.json([])),
);
// Node fetch exige URL absoluta; o navegador resolve essas rotas pela origem atual.
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => nativeFetch(
  typeof input === "string" ? new URL(input, "http://localhost").href : input, init,
);
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => { cleanup(); server.resetHandlers(); clearCsrfToken(); vi.clearAllMocks(); setPath("/nova-analise"); });
afterAll(() => server.close());
