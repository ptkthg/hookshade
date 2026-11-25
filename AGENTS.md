# hookshade: instruções para agentes

Plataforma de análise de phishing para SOC: FastAPI (backend/) + Next.js (frontend/). Projeto de portfólio full stack,
que vai ficar público. Idioma: português do Brasil, com acentuação correta. Código, rotas e identificadores no original.

## Regras
1. **Nada de dados reais.** E-mails, nomes, domínios e IPs de exemplo são fictícios (`example.com`, `contoso.example`,
   IPs da RFC 5737). Nunca grave segredos, tokens ou `.env` reais. Placeholders de teste precisam ter cara de placeholder.
2. **Segurança não regride.** CSRF, cookies `__Host-`, bcrypt, bloqueio de conta, rate limit, redação de PII, cabeçalhos
   e validação contra ReDoS continuam funcionando, cada um com teste.
3. **Toda mudança de comportamento tem teste**: pytest no backend, Vitest/RTL no frontend, Playwright no fluxo E2E.
4. **CI:** `permissions: contents: read` e actions fixadas por SHA de commit (confira o SHA na API do GitHub; a versão vai em comentário).
5. Não faça commit nem push. Registre o resultado em `docs/tasks/NN-resultado.md`: o que fez, saída dos testes, desvios, limitações.

## Comandos
```
cd backend && pip install -r requirements.txt && pytest -q
cd frontend && npm ci && npx tsc --noEmit && npm run lint && npm test && npm run build
docker compose up --build        # depois da spec 01
```
