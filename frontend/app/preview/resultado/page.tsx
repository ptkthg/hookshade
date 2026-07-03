"use client";
/* Preview da tela de Resultado com dados-mock (inclui discrepância de URL).
   Temporário — verificação visual sem precisar de backend/login. */
import type { AnalysisDetail } from "@/lib/types";
import { ResultView } from "@/components/ResultView";

const MOCK: AnalysisDetail = {
  id: 1042,
  source_type: "eml",
  severity: "alto",
  risk_score: 62,
  confidence: "high",
  created_at: "2026-07-01T00:00:00Z",
  summary:
    'E-mail de micros0ft-support.com — severidade alto. Principais evidências: URL exibida difere da real; ' +
    "Domínio lookalike de marca; DMARC fail. (Índice heurístico advisory: 62/100 — não é veredito definitivo.)",
  parsed_headers: {
    From: "Microsoft 365 Security <security@micros0ft-support.com>",
    "Reply-To": "recovery@mail.ru",
    Subject: "URGENT: Your password will expire in 24 hours - verify now",
  },
  iocs: [
    { type: "domain", value_defanged: "micros0ft-support[.]com", value_hash: "…" },
    { type: "url", value_defanged: "hxxp://evil-login[.]ru/steal", value_hash: "…" },
    { type: "email", value_defanged: "security@micros0ft-support[.]com", value_hash: "…" },
  ],
  findings: [
    {
      category: "url", severity: "alto", title: "URL exibida difere da real", weight_contribution: 12,
      description: "O texto do link aparenta um domínio, mas o href aponta para outro (mascaramento de link).",
      rule_id: "url.display_href_mismatch", evidence: 'texto exibe "secure.microsoft.com" mas aponta para "evil-login.ru"',
    },
    {
      category: "url", severity: "alto", title: "Domínio lookalike de marca (micros0ft-support.com)", weight_contribution: 10,
      description: "Domínio do remetente lembra a marca 'microsoft' mas não é o domínio oficial.",
      rule_id: "url.brand_lookalike", evidence: "micros0ft-support.com ~ microsoft",
    },
    {
      category: "auth", severity: "alto", title: "DMARC fail", weight_contribution: 8,
      description: "DMARC = fail lido do header Authentication-Results (carimbo do MTA receptor); não revalidado via DNS.",
      rule_id: "auth.dmarc_fail", evidence: "dmarc=fail",
    },
    {
      category: "auth", severity: "alto", title: "Desalinhamento de domínio (Reply-To)", weight_contribution: 6,
      description: "Domínio do From (micros0ft-support.com) difere de Reply-To (mail.ru).",
      rule_id: "auth.misalignment.reply_to", evidence: "From=micros0ft-support.com / Reply-To=mail.ru",
    },
    {
      category: "content", severity: "médio", title: "Urgência / pressão temporal", weight_contribution: 7,
      description: "Sinal de engenharia social detectado no assunto/corpo.",
      rule_id: "content.urgência", evidence: 'termo: "urgent"',
    },
  ],
  recommendations: [
    { priority: "high", action_type: "block_domain", description: "Bloquear domínio remetente no gateway de e-mail." },
    { priority: "high", action_type: "threat_hunt", description: "Caça retroativa por assunto, remetente e URLs relacionadas." },
    { priority: "medium", action_type: "block_urls", description: "Bloquear/inspecionar URLs suspeitas em ambiente isolado." },
  ],
};

export default function ResultadoPreview() {
  return <div style={{ minHeight: "100vh", background: "var(--bg)" }}><ResultView a={MOCK} /></div>;
}
