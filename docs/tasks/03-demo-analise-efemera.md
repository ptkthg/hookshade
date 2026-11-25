# Spec 03: visitantes da demo podem analisar o próprio e-mail, sem salvar e com limite

**Implementador:** Codex. **Revisor:** Claude. Leia o `AGENTS.md` antes de começar.

## Problema
Na demo pública, a tela **Nova análise** desativa o campo de texto e o upload (`fieldset disabled={demo}`), e o backend
responde `403` para `POST /api/v1/analyses` e `/text` (`require_writer`). O visitante só consegue rodar as quatro
amostras fixas. Queremos que ele cole um e-mail próprio (ou escolha um `.eml`) e veja o resultado, sem abrir uma porta
para guardar dados pessoais de terceiros nem para abuso de recurso.

## Princípios
- **Efêmero:** a análise roda em memória e **nada** é gravado: nem `analyses`, `iocs`, `findings`, `recommendations`,
  nem `audit`. O conteúdo bruto nunca aparece em log, exceção, resposta de erro ou métrica.
- **Limitado:** tamanho máximo, rate limit por IP e um teto global (o IP vem do `X-Forwarded-For`, que é forjável).
- **Sem regressão:** o demo continua sem conseguir gravar nada. `POST /api/v1/analyses`, `/text`, `DELETE`, regras e
  administração continuam `403` para o papel `demo`. Para `analyst` e `admin`, o fluxo atual (salvar e redirecionar
  para `/resultado/{id}`) não muda.

## Backend
1. **Rota nova** `POST /api/v1/analyses/preview`, corpo JSON `{"content": str}`.
   - Autenticação obrigatória (`get_current_user`), qualquer papel. CSRF obrigatório, como em toda mutação.
   - Roda `run_analysis(raw, rules=list_active_rule_dicts(db))` e devolve `AnalysisDetail` com `id=0`,
     `source_type="preview"` e `created_at` atual, no mesmo formato de `test_sample`. Remova o valor bruto dos IOCs
     (`ioc.pop("value")`), como já é feito nas amostras. Extraia o trecho comum com `test_sample` para uma função
     auxiliar, em vez de duplicar.
   - `context` não é aceito nessa rota.
2. **Limites**, configuráveis em `config.py` (com `validation_alias` e `gt=0`) e documentados no `.env.example`:
   - `PREVIEW_MAX_BYTES` (padrão `65536`): tamanho do conteúdo em UTF-8. Acima disso, `413` com
     `detail` "Conteúdo acima de 64 KB" (gere a mensagem a partir do valor configurado). Recuse **antes de ler o corpo**
     quando o `Content-Length` já passar de `PREVIEW_MAX_BYTES + 1024` (folga para o JSON); depois do parse, confira o
     tamanho real em bytes. Conteúdo vazio ou só espaços: `422`.
   - `PREVIEW_RATE_PER_MINUTE` (padrão `5`) e `PREVIEW_RATE_PER_HOUR` (padrão `30`), por IP, com chaves próprias no
     `SlidingWindowLimiter` (`preview:min:<ip>`, `preview:hour:<ip>`). Estouro: `429`.
   - `PREVIEW_GLOBAL_PER_HOUR` (padrão `300`), somando todos os IPs (chave `preview:global`). Estouro: `429`.
   - Os limites valem para todos os papéis nessa rota. O limite de `rate_limit_analyses` continua valendo nas rotas que
     salvam.
   - Mantenha a nota de limitação do `ratelimit.py`: o estado vive no processo (instância única no Render).
3. **Log:** uma linha estruturada `analysis.preview` com `user_id`, `role`, `bytes`, `severity` e `risk_score`. Nada do
   conteúdo, do assunto, de remetentes ou de IOCs.
4. **Testes pytest** (arquivo novo `backend/tests/test_preview.py`, reaproveite as fixtures existentes):
   - demo faz preview com um e-mail fictício e recebe `200`, com `source_type == "preview"` e `id == 0`;
   - depois do preview, a contagem de linhas de `analyses`, `iocs`, `findings`, `recommendations` e `audit` não muda;
   - a resposta não traz o valor bruto de nenhum IOC (só `value_defanged` e `value_hash`);
   - acima de `PREVIEW_MAX_BYTES`: `413`, tanto pelo `Content-Length` quanto pelo tamanho real (conteúdo multibyte);
   - vazio: `422`; sem sessão: `401`; sem CSRF: `403`;
   - 6ª chamada no mesmo minuto: `429`; teto por hora e teto global com limites baixos via `settings` no teste;
   - `caplog`: um marcador único colocado no conteúdo não aparece em nenhum log;
   - a matriz de 403 do demo em `test_portfolio.py` continua passando sem alteração (POST `/analyses`, `/text`, upload,
     DELETE, regras e usuários).

## Frontend
1. `lib/api.ts`: `analyzePreview(content: string)` chamando a rota nova.
2. `app/nova-analise/page.tsx`, quando o papel for `demo`:
   - o campo de texto e o seletor de arquivo ficam **habilitados**. O arquivo `.eml` é lido no navegador
     (`await file.text()`) e enviado como `content` pela mesma rota; o campo **Contexto** fica oculto;
   - "Analisar" chama `analyzePreview` e mostra o resultado na própria página com `ResultView`, sob o aviso
     "Resultado efêmero · não foi salvo". Não redireciona para `/resultado/{id}`;
   - acima do formulário, troque a frase atual por: "Na demonstração, o e-mail é analisado em memória e descartado.
     Use mensagens fictícias ou sem dados pessoais. Limite de 64 KB e de 5 análises por minuto.";
   - contador de tamanho em bytes perto do campo, e "Analisar" desabilitado acima do limite (o backend continua sendo a
     barreira de verdade);
   - mensagens de erro em português: `413` → "O e-mail passa de 64 KB."; `429` → "Limite de testes atingido. Tente de novo em alguns minutos."
     Para isso, `req` precisa expor o status HTTP do erro (por exemplo, uma classe `ApiError` com `status`), sem quebrar
     quem já usa `err.message`.
   - O bloco "Testar com amostra" continua igual.
3. Para `analyst` e `admin`, nada muda na tela.
4. **Vitest/RTL/MSW** em `frontend/tests/`:
   - demo vê o campo habilitado, envia, a página chama `/api/v1/analyses/preview` (e não `/text`) e mostra "não foi salvo";
   - demo com `.eml` envia o texto do arquivo pela rota de preview;
   - `429` e `413` mostram as mensagens acima;
   - analyst continua chamando `/api/v1/analyses/text` e sendo redirecionado.

## E2E (Playwright)
Em `e2e/tests/portfolio.spec.ts`: o demo cola um e-mail fictício (domínios `example.com`/`contoso.example`), vê o
resultado efêmero e, ao voltar ao **Histórico**, continua vendo só as 4 análises do seed.

## Documentação
- README: seção "Explorar a demonstração" (o visitante pode colar um e-mail; nada é salvo; limites) e a tabela de
  controles de segurança (linha nova para o preview efêmero, com código e testes).
- `.env.example` (raiz e `backend/`) e `render.yaml`, se ele listar variáveis da API: as quatro variáveis novas com os padrões.

## Critérios de aceite
`cd backend && pytest -q`; `cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build`, tudo passando.
Se o Playwright não puder rodar no seu ambiente, diga isso no resultado: não invente a saída.
Resultado em `docs/tasks/03-resultado.md` (o que mudou, saída dos testes, desvios, limitações). Não grave caminhos
absolutos da máquina (como `C:\Users\...` ou `D:\Temp\...`) nesse arquivo: use caminhos relativos ao repositório.
Não faça commit nem push.
