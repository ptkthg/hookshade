"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const token = await login(email, password);
      setToken(token);
      router.push("/nova-analise");
    } catch (err) {
      setError((err as Error).message || "Falha no login");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={onSubmit}
        className="w-80 p-6 rounded-lg space-y-4"
        style={{ background: "var(--panel)" }}
      >
        <h1 className="text-xl font-bold" style={{ color: "var(--accent)" }}>Hookshade</h1>
        <input
          className="w-full p-2 rounded bg-black/30 border border-white/10"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full p-2 rounded bg-black/30 border border-white/10"
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          className="w-full p-2 rounded font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
