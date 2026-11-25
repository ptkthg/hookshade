# Resultado da spec 03 — análise efêmera na demonstração

Implementação da [spec 03](03-demo-analise-efemera.md), em 25/11/2026. Sem commit nem push.

## O que mudou

- `POST /api/v1/analyses/preview`: exige sessão e CSRF, aceita somente `content`, consulta as regras ativas e devolve `AnalysisDetail` com `id=0`, `source_type="preview"` e data atual. Preview e amostras usam o mesmo auxiliar, que remove `value` dos IOCs.
- O preview não chama persistência nem auditoria. O teste compara as contagens de `analyses`, `iocs`, `findings`, `recommendations` e `audit` antes e depois da requisição.
- Limite UTF-8 configurável; `Content-Length` acima do limite mais 1024 bytes é recusado antes de ler o corpo. Depois do JSON, o tamanho real também é validado. Conteúdo vazio, campos extras (inclusive `context`) e entradas inválidas recebem erro genérico, sem ecoar o conteúdo.
- Rate limit próprio por IP/minuto, IP/hora e global/hora, para todos os papéis. As cotas de criação e de amostras continuam separadas do preview. Mantida a nota operacional sobre estado por processo.
- Evento estruturado `analysis.preview` somente com `user_id`, `role`, `bytes`, `severity` e `risk_score`. Falhas de validação e de pipeline não devolvem conteúdo bruto.
- A demo pode colar texto ou selecionar `.eml`, lido com `file.text()` e enviado por JSON à rota de preview. Mostra `ResultView` na mesma página, com o aviso de resultado efêmero. Contexto fica oculto; há contador de bytes e bloqueio acima de 65536 bytes.
- `ApiError` preserva `message` e expõe `status`; a tela traduz 413 e 429. Analistas continuam usando as rotas persistentes e o redirecionamento existente.
- README, exemplos de ambiente da raiz/backend e Render documentam as quatro novas variáveis e seus padrões.
- Pytest e Vitest/RTL/MSW cobrem os novos comportamentos. O cenário Playwright inclui texto, arquivo e retorno ao histórico com somente as quatro análises seed. `backend/tests/test_portfolio.py` foi preservado.
- Na interface, apliquei o guia `accessibility` de Modern Web Guidance: “Link hints to inputs via `aria-describedby`”. O contador fica associado aos campos, sem anúncio a cada tecla; erros usam o alerta existente.

## Verificação

Comandos executados no PowerShell com os executáveis Windows (`python.exe` do ambiente virtual existente, `npm.cmd` e `npx.cmd`). Dependências existentes foram utilizadas, sem mudanças nos manifests ou lockfiles.

| Local | Comando | Resultado |
|---|---|---|
| `backend/` | `.venv/Scripts/python.exe -m pytest -q` | Primeira execução completa: `282 passed, 4 warnings, 4 errors in 179.93s`. Os quatro erros foram de acesso à pasta temporária, no setup dos testes de migração, descritos abaixo. |
| `backend/` | `.venv/Scripts/python.exe -m pytest -q --basetemp=../.local-test/pytest-spec03-new -p no:cacheprovider` | Código de saída 0: `290 passed, 2 warnings in 162.21s (0:02:42)`. Inclui os 24 testes de preview e a matriz demo existente sem alterações. |
| `frontend/` | `npx.cmd tsc --noEmit` | Código de saída 0, sem erros. |
| `frontend/` | `npm.cmd run lint` | Código de saída 0, sem erros. |
| `frontend/` | `npm.cmd test` | `Test Files 1 passed (1)`; `Tests 23 passed (23)`; duração 12,71 s. |
| `frontend/` | `npm.cmd run build` | Código de saída 0; `Compiled successfully`, verificação TypeScript e geração de páginas concluídas. |
| `e2e/` | `npm.cmd test`, com `PLAYWRIGHT_BROWSERS_PATH=../.local-test/browsers` | `2 failed`: ambos em `page.goto`, com `net::ERR_CONNECTION_REFUSED` para `http://localhost:3000/login`. O Chromium iniciou, mas não havia frontend acessível. Não houve validação E2E do fluxo. |
| raiz | `git diff --check` | Código de saída 0. |

Os testes foram escritos e executados antes da implementação: inicialmente, o preview retornava 405 e suas configurações não existiam (`19 failed, 1 passed`); os novos cenários de UI também falharam com o formulário demo desabilitado (`6 failed, 17 passed`).

Os quatro erros ambientais da primeira suíte backend ocorreram em:

- `test_upgrade_head_creates_all_model_tables`;
- `test_migrated_schema_columns_match_models`;
- `test_seed_user_works_on_migrated_db`;
- `test_token_version_migrates_existing_user_and_downgrades`.

A repetição redireciona somente os temporários para `.local-test/` e desativa o cache, que também tinha restrições de acesso. Não altera nem ignora testes. Os avisos de depreciação de `httpx`/Starlette e do nome da constante HTTP 422 pertencem às dependências/código existentes.

## Desvios e limitações

- A leitura do JSON é explícita por `Request`: declarar um parâmetro de corpo faria o framework lê-lo antes da verificação antecipada de tamanho. O modelo Pydantic continua validando o conteúdo, mas sua mensagem detalhada não é enviada ao cliente para evitar exposição do input.
- A interface informa e aplica os padrões da spec (64 KB/5 por minuto); alterações operacionais nas variáveis do backend não atualizam automaticamente esse texto. O backend mantém a decisão final.
- O limiter continua em memória por processo; o IP derivado de `X-Forwarded-For` é forjável. O teto global reduz esse abuso e não substitui um armazenamento compartilhado para múltiplas instâncias.
- No teste de arquivo em jsdom, `File.text()` é suprido no objeto de teste, pois esse ambiente não o implementa. Foi acrescentado um cenário com arquivo real no Playwright, ainda pendente de execução bem-sucedida.
- Docker não estava disponível. A API local foi iniciada para a tentativa E2E, com banco SQLite separado em `.local-test/` e somente credenciais fictícias, e encerrada após a tentativa. A revisão automática de permissões rejeitou `npm run start` do frontend com `blocked by policy`, sem detalhar o motivo; não foi possível completar o E2E neste ambiente. Traces e capturas da tentativa estão em `e2e/test-results/` (ignorado pelo Git).
- Os arquivos preexistentes não rastreados `docs/tasks/03-demo-analise-efemera.md` e `docs/tasks/03-resultado-codex.md` foram preservados. Nenhum segredo ou arquivo `.env` real foi lido ou gravado.

## Revisão (Claude)

- **Corrigido: corpo sem `Content-Length`.** Com `Transfer-Encoding: chunked`, `await request.json()` lia o corpo inteiro
  para a memória antes de qualquer checagem, e a API do Render pode ser chamada diretamente, sem o proxy da Vercel.
  A leitura agora é feita em streaming por `_read_capped`, que para assim que passa do teto. Teste novo
  `test_read_capped_stops_at_cap`: com 1000 pedaços de 1 KB e teto de 3 KB, a função lê 4 pedaços e para. O `TestClient`
  entrega o corpo numa mensagem só, por isso a função é testada direto. `test_preview_chunked_body_over_cap_is_413` cobre a rota.
- **Corrigido na spec: folga do JSON.** A folga de 1 KB no `Content-Length` recusava e-mails válidos: o `JSON.stringify`
  transforma cada quebra de linha em `\n` (2 bytes). O teto do corpo passou a ser `2 × PREVIEW_MAX_BYTES + 1 KB`, e o limite
  exato continua valendo para o conteúdo. Teste novo `test_preview_max_size_with_many_newlines_is_accepted`.
- **Verificação depois da revisão:** `pytest -q` com `--basetemp` próprio e `-p no:cacheprovider`: `293 passed`.
  Frontend: `tsc`, `lint`, `npm test` (`23 passed`) e `build` sem erros.
- **Teste manual no navegador** (API local com SQLite descartável e `next start`, perfil demo): o e-mail fictício colado gerou
  o resultado efêmero na própria página; a 6ª análise no mesmo minuto mostrou "Limite de testes atingido…"; o histórico
  continuou com 4 análises; os logs da API trouxeram só `analysis.preview` com `bytes`, `severity` e `risk_score`, sem nenhum
  trecho do conteúdo. O E2E com Playwright (`e2e/`) continua sem execução registrada.
- **Ficou como está:** a tela mostra "Análise #0" no resultado efêmero, como já acontecia nas amostras.
