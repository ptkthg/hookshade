"use client";

/* Exploração TIPOGRÁFICA sobre a direção Premium.
   A mesma composição premium renderizada em 4 pareamentos de fontes,
   com switcher. Todas as fontes são Google Fonts (legíveis em web/dashboard).
   Temporário — remover após a escolha. */

import { useState } from "react";
import Link from "next/link";
import { NegativeHook, Icons, FEATURES, MOCK } from "../_shared";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  "family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&" +
  "family=Inter:wght@300;400;500;600&" +
  "family=JetBrains+Mono:wght@400;500&" +
  "family=Geist:wght@300;400;500;600&" +
  "family=Geist+Mono:wght@400;500&" +
  "family=IBM+Plex+Sans:wght@300;400;500;600&" +
  "family=IBM+Plex+Mono:wght@400;500&" +
  "family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&" +
  "family=Space+Mono:wght@400;700&display=swap";

const FB = ", ui-sans-serif, system-ui, sans-serif";
const FBM = ", ui-monospace, SFMono-Regular, monospace";

type Dir = {
  key: string; label: string; note: string; vibe: string;
  display: string; text: string; mono: string; dispWeight: number; tracking: string;
};
const DIRS: Dir[] = [
  { key: "elegante", label: "1 · Elegante", note: "Fraunces · Inter · JetBrains Mono", vibe: "Editorial, sofisticada, premium",
    display: `'Fraunces'${FB}`, text: `'Inter'${FB}`, mono: `'JetBrains Mono'${FBM}`, dispWeight: 400, tracking: "-0.01em" },
  { key: "tech", label: "2 · Tecnológica", note: "Geist · Geist Mono", vibe: "Moderna, precisa, SaaS de produto",
    display: `'Geist'${FB}`, text: `'Geist'${FB}`, mono: `'Geist Mono'${FBM}`, dispWeight: 400, tracking: "-0.025em" },
  { key: "corp", label: "3 · Corporativa", note: "IBM Plex Sans · IBM Plex Mono", vibe: "Neutra, confiável, institucional",
    display: `'IBM Plex Sans'${FB}`, text: `'IBM Plex Sans'${FB}`, mono: `'IBM Plex Mono'${FBM}`, dispWeight: 400, tracking: "-0.02em" },
  { key: "ousada", label: "4 · Ousada", note: "Bricolage Grotesque · Inter · Space Mono", vibe: "Marcante, contemporânea, memorável",
    display: `'Bricolage Grotesque'${FB}`, text: `'Inter'${FB}`, mono: `'Space Mono'${FBM}`, dispWeight: 600, tracking: "-0.02em" },
];

const C = {
  bg: "#04060c", raise: "#070a12", panel: "#0a0e18", panelTop: "#0e1420",
  hair: "#ffffff12", hairFaint: "#ffffff08", accent: "#9b8cff",
  text: "#f2f4fa", muted: "#9aa3b6", faint: "#5a6478",
};
const DEPTH = "inset 0 1px 0 #ffffff10, 0 2px 4px #00000066, 0 30px 60px -18px #000000cc";
const sev = MOCK.severity === "alto" ? "#e8776b" : "#d7ad55";

export default function FontsPreview() {
  const [i, setI] = useState(0);
  const d = DIRS[i];
  const f0 = FEATURES[0];
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: d.text }}>
      <link rel="stylesheet" href={FONTS_URL} />

      {/* Switcher de direção tipográfica */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full px-1.5 py-1.5 backdrop-blur"
        style={{ background: "#0a0e18e0", border: `1px solid ${C.hair}`, fontFamily: `'JetBrains Mono'${FBM}` }}>
        {DIRS.map((x, k) => (
          <button key={x.key} onClick={() => setI(k)} className="rounded-full px-3 py-1 text-xs transition-colors"
            style={{ background: k === i ? C.accent : "transparent", color: k === i ? "#fff" : C.muted }}>
            {x.label}
          </button>
        ))}
        <Link href="/preview/premium" className="rounded-full px-2.5 py-1 text-xs" style={{ color: C.muted, opacity: 0.6 }}>premium ↗</Link>
      </div>

      {/* legenda da direção atual */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full px-4 py-2 text-xs backdrop-blur text-center"
        style={{ background: "#0a0e18e0", border: `1px solid ${C.hair}`, fontFamily: `'JetBrains Mono'${FBM}`, color: C.muted }}>
        <span style={{ color: C.accent }}>{d.note}</span> · {d.vibe}
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: "#04060cd9", borderBottom: `1px solid ${C.hairFaint}` }}>
        <nav className="max-w-6xl mx-auto flex items-center justify-between px-8 h-20">
          <div className="flex items-center gap-2.5">
            <NegativeHook c={C.accent} size={26} uid="ft-nav" />
            <span className="lowercase" style={{ fontFamily: d.display, fontWeight: 500, letterSpacing: "0.02em", fontSize: 18 }}>hookshade</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm" style={{ color: C.muted, fontFamily: d.text }}>
            <a href="#">Recursos</a><a href="#">Processo</a><a href="#">Aplicações</a>
          </div>
          <button className="rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: C.accent, fontFamily: d.text }}>Analisar e-mail</button>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(48% 40% at 25% 20%, ${C.accent}14, transparent 70%)` }} />
        <div className="relative max-w-5xl mx-auto px-8 pt-32 pb-24">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em]" style={{ color: C.faint, fontFamily: d.mono }}>
            <span className="h-px w-8" style={{ background: C.accent, opacity: 0.6 }} />plataforma de triagem de phishing · para SOC e blue team
          </div>
          <h1 className="mt-9 leading-[1.0]" style={{ fontFamily: d.display, fontWeight: d.dispWeight, fontSize: 72, letterSpacing: d.tracking }}>
            Todo e-mail suspeito,<br />com um <span style={{ color: C.accent }}>veredito que se explica</span>.
          </h1>
          <p className="mt-8 max-w-[46ch] leading-relaxed" style={{ color: C.muted, fontSize: 19, fontWeight: 300 }}>
            Cole um e-mail bruto e receba indicadores, autenticação do remetente e um score auditável — ponto a ponto, sem caixa-preta.
          </p>
          <div className="mt-11 flex items-center gap-8">
            <button className="rounded-full px-8 py-4 text-sm font-medium text-white" style={{ background: C.accent, boxShadow: `0 8px 24px -8px ${C.accent}99, inset 0 1px 0 #ffffff33`, fontFamily: d.text }}>
              Analisar um e-mail →
            </button>
            <a href="#" className="text-sm" style={{ color: C.text, fontFamily: d.text }}>Ver demonstração →</a>
          </div>
        </div>
      </section>

      {/* CARD + subtítulo/apoio */}
      <section style={{ background: C.raise }}>
        <div className="max-w-6xl mx-auto px-8 py-24 grid md:grid-cols-[1fr_1fr] gap-12 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.4em]" style={{ color: C.faint, fontFamily: d.mono }}>recursos</div>
            <h2 className="mt-5" style={{ fontFamily: d.display, fontWeight: d.dispWeight, fontSize: 40, letterSpacing: d.tracking }}>Tudo que a triagem exige</h2>
            <p className="mt-4 leading-relaxed" style={{ color: C.muted, fontSize: 16, fontWeight: 300 }}>
              Da submissão à recomendação, com a evidência sempre à vista do analista.
            </p>
          </div>
          <div className="rounded-2xl p-8" style={{ background: C.panel, boxShadow: DEPTH, border: `1px solid ${C.hairFaint}` }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.panelTop, border: `1px solid ${C.hair}`, boxShadow: "inset 0 1px 0 #ffffff10" }}>
              {Icons[f0.icon]({ c: C.accent, size: 20, sw: 1.5 })}
            </div>
            <h3 className="mt-6" style={{ fontFamily: d.display, fontWeight: 500, fontSize: 21 }}>{f0.title}</h3>
            <p className="mt-3 leading-relaxed" style={{ color: C.muted, fontSize: 14, fontWeight: 300 }}>{f0.desc}</p>
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="max-w-4xl mx-auto px-8 py-24">
        <div className="rounded-2xl p-10" style={{ background: C.panel, border: `1px solid ${C.hair}`, boxShadow: DEPTH }}>
          <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: C.hairFaint }}>
            <span className="text-xs" style={{ color: C.faint, fontFamily: d.mono }}>resultado #1042</span>
            <span className="text-xs" style={{ color: C.faint, fontFamily: d.mono }}>concluído · {MOCK.confidence} confiança</span>
          </div>
          <div className="grid md:grid-cols-[1fr_auto] gap-12 items-center pt-8">
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-widest" style={{ color: C.faint }}>remetente</div>
                <div className="mt-1" style={{ fontFamily: d.mono, color: C.text, fontSize: 15 }}>{MOCK.sender}</div>
              </div>
              {MOCK.findings.slice(0, 3).map((f) => (
                <div key={f.title} className="flex items-center justify-between">
                  <span style={{ fontSize: 14, fontWeight: 300 }}>{f.title}</span>
                  <span className="text-xs" style={{ color: C.faint, fontFamily: d.mono }}>+{f.w}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-2 border-t" style={{ borderColor: C.hairFaint }}>
                {MOCK.iocs.slice(0, 2).map((x) => <span key={x} className="pt-2 text-xs" style={{ color: C.accent, fontFamily: d.mono }}>{x}</span>)}
              </div>
            </div>
            <div className="flex flex-col items-center md:pl-12 md:border-l" style={{ borderColor: C.hairFaint }}>
              <div className="leading-none" style={{ color: C.text, fontFamily: d.mono, fontWeight: 300, fontSize: 88 }}>{MOCK.score}</div>
              <div className="mt-3 h-px w-16" style={{ background: sev }} />
              <div className="mt-3 text-sm uppercase tracking-[0.3em]" style={{ color: sev }}>{MOCK.severity}</div>
            </div>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer style={{ background: C.raise, borderTop: `1px solid ${C.hairFaint}`, color: C.muted }}>
        <div className="max-w-6xl mx-auto px-8 py-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NegativeHook c={C.accent} size={22} uid="ft-foot" />
            <span className="lowercase" style={{ fontFamily: d.display, fontWeight: 500, fontSize: 15 }}>hookshade</span>
          </div>
          <span className="text-xs" style={{ fontFamily: d.mono }}>© 2026 — portfólio de segurança da informação</span>
        </div>
      </footer>
    </div>
  );
}
