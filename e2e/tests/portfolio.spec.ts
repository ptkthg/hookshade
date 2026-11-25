import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

test("demo: seed, resultado, amostra, escrita negada e limpeza de sessão", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/Refused to (execute|load|connect)|violates.*Content Security Policy/i.test(message.text())) errors.push(message.text());
  });
  const capture = async (name: string) => {
    if (process.env.CAPTURE_DOCS === "true") {
      await mkdir(resolve("../docs/img"), { recursive: true });
      await page.screenshot({ path: resolve(`../docs/img/${name}.png`), fullPage: true });
    }
  };
  const loginResponse = await page.goto("/login");
  expect(loginResponse?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(loginResponse?.headers()["x-frame-options"]).toBe("DENY");
  expect(loginResponse?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(loginResponse?.headers()["permissions-policy"]).toContain("camera=()");
  expect(loginResponse?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(loginResponse?.headers()["content-security-policy"]).toContain("https://hookshade-api.onrender.com");
  await expect(page.getByRole("button", { name: "Entrar como demo" })).toBeVisible();
  await capture("login");
  await page.getByRole("button", { name: "Entrar como demo" }).click();
  await expect(page).toHaveURL(/historico/);
  await expect(page.getByText("Demonstração · dados fictícios · somente leitura")).toBeVisible();
  await page.locator('a[href^="/resultado/"]').last().click();
  await expect(page).toHaveURL(/\/resultado\/\d+/);
  await expect(page.getByText("Principais evidências:", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /Índice heurístico \d+ de 100/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /IOCs/ })).toBeVisible();
  await expect(page.locator("text=/example|203.*113|192.*0.*2|198.*51.*100/").first()).toBeVisible();
  await capture("resultado");
  await page.goto("/regras");
  await expect(page.getByRole("heading", { name: "Regras de detecção" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova regra" })).toHaveCount(0);
  await capture("regras");
  await page.goto("/nova-analise");
  await expect(page.getByLabel("Conteúdo bruto do e-mail")).toBeEnabled();
  await capture("nova-analise");
  await page.getByRole("button", { name: "Testar com amostra" }).click();
  await expect(page.getByText("Resultado da amostra · não persistido")).toBeVisible();
  await page.getByLabel("Conteúdo bruto do e-mail").fill("From: ficticio@example.com\nSubject: Treinamento fictício\n\nhttps://contoso.example/login");
  await page.getByRole("button", { name: "Analisar", exact: true }).click();
  await expect(page.getByText("Resultado efêmero · não foi salvo")).toBeVisible();
  await expect(page).toHaveURL(/nova-analise/);
  // Exercita também File.text() no navegador real.
  await page.getByLabel("Arquivo .eml").setInputFiles({
    name: "ficticio.eml", mimeType: "message/rfc822",
    buffer: Buffer.from("From: ficticio@example.com\nSubject: Arquivo fictício\n\nhttps://contoso.example/login"),
  });
  const uploadPreview = page.waitForResponse((r) => r.url().endsWith("/analyses/preview") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Analisar", exact: true }).click();
  expect((await uploadPreview).status()).toBe(200);
  await expect(page.getByText("Resultado efêmero · não foi salvo")).toBeVisible();
  await page.goto("/historico");
  await expect(page.locator('a[href^="/resultado/"]')).toHaveCount(4);
  // Reutiliza o par CSRF do navegador; reemitir pela API desalinhará o token em memória da UI.
  const csrf = (await context.cookies()).find((c) => c.name.includes("csrf"))!.value;
  const before = await (await context.request.get("/api/v1/analyses")).json();
  expect(before).toHaveLength(4);
  const denied = await context.request.post("/api/v1/analyses/text", {
    headers: { "X-CSRF-Token": csrf }, data: { content: "Somente mensagem fictícia" },
  });
  expect(denied.status()).toBe(403);
  expect(await (await context.request.get("/api/v1/analyses")).json()).toEqual(before);
  const session = (await context.cookies()).find((c) => c.httpOnly && c.name.includes("session"));
  expect(session).toBeTruthy();
  const logout = page.waitForResponse((r) => r.url().endsWith("/api/v1/auth/logout") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Sair", exact: true }).filter({ visible: true }).click();
  expect((await logout).status()).toBe(204);
  await expect(page).toHaveURL(/login/);
  expect((await context.cookies()).some((c) => c.name === session!.name)).toBe(false);
  expect((await context.request.get("/api/v1/auth/me")).status()).toBe(401);
  await page.goto("/historico");
  await expect(page).toHaveURL(/login/);
  expect(errors).toEqual([]);
});

test("analyst: cookie antigo é recusado após logout", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("e2e-analyst@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("e2e-only-analyst-placeholder");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/nova-analise/);
  expect((await (await context.request.get("/api/v1/auth/me")).json()).role).toBe("analyst");
  const oldCookies = await context.cookies();
  await page.getByRole("button", { name: "Sair", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/login/);
  await context.addCookies(oldCookies);
  expect((await context.request.get("/api/v1/auth/me")).status()).toBe(401);
  await page.goto("/historico");
  await expect(page).toHaveURL(/login/);
});
