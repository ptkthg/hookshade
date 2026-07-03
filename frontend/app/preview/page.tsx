"use client";

import { useState } from "react";

/**
 * Preview temporário: exploração de LOGO — 3 conceitos distintos de símbolo
 * na mesma direção minimalista, com lockup, teste de tamanho e toggle claro/escuro.
 * Rota pública sem auth. Remover após a escolha.
 */

type Mode = "dark" | "light";
type Tok = { bg: string; panel: string; hair: string; text: string; muted: string; faint: string; accent: string };
const TOK: Record<Mode, Tok> = {
  dark: { bg: "#06090f", panel: "#0a0f19", hair: "#ffffff16", text: "#e8edf5", muted: "#7d8ba0", faint: "#4a566a", accent: "#8a7bff" },
  light: { bg: "#ffffff", panel: "#f5f7fb", hair: "#0b17331a", text: "#0c1424", muted: "#5b6b82", faint: "#9aa7ba", accent: "#5b45e0" },
};
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/* ============ Conceito 1 — "Aperture" (premium, monoline, lente/hook) ============ */
function Aperture({ c, size = 44 }: { c: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" stroke={c} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M30.5 11 A13 13 0 1 0 33.5 19.5" />
      <path d="M33.5 19.5 L27.6 18 M33.5 19.5 L32 13.6" />
      <circle cx="22" cy="22" r="1.9" fill={c} stroke="none" />
    </svg>
  );
}

/* ============ Conceito 2 — "Reticle" (tech/preciso, mira + camadas) ============ */
function Reticle({ c, size = 44 }: { c: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14 V9 a1 1 0 0 1 1 -1 H14" />
      <path d="M36 14 V9 a1 1 0 0 0 -1 -1 H30" />
      <path d="M8 30 V35 a1 1 0 0 0 1 1 H14" />
      <path d="M36 30 V35 a1 1 0 0 1 -1 1 H30" />
      <path d="M15 26 L22 20 L29 26" />
      <path d="M15 21 L22 15 L29 21" opacity={0.45} />
    </svg>
  );
}

/* ============ Conceito 3 — "Negative Hook" (conceitual, espaço negativo) ============ */
function NegativeHook({ c, size = 44, uid = "nh" }: { c: string; size?: number; uid?: string }) {
  const m = `mask-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44">
      <defs>
        <mask id={m}>
          <rect width="44" height="44" fill="white" />
          <path d="M29 13 H21 a8 8 0 0 0 -8 8 v6" fill="none" stroke="black" strokeWidth="5.2" strokeLinecap="round" />
          <circle cx="29" cy="13" r="3.1" fill="black" />
        </mask>
      </defs>
      <rect x="7" y="7" width="30" height="30" rx="10" fill={c} mask={`url(#${m})`} />
    </svg>
  );
}

/* ---------------- lockup + teste de tamanho ---------------- */
function Lockup({ t, mark }: { t: Tok; mark: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      {mark}
      <span className="text-lg tracking-[0.3em] lowercase" style={{ fontFamily: MONO, color: t.text }}>hookshade</span>
    </div>
  );
}

function ConceptCard({
  t, title, desc, big, sizes,
}: { t: Tok; title: string; desc: string; big: React.ReactNode; sizes: (s: number) => React.ReactNode }) {
  return (
    <div className="rounded-xl p-6 space-y-5" style={{ background: t.panel, border: `1px solid ${t.hair}` }}>
      <div>
        <div className="text-sm font-semibold" style={{ fontFamily: MONO, color: t.text }}>{title}</div>
        <div className="text-xs mt-1" style={{ color: t.muted }}>{desc}</div>
      </div>
      <div className="flex items-center justify-center py-6 rounded-lg" style={{ background: t.bg, border: `1px solid ${t.hair}` }}>
        {big}
      </div>
      <Lockup t={t} mark={sizes(30)} />
      <div className="flex items-end gap-5 pt-1" style={{ color: t.text }}>
        {[16, 24, 32].map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            {sizes(s)}
            <span className="text-[10px]" style={{ color: t.faint, fontFamily: MONO }}>{s}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const [mode, setMode] = useState<Mode>("dark");
  const t = TOK[mode];
  return (
    <div style={{ background: mode === "dark" ? "#02040a" : "#e9edf3", minHeight: "100vh" }}>
      <main className="max-w-5xl mx-auto p-8 space-y-8" style={{ color: t.text }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: MONO }}>Logo — 3 conceitos</h1>
            <p className="text-sm mt-1" style={{ color: t.muted }}>Mesma linha minimalista, três presenças diferentes. Símbolo grande · lockup · teste 16–32px.</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/preview/clean" className="px-3 py-1.5 rounded-md text-sm" style={{ background: t.accent, color: "#fff", fontFamily: MONO }}>
              ver landings →
            </a>
            <button onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${t.hair}`, color: t.text, fontFamily: MONO }}>
              {mode === "dark" ? "☀ claro" : "☾ escuro"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ConceptCard
            t={t}
            title="1 · Aperture"
            desc="Elegante/premium. Monoline em lente/abertura com um hook fino e um ponto central — refinado, muito espaço negativo."
            big={<Aperture c={t.accent} size={96} />}
            sizes={(sz) => <Aperture c={t.accent} size={sz} />}
          />
          <ConceptCard
            t={t}
            title="2 · Reticle"
            desc="Tecnológico/preciso. Mira de análise (cantos) sobre camadas de sinal — evoca segurança, triagem e inteligência."
            big={<Reticle c={t.accent} size={96} />}
            sizes={(sz) => <Reticle c={t.accent} size={sz} />}
          />
          <ConceptCard
            t={t}
            title="3 · Negative Hook"
            desc="Conceitual/memorável. Squircle sólido com um hook recortado em espaço negativo — forma forte, single-color, escala bem."
            big={<NegativeHook c={t.accent} size={96} uid="big3" />}
            sizes={(sz) => <NegativeHook c={t.accent} size={sz} uid={`s3-${sz}`} />}
          />
        </div>

        {/* linha de wordmarks lado a lado para comparar equilíbrio símbolo↔tipografia */}
        <section className="space-y-4 pt-2">
          <div className="text-xs uppercase tracking-[0.25em]" style={{ color: t.faint, fontFamily: MONO }}>lockups lado a lado</div>
          <div className="rounded-xl p-6 space-y-5" style={{ background: t.panel, border: `1px solid ${t.hair}` }}>
            <Lockup t={t} mark={<Aperture c={t.accent} size={28} />} />
            <Lockup t={t} mark={<Reticle c={t.accent} size={28} />} />
            <Lockup t={t} mark={<NegativeHook c={t.accent} size={28} uid="lk3" />} />
          </div>
        </section>
      </main>
    </div>
  );
}
