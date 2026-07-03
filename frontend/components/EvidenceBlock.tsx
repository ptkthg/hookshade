"use client";
import { CopyButton } from "./CopyButton";

/* Evidência de um finding, com cópia individual do trecho/indicador. */
export function EvidenceBlock({
  evidence, highlight = false, srLabel,
}: { evidence: string; highlight?: boolean; srLabel: string }) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <span className="text-[10px] uppercase tracking-wide text-slate-500 mt-1.5 shrink-0">evidência</span>
      <code
        className="text-xs font-mono px-2 py-1 rounded break-all flex-1"
        style={{
          background: highlight ? "rgba(124,92,255,0.12)" : "rgba(0,0,0,0.3)",
          color: highlight ? "var(--accent)" : "#cbd5e1",
        }}
      >
        {evidence}
      </code>
      <CopyButton value={evidence} srLabel={srLabel} iconOnly />
    </div>
  );
}
