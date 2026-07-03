"use client";
import { useState } from "react";

/* Botão de cópia reutilizável, discreto e acessível.
   Feedback "copiado" por ~1.5s. Sempre copia o valor recebido tal como exibido
   (defanged) — nunca re-fanga IOCs (security-first). */

const CopyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function CopyButton({
  value, label, srLabel, iconOnly = false,
}: { value: string; label?: string; srLabel: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
    } catch {
      /* clipboard indisponível — silencioso; feedback ainda sinaliza tentativa */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? "Copiado" : srLabel}
      aria-label={copied ? "Copiado" : srLabel}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors
                 hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 shrink-0"
      style={{ color: copied ? "#34d399" : "#7c8aa0" }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {!iconOnly && <span aria-live="polite">{copied ? "copiado" : label ?? "copiar"}</span>}
    </button>
  );
}
