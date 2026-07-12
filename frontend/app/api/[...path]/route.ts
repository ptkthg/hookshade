import { NextRequest } from "next/server";

/* Proxy same-origin: o navegador fala SÓ com o front; o front fala com o backend.
 *
 * Isso é o que torna o cookie httpOnly viável: a sessão é emitida para a origem do
 * front (nada de cookie cross-site, nada de SameSite=None) e a URL real do backend
 * nunca chega ao navegador.
 *
 * NÃO é um proxy aberto. O destino é UMA origem fixa, vinda de variável server-side;
 * o caminho recebido é reanexado a ela e nada da requisição do usuário pode
 * redirecionar para outro host. Sem isso, seria um SSRF de mão beijada.
 */

// server-side: sem NEXT_PUBLIC_, este valor nunca é embutido no bundle do browser
const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

const TIMEOUT_MS = 30_000;

// Repassados do browser para o backend. Allowlist: nada de header arbitrário.
const FORWARD_TO_BACKEND = new Set([
  "content-type",
  "cookie",
  "accept",
  "x-csrf-token",
  "x-request-id",
]);

// Devolvidos do backend para o browser. `set-cookie` é tratado à parte (pode repetir).
const FORWARD_TO_BROWSER = new Set([
  "content-type",
  "cache-control",
  "x-request-id",
]);

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Reconstrói a URL a partir da origem FIXA. O usuário controla só o caminho e a
  // query — nunca o host.
  const target = new URL(`${BACKEND}/api/${path.map(encodeURIComponent).join("/")}`);
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (FORWARD_TO_BACKEND.has(key.toLowerCase())) headers.set(key, value);
  });

  // GET/HEAD não têm corpo. Nos demais, o body é repassado como stream: um .eml
  // grande não é carregado inteiro em memória, e o multipart chega intacto (não
  // reserializamos o FormData, o que corromperia o boundary).
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      // @ts-expect-error duplex é exigido pelo runtime para body em stream
      duplex: "half",
      redirect: "manual", // o backend não redireciona; se redirecionar, não seguimos
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Erro opaco: não expõe host interno, stack nem causa. Nunca loga o corpo.
    return Response.json({ detail: "Serviço indisponível" }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (FORWARD_TO_BROWSER.has(key.toLowerCase())) out.set(key, value);
  });

  // Set-Cookie precisa sobreviver ao proxy — é ele que carrega a sessão. Pode vir
  // repetido (sessão + csrf), daí getSetCookie() em vez de headers.get().
  for (const cookie of upstream.headers.getSetCookie()) {
    out.append("set-cookie", cookie);
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
