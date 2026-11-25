# Spec 02: logout do demo não pode derrubar os outros visitantes

**Implementador:** Codex. **Revisor:** Claude. Correção encontrada na revisão da spec 01.

## Problema
A revogação por `token_version` é por conta. O demo é **uma conta compartilhada** por todos os visitantes: o logout
de um visitante incrementa a versão e desloga todos os outros. Repetido, vira negação de serviço da demo pública.

## Correção
1. Para o papel `demo`, o logout **só apaga o cookie**: não incrementa `token_version`. O mesmo vale para qualquer outra
   ação que o demo consiga disparar e que mude a versão (confira).
2. O JWT do demo tem validade curta e própria (`DEMO_SESSION_MINUTES`, padrão 30), documentada no `.env.example`.
3. Para `analyst` e `admin`, nada muda: logout, troca de senha e bloqueio continuam revogando os tokens antigos.
4. Testes pytest:
   - dois logins demo; um faz logout; **o outro continua autorizado**;
   - token demo expira após a validade configurada;
   - logout de analyst continua invalidando o token antigo (já existente: manter).
5. E2E (Playwright): a verificação de "cookie antigo não acessa mais após logout" passa a usar um usuário `analyst`
   criado no seed **apenas no ambiente E2E/compose** (nunca em produção). Para o demo, o E2E confere que logout limpa a
   sessão no navegador.
6. Atualize o README (seção de limitações e de segurança) e o `docs/tasks/01-resultado.md` (item "Revogação por conta").

## Critérios de aceite
Backend `pytest`, frontend `tsc`/`lint`/`test`/`build` passando; resultado em `docs/tasks/02-resultado.md`. Não faça commit nem push.
