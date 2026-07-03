"use client";

/**
 * Conteúdo e primitivos compartilhados pelas 3 variações de landing (preview).
 * Pasta _shared não vira rota (private folder do App Router).
 * Copy real do produto (triagem defensiva de phishing p/ SOC/Blue Team).
 * Remover /preview após a escolha da direção visual.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

/* ============ Logo — Negative Hook (conceito escolhido) ============ */
export function NegativeHook({ c, size = 44, uid = "nh" }: { c: string; size?: number; uid?: string }) {
  const m = `mask-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-label="Hookshade">
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

export function Wordmark({ c, mark, size = 28 }: { c: string; mark: React.ReactNode; size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {mark}
      <span
        className="tracking-[0.28em] lowercase"
        style={{ fontFamily: MONO, color: c, fontSize: size * 0.5 }}
      >
        hookshade
      </span>
    </div>
  );
}

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
export const DISPLAY = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

/* ============ Ícones minimalistas monoline (mesma linha da logo) ============ */
type IconProps = { c: string; size?: number; sw?: number };
const svg = (children: React.ReactNode, { c, size = 24, sw = 1.75 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
export const Icons = {
  headers: (p: IconProps) => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 13h6" /></>, p),
  ioc: (p: IconProps) => svg(<><path d="M12 2a5 5 0 0 0-5 5v3M12 22a5 5 0 0 1-5-5" /><path d="M12 6a1 1 0 0 0-1 1v10M15 8v6a3 3 0 0 1-6 0" /></>, p),
  auth: (p: IconProps) => svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="m3 8 9 6 9-6" /><circle cx="18" cy="7" r="3" fill="none" /></>, p),
  score: (p: IconProps) => svg(<><path d="M4 15a8 8 0 0 1 16 0" /><path d="m12 15 4-4" /><circle cx="12" cy="15" r="1" /></>, p),
  action: (p: IconProps) => svg(<><path d="M4 6h11M4 12h7M4 18h11" /><path d="m16 15 3 3 3-5" /></>, p),
  history: (p: IconProps) => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 8v4l3 2" /></>, p),
};

/* ============ Conteúdo (copy real do produto) ============ */
export const FEATURES = [
  { icon: "headers", title: "Parsing de cabeçalhos", desc: "Extrai remetente, rota Received e Authentication-Results de qualquer .eml ou texto colado." },
  { icon: "ioc", title: "Extração de IOCs", desc: "URLs, domínios, e-mails e hashes de anexos — sempre defanged para manipulação segura." },
  { icon: "auth", title: "Autenticação de e-mail", desc: "Leitura de SPF, DKIM e DMARC com o peso de cada falha refletido no veredito." },
  { icon: "score", title: "Score explicável", desc: "Pontuação determinística e auditável, com a evidência por trás de cada ponto atribuído." },
  { icon: "action", title: "Recomendações de resposta", desc: "Ações priorizadas para o analista: bloquear domínio, caçar retroativamente, revisar autenticação." },
  { icon: "history", title: "Histórico e relatórios", desc: "Cada análise fica registrada e pronta para consulta, correlação e exportação futura." },
] as const;

export const BENEFITS = [
  { k: "Triagem em segundos", v: "Um veredito consistente para a fila de e-mails reportados, sem análise manual repetitiva." },
  { k: "Veredito auditável", v: "Cada ponto do score tem origem rastreável — nada de caixa-preta na decisão." },
  { k: "Seguro por padrão", v: "Anexos nunca são executados (só hash e metadados); URLs sempre exibidas defanged." },
  { k: "Feito para analistas", v: "Linguagem de SOC do L1 ao threat hunter, com IOCs prontos para pivotar." },
] as const;

export const STEPS = [
  { n: "01", t: "Submeter", d: "Cole o e-mail bruto ou envie o arquivo .eml suspeito." },
  { n: "02", t: "Analisar", d: "Parser, IOCs e autenticação rodam em uma passada síncrona." },
  { n: "03", t: "Pontuar", d: "Score explicável classifica em baixo, médio, alto ou crítico." },
  { n: "04", t: "Agir", d: "Recomendações priorizadas guiam a resposta do analista." },
] as const;

export const USE_CASES = [
  { t: "SOC / Triagem L1", d: "Reduza a fila de e-mails reportados com um veredito rápido e consistente." },
  { t: "Threat Hunting", d: "IOCs defanged prontos para pivotar em SIEM e EDR sem risco de clique." },
  { t: "Security Awareness", d: "Mostre ao usuário por que o e-mail é malicioso, com evidência concreta." },
  { t: "MSSP / Consultoria", d: "Relatórios auditáveis de triagem para entregar ao cliente com confiança." },
] as const;

export const MOCK = {
  sender: "security@paypa1.com",
  domain: "paypa1.com",
  subject: "Verifique sua conta agora",
  score: 53,
  severity: "alto",
  confidence: "média",
  findings: [
    { cat: "url", sev: "alto", title: "Domínio lookalike de marca (paypa1.com)", w: 11 },
    { cat: "url", sev: "médio", title: "Encurtador de URL (bit.ly)", w: 11 },
    { cat: "content", sev: "médio", title: "Urgência / pressão temporal", w: 7 },
    { cat: "auth", sev: "médio", title: "SPF none · DKIM none · DMARC none", w: 18 },
  ],
  iocs: ["hxxp://bit[.]ly/verify-now", "paypa1[.]com", "security@paypa1[.]com"],
} as const;

/* ============ Switcher fixo entre as variações ============ */
const VARIANTS = [
  { href: "/preview/clean", label: "Clean" },
  { href: "/preview/tech", label: "Tech" },
  { href: "/preview/premium", label: "Premium" },
];
export function VariationSwitcher({ accent, bg, fg, hair }: { accent: string; bg: string; fg: string; hair: string }) {
  const path = usePathname();
  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full px-1.5 py-1.5 backdrop-blur"
      style={{ background: `${bg}d9`, border: `1px solid ${hair}`, fontFamily: MONO }}
    >
      {VARIANTS.map((v) => {
        const active = path === v.href;
        return (
          <Link
            key={v.href}
            href={v.href}
            className="rounded-full px-3 py-1 text-xs transition-colors"
            style={{ background: active ? accent : "transparent", color: active ? "#fff" : fg }}
          >
            {v.label}
          </Link>
        );
      })}
      <Link href="/preview" className="rounded-full px-2.5 py-1 text-xs" style={{ color: fg, opacity: 0.6 }}>
        logo ↗
      </Link>
    </div>
  );
}
