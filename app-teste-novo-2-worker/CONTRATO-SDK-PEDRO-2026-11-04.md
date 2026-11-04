# Integração TeleSaúde PromoVie | Contrato operativo SDK V3 confirmado por Pedro

**Fonte de decisão:** orientação direta de Pedro Henrique, Suporte MediQuo Brasil, e-mail de **04/11/2026, 12h32 BRT**, assunto **"Re:Re: [## 22267 ##] TeleSaúde | Continuidade da integração"**, junto do kit SDK V3 específico entregue ao parceiro.

## Decisão vinculante para este projeto
A **integração de pacientes da PromoVie utiliza a API SDK**, não o fluxo de cadastro da API ID anterior. Não substituir endpoints do kit SDK V3 por orientações genéricas sobre a API ID/portal antigo.

- API SDK: `https://sdk.mediquo.com/v1`
- Ambiente do Widget: `production`, inclusive durante homologação, **conforme confirmação explícita de Pedro**
- Plano contratado no SDK: `345`
- Criar/sincronizar um paciente SDK: `PUT /patients` com o payload do kit V3; na integração atual há array `{patients:[{code,tax_id,first_name,last_name,plan:'345',locale:'pt', ...}]}`
- Consultar existência e status: `GET /patients/{cpf}`
- Autenticar/abrir atendimento: `POST /patients/authenticate` conforme **formato de autenticação do kit V3**, que pode receber CPF como query parameter na implementação corrente.
- Cabeçalhos server-side: `X-API-Key` e `X-Secret-Key` do cliente SDK, **exclusivamente no Worker**, nunca no site público.
- O antigo portal ID foi configurado para SDK, mas **não apresenta automaticamente os pacientes SDK cadastrados**. Não inferir ausência de paciente a partir de listagem vazia no portal ID. A consulta correta é pela API SDK.

## Situação efetivamente observada (04/11/2026)
- D1 privado `promovie-beneficiarios` conectado e funcional; painel `/telesaude/gestao/` possui acesso protegido e registro local.
- Um primeiro beneficiário de teste foi cadastrado e permanece como **rascunho** no D1.
- O comando **Consultar Médiquo** no painel consultou o SDK, que retornou **paciente não encontrado** para esse CPF.
- A variável `TELESAUDE_V3_WRITE_ENABLED` permanece `false` até liberação deliberada, restrita ao CPF de teste em `TELESAUDE_V3_TEST_CPF`.
- `TELESAUDE_V3_ENABLED` permanece `false` enquanto o acesso assistencial não for explicitamente habilitado.
- O retorno de Pedro **não confirma sozinho** a situação das licenças antigas nem importa beneficiários antigos do portal ID. Não criar, suspender, apagar, migrar nem alterar licenças dos demais beneficiários automaticamente.

## Próximo fluxo, sem retrabalho
1. Preservar o cadastro local existente e conferir o CPF autorizado **na Cloudflare**, nunca registrar CPF ou segredos no GitHub/chat.
2. Manter origem e métodos do SDK V3; executar apenas consultas seguras para detectar duplicidade.
3. Após autorização consciente do operador, liberar temporariamente `TELESAUDE_V3_WRITE_ENABLED=true` para o teste individual; **não habilitar** `PROMOVIE_ADMIN_MULTI_PATIENT_ENABLED`.
4. Pelo painel protegido, enviar somente o cadastro de teste via `PUT /patients`. O backend deve recusar CPF que não corresponde ao autorizado, impedir duplicidade com um GET anterior e bloquear envio em caso de falha na consulta.
5. Após o envio, usar **Consultar Médiquo** novamente. Só considerar a ativação confirmada quando a resposta do SDK informar o paciente associado ao plano 345 e ativo.
6. Testar geração de sessão e atendimento no Widget usando a homologação restrita, e então desativar novamente a escrita, até a operação multiusuário ser formalmente aprovada.
7. Validar os oito serviços contratados e a administração das licenças antigas em etapa separada, sem pressupor que são visíveis no portal ID.

## Regra de continuidade
**Em novas tarefas e revisões deste projeto, esta orientação específica de Pedro e o kit SDK V3 são a referência.** A documentação pública de ID, por si só, **não autoriza** a troca dessas rotas. Se houver mudança futura, exigir nova comunicação explícita do fornecedor, registrar a data e preservar este histórico.

Credenciais e dados pessoais ficam somente na Cloudflare/D1. Nenhum segredo, CPF ou token pode entrar no código ou em mensagens públicas.

## Rotina operacional definitiva da PromoVie (após aprovação do modo multiusuário)
O teste inicial de um único CPF exigiu alternar `TELESAUDE_V3_WRITE_ENABLED` entre `false` e `true` por cautela. **Isso não faz parte da rotina de cada novo cadastro.**

- No modo de operação definitiva, o administrador ativa **uma vez** as permissões de escrita e múltiplos pacientes (`TELESAUDE_V3_WRITE_ENABLED=true` e `PROMOVIE_ADMIN_MULTI_PATIENT_ENABLED=true`) na Cloudflare. Elas permanecem habilitadas enquanto o serviço estiver em produção; não precisam ser alternadas por beneficiário.
- Só colocar o modo definitivo em produção após validar com a Médiquo a capacidade contratada, como consultar licenças ocupadas/disponíveis, tratamento de cancelamento/suspensão e risco de duplicidade com o portal ID anterior. Não habilitar esses controles apenas por instalar a nova interface.
- O painel oferece agora **Cadastrar e ativar**: após preencher nome e CPF, o frontend grava no D1, chama uma única vez o envio SDK protegido no Worker e consulta o plano 345. Se o envio ou a confirmação ficarem inconclusivos, o cadastro fica salvo localmente e **não ocorre reenvio automático**.
- **Salvar apenas** continua disponível para cadastro local sem consumir licença. O painel é responsivo para computadores e celulares.
- A ativação e as consultas dependem da resposta externa da Médiquo, por isso podem levar alguns segundos. Se a resposta falhar, a operação não deve ser repetida sem primeiro consultar o status do paciente existente.
- O painel mantém autenticação administrativa e segurança do backend. A interface simplificada não cria acesso público para incluir pacientes.
