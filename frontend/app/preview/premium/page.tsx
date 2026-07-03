"use client";

/* ============================================================================
   Variação 3 — PREMIUM (evoluída) · Tipografia ELEGANTE (escolhida):
     Títulos → Fraunces (serif optical, sofisticada)
     Texto   → Inter (legível, neutra)
     Dados   → JetBrains Mono (score, IOCs, labels) — sinal técnico/segurança
   Princípios: Refactoring UI (type scale, weight+contrast, depth, fewer borders,
   accent borders, decorate bg) + Don't Make Me Think (auto-evidência, scanning,
   Big Bang, omit needless words, clique óbvio).
   ============================================================================ */

import {
  NegativeHook, Wordmark, VariationSwitcher, Icons, MONO,
  FEATURES, BENEFITS, STEPS, USE_CASES, MOCK,
} from "../_shared";

/* Tipografia Elegante — Fraunces (display) + Inter (texto). JetBrains Mono vem do globals. */
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Inter:wght@300;400;500;600&display=swap";
const DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const TEXT = "'Inter', ui-sans-serif, system-ui, sans-serif";

/* Cores navy-tinted (RUI: "greys don't have to be grey") */
const C = {
  bg: "#04060c", raise: "#070a12", panel: "#0a0e18", panelTop: "#0e1420",
  hair: "#ffffff12", hairFaint: "#ffffff08", accent: "#9b8cff", accentDim: "#9b8cff26",
  text: "#f2f4fa", muted: "#9aa3b6", faint: "#5a6478",
};

/* Type scale (RUI: "establish a type scale") */
const T = { label: 12, small: 14, body: 16, bodyL: 19, h3: 21, h2: 40, cta: 54, hero: 72 };

/* Two-part shadow + luz de cima (RUI: "creating depth / emulate a light source") */
const DEPTH = "inset 0 1px 0 #ffffff10, 0 2px 4px #00000066, 0 30px 60px -18px #000000cc";

const sevColor = (s: string) => (s === "alto" || s === "crítico" ? "#e8776b" : s === "médio" ? "#d7ad55" : "#63c69c");

/* Diferenciais — posicionamento (o que separa o Hookshade), distinto de "benefícios" */
const DIFERENCIAIS = [
  { t: "Explicável por padrão", d: "Cada ponto do score aponta a evidência que o gerou — nada de veredito opaco." },
  { t: "Determinístico e auditável", d: "O mesmo e-mail sempre gera o mesmo resultado: reproduzível e defensável." },
  { t: "Privado por construção", d: "Heurísticas locais; o e-mail não é enviado a serviços de terceiros." },
  { t: "Defensivo, sem exceção", d: "Anexos nunca executados, URLs sempre defanged. Zero superfície ofensiva." },
] as const;
const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="group relative text-sm font-light transition-colors duration-200"
      style={{ color: C.muted, fontFamily: TEXT }} onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
      onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
      {children}
      <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: C.accent }} />
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em]" style={{ color: C.faint, fontFamily: MONO, fontSize: T.label }}>
      <span className="h-px w-8" style={{ background: C.accent, opacity: 0.6 }} />{children}
    </div>
  );
}

function CTA({ children, size = "md" }: { children: React.ReactNode; size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-8 py-4" : "px-7 py-3.5";
  return (
    <button className={`group rounded-full ${pad} text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5`}
      style={{ background: C.accent, fontFamily: TEXT, boxShadow: `0 8px 24px -8px ${C.accent}99, inset 0 1px 0 #ffffff33` }}>
      <span className="inline-flex items-center gap-2">{children}
        <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
      </span>
    </button>
  );
}

export default function PremiumLanding() {
  const Icon = (name: keyof typeof Icons) => Icons[name]({ c: C.accent, size: 20, sw: 1.5 });
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: TEXT }}>
      <link rel="stylesheet" href={FONTS_URL} />
      <VariationSwitcher accent={C.accent} bg={C.bg} fg={C.text} hair={C.hair} />

      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-md" style={{ background: "#04060cd9", borderBottom: `1px solid ${C.hairFaint}` }}>
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-8 h-20">
          <Wordmark c={C.text} mark={<NegativeHook c={C.accent} size={26} uid="pr-nav" />} />
          <div className="hidden md:flex items-center gap-10">
            <NavLink href="#recursos">Recursos</NavLink>
            <NavLink href="#fluxo">Processo</NavLink>
            <NavLink href="#casos">Aplicações</NavLink>
          </div>
          <div className="flex items-center gap-6">
            <NavLink href="#">Entrar</NavLink>
            <button className="rounded-full px-5 py-2 text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: C.accent, fontFamily: TEXT, boxShadow: `0 6px 18px -8px ${C.accent}aa, inset 0 1px 0 #ffffff33` }}>
              Analisar e-mail
            </button>
          </div>
        </nav>
      </header>

      {/* 1 · HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(48% 40% at 25% 20%, ${C.accent}14, transparent 70%)` }} />
        <div className="relative max-w-5xl mx-auto px-8 pt-40 pb-32">
          <Eyebrow>plataforma de triagem de phishing · para SOC e blue team</Eyebrow>
          <h1 className="mt-9 leading-[1.02] tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.hero, letterSpacing: "-0.01em" }}>
            Todo e-mail suspeito,<br />com um <span style={{ color: C.accent, fontWeight: 400 }}>veredito que se explica</span>.
          </h1>
          <p className="mt-8 max-w-[46ch] font-light leading-relaxed" style={{ color: C.muted, fontSize: T.bodyL }}>
            Cole um e-mail bruto e receba indicadores, autenticação do remetente e um score auditável —
            ponto a ponto, sem caixa-preta.
          </p>
          <div className="mt-11 flex items-center gap-8">
            <CTA size="lg">Analisar um e-mail</CTA>
            <a href="#" className="group text-sm font-light inline-flex items-center gap-2" style={{ color: C.text }}>
              Ver demonstração
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </a>
          </div>
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs" style={{ color: C.faint, fontFamily: MONO }}>
            {["anexos nunca executados", "urls sempre defanged", "score determinístico", "SPF · DKIM · DMARC"].map((s, i) => (
              <span key={s} className="flex items-center gap-8">{i > 0 && <span style={{ opacity: 0.4 }}>·</span>}{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 2 · APRESENTAÇÃO */}
      <section style={{ background: C.raise }}>
        <div className="max-w-5xl mx-auto px-8 py-28">
          <Eyebrow>a plataforma</Eyebrow>
          <p className="mt-10 max-w-4xl leading-[1.35] tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.h2 }}>
            <span style={{ color: C.muted }}>Reproduzimos o raciocínio de um investigador —</span> separando cabeçalhos,
            isolando indicadores e verificando a autenticação <span style={{ color: C.muted }}>para entregar</span> um
            veredito <span style={{ color: C.accent, fontWeight: 400 }}>sem caixa-preta</span>.
          </p>
        </div>
      </section>

      {/* 3 · CARDS */}
      <section id="recursos" className="max-w-6xl mx-auto px-8 py-32">
        <div className="max-w-2xl">
          <Eyebrow>recursos</Eyebrow>
          <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Tudo que a triagem exige</h2>
          <p className="mt-4 font-light" style={{ color: C.muted, fontSize: T.body }}>Seis capacidades, da submissão à recomendação.</p>
        </div>
        <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title}
              className="group rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{ background: C.panel, boxShadow: DEPTH, border: `1px solid ${C.hairFaint}` }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: C.panelTop, border: `1px solid ${C.hair}`, boxShadow: "inset 0 1px 0 #ffffff10" }}>
                {Icon(f.icon)}
              </div>
              <h3 className="mt-6" style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: T.h3 }}>{f.title}</h3>
              <p className="mt-3 font-light leading-relaxed" style={{ color: C.muted, fontSize: T.small }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · BENEFÍCIOS */}
      <section style={{ background: C.raise }}>
        <div className="max-w-6xl mx-auto px-8 py-32 grid md:grid-cols-2 gap-x-16 gap-y-14">
          {BENEFITS.map((b, i) => (
            <div key={b.k} className="pl-6" style={{ borderLeft: `2px solid ${i === 0 ? C.accent : C.hair}` }}>
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-light" style={{ color: C.accent, fontFamily: MONO }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{b.k}</h3>
              </div>
              <p className="mt-3 font-light leading-relaxed" style={{ color: C.muted, fontSize: T.small }}>{b.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · FLUXO */}
      <section id="fluxo" className="max-w-5xl mx-auto px-8 py-32">
        <Eyebrow>processo</Eyebrow>
        <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Quatro passos, uma passada.</h2>
        <div className="mt-16 relative">
          <div className="absolute left-[1.15rem] top-2 bottom-2 w-px hidden md:block" style={{ background: `linear-gradient(${C.accent}55, ${C.hairFaint})` }} />
          <div className="space-y-10">
            {STEPS.map((s) => (
              <div key={s.n} className="flex items-baseline gap-8">
                <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-light shrink-0"
                  style={{ color: C.accent, background: C.bg, border: `1px solid ${C.hair}`, fontFamily: MONO }}>{s.n}</span>
                <h3 className="w-44 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{s.t}</h3>
                <p className="font-light leading-relaxed flex-1" style={{ color: C.muted, fontSize: T.small }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · DASHBOARD PREVIEW */}
      <section className="relative" style={{ background: C.raise }}>
        <div className="max-w-6xl mx-auto px-8 pt-32 pb-40">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex justify-center"><Eyebrow>preview do produto</Eyebrow></div>
            <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>O veredito, com a evidência à vista.</h2>
          </div>
          <div className="mt-16 mx-auto max-w-4xl rounded-2xl p-10 -mb-24 relative z-10"
            style={{ background: C.panel, border: `1px solid ${C.hair}`, boxShadow: DEPTH }}>
            <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: C.hairFaint }}>
              <div className="text-xs" style={{ color: C.faint, fontFamily: MONO }}>resultado #1042</div>
              <div className="text-xs" style={{ color: C.faint, fontFamily: MONO }}>concluído · {MOCK.confidence} confiança</div>
            </div>
            <div className="grid md:grid-cols-[1fr_auto] gap-12 items-center pt-8">
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-widest" style={{ color: C.faint }}>remetente</div>
                  <div className="mt-1 font-light" style={{ fontFamily: MONO, color: C.text, fontSize: T.body }}>{MOCK.sender}</div>
                </div>
                <div className="space-y-3 pt-1">
                  {MOCK.findings.map((f) => (
                    <div key={f.title} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor(f.sev), boxShadow: `0 0 8px ${sevColor(f.sev)}88` }} />
                        <span className="font-light" style={{ fontSize: T.small }}>{f.title}</span>
                      </div>
                      <span className="text-xs font-light" style={{ color: C.faint, fontFamily: MONO }}>+{f.w}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t" style={{ borderColor: C.hairFaint }}>
                  <span className="pt-2 text-xs uppercase tracking-widest" style={{ color: C.faint }}>iocs</span>
                  {MOCK.iocs.map((i) => <span key={i} className="pt-2 text-xs font-light" style={{ color: C.accent, fontFamily: MONO }}>{i}</span>)}
                </div>
              </div>
              <div className="flex flex-col items-center md:pl-12 md:border-l" style={{ borderColor: C.hairFaint }}>
                <div className="font-extralight leading-none" style={{ color: C.text, fontFamily: MONO, fontSize: 88 }}>{MOCK.score}</div>
                <div className="mt-3 h-px w-16" style={{ background: sevColor(MOCK.severity) }} />
                <div className="mt-3 text-sm font-light uppercase tracking-[0.3em]" style={{ color: sevColor(MOCK.severity) }}>{MOCK.severity}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · CASOS DE USO */}
      <section id="casos" className="max-w-6xl mx-auto px-8 pt-40 pb-32">
        <Eyebrow>aplicações</Eyebrow>
        <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>Onde o Hookshade encaixa</h2>
        <div className="mt-16 grid md:grid-cols-2 gap-4">
          {USE_CASES.map((u) => (
            <div key={u.t} className="group flex items-start gap-5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1"
              style={{ background: C.panel, boxShadow: DEPTH, border: `1px solid ${C.hairFaint}` }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: C.panelTop, border: `1px solid ${C.hair}`, boxShadow: "inset 0 1px 0 #ffffff10" }}>
                <NegativeHook c={C.accent} size={18} uid={`pr-uc-${u.t}`} />
              </div>
              <div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h3 }}>{u.t}</h3>
                <p className="mt-2 font-light leading-relaxed" style={{ color: C.muted, fontSize: T.small }}>{u.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8 · DIFERENCIAIS — grid de células com hairlines (leitura tipo "spec sheet" = autoridade) */}
      <section id="diferenciais" style={{ background: C.raise }}>
        <div className="max-w-6xl mx-auto px-8 py-32">
          <Eyebrow>diferenciais</Eyebrow>
          <h2 className="mt-6 tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 400, fontSize: T.h2 }}>O que separa o Hookshade</h2>
          <div className="mt-14 rounded-2xl overflow-hidden grid sm:grid-cols-2" style={{ background: C.panel, boxShadow: DEPTH, border: `1px solid ${C.hairFaint}` }}>
            {DIFERENCIAIS.map((x, i) => (
              <div key={x.t} className="p-9"
                style={{
                  borderTop: i > 1 ? `1px solid ${C.hairFaint}` : undefined,
                  borderLeft: i % 2 === 1 ? `1px solid ${C.hairFaint}` : undefined,
                }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full shrink-0" style={{ background: C.accentDim }}><Check /></span>
                  <h3 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: T.h3 }}>{x.t}</h3>
                </div>
                <p className="mt-3 font-light leading-relaxed" style={{ color: C.muted, fontSize: T.small }}>{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9 · CHAMADA FINAL */}
      <section className="relative overflow-hidden" style={{ background: C.bg }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(50% 70% at 50% 50%, ${C.accent}14, transparent 70%)` }} />
        <div className="relative max-w-4xl mx-auto px-8 py-40 text-center">
          <h2 className="tracking-tight" style={{ fontFamily: DISPLAY, fontWeight: 300, fontSize: T.cta, letterSpacing: "-0.01em" }}>Triagem que inspira confiança.</h2>
          <p className="mt-6 font-light" style={{ color: C.muted, fontSize: T.bodyL }}>Comece com um único e-mail suspeito.</p>
          <div className="mt-12 flex justify-center"><CTA size="lg">Analisar um e-mail</CTA></div>
        </div>
      </section>

      {/* 10 · RODAPÉ */}
      <footer style={{ background: C.bg, borderTop: `1px solid ${C.hairFaint}`, color: C.muted }}>
        <div className="max-w-6xl mx-auto px-8 py-16 grid md:grid-cols-[1.5fr_1fr_1fr] gap-10">
          <div>
            <Wordmark c={C.text} mark={<NegativeHook c={C.accent} size={24} uid="pr-foot" />} />
            <p className="mt-4 text-xs font-light max-w-xs leading-relaxed" style={{ fontFamily: MONO }}>
              Plataforma defensiva de análise de phishing. Sem recursos ofensivos.
            </p>
          </div>
          <div className="space-y-3 text-sm font-light">
            <div style={{ color: C.text, fontFamily: DISPLAY, fontWeight: 500 }}>Produto</div>
            <NavLink href="#recursos">Recursos</NavLink><br /><NavLink href="#fluxo">Processo</NavLink><br /><NavLink href="#casos">Aplicações</NavLink>
          </div>
          <div className="space-y-3 text-sm font-light">
            <div style={{ color: C.text, fontFamily: DISPLAY, fontWeight: 500 }}>Recursos</div>
            <NavLink href="#">Documentação</NavLink><br /><NavLink href="#">Segurança</NavLink>
          </div>
        </div>
        <div className="border-t px-8 py-6 text-center text-xs font-light" style={{ borderColor: C.hairFaint, fontFamily: MONO }}>
          © 2026 Hookshade — portfólio de segurança da informação
        </div>
      </footer>
    </div>
  );
}
