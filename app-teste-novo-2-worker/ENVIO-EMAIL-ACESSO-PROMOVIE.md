# PromoVie | Envio de código pessoal diretamente ao beneficiário

## Fluxo solicitado

1. O gestor cadastra nome, CPF, telefone e **e-mail do beneficiário** em `/telesaude/gestao/` e seleciona **Cadastrar e ativar**.
2. O sistema somente emite código após confirmar a licença do plano 345 como ativa.
3. O Worker cria um código aleatório, envia-o diretamente ao e-mail cadastrado usando serviço transacional e salva **somente o HMAC** no D1.
4. O código **nunca aparece no gerenciador**, não é incluído na resposta HTTP administrativa, não fica gravado em texto e não é enviado para o Gmail do gestor.
5. A tela de gestão confirma apenas que o serviço externo **aceitou a solicitação de envio**, não que o e-mail chegou ao destinatário.
6. Se o serviço estiver desligado, sem chave, sem endereço válido ou falhar, **nenhum código novo é emitido ou substituído**. Um código anteriormente ativo continua válido. O gestor pode solicitar novo envio quando o problema for resolvido.

O cadastro pode ser salvo como **rascunho** sem e-mail; é necessário endereço válido para enviar o acesso após ativação. Para um beneficiário já ativo, o gestor pode selecionar **Enviar novo código por e-mail**, sem enxergar o código.

## Serviço de envio e custo

- O Cloudflare Email Routing é somente encaminhamento de e-mails recebidos, **não envia mensagens aos beneficiários**.
- O serviço de envio implementado é o Resend, cuja conta Free oferece limites gratuitos sujeitos a atualização pelo fornecedor: https://resend.com/pricing
- **Nenhuma conta foi criada e nenhum serviço pago foi contratado.** O envio permanece desligado até configuração pelo responsável.

## Configuração necessária

1. Criar conta Free em https://resend.com.
2. Verificar o domínio `promovie.tv.br` (ou subdomínio apropriado) no Resend e incluir somente os registros DNS solicitados para envio, sem mudar registros do GitHub Pages ou da Médiquo.
3. Criar chave de API restrita a envio, sem publicar o valor em GitHub, HTML, chat ou logs.
4. Em Cloudflare Workers > `promovie-mediquo-teste-2` > Settings > Variables and Secrets:
   - `RESEND_API_KEY`: secret;
   - `PROMOVIE_ACCESS_EMAIL_FROM`: remetente autorizado, como `TeleSaúde PromoVie <acessotelesaude@promovie.tv.br>`;
   - `PROMOVIE_ACCESS_EMAIL_ENABLED=true`, **somente após** o remetente estar verificado e os testes aprovados.
5. Validar em teste simulado e, com autorização, usar um beneficiário de teste já ativo com e-mail controlado; conferir aceite de API e efetivo recebimento.
6. Não alterar integração Médiquo, plano 345, SDK, tokens, DNS principal, dados clínicos nem habilitação de escrita de novos pacientes.

## Mensagem enviada

Assunto: **Seu acesso à TeleSaúde PromoVie**

> Olá, [primeiro nome]!
>
> Seu acesso à TeleSaúde PromoVie está disponível.
>
> Acesse: https://www.promovie.tv.br/telesaude/
>
> Identificação: seu CPF cadastrado
>
> Código pessoal: [código gerado]
>
> Guarde seu código com segurança e não o compartilhe.
>
> PromoVie

## Observações de segurança

- E-mail comum **não oferece sigilo absoluto**: o titular, quem controlar a caixa de entrada e eventualmente administradores do provedor de envio podem ter acesso ao conteúdo. O código não fica visível no painel PromoVie, mas trafega no provedor de e-mail.
- Não incluir CPF completo, chave do SDK, dados clínicos nem senha administrativa no e-mail.
- Para um nível mais elevado de sigilo, a evolução futura pode ser um link único de ativação com definição de código pelo próprio titular. **Esta evolução não faz parte desta alteração.**
- Não enviar códigos a beneficiários reais durante testes sem autorização.
