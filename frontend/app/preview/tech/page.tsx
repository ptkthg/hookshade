"use client";

/* Variação 2 — Tecnológica & Futurista. Dark-first, grid sutil, mono labels,
   cantos de mira (callback do motivo de análise), um único accent com glow contido. */

import {
  NegativeHook, Wordmark, VariationSwitcher, Icons, MONO, DISPLAY,
  FEATURES, BENEFITS, STEPS, USE_CASES, MOCK,
} from "../_shared";

const C = {
  bg: "#06090f", panel: "#0a0f19", panel2: "#0c121f", hair: "#ffffff12", hairBright: "#8a7bff33",
  text: "#e8edf5", muted: "#7d8ba0", faint: "#4a566a", accent: "#8a7bff",
};
const grid = {
  backgroundImage: `linear-gradient(${C.hair} 1px, transparent 1px), linear-gradient(90deg, ${C.hair} 1px, transparent 1px)`,
  backgroundSize: "48px 48px",
};
const sevColor = (s: string) => (s === "alto" || s === "crítico" ? "#ff6b5e" : s === "médio" ? "#e6b23a" : "#4ac48a");

/* card com cantos de mira */
function Ticks({ c }: { c: string }) {
  const s = "absolute w-3 h-3";
  const b = `1.5px solid ${c}`;
  return (
    <>
      <span className={`${s} top-0 left-0`} style={{ borderTop: b, borderLeft: b }} />
      <span className={`${s} top-0 right-0`} style={{ borderTop: b, borderRight: b }} />
      <span className={`${s} bottom-0 left-0`} style={{ borderBottom: b, borderLeft: b }} />
      <span className={`${s} bottom-0 right-0`} style={{ borderBottom: b, borderRight: b }} />
    </>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-[0.3em]" style={{ color: C.accent, fontFamily: MONO }}>{children}</div>;
}

export default function TechLanding() {
  const Icon = (name: keyof typeof Icons) => Icons[name]({ c: C.accent, size: 22 });
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: DISPLAY }}>
      <VariationSwitcher accent={C.accent} bg={C.bg} fg={C.text} hair={C.hair} />

      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: "#06090fcc", borderBottom: `1px solid ${C.hair}` }}>
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <Wordmark c={C.text} mark={<NegativeHook c={C.accent} size={26} uid="tk-nav" />} />
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: C.muted, fontFamily: MONO }}>
            <a href="#recursos">/recursos</a><a href="#fluxo">/fluxo</a><a href="#casos">/casos</a>
          </div>
          <button className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: C.accent, fontFamily: MONO }}>acessar_</button>
        </nav>
      </header>

      {/* 1 · HERO */}
      <section className="relative overflow-hidden" style={grid}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 0%, ${C.accent}1f, transparent 70%)` }} />
        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs" style={{ border: `1px solid ${C.hairBright}`, color: C.accent, fontFamily: MONO }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.accent }} />sistema de triagem defensiva · v0.1
          </span>
          <h1 className="mx-auto mt-7 max-w-3xl text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
            Do e-mail suspeito<br />ao veredito, em uma passada.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: C.muted }}>
            Parsing, IOCs e autenticação combinados em um score determinístico — construído para a velocidade e o rigor de um SOC.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3" style={{ fontFamily: MONO }}>
            <button className="rounded-md px-5 py-3 text-sm font-medium text-white" style={{ background: C.accent }}>iniciar_análise</button>
            <button className="rounded-md px-5 py-3 text-sm" style={{ border: `1px solid ${C.hair}`, color: C.text }}>ver_demo</button>
          </div>
        </div>
      </section>

      {/* 2 · APRESENTAÇÃO */}
      <section className="border-y" style={{ borderColor: C.hair }}>
        <div className="max-w-5xl mx-auto px-6 py-20">
          <Label>// a plataforma</Label>
          <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight max-w-3xl">
            Um console de triagem que pensa como analista.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed" style={{ color: C.muted }}>
            Cabeçalhos separados, indicadores isolados e defanged, autenticação do remetente verificada — cada sinal
            entra no score com peso conhecido. Nada de caixa-preta: você vê exatamente o que elevou o risco.
          </p>
        </div>
      </section>

      {/* 3 · CARDS DE FUNCIONALIDADES */}
      <section id="recursos" className="max-w-6xl mx-auto px-6 py-24">
        <Label>// recursos</Label>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Capacidades de análise</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="group relative p-6 transition-colors" style={{ background: C.panel, border: `1px solid ${C.hair}` }}>
              <Ticks c={C.hairBright} />
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-md" style={{ background: `${C.accent}14`, border: `1px solid ${C.hairBright}` }}>{Icon(f.icon)}</div>
                <span className="text-xs" style={{ color: C.faint, fontFamily: MONO }}>0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · BENEFÍCIOS */}
      <section className="border-y" style={{ borderColor: C.hair, background: C.panel2 }}>
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-x-12 gap-y-8">
          {BENEFITS.map((b) => (
            <div key={b.k} className="flex gap-4">
              <span className="mt-1.5 text-lg" style={{ color: C.accent, fontFamily: MONO }}>▸</span>
              <div>
                <h3 className="text-[15px] font-semibold">{b.k}</h3>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: C.muted }}>{b.v}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · FLUXO */}
      <section id="fluxo" className="max-w-6xl mx-auto px-6 py-24">
        <Label>// pipeline</Label>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Fluxo de funcionamento</h2>
        <div className="mt-12 grid md:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative px-5 py-6" style={{ borderLeft: `1px solid ${C.hair}` }}>
              {i < STEPS.length - 1 && <span className="hidden md:block absolute top-9 -right-1.5 text-xs" style={{ color: C.faint }}>→</span>}
              <div className="text-2xl font-semibold" style={{ color: C.accent, fontFamily: MONO }}>{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 · DASHBOARD PREVIEW */}
      <section className="relative" style={grid}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <Label>// output</Label>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Veredito em tempo real</h2>
          <div className="mt-10 relative rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.hairBright}`, boxShadow: `0 0 60px -15px ${C.accent}40` }}>
            <div className="flex items-center gap-2 px-4 h-9 border-b" style={{ borderColor: C.hair, fontFamily: MONO }}>
              <span className="w-2 h-2 rounded-full" style={{ background: C.accent }} />
              <span className="text-xs" style={{ color: C.muted }}>hookshade@soc:~$ analyze --id 1042</span>
            </div>
            <div className="grid md:grid-cols-[1fr_260px] gap-0">
              <div className="p-6 space-y-2.5 border-r" style={{ borderColor: C.hair }}>
                <div className="text-sm" style={{ color: C.muted, fontFamily: MONO }}>&gt; de <span style={{ color: C.text }}>{MOCK.sender}</span></div>
                <div className="text-sm" style={{ color: C.muted, fontFamily: MONO }}>&gt; assunto <span style={{ color: C.text }}>"{MOCK.subject}"</span></div>
                <div className="pt-2 space-y-2">
                  {MOCK.findings.map((f) => (
                    <div key={f.title} className="flex items-center justify-between rounded px-3 py-2" style={{ background: C.panel2, borderLeft: `2px solid ${sevColor(f.sev)}` }}>
                      <span className="text-sm">{f.title}</span>
                      <span className="text-xs" style={{ color: sevColor(f.sev), fontFamily: MONO }}>+{f.w}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {MOCK.iocs.map((i) => <span key={i} className="rounded px-2 py-1 text-xs" style={{ background: `${C.accent}14`, color: C.accent, fontFamily: MONO }}>{i}</span>)}
                </div>
              </div>
              <div className="p-6 flex flex-col items-center justify-center" style={{ background: C.panel2 }}>
                <div className="relative flex items-center justify-center">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke={C.hair} strokeWidth="8" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke={sevColor(MOCK.severity)} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - MOCK.score / 100)}`} transform="rotate(-90 60 60)" />
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-3xl font-semibold" style={{ color: sevColor(MOCK.severity), fontFamily: MONO }}>{MOCK.score}</div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: C.muted }}>risco</div>
                  </div>
                </div>
                <div className="mt-4 rounded px-3 py-1 text-xs font-semibold uppercase" style={{ background: `${sevColor(MOCK.severity)}22`, color: sevColor(MOCK.severity), fontFamily: MONO }}>{MOCK.severity}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · CASOS DE USO */}
      <section id="casos" className="border-y" style={{ borderColor: C.hair }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <Label>// casos de uso</Label>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {USE_CASES.map((u) => (
              <div key={u.t} className="relative p-6" style={{ background: C.panel, border: `1px solid ${C.hair}` }}>
                <div className="h-8 w-8 rounded-md flex items-center justify-center mb-4" style={{ border: `1px solid ${C.hairBright}` }}>
                  <NegativeHook c={C.accent} size={18} uid={`tk-uc-${u.t}`} />
                </div>
                <h3 className="text-[15px] font-semibold">{u.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{u.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 · CTA FINAL */}
      <section className="relative overflow-hidden" style={grid}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(50% 60% at 50% 50%, ${C.accent}1a, transparent 70%)` }} />
        <div className="relative max-w-3xl mx-auto px-6 py-28 text-center">
          <h2 className="text-4xl font-semibold tracking-tight">Coloque o SOC à frente do phishing.</h2>
          <p className="mt-4 text-lg" style={{ color: C.muted }}>Submeta um e-mail e receba o veredito explicável em segundos.</p>
          <button className="mt-8 rounded-md px-6 py-3.5 text-sm font-medium text-white" style={{ background: C.accent, fontFamily: MONO }}>iniciar_análise</button>
        </div>
      </section>

      {/* 9 · RODAPÉ */}
      <footer style={{ background: C.panel, borderTop: `1px solid ${C.hair}`, color: C.muted }}>
        <div className="max-w-6xl mx-auto px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Wordmark c={C.text} mark={<NegativeHook c={C.accent} size={24} uid="tk-foot" />} />
            <p className="mt-3 text-xs" style={{ fontFamily: MONO }}>// plataforma defensiva · sem recursos ofensivos</p>
          </div>
          <div className="flex gap-8 text-sm" style={{ fontFamily: MONO }}>
            <a href="#recursos">/recursos</a><a href="#fluxo">/fluxo</a><a href="#casos">/casos</a>
          </div>
        </div>
        <div className="border-t px-6 py-5 text-center text-xs" style={{ borderColor: C.hair, fontFamily: MONO }}>© 2026 hookshade — portfólio de segurança da informação</div>
      </footer>
    </div>
  );
}
