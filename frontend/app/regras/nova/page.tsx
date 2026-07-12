"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createRule, getMe } from "@/lib/api";
import type { RuleInput } from "@/lib/types";
import { AppShell } from "@/components/AppShell";
import { RuleForm } from "@/components/RuleForm";

export default function NovaRegraPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    getMe().then((u) => setAllowed(u.role === "admin")).catch(() => setAllowed(false));
  }, []);

  async function submit(input: RuleInput) {
    const rule = await createRule(input);
    router.push(`/regras/${rule.id}`);
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="font-display text-2xl">Nova regra</h1>
        {allowed === false && (
          <p className="text-sm text-[#f87171]">
            Sem permissão: criar regras exige perfil administrador.
          </p>
        )}
        {allowed && (
          <>
            <p className="text-xs text-[var(--muted)]">
              A regra nasce <strong>inativa</strong>. Teste-a contra uma análise e só então ative.
            </p>
            <RuleForm onSubmit={submit} submitLabel="Criar regra" />
          </>
        )}
      </main>
    </AppShell>
  );
}
