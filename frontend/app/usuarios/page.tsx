"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  changeUserRole, changeUserStatus, createUser, getMe, listUsers, resetUserPassword,
} from "@/lib/api";
import type { AdminUser } from "@/lib/types";

const ROLES = ["analyst", "viewer", "admin"];
const input = "rounded bg-[var(--panel)] border border-white/10 px-2 py-1.5 text-sm outline-none";

export default function UsuariosPage() {
  const [me, setMe] = useState<{ id: number; role: string } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "analyst" });

  const refresh = useCallback(() => {
    listUsers().then(setUsers).catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    getMe()
      .then((u) => {
        setMe({ id: u.id, role: u.role });
        if (u.role === "admin") refresh();
      })
      .catch(() => {});
  }, [refresh]);

  if (!me) return <AppShell><main className="max-w-5xl mx-auto p-6" /></AppShell>;
  if (me.role !== "admin") {
    return (
      <AppShell>
        <main className="max-w-5xl mx-auto p-6">
          <p className="text-sm text-[var(--muted)]">Esta área exige perfil administrador.</p>
        </main>
      </AppShell>
    );
  }

  const act = (p: Promise<unknown>, ok: string) => {
    setError(""); setNotice("");
    p.then(() => { setNotice(ok); refresh(); })
      .catch((e) => setError((e as Error).message));
  };

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    act(createUser(form).then(() => setForm({ name: "", email: "", password: "", role: "analyst" })),
        "Usuário criado. A senha inicial deve ser trocada pelo próprio usuário.");
  };

  const onResetPassword = (u: AdminUser) => {
    const password = window.prompt(`Nova senha temporária para ${u.email} (mínimo 10 caracteres):`);
    if (!password) return;
    act(resetUserPassword(u.id, password),
        "Senha redefinida. Compartilhe por canal seguro; ela não será exibida novamente.");
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl">Usuários</h1>
          <span className="text-xs text-[var(--muted)]">administração mínima — toda mutação é auditada</span>
        </div>

        {error && <p className="text-sm text-[#f87171]">{error}</p>}
        {notice && <p className="text-sm text-[#34d399]">{notice}</p>}

        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 p-4">
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Nome
            <input className={input} required value={form.name} aria-label="Nome do novo usuário"
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">E-mail
            <input className={input} required type="email" value={form.email} aria-label="E-mail do novo usuário"
                   onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Senha inicial (mín. 10)
            <input className={input} required type="password" minLength={10} value={form.password}
                   aria-label="Senha inicial" autoComplete="new-password"
                   onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">Papel
            <select className={input} value={form.role} aria-label="Papel do novo usuário"
                    onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit"
                  className="rounded bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white">
            Criar usuário
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-[var(--muted)] text-left">
              <tr>
                <th className="py-2">Nome</th><th>E-mail</th><th>Papel</th>
                <th>Status</th><th>Último login</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-2">{u.name}</td>
                  <td className="text-[var(--muted)]">{u.email}</td>
                  <td>
                    <select className={input} value={u.role} aria-label={`Papel de ${u.email}`}
                            onChange={(e) => act(changeUserRole(u.id, e.target.value), "Papel alterado.")}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className="text-xs border rounded px-2 py-0.5"
                          style={{ color: u.status === "active" ? "#34d399" : "#8aa0b8",
                                   borderColor: u.status === "active" ? "#34d399" : "#8aa0b8" }}>
                      {u.status}
                    </span>
                  </td>
                  <td className="text-[var(--muted)]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "—"}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <button className="text-xs text-[var(--accent)] hover:underline"
                            onClick={() => act(changeUserStatus(u.id, u.status === "active" ? "inactive" : "active"),
                                               u.status === "active" ? "Usuário desativado." : "Usuário reativado.")}>
                      {u.status === "active" ? "Desativar" : "Reativar"}
                    </button>
                    <button className="text-xs text-[var(--accent)] hover:underline"
                            onClick={() => onResetPassword(u)}>
                      Redefinir senha
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !error && (
                <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">Nenhum usuário.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
