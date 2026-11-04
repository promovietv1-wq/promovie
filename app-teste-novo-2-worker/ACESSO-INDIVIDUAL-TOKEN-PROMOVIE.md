# Token PromoVie | Acesso individual do beneficiário

## Fluxo liberado no código

1. O gestor acessa `https://www.promovie.tv.br/telesaude/gestao/` e cadastra o beneficiário.
2. **Cadastrar e ativar** cria o registro privado D1, faz um envio único ao SDK (se houver autorização comercial de escrita) e consulta o status. Quando o plano 345 está ativo, emite automaticamente um **código pessoal** de 20 caracteres, exibido uma única vez ao gestor.
3. Para beneficiários já ativos, o gestor abre o cadastro e clica em **Gerar código pessoal**. Um novo código invalida o anterior. Também há **Revogar código**.
4. O beneficiário acessa `https://www.promovie.tv.br/telesaude/`, informa CPF e código pessoal recebido diretamente da PromoVie. O backend valida o código por HMAC e a situação local, consulta o plano ativo 345 no SDK, gera um access token **somente para aquele CPF** e abre o Widget Web.
5. O ambiente público nunca cria pacientes nem recebe chaves privadas. As mensagens de interface usam a nomenclatura **Token PromoVie**.

## Segurança

- Códigos individuais têm 100 bits de entropia, não ficam armazenados em texto no D1, não são retornados no histórico e só aparecem na resposta de geração para o gestor autenticado.
- O código é verificado pelo Worker usando HMAC derivado do segredo de dados existente, indexado pelo CPF protegido por HMAC. Não é suficiente informar apenas um CPF.
- O código não entra em parâmetros de URL, logs, armazenamento do navegador, repositório ou cookies. É enviado em corpo JSON via HTTPS ao domínio `backend.promovie.tv.br`.
- O banco D1 aplica limite persistente de seis tentativas por CPF a cada 15 minutos.
- Antes de iniciar sessão o sistema verifica o beneficiário ativo na PromoVie e revalida no SDK o plano 345. A licença revogada/suspensa não deve receber sessão.
- Somente o gestor logado, com cookie HttpOnly e origem permitida, pode gerar ou revogar códigos. Compartilhar apenas com o titular, em canal privado.
- As rotas técnicas do SDK permanecem exatamente as confirmadas por Pedro em 04/11/2026: `GET /patients/{cpf}` e `POST /patients/authenticate?code={cpf}` com os dois headers privados do servidor.
- O antigo `TELESAUDE_V3_ENABLED` permanece separado e pode continuar `false`. O acesso pessoal usa `PROMOVIE_BENEFICIARY_ACCESS_ENABLED` e não depende da escrita de pacientes.

## Implantação

- Página pública e painel: GitHub Pages, branch `main`.
- Backend: implantar **o Worker existente**, sem trocar nome/domínio e mantendo banco D1 e segredos existentes, com `wrangler deploy --keep-vars`. O projeto tem `keep_vars=true` para preservar variáveis que estão só no painel Cloudflare.
- A variável pública `PROMOVIE_BENEFICIARY_ACCESS_ENABLED=true` passa a integrar a configuração do Worker. Essa liberação permite apenas autenticar beneficiários com código individual. **Não habilita cadastro de outros CPFs nem consome licença nova.**
- O workflow `Publicar Worker Token PromoVie` consegue fazer a implantação quando os segredos **CLOUDFLARE_API_TOKEN** e **CLOUDFLARE_ACCOUNT_ID** estiverem definidos nas configurações do GitHub Actions. Nunca escrever valores de credenciais no GitHub, chat ou arquivos.
- Se os segredos do GitHub não existirem, a página nova pode aparecer como **Acesso em preparação**, até o novo código do Worker ser realmente implantado na Cloudflare. Não declarar o atendimento pronto antes da validação real.
- A escrita de novos pacientes continua protegida por `TELESAUDE_V3_WRITE_ENABLED` e `PROMOVIE_ADMIN_MULTI_PATIENT_ENABLED`. Sua liberação comercial é um passo separado da autenticação.
- O app principal `/app/` não foi alterado neste trabalho.

## Verificações antes de divulgar aos clientes

1. Confirmar `GET /api/promovie/access/v1/health` com origem oficial devolve `disponivel=true`.
2. No painel de gestão, selecionar o cadastro ativo do gestor e gerar um código.
3. No site, autenticar com CPF e código, verificar se o Widget abre e apresenta os serviços contratados.
4. Um código incorreto deve falhar sem revelar o cadastro; um código revogado deve falhar; o código renovado deve substituir o antigo.
5. Se o Widget não abrir ou os oito serviços não aparecerem, conferir com o suporte do fornecedor antes de liberar outros clientes. Não enviar pacientes extras durante testes de entrada.

**Não existe fallback automático para a API ID, nem para entrada insegura somente com CPF.**
