# Plano de execução — spec 01

A spec `01-portfolio-fullstack.md` é o contrato aprovado para esta implementação.
Preservar o visual existente, o proxy same-origin, a análise offline e todos os
controles de segurança. Trabalhar no diretório atual, sem commit nem push.

1. Testar e implementar demo opt-in, seed idempotente de quatro mensagens fictícias,
   amostras por ID sem persistência e bloqueio de mutações por RBAC.
2. Testar e implementar `token_version`, migração reversível e revogação em logout,
   troca de senha, desativação e lockout.
3. Adicionar Vitest/RTL/MSW e testes de login, formulário, resultados, regras,
   guarda por papel e recuperação de cold start; implementar as interfaces.
4. Adicionar imagens Docker sem root, compose com Postgres e verificações de saúde,
   Playwright com fluxo completo e capturas reais, CI com SHAs verificados na API.
5. Atualizar README/runbooks, executar as verificações disponíveis e registrar saídas,
   política CSP, instruções de demo em produção e limitações em `01-resultado.md`.

Cada etapa usa testes de comportamento e preserva arquivos locais preexistentes.
Se uma ferramenta não estiver disponível, registrar a falha concreta e continuar
as verificações independentes; nunca declarar uma verificação não executada como aprovada.
