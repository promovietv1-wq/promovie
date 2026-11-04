# PromoVie | Gestão de beneficiários e banco D1

## Objetivo
Painel privado em /telesaude/gestao/ para registrar, pesquisar e arquivar
beneficiários, separado da página pública e dos prontuários da Médiquo.

## Estado atual
- Painel administrativo publicado e banco Cloudflare D1 `promovie-beneficiarios` conectado.
- Senha administrativa e chave de criptografia registradas como segredos na Cloudflare.
- Login, cadastro local, consulta individual à Médiquo e testes públicos de saúde do Worker concluídos.
- Nenhum dado pessoal é salvo no GitHub.
- O histórico do antigo portal ID não será importado automaticamente.
- Nenhuma licença real será cadastrada pela nova funcionalidade até autorização.

## Ativação, sem contratar serviço pago
1. Cloudflare > Workers & Pages > D1 SQL database > Create Database.
   Nome recomendado: promovie-beneficiarios.
2. Copiar o ID real do banco e associar ao Worker em wrangler.jsonc:
   d1_databases: [{binding: PROMOVIE_BENEFICIARIOS_DB,
     database_name: promovie-beneficiarios, database_id: ID_REAL}]
   Não usar IDs fictícios. Não alterar DNS nem o PWA.
3. Cloudflare Worker > Settings > Variáveis e Segredos:
   - PROMOVIE_ADMIN_PASSWORD: tipo Segredo, senha exclusiva de 16+ caracteres.
   - PROMOVIE_ADMIN_DATA_KEY: tipo Segredo, chave aleatória de 32+ caracteres.
   Não compartilhar senha nem chave no chat, nem inserir em repositórios.
4. Fazer o deploy do Worker com o ID verdadeiro.
5. No primeiro login correto, o Worker cria as tabelas D1 automaticamente.
6. Criar o primeiro registro local, verificar listagem, pesquisa e histórico.
7. Só habilitar gravação no fornecedor após confirmar o fluxo com Pedro e
   como o plano 345 usa as licenças existentes.

## Segurança
- Apenas CPF, nome e contatos opcionais; não registrar dados clínicos.
- Campos pessoais cifrados com AES-GCM antes de chegar ao D1.
- Índice de CPF em HMAC. D1 mantém registros mesmo após fechar o navegador.
- Senha administrativa validada no Worker. Nunca é enviada à Médiquo.
- Sessões com cookie HttpOnly, Secure, SameSite=Strict, validade 1 hora.
- Sessão invalidada no servidor no logout e limitação de tentativas por IP.
- Registros de ações administrativas sem prontuários.
- A página impede indexação e o Worker aplica CORS por origem autorizada.
- A chave PROMOVIE_ADMIN_DATA_KEY deve ser guardada: se perdida, dados
  criptografados existentes não poderão ser recuperados.
- Arquivar NÃO suspende nem encerra a licença da Médiquo.
- Definir política de retenção/exclusão conforme LGPD.
- Recomenda-se 2FA ou Cloudflare Access antes de conceder acesso a terceiros.

## Limites nesta etapa
- A lista é paginada em 50 registros; pesquisa na página carregada.
- Não importa os pacientes cadastrados anteriormente no ID Médiquo.
- Envio real ao SDK permanece bloqueado (TELESAUDE_V3_WRITE_ENABLED=false).
- Na primeira liberação, somente o CPF já autorizado será aceito.
- **A rota SDK já foi confirmada por Pedro** em 04/11/2026. Para pacientes PromoVie usar `https://sdk.mediquo.com/v1`, `PUT /patients`, `GET /patients/{cpf}` e o fluxo de autenticação SDK do kit. **Não trocar para a API ID baseada em documentação genérica.**
- Antes da ativação, consultar o registro pelo SDK, manter a escrita bloqueada e só ativar o CPF de teste mediante autorização explícita.
- Fonte canônica: `CONTRATO-SDK-PEDRO-2026-11-04.md`.

## Fontes
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://documentacao.mediquo.com.br/sdk-overview.html
- https://documentacao.mediquo.com.br/patients.html
- https://www.gov.br/saude/pt-br/acesso-a-informacao/lgpd/principios
