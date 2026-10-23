# Produção do DocFlow

Publicação concluída em 23/10/2026.

- Endereço: https://docflow-pedro-portal.wittybean130.chatgpt.site
- Código da aplicação no GitHub: `54190dc4d3c11acc82dfc2a4163488383d57070e`.
- Versão publicada no Sites: **6**.
- Recursos: tipos de solicitação, vários anexos, revisão, correção e reenvio com histórico, relatórios CSV e preparação de avisos por e-mail.

## Contas reais

Na versão publicada, o acesso ocorre por **Entrar com ChatGPT**, usando a conta real do visitante. O solicitante completa seu cadastro e acessa somente os próprios pedidos. A conta administradora é determinada pelo segredo de servidor `ADMIN_EMAIL`, já configurado na hospedagem.

O seletor de administrador e solicitante fictícios pertence exclusivamente ao ambiente de desenvolvimento. A compilação de produção foi verificada e não inclui o seletor ou o middleware de sessões de teste.

## Dados

O banco D1 e o bucket R2 da hospedagem existente foram mantidos. A migração `0002_eager_randall.sql` acrescenta histórico e controles de versão; não contém comandos de exclusão de registros. Migrações anteriores permanecem inalteradas.

Codespaces e produção usam bancos e arquivos separados. Dados fictícios dos testes locais não foram copiados para a hospedagem. Em produção, decisões já sobrescritas antes do recurso de histórico não podem ser reconstruídas; a última situação conhecida serve como ponto inicial.

## Verificações realizadas

- Testes locais da API com SQLite em memória e arquivos simulados: permissões, anexos obrigatórios, revisão, reenvio, histórico e isolamento entre contas.
- Testes do seletor de desenvolvimento, geração de aviso por e-mail e relatórios CSV.
- Checagem de tipos e compilação.
- Migração testada sobre um banco com perfis, pedido, anexo e recusa preexistentes.
- Publicação confirmada pelo serviço de hospedagem.

O teste interativo completo com duas contas ChatGPT reais continua necessário: entre como solicitante, envie um arquivo fictício e confirme a análise com a conta administradora. Nenhuma conta real foi acessada em nome do usuário durante esta publicação.

## Próximas atualizações

Um push no GitHub executa a CI, mas não publica automaticamente no Sites. Para atualizar a hospedagem, prepare e teste a versão, sincronize o código com o repositório de origem do Sites, gere o pacote da aplicação e publique uma versão salva. Preserve o mesmo `project_id`, os bindings `DB` e `BUCKET` e os segredos já configurados.

O botão de e-mail prepara a mensagem para revisão e envio manual no aplicativo configurado. Esta publicação não ativa envio automático de e-mails.
