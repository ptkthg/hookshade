/* Copy institucional da landing (promovido de app/preview/_shared.tsx).
   MOCK é uma vitrine ILUSTRATIVA da landing — não representa dado real de análise. */
import type { IconName } from "@/components/brand";

export const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: "headers", title: "Parsing de cabeçalhos", desc: "Extrai remetente, rota Received e Authentication-Results de qualquer .eml ou texto colado." },
  { icon: "ioc", title: "Extração de IOCs", desc: "URLs, domínios, e-mails e hashes de anexos, sempre defanged para manipulação segura." },
  { icon: "auth", title: "Autenticação de e-mail", desc: "Leitura de SPF, DKIM e DMARC com o peso de cada falha refletido no veredito." },
  { icon: "score", title: "Índice explicável", desc: "Índice heurístico advisory e auditável, com a evidência por trás de cada ponto atribuído." },
  { icon: "action", title: "Motor de regras editável", desc: "O analista escreve regras declarativas de detecção: versionadas, auditadas e sem executar código." },
  { icon: "history", title: "Histórico e auditoria", desc: "Cada análise e cada mudança de regra ficam registradas e prontas para consulta." },
];

export const BENEFITS = [
  { k: "Triagem em segundos", v: "Um veredito consistente para a fila de e-mails reportados, sem análise manual repetitiva." },
  { k: "Veredito auditável", v: "Cada ponto do índice tem origem rastreável, sem caixa-preta na decisão." },
  { k: "Seguro por padrão", v: "Anexos nunca são executados (só hash e metadados); URLs sempre exibidas defanged." },
  { k: "Feito para analistas", v: "Linguagem de SOC do L1 ao threat hunter, com IOCs prontos para pivotar." },
];

export const STEPS = [
  { n: "01", t: "Submeter", d: "Cole o e-mail bruto ou envie o arquivo .eml suspeito." },
  { n: "02", t: "Analisar", d: "Parser, IOCs, autenticação e regras rodam em uma passada síncrona." },
  { n: "03", t: "Pontuar", d: "Índice explicável classifica em baixo, médio, alto ou crítico." },
  { n: "04", t: "Agir", d: "Recomendações priorizadas guiam a resposta do analista." },
];

export const USE_CASES = [
  { t: "SOC / Triagem L1", d: "Reduza a fila de e-mails reportados com um veredito rápido e consistente." },
  { t: "Threat Hunting", d: "IOCs defanged prontos para pivotar em SIEM e EDR sem risco de clique." },
  { t: "Security Awareness", d: "Mostre ao usuário por que o e-mail é malicioso, com evidência concreta." },
  { t: "MSSP / Consultoria", d: "Relatórios auditáveis de triagem para entregar ao cliente com confiança." },
];

export const DIFERENCIAIS = [
  { t: "Explicável por padrão", d: "Cada ponto do índice aponta a evidência que o gerou. Nenhum veredito opaco." },
  { t: "Determinístico e auditável", d: "O mesmo e-mail sempre gera o mesmo resultado: reproduzível e defensável." },
  { t: "Privado por construção", d: "Heurísticas locais; o e-mail não é enviado a serviços de terceiros." },
  { t: "Defensivo, sem exceção", d: "Anexos nunca executados, URLs sempre defanged. Zero superfície ofensiva." },
];

/* Vitrine ilustrativa do produto (landing) — dado fictício de demonstração. */
export const MOCK = {
  sender: "security@paypa1.com",
  score: 53,
  severity: "alto",
  confidence: "média",
  findings: [
    { sev: "alto", title: "Domínio lookalike de marca (paypa1.com)", w: 11 },
    { sev: "médio", title: "Encurtador de URL (bit.ly)", w: 11 },
    { sev: "médio", title: "Urgência / pressão temporal", w: 7 },
    { sev: "médio", title: "SPF none · DKIM none · DMARC none", w: 18 },
  ],
  iocs: ["hxxp://bit[.]ly/verify-now", "paypa1[.]com", "security@paypa1[.]com"],
} as const;
