"use client";
import type { IOC } from "@/lib/types";
import { CopyButton } from "./CopyButton";

/* Lista de IOCs (sempre defanged) agrupada por tipo, com cópia por item.
   "Copiar todos" fica no cabeçalho do card (ResultView) — ver iocBlock(). */

const TYPE_ORDER = ["url", "domain", "ip", "email", "hash"] as const;
const TYPE_LABEL: Record<string, string> = {
  url: "URLs", domain: "Domínios", ip: "IPs", email: "E-mails", hash: "Hashes",
};

/** Bloco textual "tipo: valor" (um por linha) para cópia em massa — preserva contexto. */
export function iocBlock(iocs: IOC[]): string {
  return iocs.map((i) => `${i.type}: ${i.value_defanged}`).join("\n");
}

export function IOCList({ iocs }: { iocs: IOC[] }) {
  if (iocs.length === 0) return <p className="text-sm text-slate-500">Nenhum IOC extraído.</p>;

  const known = new Set<string>(TYPE_ORDER);
  const groups: [string, IOC[]][] = TYPE_ORDER
    .map((t) => [t, iocs.filter((i) => i.type === t)] as [string, IOC[]])
    .filter(([, l]) => l.length > 0);
  const others = iocs.filter((i) => !known.has(i.type));
  if (others.length) groups.push(["outros", others]);

  return (
    <div className="space-y-3">
      {groups.map(([type, list]) => (
        <div key={type}>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            {TYPE_LABEL[type] ?? type} · {list.length}
          </div>
          <ul className="space-y-0.5">
            {list.map((i, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-mono text-slate-300 break-all">{i.value_defanged}</span>
                <CopyButton value={i.value_defanged} srLabel={`Copiar ${i.type}: ${i.value_defanged}`} iconOnly />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
