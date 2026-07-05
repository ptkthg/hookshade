"use client";
/* Landing pública do Hookshade (promovida de /preview/premium).
   Tipografia via next/font (--font-display Fraunces / --font-sans Inter / --font-mono JetBrains).
   Tokens de cor/profundidade vêm de globals.css. CTAs reais; sem VariationSwitcher. */
import Link from "next/link";
import { Icons, NegativeHook, Wordmark } from "@/components/brand";
import { BENEFITS, DIFERENCIAIS, FEATURES, MOCK, STEPS, USE_CASES } from "@/lib/landingContent";

const DISPLAY = "var(--font-display), ui-serif, Georgia, serif";
const TEXT = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
const MONO = "var(--font-mono), ui-monospace, monospace";
const T = { label: 12, small: 14, body: 16, bodyL: 19, h3: 21, h2: 40, cta: 54, hero: 72 };
const sevColor = (s: string) => (s === "alto" || s === "crítico" ? "#e8776b" : s === "médio" ? "#d7ad55" : "#63c69c");

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 uppercase tracking-[0.4em]" style={{ color: "var(--faint)", fontFamily: MONO, fontSize: T.label }}>
      <span className="h-px w-8" style={{ background: "var(--accent)", opacity: 0.6 }} />{children}
    </div>
  );
}

function CtaButton({ children, size = "md" }: { children: React.ReactNode; size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-8 py-4" : "px-7 py-3.5";
  return (
    <span className={`group inline-flex rounded-full ${pad} text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5`}
      style={{ background: "var(--accent)", fontFamily: TEXT, boxShadow: "0 8px 24px -8px #9b8cff99, inset 0 1px 0 #ffffff33" }}>
      <span className="inline-flex items-center gap-2">{children}
        <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
      </span>
    </span>
  );
}

export default function Landing() {
  const Icon = (name: keyof typeof Icons) => Icons[name]({ c: "var(--accent)", size: 20, sw: 1.5 });
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", fontFamily: TEXT }}>
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: "#04060cd9", borderBottom: "1px solid var(--hair-faint)" }}>
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-8 h-20">
          <Wordmark uid="pr-nav" />
          <div className="hidden md:flex items-center gap-10 text-sm font-light" style={{ color: "var(--muted)" }}>
            <a href="#recursos" className="hover:text-white transition-colors">Recursos</a>
            <a href="#fluxo" className="hover:text-white transition-colors">Processo</a>
            <a href="#casos" className="hover:text-white transition-colors">Aplicações</a>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-light transition-colors hover:text-white" style={{ color: "var(--muted)" }}>Entrar</Link>
            <Link href="/nova-analise" className="rounded-full px-5 py-2 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: "var(--accent)", fontFamily: TEXT, boxShadow: "0 6px 18px -8px #9b8cffaa, inset 0 1px 0 #ffffff33" }}>
              Analisar e-mail
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(48% 40% at 25% 20%, #9b8cff14, transparent 70%)" }} />
        <div className="relative max-w-5xl mx-auto px-8 pt-40 pb-32">
          <Eyebrow>plataforma de triagem de phishing · para SOC e blue team</Eyebrow>
          <h1 className="mt-9 leading-[1.02] tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.hero, letterSpacing: "-0.01em" }}>
            Todo e-mail suspeito,<br />com um <span style={{ color: "var(--accent)", fontWeight: 400 }}>veredito que se explica</span>.
          </h1>
          <p className="mt-8 max-w-[46ch] font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: T.bodyL }}>
            Cole um e-mail bruto e receba indicadores, autenticação do remetente e um índice auditável —
            ponto a ponto, sem caixa-preta.
          </p>
          <div className="mt-11 flex items-center gap-8">
            <Link href="/nova-analise"><CtaButton size="lg">Analisar um e-mail</CtaButton></Link>
            <Link href="/login" className="group text-sm font-light inline-flex items-center gap-2" style={{ color: "var(--text)" }}>
              Entrar na plataforma
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs" style={{ color: "var(--faint)", fontFamily: MONO }}>
            {["anexos nunca executados", "urls sempre defanged", "índice determinístico", "SPF · DKIM · DMARC"].map((s, i) => (
              <span key={s} className="flex items-center gap-8">{i > 0 && <span style={{ opacity: 0.4 }}>·</span>}{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* APRESENTAÇÃO */}
      <section style={{ background: "var(--raise)" }}>
        <div className="max-w-5xl mx-auto px-8 py-28">
          <Eyebrow>a plataforma</Eyebrow>
          <p className="mt-10 max-w-4xl leading-[1.35] tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.h2 }}>
            <span style={{ color: "var(--muted)" }}>Reproduzimos o raciocínio de um investigador —</span> separando cabeçalhos,
            isolando indicadores e verificando a autenticação <span style={{ color: "var(--muted)" }}>para entregar</span> um
            veredito <span style={{ color: "var(--accent)", fontWeight: 400 }}>sem caixa-preta</span>.
          </p>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="max-w-6xl mx-auto px-8 py-32">
        <div className="max-w-2xl">
          <Eyebrow>recursos</Eyebrow>
          <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Tudo que a triagem exige</h2>
          <p className="mt-4 font-light" style={{ color: "var(--muted)", fontSize: T.body }}>Seis capacidades, da submissão à recomendação.</p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{ background: "var(--panel)", boxShadow: "var(--depth)", border: "1px solid var(--hair-faint)" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "var(--panel-top)", border: "1px solid var(--hair)", boxShadow: "inset 0 1px 0 #ffffff10" }}>
                {Icon(f.icon)}
              </div>
              <h3 className="mt-6" style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: T.h3 }}>{f.title}</h3>
              <p className="mt-3 font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: T.small }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section style={{ background: "var(--raise)" }}>
        <div className="max-w-6xl mx-auto px-8 py-32 grid md:grid-cols-2 gap-x-16 gap-y-14">
          {BENEFITS.map((b, i) => (
            <div key={b.k} className="pl-6" style={{ borderLeft: `2px solid ${i === 0 ? "var(--accent)" : "var(--hair)"}` }}>
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-light" style={{ color: "var(--accent)", fontFamily: MONO }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{b.k}</h3>
              </div>
              <p className="mt-3 font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: T.small }}>{b.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FLUXO */}
      <section id="fluxo" className="max-w-5xl mx-auto px-8 py-32">
        <Eyebrow>processo</Eyebrow>
        <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Quatro passos, uma passada.</h2>
        <div className="mt-16 relative">
          <div className="absolute left-[1.15rem] top-2 bottom-2 w-px hidden md:block" style={{ background: "linear-gradient(#9b8cff55, #ffffff08)" }} />
          <div className="space-y-10">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-baseline gap-8">
                <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-light shrink-0"
                  style={{ color: "var(--accent)", background: "var(--bg)", border: "1px solid var(--hair)", fontFamily: MONO }}>{s.n}</span>
                <h3 className="w-44 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{s.t}</h3>
                <p className="font-light leading-relaxed flex-1" style={{ color: "var(--muted)", fontSize: T.small }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VITRINE (ilustrativa) */}
      <section className="relative" style={{ background: "var(--raise)" }}>
        <div className="max-w-6xl mx-auto px-8 pt-32 pb-40">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex justify-center"><Eyebrow>vitrine ilustrativa</Eyebrow></div>
            <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>O veredito, com a evidência à vista.</h2>
          </div>
          <div className="mt-16 mx-auto max-w-4xl rounded-2xl p-10 relative z-10"
            style={{ background: "var(--panel)", border: "1px solid var(--hair)", boxShadow: "var(--depth)" }}>
            <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: "var(--hair-faint)" }}>
              <div className="text-xs" style={{ color: "var(--faint)", fontFamily: MONO }}>exemplo ilustrativo</div>
              <div className="text-xs" style={{ color: "var(--faint)", fontFamily: MONO }}>{MOCK.confidence} confiança</div>
            </div>
            <div className="grid md:grid-cols-[1fr_auto] gap-12 items-center pt-8">
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-widest" style={{ color: "var(--faint)" }}>remetente</div>
                  <div className="mt-1 font-light" style={{ fontFamily: MONO, color: "var(--text)", fontSize: T.body }}>{MOCK.sender}</div>
                </div>
                <div className="space-y-3 pt-1">
                  {MOCK.findings.map((f) => (
                    <div key={f.title} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor(f.sev), boxShadow: `0 0 8px ${sevColor(f.sev)}88` }} />
                        <span className="font-light" style={{ fontSize: T.small }}>{f.title}</span>
                      </div>
                      <span className="text-xs font-light" style={{ color: "var(--faint)", fontFamily: MONO }}>+{f.w}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t" style={{ borderColor: "var(--hair-faint)" }}>
                  <span className="pt-2 text-xs uppercase tracking-widest" style={{ color: "var(--faint)" }}>iocs</span>
                  {MOCK.iocs.map((i) => <span key={i} className="pt-2 text-xs font-light" style={{ color: "var(--accent)", fontFamily: MONO }}>{i}</span>)}
                </div>
              </div>
              <div className="flex flex-col items-center md:pl-12 md:border-l" style={{ borderColor: "var(--hair-faint)" }}>
                <div className="font-extralight leading-none" style={{ color: "var(--text)", fontFamily: MONO, fontSize: 88 }}>{MOCK.score}</div>
                <div className="mt-3 h-px w-16" style={{ background: sevColor(MOCK.severity) }} />
                <div className="mt-3 text-sm font-light uppercase tracking-[0.3em]" style={{ color: sevColor(MOCK.severity) }}>{MOCK.severity}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* APLICAÇÕES */}
      <section id="casos" className="max-w-6xl mx-auto px-8 pt-40 pb-32">
        <Eyebrow>aplicações</Eyebrow>
        <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Onde o Hookshade encaixa</h2>
        <div className="mt-16 grid md:grid-cols-2 gap-4">
          {USE_CASES.map((u) => (
            <div key={u.t} className="group flex items-start gap-5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{ background: "var(--panel)", boxShadow: "var(--depth)", border: "1px solid var(--hair-faint)" }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: "var(--panel-top)", border: "1px solid var(--hair)", boxShadow: "inset 0 1px 0 #ffffff10" }}>
                <NegativeHook size={18} uid={`pr-uc-${u.t}`} />
              </div>
              <div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{u.t}</h3>
                <p className="mt-2 font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: T.small }}>{u.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section id="diferenciais" style={{ background: "var(--raise)" }}>
        <div className="max-w-6xl mx-auto px-8 py-32">
          <Eyebrow>diferenciais</Eyebrow>
          <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>O que separa o Hookshade</h2>
          <div className="mt-14 rounded-2xl overflow-hidden grid sm:grid-cols-2" style={{ background: "var(--panel)", boxShadow: "var(--depth)", border: "1px solid var(--hair-faint)" }}>
            {DIFERENCIAIS.map((x, i) => (
              <div key={x.t} className="p-9" style={{ borderTop: i > 1 ? "1px solid var(--hair-faint)" : undefined, borderLeft: i % 2 === 1 ? "1px solid var(--hair-faint)" : undefined }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: "var(--accent-dim)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: T.h3 }}>{x.t}</h3>
                </div>
                <p className="mt-3 font-light leading-relaxed" style={{ color: "var(--muted)", fontSize: T.small }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHAMADA FINAL */}
      <section className="relative overflow-hidden" style={{ background: "var(--bg)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(50% 70% at 50% 50%, #9b8cff14, transparent 70%)" }} />
        <div className="relative max-w-4xl mx-auto px-8 py-40 text-center">
          <h2 className="tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.cta, letterSpacing: "-0.01em" }}>Triagem que inspira confiança.</h2>
          <p className="mt-6 font-light" style={{ color: "var(--muted)", fontSize: T.bodyL }}>Comece com um único e-mail suspeito.</p>
          <div className="mt-12 flex justify-center"><Link href="/nova-analise"><CtaButton size="lg">Analisar um e-mail</CtaButton></Link></div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer style={{ background: "var(--bg)", borderTop: "1px solid var(--hair-faint)", color: "var(--muted)" }}>
        <div className="max-w-6xl mx-auto px-8 py-16 grid md:grid-cols-[1.5fr_1fr_1fr] gap-10">
          <div>
            <Wordmark uid="pr-foot" />
            <p className="mt-4 text-xs font-light max-w-xs leading-relaxed" style={{ fontFamily: MONO }}>
              Plataforma defensiva de análise de phishing. Sem recursos ofensivos.
            </p>
          </div>
          <div className="space-y-3 text-sm font-light">
            <div style={{ color: "var(--text)", fontFamily: DISPLAY, fontWeight: 500 }}>Produto</div>
            <a href="#recursos" className="block hover:text-white transition-colors">Recursos</a>
            <a href="#fluxo" className="block hover:text-white transition-colors">Processo</a>
            <a href="#casos" className="block hover:text-white transition-colors">Aplicações</a>
          </div>
          <div className="space-y-3 text-sm font-light">
            <div style={{ color: "var(--text)", fontFamily: DISPLAY, fontWeight: 500 }}>Acesso</div>
            <Link href="/login" className="block hover:text-white transition-colors">Entrar</Link>
            <Link href="/nova-analise" className="block hover:text-white transition-colors">Nova análise</Link>
          </div>
        </div>
        <div className="border-t px-8 py-6 text-center text-xs font-light" style={{ borderColor: "var(--hair-faint)", fontFamily: MONO }}>
          © 2026 Hookshade — portfólio de segurança da informação
        </div>
      </footer>
    </div>
  );
}
