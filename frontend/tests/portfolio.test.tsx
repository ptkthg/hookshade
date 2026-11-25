import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { delay, http, HttpResponse } from "msw";
import { me, router, server, setPath } from "./setup";
import LoginPage from "@/app/login/page";
import NovaAnalisePage from "@/app/nova-analise/page";
import RegrasPage from "@/app/regras/page";
import { AppShell } from "@/components/AppShell";
import { ResultView } from "@/components/ResultView";
import { RuleForm } from "@/components/RuleForm";
import type { AnalysisDetail } from "@/lib/types";

const result: AnalysisDetail = {
  id: 42, source_type: "text", risk_score: 75, severity: "alto", confidence: "high",
  summary: "Mensagem fictícia suspeita", created_at: "2026-11-24T12:00:00Z", parsed_headers: {},
  iocs: [{ type: "domain", value_defanged: "contoso[.]example", value_hash: "placeholder" }],
  findings: [{ category: "auth", title: "SPF falhou", severity: "alto", description: "Falha fictícia", weight_contribution: 20, evidence: "spf=fail" }],
  recommendations: [],
};

async function credentials() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("E-mail"), "analista@example.com");
  await user.type(screen.getByLabelText("Senha"), "test-only-password");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("login", () => {
  it("entra com sucesso", async () => {
    server.use(http.post("*/api/v1/auth/login", () => HttpResponse.json(me)));
    render(<LoginPage />); await credentials();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/nova-analise"));
  });
  it.each(["senha incorreta", "conta bloqueada"])("mostra erro genérico para %s", async () => {
    server.use(http.post("*/api/v1/auth/login", () => HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 })));
    render(<LoginPage />); await credentials();
    expect(await screen.findByText("Invalid credentials")).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("entra como demo somente quando habilitado", async () => {
    server.use(http.post("*/api/v1/auth/demo", () => HttpResponse.json(me)));
    render(<LoginPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar como demo" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/historico"));
  });
  it("oculta demo quando desligado", async () => {
    server.use(http.get("*/api/v1/auth/config", () => HttpResponse.json({ demo_enabled: false })));
    render(<LoginPage />);
    await screen.findByRole("button", { name: "Entrar" });
    await waitFor(() => expect(screen.queryByText("Entrar como demo")).not.toBeInTheDocument());
  });
  it("avisa cold start e recupera sem mostrar erro", async () => {
    server.use(http.get("*/api/health", async () => { await delay(3400); return HttpResponse.json({ status: "ok" }); }));
    render(<LoginPage />);
    expect(await screen.findByText("API acordando (plano gratuito do Render)…", {}, { timeout: 4500 })).toBeVisible();
    await screen.findByText("Entrar como demo", {}, { timeout: 4000 });
    await waitFor(() => expect(screen.queryByText("API acordando (plano gratuito do Render)…")).not.toBeInTheDocument());
  });
  it("tenta novamente quando a saúde retorna indisponível", async () => {
    let calls = 0;
    server.use(http.get("*/api/health", () => {
      calls += 1;
      return HttpResponse.json({}, { status: calls === 1 ? 503 : 200 });
    }));
    render(<LoginPage />);
    expect(await screen.findByText("Entrar como demo", {}, { timeout: 4000 })).toBeVisible();
    expect(calls).toBe(2);
  });
});

describe("análises", () => {
  it("desabilita escrita demo e permite amostra sem navegar a um ID persistido", async () => {
    server.use(http.post("*/api/v1/analyses/samples/phishing", () => HttpResponse.json({ ...result, id: 0, source_type: "sample" })));
    render(<NovaAnalisePage />);
    expect(await screen.findByText(/Demonstração · dados fictícios/)).toBeVisible();
    expect(screen.getByLabelText("Conteúdo bruto do e-mail")).toBeDisabled();
    expect(screen.getByLabelText("Arquivo .eml")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Testar com amostra" }));
    expect(await screen.findByText("contoso[.]example")).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });
  it.each(["texto", "upload"])("envia %s como analista", async (mode) => {
    server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json({ ...me, role: "analyst" })),
      http.post(mode === "texto" ? "*/api/v1/analyses/text" : "*/api/v1/analyses", async ({ request }) => {
        if (mode === "texto") expect(await request.json()).toMatchObject({ content: "Mensagem fictícia" });
        else expect(request.headers.get("content-type")).toContain("multipart/form-data");
        return HttpResponse.json(result);
      }));
    render(<NovaAnalisePage />);
    await screen.findByRole("button", { name: "Testar com amostra" });
    await waitFor(() => expect(screen.getByLabelText("Arquivo .eml")).toBeEnabled());
    if (mode === "texto") await userEvent.type(screen.getByLabelText("Conteúdo bruto do e-mail"), "Mensagem fictícia");
    else await userEvent.upload(screen.getByLabelText("Arquivo .eml"), new File(["Fictício"], "teste.eml", { type: "message/rfc822" }));
    await userEvent.click(screen.getByRole("button", { name: "Analisar" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/resultado/42"));
  });
  it("mostra score, evidências e IOCs", () => {
    render(<ResultView a={result} />);
    expect(screen.getByText("75")).toBeVisible();
    expect(screen.getByText("spf=fail")).toBeVisible();
    expect(screen.getByText("contoso[.]example")).toBeVisible();
  });
});

describe("regras e guardas", () => {
  it("valida JSON antes de enviar", async () => {
    const submit = vi.fn(); render(<RuleForm onSubmit={submit} submitLabel="Criar regra" />);
    fireEvent.change(screen.getByLabelText("Condição declarativa da regra (JSON)"), { target: { value: "{" } });
    fireEvent.submit(screen.getByRole("button", { name: /Criar|Salvar/ }).closest("form")!);
    expect(await screen.findByText(/não é um JSON válido/)).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });
  it.each(["nome", "justificativa"])("exige %s no editor", async (field) => {
    const submit = vi.fn(); render(<RuleForm onSubmit={submit} submitLabel="Criar regra" />);
    if (field === "justificativa") await userEvent.type(screen.getByLabelText("Nome da regra"), "Regra fictícia");
    await userEvent.click(screen.getByRole("button", { name: "Criar regra" }));
    expect(await screen.findByText(field === "nome" ? /Informe um nome/ : /Justificativa é obrigatória/)).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
  });
  it("oculta nova regra para demo", async () => {
    render(<RegrasPage />); await screen.findByRole("heading", { name: "Regras de detecção" });
    expect(screen.queryByRole("link", { name: /Nova regra/ })).not.toBeInTheDocument();
  });
  it.each(["/usuarios", "/auditoria"])("bloqueia %s para demo", async (path) => {
    setPath(path); render(<AppShell><p>Conteúdo restrito</p></AppShell>);
    expect(await screen.findByText(/Acesso restrito/)).toBeVisible();
    expect(screen.queryByText("Conteúdo restrito")).not.toBeInTheDocument();
  });
  it("permite administração para admin", async () => {
    server.use(http.get("*/api/v1/auth/me", () => HttpResponse.json({ ...me, role: "admin" })));
    setPath("/auditoria"); render(<AppShell><p>Conteúdo restrito</p></AppShell>);
    expect(await screen.findByText("Conteúdo restrito")).toBeVisible();
  });
});
