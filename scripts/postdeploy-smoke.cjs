#!/usr/bin/env node
/*
 * Smoke pós-deploy da Hookshade — valida o ambiente PUBLICADO.
 * Parametrizado 100% por variáveis de ambiente: nenhum segredo/URL hardcoded,
 * nenhuma dependência de localhost, nenhum pressuposto de usuário viewer
 * (o seed de produção é admin). Não apaga dados; a regra de smoke é deixada
 * INATIVA para não afetar o score de análises reais.
 *
 * Uso (bash/CI):
 *   HOOKSHADE_FRONTEND_URL=... HOOKSHADE_API_URL=... \
 *   HOOKSHADE_ADMIN_EMAIL=... HOOKSHADE_ADMIN_PASSWORD=... node postdeploy-smoke.cjs
 *
 * Uso (PowerShell):
 *   $env:HOOKSHADE_FRONTEND_URL="..."; $env:HOOKSHADE_API_URL="..."
 *   $env:HOOKSHADE_ADMIN_EMAIL="..."; $env:HOOKSHADE_ADMIN_PASSWORD="..."
 *   node postdeploy-smoke.cjs
 */
const { chromium } = require("playwright");

function reqEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`ERRO: variável de ambiente obrigatória ausente: ${name}`); process.exit(2); }
  return v;
}

const FRONTEND = reqEnv("HOOKSHADE_FRONTEND_URL").replace(/\/+$/, "");
const API = reqEnv("HOOKSHADE_API_URL").replace(/\/+$/, "");
const EMAIL = reqEnv("HOOKSHADE_ADMIN_EMAIL");
const PASSWORD = reqEnv("HOOKSHADE_ADMIN_PASSWORD");

const PREVIEW_ROUTES = ["/preview", "/preview/premium", "/preview/clean", "/preview/tech",
                        "/preview/fonts", "/preview/auditoria", "/preview/resultado"];
// Dado de teste sintético (não sensível, não é isca real reutilizável).
const EML = "From: Cobranca <a@paypa1.com>\nSubject: Acao urgente na conta\n\nvoce ganhou na loteria, confirme agora";

const results = [];
const check = (name, cond) => { results.push([!!cond, name]); console.log((cond ? "PASS" : "FAIL") + "  " + name); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // API viva
  const health = await ctx.request.get(API + "/health").catch(() => null);
  check("API /health responde ok", health && health.ok());

  // 1. landing pública
  await page.goto(FRONTEND + "/");
  await page.waitForSelector("text=veredito que se explica", { timeout: 30000 }).catch(() => {});
  check("/ abre a landing premium (pública)", (await page.getByText("veredito que se explica").count()) > 0);

  // 2. /preview/* inacessível
  let previewBlocked = true;
  for (const r of PREVIEW_ROUTES) {
    const resp = await ctx.request.get(FRONTEND + r).catch(() => null);
    const st = resp ? resp.status() : 0;
    if (st !== 404) { previewBlocked = false; console.log(`  ${r} -> ${st}`); }
  }
  check("/preview/* retorna 404 (inacessível)", previewBlocked);

  // 3. /login carrega
  await page.goto(FRONTEND + "/login");
  await page.waitForSelector('input[placeholder="E-mail"]');
  check("/login carrega", (await page.locator('input[placeholder="E-mail"]').count()) > 0);

  // 4. login admin
  await page.fill('input[placeholder="E-mail"]', EMAIL);
  await page.fill('input[placeholder="Senha"]', PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/nova-analise", { timeout: 30000 }).catch(() => {});
  check("login admin -> /nova-analise", page.url().includes("/nova-analise"));

  // 5. nova análise (cria dado de teste sintético)
  await page.waitForSelector('h1:has-text("Nova Análise")');
  await page.fill('textarea[placeholder="Cole o e-mail bruto aqui"]', EML);
  await page.getByRole("button", { name: "Analisar", exact: true }).click();
  await page.waitForURL("**/resultado/**", { timeout: 30000 }).catch(() => {});
  const aid = page.url().split("/").pop();
  check("/nova-analise cria e abre resultado", /resultado\/\d+/.test(page.url()));

  // 6. resultado com manchete "veredito + ação"
  await page.waitForSelector("text=Achados e evidências").catch(() => {});
  check("resultado exibe achados e evidências", (await page.getByText("Achados e evidências").count()) > 0);
  check("resultado exibe manchete 'veredito + ação'", (await page.getByText("Ação recomendada").count()) > 0);

  // 7. histórico lista a análise criada
  await page.goto(FRONTEND + "/historico");
  await page.waitForSelector('h1:has-text("Histórico")');
  await page.waitForSelector(`a[href="/resultado/${aid}"]`, { timeout: 10000 }).catch(() => {});
  check("/historico lista a análise permitida", (await page.locator(`a[href="/resultado/${aid}"]`).count()) > 0);

  // 8. regras: abrir / criar / testar / ativar / desativar
  await page.goto(FRONTEND + "/regras");
  await page.waitForSelector('h1:has-text("Regras de detecção")');
  await page.getByRole("link", { name: "Nova regra" }).waitFor({ timeout: 10000 }).catch(() => {});
  check("/regras abre (admin vê 'Nova regra')", (await page.getByRole("link", { name: "Nova regra" }).count()) > 0);

  await page.getByRole("link", { name: "Nova regra" }).click();
  await page.waitForURL("**/regras/nova");
  const inputs = page.locator("form input");
  await inputs.nth(0).fill("smoke-postdeploy-" + Date.now());
  await inputs.nth(1).fill("regra de smoke — pode ficar inativa/excluir");
  await page.locator("form select").nth(0).selectOption("content");
  await page.locator("form select").nth(1).selectOption("alto");
  await page.locator("form textarea").fill('{"field":"body","op":"contains","value":"loteria"}');
  await page.fill('input[placeholder="Por que esta regra/mudança?"]', "smoke pós-deploy");
  await page.getByRole("button", { name: "Criar regra", exact: true }).click();
  await page.waitForURL(/\/regras\/\d+$/);
  await page.getByRole("button", { name: "Ativar", exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
  check("criar regra (nasce inativa)", (await page.getByRole("button", { name: "Ativar", exact: true }).count()) > 0);

  // testar contra a análise criada
  await page.locator("select").last().selectOption(aid);
  await page.getByRole("button", { name: "Testar regra", exact: true }).click();
  await page.waitForSelector("text=DISPARARIA", { timeout: 15000 }).catch(() => {});
  check("testar regra contra análise (disparo previsto)", (await page.getByText("DISPARARIA").count()) > 0);

  // ativar
  await page.fill('input[placeholder="Justificativa desta ação"]', "ativar (smoke)");
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await page.getByRole("button", { name: "Desativar", exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
  check("ativar regra", (await page.getByRole("button", { name: "Desativar", exact: true }).count()) > 0);

  // desativar — deixa INATIVA para não afetar produção
  await page.fill('input[placeholder="Justificativa desta ação"]', "desativar (smoke)");
  await page.getByRole("button", { name: "Desativar", exact: true }).click();
  await page.getByRole("button", { name: "Ativar", exact: true }).waitFor({ timeout: 10000 }).catch(() => {});
  check("desativar regra (deixa inativa, sem poluir score)", (await page.getByRole("button", { name: "Ativar", exact: true }).count()) > 0);

  // 9. sem erro bruto / token / segredo / dado sensível na tela
  const bodyText = await page.evaluate(() => document.body.innerText);
  const LEAK = /eyJ[A-Za-z0-9._-]{10,}|Bearer\s+[A-Za-z0-9]|Traceback|Internal Server Error|HOOKSHADE_[A-Z_]*=|SECRET_KEY|ENCRYPTION_KEY|-----BEGIN/;
  check("sem token/segredo/stacktrace exposto na tela", !LEAK.test(bodyText));
  check("sem erros de página (pageerror)", pageErrors.length === 0);

  await browser.close();
  const failed = results.filter((r) => !r[0]);
  console.log(`\n=== SMOKE PÓS-DEPLOY: ${results.length - failed.length}/${results.length} PASS ===`);
  console.log(`frontend=${FRONTEND}  api=${API}`);
  if (pageErrors.length) console.log("PAGE ERRORS:", pageErrors.slice(0, 5));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("SCRIPT ERROR:", e); process.exit(2); });
