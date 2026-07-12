# Fase 2 (CI/CD) e Fase 3 (operação) — plano de execução

**Data:** 2026-07-12
**Baseline:** `a27055c` — árvore limpa, sincronizada com o remoto privado
**Escopo:** impedir que código quebrado chegue à produção, e tornar a aplicação
monitorável e recuperável. **Nenhuma funcionalidade nova de produto.**

---

## 1. Arquitetura real (verificada, não presumida)

```
Internet
   ↓ HTTPS
Vercel  — Next.js        https://hookshade.vercel.app   (público)
   ↓ HTTPS (proxy same-origin, server-side)
Render  — FastAPI        https://hookshade-api.onrender.com
   ↓ TLS
Neon    — PostgreSQL     (privado)
```

### Como o deploy acontece HOJE

| Serviço | Gatilho | Consequência |
|---|---|---|
| **Render (backend)** | **auto-deploy a cada push** na branch `feat/vertical-slice-1` | **qualquer commit vai direto para produção, sem nenhum check** |
| **Vercel (frontend)** | **nenhum** — o projeto foi criado via CLI e **não tem integração com o GitHub** | produção só muda quando alguém roda `vercel deploy` |

### 🔴 Risco central desta fase

**O backend em produção está a um `git push` de qualquer regressão.** Não existe CI, não
existe branch protegida, e o Render publica tudo que chega na branch padrão. Os 221 testes
verdes não impedem nada hoje: eles só rodam quando alguém lembra de rodar.

E há um segundo risco, mais sutil: **frontend e backend podem divergir**. O Render publica
sozinho; a Vercel, não. Um push que muda o contrato da API sobe no backend e quebra um
frontend que continua na versão antiga.

---

## 2. Estado do repositório

- **Não existe branch `main`.** A branch padrão no GitHub é `feat/vertical-slice-1`.
- Nenhuma proteção de branch. Force push e deleção são possíveis.
- Nenhum workflow (`.github/` não existe).

**Decisão:** criar `main` a partir de `a27055c`, torná-la a branch padrão e protegê-la.
Trabalho passa a ocorrer em branches de feature → PR → CI verde → merge → deploy.
`feat/vertical-slice-1` deixa de ser a branch de produção.

---

## 3. Ordem de implementação (cada bloco só começa com o anterior verde)

| # | Bloco | Entrega |
|---|---|---|
| **1** | Baseline + este plano | ✅ |
| **2** | CI de backend e frontend | workflows verdes no GitHub |
| **3** | Proteção de deploy | `main` protegida, checks obrigatórios, fluxo de PR documentado |
| **4** | Smoke pós-deploy automatizado | workflow manual, conta de smoke sem privilégio |
| **5** | Observabilidade | uptime + captura de erro + alerta |
| **6** | Purga agendada | cron diário no GitHub Actions |
| **7** | Backup e restore comprovados | dump + restore em banco temporário |
| **8** | Runbooks | documentação operacional |

**Regra:** monitoramento (bloco 5) **antes** de automação destrutiva (blocos 6 e 7). Não se
agenda um job que apaga dados sem ter como saber que ele falhou.

---

## 4. Segredos necessários (GitHub Secrets)

Nenhum é adicionado antes do bloco que o exige.

| Segredo | Bloco | Por que o mínimo privilégio é possível |
|---|---|---|
| `NEON_DATABASE_URL` | 6, 7 | **A purga precisa SÓ disto.** Verificado: `app/tasks/purge.py` instancia `Settings()` sem exigir segredo de produção, e `retention.py` não importa `crypto` — a purga apaga linhas, não decifra nada. Nada de `SECRET_KEY`, `ENCRYPTION_KEY`, senha de usuário ou cookie de sessão vai para o GitHub |
| `SMOKE_PASSWORD` | 4 | senha de uma conta **analyst** dedicada, sem privilégio administrativo. **Nunca o admin principal** |
| `BACKUP_ENCRYPTION_KEY` | 7 | cifra o dump **antes** de sair da máquina do runner |

O CI (blocos 2 e 3) **não usa segredo nenhum** e **não toca em produção**: sobe um Postgres
efêmero como serviço do próprio workflow.

---

## 5. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Push quebrado vai para produção (**ativo hoje**) | Bloco 2 + 3: CI obrigatório e `main` protegida |
| Frontend e backend divergem | Bloco 3: conectar a Vercel ao git, mesma branch do Render |
| CI usa o banco de produção por engano | Postgres efêmero no workflow; `NEON_DATABASE_URL` **não** é exposta aos jobs de CI |
| Purga apaga demais | Idempotente, auditada, `--days` explícito; **execução manual supervisionada** antes de agendar |
| Purga falha em silêncio | Bloco 5 **antes** do 6: falha do job dispara alerta |
| Segredo vaza em log | A app nunca imprime credencial (já testado); workflows não ecoam variável; relatório do smoke é sanitizado |
| Dump de backup vaza | Cifrado antes de armazenar; **nunca** em Git nem em artefato do GitHub como destino final |
| `pg_dump` incompatível com o Neon | Fixar a versão do cliente Postgres igual à do servidor Neon (verificar antes) |
| Conta de smoke vira porta dos fundos | Papel `analyst`, senha forte, desativável por 1 chamada; documentada |

---

## 6. Rollback

- **CI:** workflows não tocam produção. Rollback = remover o arquivo.
- **Branch protection:** reversível pelo painel do GitHub.
- **Deploy:** Render e Vercel guardam deploys anteriores; rollback = promover o anterior.
- **Purga:** **não tem rollback** — dado apagado não volta. Por isso o bloco 7 (backup
  comprovado) precisa estar pronto **antes** de o cron ficar ativo, e a primeira execução
  em produção é manual e supervisionada.
- **Migrations:** nenhuma nesta fase.

---

## 7. Critérios de aceite

**Bloco 2 (CI):**
- [ ] PR com teste quebrado → vermelho
- [ ] PR com build quebrado → vermelho
- [ ] múltiplos heads do Alembic → vermelho
- [ ] migration pendente (modelo mudou sem migration) → vermelho
- [ ] nenhum workflow acessa produção
- [ ] todos verdes no commit atual

**Bloco 3 (deploy protegido):**
- [ ] `main` é a branch padrão e está protegida
- [ ] merge exige PR + checks verdes
- [ ] force push e deleção bloqueados
- [ ] Render e Vercel publicam a partir de `main`
- [ ] fluxo documentado: branch → PR → CI → merge → deploy → smoke → rollback

---

## 8. Fora de escopo (registrado para não voltar por acidente)

MFA, refresh token, revogação de sessão, SSO, dashboard, relatórios, exportação, paginação,
busca, multi-tenancy e **qualquer funcionalidade nova de análise**.

Também fora: staging dedicado (custo), Redis (Fase 6), pentest (Fase 6), documentos
jurídicos (Fase 7).
