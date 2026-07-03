"use client";

/* Variação 1 — Clean & Corporativa. Fundo claro dominante, hairlines, muito respiro.
   Seção de produto e rodapé em dark navy (uso claro/escuro estratégico). */

import {
  NegativeHook, Wordmark, VariationSwitcher, Icons, MONO, DISPLAY,
  FEATURES, BENEFITS, STEPS, USE_CASES, MOCK,
} from "../_shared";

const C = {
  bg: "#ffffff", alt: "#f6f8fc", ink: "#0b1220", muted: "#54617a", faint: "#8a97ad",
  hair: "#0b173316", accent: "#5b45e0", accentSoft: "#5b45e014",
  dark: "#070c16", darkPanel: "#0d1424", darkHair: "#ffffff14", darkText: "#e8edf6", darkMuted: "#8695ac",
};
const sevColor = (s: string) => (s === "alto" || s === "crítico" ? "#e0574b" : s === "médio" ? "#d99a2b" : "#3aa675");

export default function CleanLanding() {
  const Icon = (name: keyof typeof Icons) => Icons[name]({ c: C.accent, size: 22 });
  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: DISPLAY }}>
      <VariationSwitcher accent={C.accent} bg={C.bg} fg={C.ink} hair={C.hair} />

      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: "#ffffffcc", borderBottom: `1px solid ${C.hair}` }}>
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <Wordmark c={C.ink} mark={<NegativeHook c={C.accent} size={26} uid="cl-nav" />} />
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: C.muted }}>
            <a href="#recursos">Recursos</a><a href="#fluxo">Como funciona</a><a href="#casos">Casos de uso</a>
          </div>
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: C.accent }}>Entrar</button>
        </nav>
      </header>

      {/* 1 · HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs" style={{ background: C.accentSoft, color: C.accent, fontFamily: MONO }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.accent }} />plataforma defensiva de triagem
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight">
          Triagem de phishing<br />que o seu SOC entende.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg" style={{ color: C.muted }}>
          Submeta um e-mail suspeito e receba IOCs, autenticação e um score explicável — auditável do primeiro ao último ponto.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <button className="rounded-lg px-5 py-3 text-sm font-medium text-white" style={{ background: C.accent }}>Analisar um e-mail</button>
          <button className="rounded-lg px-5 py-3 text-sm font-medium" style={{ border: `1px solid ${C.hair}`, color: C.ink }}>Ver demonstração</button>
        </div>
        <p className="mt-6 text-xs" style={{ color: C.faint, fontFamily: MONO }}>anexos nunca executados · urls sempre defanged · score determinístico</p>
      </section>

      {/* 2 · APRESENTAÇÃO */}
      <section className="border-y" style={{ background: C.alt, borderColor: C.hair }}>
        <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: C.accent, fontFamily: MONO }}>a plataforma</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">O fluxo de um analista, num só lugar.</h2>
          </div>
          <p className="text-[15px] leading-relaxed" style={{ color: C.muted }}>
            O Hookshade reproduz o raciocínio de quem investiga e-mails suspeitos: separa cabeçalhos, isola indicadores,
            checa a autenticação do remetente e traduz tudo num veredito que qualquer analista consegue defender.
            Sem recursos ofensivos, sem caixa-preta — só triagem confiável e explicável.
          </p>
        </div>
      </section>

      {/* 3 · CARDS DE FUNCIONALIDADES */}
      <section id="recursos" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Tudo que a triagem exige</h2>
          <p className="mt-3" style={{ color: C.muted }}>Seis capacidades que cobrem o e-mail suspeito da submissão à recomendação.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl p-6 transition-shadow hover:shadow-lg" style={{ background: C.bg, border: `1px solid ${C.hair}`, boxShadow: "0 1px 2px #0b17330a" }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.accentSoft }}>{Icon(f.icon)}</div>
              <h3 className="mt-5 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4 · BENEFÍCIOS */}
      <section className="border-y" style={{ background: C.alt, borderColor: C.hair }}>
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-4 gap-8">
          {BENEFITS.map((b, i) => (
            <div key={b.k}>
              <div className="text-2xl font-semibold" style={{ color: C.accent, fontFamily: MONO }}>{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-3 text-[15px] font-semibold">{b.k}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{b.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 · FLUXO */}
      <section id="fluxo" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-semibold tracking-tight text-center">Como funciona</h2>
        <div className="mt-14 grid md:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-sm font-medium" style={{ color: C.accent, fontFamily: MONO }}>{s.n}</div>
              <div className="mt-3 h-px w-full" style={{ background: C.hair }} />
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 · DASHBOARD PREVIEW (dark) */}
      <section style={{ background: C.dark, color: C.darkText }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.25em]" style={{ color: C.accent, fontFamily: MONO }}>preview do produto</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">O veredito, com a evidência à vista.</h2>
          </div>
          <div className="mt-12 mx-auto max-w-4xl rounded-2xl overflow-hidden" style={{ background: C.darkPanel, border: `1px solid ${C.darkHair}`, boxShadow: "0 30px 80px -20px #00000080" }}>
            <div className="flex items-center gap-2 px-4 h-10 border-b" style={{ borderColor: C.darkHair }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              <span className="ml-3 text-xs" style={{ color: C.darkMuted, fontFamily: MONO }}>hookshade · resultado #1042</span>
            </div>
            <div className="grid md:grid-cols-[220px_1fr] gap-6 p-6">
              <div className="rounded-xl p-5 flex flex-col items-center justify-center" style={{ background: "#ffffff08", border: `1px solid ${C.darkHair}` }}>
                <div className="text-5xl font-semibold" style={{ color: sevColor(MOCK.severity), fontFamily: MONO }}>{MOCK.score}</div>
                <div className="mt-1 text-xs uppercase tracking-widest" style={{ color: C.darkMuted }}>risco</div>
                <div className="mt-4 rounded-full px-3 py-1 text-xs font-semibold uppercase" style={{ background: `${sevColor(MOCK.severity)}22`, color: sevColor(MOCK.severity) }}>{MOCK.severity}</div>
                <div className="mt-3 text-[11px]" style={{ color: C.darkMuted, fontFamily: MONO }}>confiança {MOCK.confidence}</div>
              </div>
              <div className="space-y-3">
                <div className="text-sm" style={{ color: C.darkMuted, fontFamily: MONO }}>de <span style={{ color: C.darkText }}>{MOCK.sender}</span> — {MOCK.subject}</div>
                {MOCK.findings.map((f) => (
                  <div key={f.title} className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "#ffffff06", border: `1px solid ${C.darkHair}` }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor(f.sev) }} />
                      <span className="text-sm">{f.title}</span>
                    </div>
                    <span className="text-xs" style={{ color: C.darkMuted, fontFamily: MONO }}>+{f.w}</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 pt-1">
                  {MOCK.iocs.map((i) => (
                    <span key={i} className="rounded px-2 py-1 text-xs" style={{ background: "#ffffff08", color: C.accent, fontFamily: MONO }}>{i}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 · CASOS DE USO */}
      <section id="casos" className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-semibold tracking-tight">Onde o Hookshade encaixa</h2>
        <div className="mt-12 grid sm:grid-cols-2 gap-5">
          {USE_CASES.map((u) => (
            <div key={u.t} className="rounded-2xl p-7 flex items-start gap-4" style={{ background: C.alt, border: `1px solid ${C.hair}` }}>
              <div className="mt-1 h-8 w-1 rounded-full" style={{ background: C.accent }} />
              <div>
                <h3 className="text-[15px] font-semibold">{u.t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{u.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8 · CTA FINAL */}
      <section className="border-t" style={{ borderColor: C.hair }}>
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-4xl font-semibold tracking-tight">Comece a triar em segundos.</h2>
          <p className="mt-4 text-lg" style={{ color: C.muted }}>Cole um e-mail suspeito e veja o veredito explicável do Hookshade.</p>
          <button className="mt-8 rounded-lg px-6 py-3.5 text-sm font-medium text-white" style={{ background: C.accent }}>Analisar um e-mail</button>
        </div>
      </section>

      {/* 9 · RODAPÉ (dark) */}
      <footer style={{ background: C.dark, color: C.darkMuted }}>
        <div className="max-w-6xl mx-auto px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <Wordmark c={C.darkText} mark={<NegativeHook c={C.accent} size={24} uid="cl-foot" />} />
            <p className="mt-3 text-xs max-w-xs" style={{ fontFamily: MONO }}>plataforma defensiva de análise de phishing · sem recursos ofensivos</p>
          </div>
          <div className="flex gap-10 text-sm">
            <div className="space-y-2"><div style={{ color: C.darkText }}>Produto</div><div>Recursos</div><div>Como funciona</div></div>
            <div className="space-y-2"><div style={{ color: C.darkText }}>Recursos</div><div>Documentação</div><div>Segurança</div></div>
          </div>
        </div>
        <div className="border-t px-6 py-5 text-center text-xs" style={{ borderColor: C.darkHair, fontFamily: MONO }}>© 2026 Hookshade — portfólio de segurança da informação</div>
      </footer>
    </div>
  );
}
