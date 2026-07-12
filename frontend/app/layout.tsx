import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Hookshade | triagem de phishing explicável",
  description: "Plataforma defensiva de análise de phishing para SOC/Blue Team. Veredito auditável, sem caixa-preta.",
};

/* Renderização dinâmica é PRÉ-REQUISITO da CSP com nonce.
 *
 * Um nonce precisa ser novo a cada resposta — e não há como injetá-lo num HTML gerado uma
 * única vez no build. Com pré-render estático, os <script> do Next saem sem nonce, a CSP
 * bloqueia todos, e a aplicação simplesmente não roda (o formulário de login vira um
 * submit HTML puro). Foi exatamente o que aconteceu ao validar o build de produção.
 *
 * Custo real aqui: nenhum. Toda a UI busca dados no cliente, então o pré-render não
 * economizava trabalho nenhum — só gerava a casca HTML. A alternativa seria abrir
 * 'unsafe-inline' em script-src, que é justamente o que estamos fechando. */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
