# Meu Espaço de Saúde — etapa isolada, sem publicação

Base examinada: main `b40de6f18bee5236e996acc7c43df7ee1dafce98`. Implementação adicionada em `health-space/`, sem alterar o Worker existente, o portal público, SDK, sessões clínicas ou plano 345. Esta entrega NÃO está liberada para dados reais.

## O que funciona na etapa local

Informações essenciais, medicamentos, alergias, notas e perguntas; arquivos PDF/PNG/JPEG de até 5 MiB (20 arquivos, 50 MiB por beneficiário); download privado; exportação integral NDJSON com anexos em base64; exclusão do espaço; sessão própria de uma hora, com 15 minutos de inatividade; confirmação e autenticação recente para exportação/exclusão. A demonstração usa SQLite em memória e substitutos de R2/scanner com dados exclusivamente fictícios. Nenhum desses substitutos é importado pelo Worker.

## Arquitetura e limites de confiança

- Novo Worker independente `promovie-health-space`, futuramente servido SOMENTE em `https://www.promovie.tv.br/telesaude/meu-espaco/*`, dentro do escopo do aplicativo instalado. Rotas de `backend.promovie.tv.br` e Médiquo permanecem intactas. É necessário confirmar que a zona WWW pode receber uma rota Worker; não alterar DNS apenas para experimentar.
- Banco `HEALTH_DB` separado do banco administrativo. Migração explícita `migrations/0001.sql`, nunca executada automaticamente em produção.
- Binding `BENEFICIARIES` para o D1 administrativo existente `promovie-beneficiarios` (ID documentado no repositório: `a11f2e06-28c2-4582-ba40-7a3c7f43af4a`). O adaptador faz apenas SELECT. D1 não oferece autorização por tabela no binding: o processo ainda terá capacidade técnica de escrita. Uma futura ponte privada de identidade com menor privilégio é preferível se disponível. Não conceder esse binding a código não revisado.
- CPF + código de 100 bits gerado pelo cadastro atual são verificados no servidor, sem chamar ou emitir sessão Médiquo. Cadastro ativo e plano 345 são revalidados localmente em toda requisição, incluindo hash de código vigente/pendente. A revogação no cadastro cancela o acesso; mudanças apenas no fornecedor, ainda não sincronizadas no cadastro, não são automaticamente observadas por este Worker.
- Cookie `__Host-pv_health`, Secure/HttpOnly/SameSite=Strict; identificador aleatório de 256 bits, somente hash no D1; rotação no login e uma sessão por beneficiário. Não usa token clínico, localStorage ou CPF como autorização de objeto.
- Todas as consultas sensíveis usam owner obtido da sessão; IDs de arquivos não concedem acesso. Origem exata, Fetch Metadata em GET, cabeçalho próprio e CSRF sincronizado em alterações. Não há CORS habilitado.
- Limites atômicos em D1 por IP, CPF, usuário, upload e exportação. Limites de tamanho são conferidos durante leitura do stream. Quotas de anexos reservadas numa instrução SQL, incluindo uploads pendentes.
- AES-256-GCM, IV aleatório, HKDF por beneficiário, AAD vinculado a owner/contexto/versão. Metadados de arquivo também cifrados; chaves R2 aleatórias, sem CPF/nome. `HEALTH_KEYS` permite leitura de versões antigas e novas gravações com `HEALTH_KEY_VERSION`. É criptografia no servidor, NÃO ponta a ponta: operadores com acesso ao código e segredos podem tecnicamente decifrar. A interface não afirma “só você consegue ler”.
- Download sempre como anexo, sem renderização de PDF/HTML no portal. Extensão, assinatura e scanner privado são obrigatórios. `SCANNER.fetch` deve receber POST binário e retornar JSON `{ "clean": true }` apenas após análise integral, rejeitando formatos malformados, conteúdo ativo e malware. Não implementado um motor antivírus nesta entrega; não usar o stub de testes em produção nem scanner público.
- Nenhum cache de saúde, scripts de terceiros ou logs de corpo/credenciais. Auditoria pseudonimizada só com eventos, por 90 dias. CSP, headers de privacidade e nenhuma coleta analítica.
- Exclusão bloqueia imediatamente o espaço, remove objetos e registros; falhas são retomadas por rotina agendada. Reservas antigas e objetos órfãos são reconciliados. Varredura completa de bucket deve ser avaliada contra limites de execução; para escala maior, particionar e persistir cursor em tarefa dedicada.
- Concorrência usa versão na gravação das notas. Exportação reflete leituras durante a operação; não constitui snapshot transacional dos anexos. Não editar/excluir em outra aba durante exportação. A resposta falha se algum arquivo não puder ser lido.

## Pré-requisitos ainda NÃO verificados/provisionados

1. Acesso operacional à Cloudflare. O conector disponível não fornece gestão Cloudflare; a aba existente foi identificada, mas a automação do Chrome falhou antes de ler configurações. Não foram lidos segredos. Os segredos GitHub usados pelo deploy atual não são prova de acesso direto ou da configuração do novo Worker.
2. D1 separado de homologação e produção (`HEALTH_DB`), migration aplicada e testes no runtime real D1. Banco administrativo via `BENEFICIARIES` e segredo compatível `PROMOVIE_ADMIN_DATA_KEY`; preferencialmente migrar essa verificação para serviço privado com menor privilégio antes da liberação geral.
3. R2 `FILES` exclusivo, acesso `r2.dev` desativado, sem domínio público, sem CORS público, sem retenção/bucket lock que impeça exclusão. Conferir configurações na API/painel; o binding sozinho não prova privacidade.
4. Chaves novas e aleatórias de 32 bytes em base64: `HEALTH_KEYS` (JSON com versão, por exemplo v1), `HEALTH_KEY_VERSION` e `HEALTH_AUDIT_KEY`. Nunca copiar chaves de testes. Custódia, recuperação, rotação e acesso restrito documentados; testar restauração com chaves antigas antes de removê-las.
5. Serviço privado real `SCANNER` (contrato acima), prazo/limite de 5 MiB, sem logging ou reutilização de documentos, análise estrutural e malware testada com corpus de segurança. Sua ausência mantém TODO o serviço bloqueado.
6. `ASSETS` com `run_worker_first:true`; rota HTTPS exclusivamente no caminho novo, bypass de cache CDN nesse caminho, cron de limpeza e monitoramento de falhas sem dados clínicos. Configuração versionada de staging/produção deve ser acrescentada após IDs reais serem conhecidos. Configuração entregue não tem rotas nem bindings de produção; `workers_dev` e URLs de preview desligados.
7. Avaliação de privacidade pelo controlador: finalidade/base legal para dados sensíveis, registro do tratamento, canal de direitos com contato concreto, operadores/transferências, idade/dependentes, recuperação de identidade, resposta a incidentes, retenção e eliminação em backups. Confirmar prazo efetivo D1 Time Travel/backups/R2 e substituir o texto provisório antes de coletar dados. Consentimento na interface não é declaração de conformidade LGPD.
8. Teste com DOIS beneficiários sintéticos no ambiente real e um acesso clínico autorizado, sem consulta/pagamento/cadastro de paciente novo. Testar login, chat/interface SDK e logout existentes; depois o caminho novo, cookies, revogação, quotas concorrentes, scanner, restauração/exclusão e exportação. Conferir Chrome/Edge e Safari/iOS/PWA reais; o teste responsivo local não os substitui.

## Integração e liberação

O link de entrada ainda NÃO foi colocado no portal público. Após passar os pré-requisitos, acrescentar um único link “Meu Espaço de Saúde” ao lado da opção de atendimento, para `/telesaude/meu-espaco/`; manter o formulário e handoff Médiquo existentes byte a byte. O espaço pedirá seu próprio login. Não prometer SSO e não transportar código/token por URL, localStorage ou postMessage.

1. Revisar o PR e os testes sem fazer merge. O repositório é público; a branch contém código, não uma funcionalidade acessível nem dados de pacientes.
2. Provisionar staging fechado, IDs/bindings/segredos acima, política e controles revisados. Executar testes Cloudflare e navegadores; registrar evidências e versão do scanner. A flag `HEALTH_REVIEW_APPROVED` é um gate operacional, não auditoria automática.
3. Somente com evidências, finalizar texto de privacidade e link do portal, revisar diff e fazer merge. Merge não é deploy; neste PR não existe workflow de deploy do espaço.
4. Deploy separado do novo Worker e migração no novo banco. Habilitar `HEALTH_ENABLED=true` e `HEALTH_REVIEW_APPROVED=true` somente após o gate. Verificar respostas, headers, domínio privado R2 e fluxos reais. Não tocar no workflow do Worker clínico.
5. Rollback: desligar `HEALTH_ENABLED` e retirar link/rota nova. Não reverter banco administrativo nem apagar chaves/bucket. Em incidente, revogar sessões; preservar evidência de segurança sem expor conteúdo.

## Evidências desta etapa

- 46 testes preexistentes de backend e PWA passaram localmente antes das mudanças.
- 13 testes novos com SQL SQLite real cobrem isolamento, CSRF/origem, sessões, criptografia, versões, uploads/quotas, exportação e exclusão recuperável. R2/scanner são substitutos em memória; isto NÃO valida bindings reais.
- Navegador interno: login fictício, salvar informações, recarregar e recuperar conteúdo, sair e limpar campos. Desktop inspecionado visualmente; viewport 390 px com uma coluna e sem overflow horizontal (largura do documento 375 px). Não foi testado um atendimento clínico autenticado em produção.
- Portal público existente abriu normalmente durante leitura; não houve alteração nele. Nenhum merge, deploy ou armazenamento clínico real foi realizado nesta etapa.

## Referências verificadas

- [OWASP — sessão](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP — CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP — upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Cloudflare D1 — batches e API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare R2 — exposição pública](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Worker Assets — execução antes dos assets](https://developers.cloudflare.com/workers/static-assets/binding/)

## Executar localmente

Node 24: `node --test health-space/test/*.test.mjs`. Prévia sintética: `node health-space/test/preview.mjs`, abra `http://127.0.0.1:8789/telesaude/meu-espaco/`. Somente para testes: CPF `52998224725`, código `ABCDE-FGHJK-LMNPQ-RSTUV`. Dados em memória, perdidos ao encerrar processo. Nunca usar dados reais nem implantar o servidor de preview.
