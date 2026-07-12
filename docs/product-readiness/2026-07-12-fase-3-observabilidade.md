# Fase 3 / Bloco 5 — Observabilidade mínima

**Data:** 2026-07-12
**Baseline:** `bb14724` (main) — árvore limpa, sincronizada
**Escopo:** saber que a produção quebrou **antes** do usuário contar. Nenhuma mudança de negócio.

> **Por que este bloco vem antes da purga:** não se agenda um job que apaga dados sem ter
> como saber que ele falhou. Purga não tem rollback.

---

## 1. Estado atual (verificado)

| Verificação | Resultado |
|---|---|
| `pytest` | 221 passed |
| `alembic current` / `heads` | `f08dcac4679c`, head único |
| typecheck / lint / build | OK |
| Integração de observabilidade existente | **nenhuma** |

**O que já temos e é bom:** logging estruturado JSON no stdout, com política de
**allowlist** (`app/request_logging.py`): só campos explicitamente listados entram no log.
Corpo, headers e query string **nunca** são logados. `redact()` mascara chaves sensíveis
recursivamente. A exceção loga **só o tipo**, nunca a mensagem (que pode ecoar conteúdo).

**O problema:** esse log vive no stdout do Render. **Ninguém o coleta, ninguém o olha, e ele
some.** Se a produção cair às 3h da manhã, não há alerta nenhum. Hoje, o monitoramento da
Hookshade é você abrir o site e ver se carrega.

### Achado da inspeção: o `request_id` não atravessa a fronteira

- O backend **gera** um `request_id` novo a cada requisição (`uuid4().hex[:12]`), devolve em
  `X-Request-ID` e o inclui em toda linha de log. ✅
- O proxy do Next **repassa** `x-request-id` nos dois sentidos. ✅
- **Mas o backend IGNORA um `X-Request-ID` que chegue na requisição** — ele sempre gera um
  novo. ❌

Consequência: o frontend **não consegue originar** um identificador. A correlação só
funciona de trás para frente (o browser lê o id da resposta). Para o Bloco 6 do plano
("frontend gera ou preserva X-Request-ID") isso precisa mudar.

**Correção proposta (pequena, testável):** o backend passa a **honrar** um `X-Request-ID`
recebido, **desde que** ele case com um formato estrito (hex, ≤ 32 chars). A validação de
formato não é decoração: sem ela, um cliente poderia injetar conteúdo arbitrário no log
(log injection) ou reusar o id de outra pessoa para poluir a trilha.

---

## 2. Ferramentas — comparação

| Necessidade | Opção | Free tier | Veredito |
|---|---|---|---|
| Erros (back + front) | **Sentry** | 5k erros/mês, 1 usuário, 30 dias de retenção | **Escolhido.** Uma plataforma cobre os dois lados, tem SDK oficial para FastAPI e Next, e sanitização configurável |
| | Logs nativos Render/Vercel | grátis | Insuficiente sozinho: **não alertam**, não agregam, e o Render descarta log antigo |
| Uptime | **UptimeRobot** | 50 monitores, checagem a cada 5 min, alerta por e-mail | **Escolhido.** Simples, gratuito, alerta de verdade |
| | Better Stack | 10 monitores, 3 min | Equivalente; sem vantagem que justifique |
| | Uptime do próprio Sentry | cota limitada no free | Evita 2ª plataforma, mas a cota compete com a de erros |

**Duas plataformas, não mais.** Sentry para erro, UptimeRobot para disponibilidade. Os logs
do Render e da Vercel continuam como fonte operacional de apoio.

**Custo: US$ 0.** Nenhum plano pago.

---

## 3. Arquitetura

```
Browser ──erro JS──► /monitoring (MESMA ORIGEM) ──► Sentry
   │                     ↑ tunnelRoute do @sentry/nextjs
   │
   └─ X-Request-ID lido da resposta ──┐
                                      │ correlaciona
Render (FastAPI) ──erro──► Sentry ────┘
   │
   └─ log JSON (stdout) ─► Render logs

UptimeRobot ──5 min──► https://hookshade.vercel.app
            ──5 min──► https://hookshade-api.onrender.com/health
```

### A CSP **não muda**

O `@sentry/nextjs` suporta `tunnelRoute`: o browser envia o evento para **a nossa própria
origem** (`/monitoring`), e o servidor do Next repassa ao Sentry. Resultado: `connect-src
'self'` continua intacto, nenhum domínio novo entra na CSP, e o modelo same-origin fica
preservado. É a opção certa aqui — e de quebra sobrevive a ad-blocker.

O SDK vem do npm (bundle próprio), então **`script-src` também não muda**: nada de CDN,
nada de `unsafe-eval`.

---

## 4. Dados

### Permitidos
`request_id` · rota (path) · método · status · latência · `user_id` (**inteiro interno**, nunca
e-mail) · nome da exceção e stack trace do **nosso** código · ambiente (`production`) ·
release (SHA do commit).

### 🔴 Proibidos — bloqueados na origem, não "por configuração padrão"
`raw_content` e qualquer corpo de e-mail · corpo de requisição · form data · multipart ·
arquivos · headers completos · `Cookie` · `Authorization` · token CSRF · JWT · senha ·
`DATABASE_URL` · `SECRET_KEY` · `ENCRYPTION_KEY` · e-mail de usuário · IP (opcional, ver abaixo).

**Como é garantido:**
- **Backend:** `send_default_pii=False` (não anexa headers/cookies/IP) + `max_request_body_size="never"` (nunca envia corpo) + um hook `before_send` que **varre o evento e remove** qualquer chave sensível remanescente. O hook é a rede de segurança: não confiamos só no default do SDK.
- **Frontend:** Replay de sessão **desligado** (não instalado). Sem captura de formulário, sem gravação de digitação. Breadcrumbs de `console` e de input desligados.
- **Testes** que provam a sanitização, e que **falham** se alguém reintroduzir PII.

---

## 5. Variáveis

| Variável | Onde | Secreta? | Observação |
|---|---|---|---|
| `SENTRY_DSN` | **Render** | tratar como secreta | DSN do projeto backend |
| `HOOKSHADE_RELEASE` | Render | não | SHA do commit implantado |
| `NEXT_PUBLIC_SENTRY_DSN` | **Vercel** | **não** — vai para o bundle **por desenho** | DSN do frontend. Um DSN só **permite enviar** evento; **não** lê dados nem administra o projeto. Documentado como não-credencial |
| `SENTRY_ENVIRONMENT` | ambos | não | `production` |

**Nada disso vai para o GitHub Actions.** O CI continua sem segredo.

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| PII/segredo vazar para o Sentry | `before_send` que apaga; `send_default_pii=False`; corpo nunca enviado; **testes que falham** se regredir |
| Sentry fora do ar derruba a app | SDK é fire-and-forget; **teste** prova que a app responde com o Sentry inacessível |
| DSN público ser abusado | DSN só **escreve** evento. Abuso = ruído e consumo de cota, não vazamento. Rate limit do próprio Sentry |
| Tunnel `/monitoring` virar relay aberto | O handler do SDK valida o DSN de destino; só fala com o nosso projeto |
| Estourar 5k erros/mês | Um loop de erro consome a cota. `sample_rate` e alerta de cota |
| **Monitorar a cada 5 min mantém o Render acordado** | **Decisão consciente — ver abaixo** |
| Alerta demais → ninguém olha | Severidades definidas; só CRÍTICO notifica de imediato |

### ⚠️ A decisão do cold start

O free tier do Render **dorme após 15 min**. Um monitor de uptime a cada 5 minutos **nunca
deixa ele dormir**.

- **Efeito bom:** acaba o cold start de ~50s. O app fica instantâneo para quem acessa.
- **Efeito a considerar:** o serviço passa a rodar 24/7 (~730 h/mês). O free tier do Render dá
  **750 h/mês** — cabe, mas com pouca folga, e é uma instância só.
- **Alternativa:** checar a cada 15–30 min, deixar dormir, conviver com o cold start.

**Isto é escolha do usuário, não minha.** Está na lista de decisões abaixo.

---

## 7. Rollback

| O que | Como desfazer |
|---|---|
| Sentry backend | remover `SENTRY_DSN` do Render → o SDK não inicializa, a app segue igual |
| Sentry frontend | remover `NEXT_PUBLIC_SENTRY_DSN` da Vercel → idem |
| Código | `git revert` do commit; nenhuma mudança de schema |
| Monitores | apagar no UptimeRobot |

O desligamento é por **variável de ambiente**, sem redeploy de código. Isso é proposital.

---

## 8. Critérios de aceite

- [ ] Erro sintético do backend chega ao Sentry **com `request_id`** e **sem** cookie, token, corpo ou `raw_content`
- [ ] Erro do frontend chega **sem** dado de sessão
- [ ] App continua funcionando com o Sentry inacessível (testado)
- [ ] Session replay e captura de formulário **desligados** (testado)
- [ ] `connect-src 'self'` intacto; **zero violação de CSP**
- [ ] Nenhuma URL interna do backend no bundle
- [ ] Uptime do frontend e do `/health`; indisponibilidade **gera alerta**
- [ ] `request_id` correlaciona browser → proxy → backend
- [ ] CI verde; smoke 37/37; produção funcional

---

## 9. Fora de escopo

Purga, backup, cron destrutivo, MFA, refresh token, dashboard, relatórios, métricas de
negócio, tracing distribuído, log centralizado pago.
