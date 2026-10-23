# DocFlow

Sistema web para cadastro, envio e análise de documentos, com interface em português.

**Site atual:** https://docflow-pedro-portal.wittybean130.chatgpt.site

## Recursos

- Login com ChatGPT e cadastro de perfil.
- Tipos de solicitação editáveis pelo administrador, com documentos obrigatórios.
- Vários anexos em um protocolo: PDF, JPG ou PNG, até 10 MB por arquivo e 30 MB por solicitação.
- Aprovação e recusa com observações, filtros e download dos anexos.
- Isolamento de documentos por usuário; administração definida por `ADMIN_EMAIL` no servidor.
- Botão para preparar aviso de resultado no aplicativo de e-mail. O administrador revisa e envia; não há envio automático.

## Tecnologias

React 19, TypeScript, Vinext/Vite, Cloudflare Workers, D1 (SQLite), R2 e Drizzle para migrações. A autenticação de produção é fornecida pelo Sites.

## Desenvolvimento local

Use Node.js 24 e pnpm 11.25.0, conforme `packageManager` em `package.json`.

```bash
git clone https://github.com/pedrogabrielsilva1918/DocFlow.git
cd DocFlow
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm build
```

Na **primeira execução em um banco local vazio**, aplique as migrações em ordem:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_melodic_mikhail_rasputin.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_futuristic_miss_america.sql
pnpm dev
```

Abra `http://localhost:5173`. Se aparecer o login, clique em **Entrar com ChatGPT**: o ambiente local usa a identidade de teste `seedy@sites.test`. O arquivo `.dev.vars.example` usa esse mesmo e-mail para permitir testar a administração. Essa simulação funciona em desenvolvimento em loopback e no endereço exato do Codespace configurado; não é a autenticação de produção.

Não reaplique os arquivos SQL sobre um banco já inicializado. Os dados locais ficam em `.wrangler/`, separados dos dados publicados. Novas mudanças de schema devem gerar uma nova migração com `pnpm db:generate`.

## Verificação

```bash
pnpm typecheck
pnpm test
pnpm build
```

Os testes de solicitações executam a API com SQLite local em memória e armazenamento de arquivos simulado. Verificam documentos obrigatórios, permissões, aprovação, preservação de envios antigos e tipos personalizados. Os testes de e-mail verificam destinatário, protocolo, resultado e codificação da mensagem; não enviam mensagens.

O workflow `.github/workflows/ci.yml` executa as mesmas verificações em pushes e pull requests.

## Configuração e publicação

- `ADMIN_EMAIL`: e-mail da conta administradora; configure como segredo no servidor. Não coloque o valor de produção no repositório.
- `DB`: binding D1; guarda perfis, solicitações, anexos e tipos de solicitação.
- `BUCKET`: binding R2; guarda os arquivos.
- `.openai/hosting.json`: identidade da hospedagem atual e nomes dos bindings; não contém credenciais.

O código depende da identidade autenticada encaminhada pelo Sites. **Publicar o Worker diretamente em outra hospedagem exige adaptar e validar a autenticação na borda**; os cabeçalhos de identidade não devem ser aceitos diretamente de visitantes.

O GitHub guarda o código. Um push neste repositório não publica automaticamente no site atual: a publicação continua pelo fluxo do Sites. Consulte [a documentação de infraestrutura](docs/infraestrutura-sites.md) para detalhes do runtime.

## Organização

| Caminho | Responsabilidade |
| --- | --- |
| `app/portal.tsx` | Painel do usuário e administração |
| `app/request-forms.tsx` | Formulários de tipos e anexos |
| `app/api/portal/route.ts` | API e autorização |
| `lib/request-types.ts` | Tipos iniciais e validação |
| `lib/email-notice.ts` | Mensagem de aviso por e-mail |
| `db/` e `drizzle/` | Schema e migrações |
| `scripts/test-*.mjs` | Testes locais |

As configurações salvas, os perfis e os arquivos enviados estão no banco e no armazenamento da hospedagem. Não fazem parte deste repositório.

## GitHub Codespaces

No terminal do Codespaces, após instalar as dependências, configurar `.dev.vars` e inicializar o banco conforme os passos acima:

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm dev
```

Abra **PORTS → 5173 → Abrir no navegador** e mantenha a visibilidade **Private**. O servidor reconhece o endereço do Codespace a partir de `CODESPACE_NAME` e `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`, aceita apenas esse host e abre a interface na rede do contêiner automaticamente.

Nesse ambiente, **Entrar com ChatGPT** usa uma conta de teste compartilhada (`seedy@sites.test`), sem pedir senha ou conectar uma conta real. Complete **Meu cadastro** para experimentar o fluxo. Use arquivos fictícios; o isolamento de usuários reais deve ser testado no site publicado. O mock não é incluído na autenticação de produção.

Se você já executou as duas migrações manualmente, não as execute novamente. Ao reiniciar o Codespace, use apenas `pnpm dev`. Não use `pnpm start` para essa simulação, pois ele serve o build sem o middleware de login de desenvolvimento.
