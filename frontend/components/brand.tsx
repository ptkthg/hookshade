/* Primitivos de marca do Hookshade (promovidos de app/preview/_shared.tsx). */

export function NegativeHook({ c = "var(--accent)", size = 44, uid = "nh" }: { c?: string; size?: number; uid?: string }) {
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

export function Wordmark({ c = "var(--text)", size = 28, uid = "wm" }: { c?: string; size?: number; uid?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <NegativeHook c="var(--accent)" size={size * 0.93} uid={uid} />
      <span
        className="tracking-[0.28em] lowercase font-mono-token"
        style={{ color: c, fontSize: size * 0.5 }}
      >
        hookshade
      </span>
    </div>
  );
}

/* Ícones monoline (mesma linha da logo) */
type IconProps = { c?: string; size?: number; sw?: number };
const svg = (children: React.ReactNode, { c = "var(--accent)", size = 24, sw = 1.75 }: IconProps) => (
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
} as const;

export type IconName = keyof typeof Icons;
