"use client";
import { useId } from "react";

const SEV_COLOR: Record<string, string> = {
  "baixo": "var(--sev-baixo)",
  "médio": "var(--sev-medio)",
  "alto": "var(--sev-alto)",
  "crítico": "var(--sev-critico)",
};

/** Score circular colorido pela severidade real (portado do Hookshade Lab).
 *  Mantém o enquadramento honesto do produto: é um índice advisory, não veredito
 *  — por isso o rótulo interno diz "índice /100", não "risk score". */
export function ScoreDial({
  score,
  severity,
  size = 150,
  strokeWidth = 11,
}: {
  score: number;
  severity: string;
  size?: number;
  strokeWidth?: number;
}) {
  const gradId = useId();
  const s = Math.max(0, Math.min(100, score));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = (s / 100) * c;
  const color = SEV_COLOR[severity] ?? "#8aa0b8";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Índice heurístico ${s} de 100, severidade ${severity}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#ffffff14"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-4xl font-medium tabular-nums" style={{ color: "var(--text)" }}>
          {s}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>
          índice /100
        </div>
      </div>
    </div>
  );
}
