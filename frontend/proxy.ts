import { NextRequest, NextResponse } from "next/server";

/* CSP com nonce por requisição.
 *
 * Esta é a metade que faltava da migração de autenticação. O cookie httpOnly impede que
 * um XSS ROUBE a sessão; não impede que ele a USE — o token CSRF é legível por JS (é assim
 * que double-submit funciona), então um script injetado o lê e o navegador anexa o cookie
 * de sessão sozinho. A defesa contra abuso em sessão é impedir o script de rodar: CSP.
 *
 * Por isso, em produção, `script-src` NÃO tem 'unsafe-inline' nem 'unsafe-eval'. Só roda
 * script com o nonce desta resposta — que um atacante não tem como adivinhar.
 */

const isProd = process.env.NODE_ENV === "production";

// Interruptor de emergência: transforma a CSP em Report-Only (relata, não bloqueia).
// Existe para que uma CSP mal calibrada em produção seja neutralizada por variável de
// ambiente, em segundos, sem redeploy de código.
const reportOnly = process.env.CSP_REPORT_ONLY === "true";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",

    // 'strict-dynamic': o bootstrap do Next carrega os próprios chunks; sem isso teríamos
    // de listar cada arquivo. Em dev, o Turbopack exige 'unsafe-eval' para o HMR — a CSP
    // de desenvolvimento é deliberadamente mais frouxa, a de produção não.
    isProd
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,

    // EXCEÇÃO CONSCIENTE: a UI usa style={{...}} do React em toda parte, e atributos
    // `style` são bloqueados por style-src sem 'unsafe-inline'. Risco aceito: estilo
    // inline não executa código — é ordens de magnitude menos perigoso que script inline.
    // Remover exigiria reescrever a UI inteira para classes.
    "style-src 'self' 'unsafe-inline'",

    "img-src 'self' data:",
    "font-src 'self'",           // next/font self-hospeda as fontes; nenhum CDN
    "connect-src 'self' https://hookshade-api.onrender.com",
    "frame-ancestors 'none'",    // anti-clickjacking
    "object-src 'none'",         // sem plugins
    "base-uri 'self'",           // impede sequestro da URL base
    "form-action 'self'",        // impede exfiltração por submit para fora
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export default function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // O Next lê o nonce do header CSP da REQUISIÇÃO e o injeta nos próprios <script>.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(
    reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    csp,
  );
  return response;
}

export const config = {
  // Fora: assets estáticos (não executam nada) e /api/* (é JSON puro, e o backend já
  // manda a própria CSP restritiva na resposta).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
