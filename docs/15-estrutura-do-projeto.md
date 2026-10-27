# 15 · Estrutura do projeto

Organização **por domínio dentro de camadas**: cada módulo de negócio (jornada, corrida, usuário…)
mantém junto o seu esquema de validação, seu caso de uso, seu repositório e seus componentes. Isso
evita a dispersão típica de projetos organizados só por tipo de arquivo, em que uma alteração em
"corrida" toca sete pastas distantes.

```
bordo/
├── .env.example                  # todas as variáveis, sem valores reais (RNF005)
├── .github/workflows/ci.yml      # lint → tipos → testes → build
├── docker-compose.yml            # app + postgres + proxy
├── Dockerfile
├── prisma/
│   ├── schema.prisma             # modelo de dados (doc 12)
│   ├── migrations/               # migrações versionadas
│   └── seed.ts                   # admin inicial, configurações padrão, dados de homologação
├── public/
│   ├── manifest.webmanifest      # PWA
│   ├── icons/
│   └── modelos/                  # modelos .xlsx de importação
├── docs/                         # esta documentação
└── src/
    ├── app/                                  # rotas (Next.js App Router)
    │   ├── layout.tsx
    │   ├── (publico)/
    │   │   └── login/page.tsx
    │   ├── (autenticado)/
    │   │   ├── layout.tsx                    # exige sessão
    │   │   ├── trocar-senha/page.tsx
    │   │   ├── privacidade/aceite/page.tsx
    │   │   ├── perfil/page.tsx
    │   │   ├── app/                          # ÁREA DO MOTORISTA
    │   │   │   ├── layout.tsx                # exige perfil MOTORISTA ou ADMIN
    │   │   │   ├── page.tsx                  # T04 Meu dia
    │   │   │   ├── jornada/abrir/page.tsx
    │   │   │   ├── jornada/encerrar/page.tsx
    │   │   │   ├── corrida/iniciar/page.tsx
    │   │   │   ├── corrida/[id]/page.tsx
    │   │   │   ├── corrida/[id]/encerrar/page.tsx
    │   │   │   ├── ocorrencia/nova/page.tsx
    │   │   │   ├── resumo/[data]/page.tsx
    │   │   │   └── historico/page.tsx
    │   │   └── admin/                        # ÁREA ADMINISTRATIVA
    │   │       ├── layout.tsx                # exige perfil ADMIN
    │   │       ├── page.tsx                  # T14 Dashboard
    │   │       ├── jornadas/{page,[id]/page}.tsx
    │   │       ├── corridas/{page,[id]/page}.tsx
    │   │       ├── usuarios/{page,novo/page,[id]/page}.tsx
    │   │       ├── veiculos/{page,novo/page,[id]/page}.tsx
    │   │       ├── rotas/{page,novo/page,[id]/page}.tsx
    │   │       ├── relatorios/page.tsx
    │   │       ├── arquivos/page.tsx
    │   │       ├── importar/page.tsx
    │   │       ├── notificacoes/page.tsx
    │   │       ├── auditoria/page.tsx
    │   │       └── configuracoes/page.tsx
    │   ├── api/                              # contratos HTTP (doc 16)
    │   │   ├── auth/login/route.ts          # CPF + senha, sessão própria
    │   │   ├── auth/logout/route.ts
    │   │   ├── auth/trocar-senha/route.ts
    │   │   ├── jornadas/route.ts
    │   │   ├── jornadas/[id]/encerrar/route.ts
    │   │   ├── corridas/…
    │   │   ├── sincronizacao/route.ts        # fila offline
    │   │   ├── arquivos/[id]/download/route.ts
    │   │   └── health/route.ts
    │   ├── 403/page.tsx
    │   ├── not-found.tsx
    │   └── error.tsx
    │
    ├── modulos/                              # NÚCLEO — um diretório por domínio
    │   ├── usuario/
    │   │   ├── usuario.schema.ts             # Zod: entrada e saída
    │   │   ├── usuario.tipos.ts
    │   │   ├── usuario.regras.ts             # RN001–RN011, puras e testáveis
    │   │   ├── usuario.repositorio.ts        # único ponto com Prisma
    │   │   ├── usuario.servico.ts            # casos de uso
    │   │   ├── usuario.acoes.ts              # Server Actions
    │   │   └── componentes/
    │   │       ├── FormularioUsuario.tsx
    │   │       └── TabelaUsuarios.tsx
    │   ├── autenticacao/
    │   ├── veiculo/
    │   ├── rota/
    │   ├── jornada/
    │   │   ├── jornada.regras.ts             # RN012–RN020: odômetro, totais, transições
    │   │   └── …
    │   ├── corrida/
    │   ├── localizacao/
    │   ├── ocorrencia/
    │   ├── relatorio/
    │   │   ├── relatorio.servico.ts
    │   │   └── planilhas/                    # um construtor .xlsx por tipo
    │   ├── importacao/
    │   ├── notificacao/
    │   │   ├── notificacao.servico.ts
    │   │   └── canais/
    │   │       ├── whatsapp-link.ts          # MVP (V-05a)
    │   │       └── whatsapp-cloud-api.ts     # evolução (V-05b)
    │   ├── auditoria/
    │   │   └── auditoria.servico.ts          # ponto único de escrita (RF037)
    │   └── configuracao/
    │
    ├── componentes/                          # UI compartilhada, sem regra de negócio
    │   ├── ui/                               # shadcn/ui (button, input, dialog, table…)
    │   ├── layout/                           # MenuLateral, Cabecalho, NavegacaoInferior
    │   ├── dados/                            # TabelaPaginada, BarraFiltros, EstadoVazio, Skeleton
    │   ├── formulario/                       # CampoTexto, CampoNumerico, CampoCpf, CampoData
    │   ├── mapa/                             # MapaTrajeto, SeletorCoordenada
    │   └── feedback/                         # ModalConfirmacao, Toast, MensagemErro
    │
    ├── lib/                                  # infraestrutura transversal
    │   ├── prisma.ts                         # instância única do client
    │   ├── sessao.ts                         # token opaco, cookie e sessão em banco
    │   ├── senha.ts                          # hash Argon2id e senha temporária
    │   ├── autorizacao.ts                    # exigirSessao(), exigirPerfil(), exigirEscopo()
    │   ├── acao-segura.ts                    # wrapper: sessão → permissão → validação → transação → auditoria
    │   ├── erros.ts                          # ErroDeNegocio, ErroDeValidacao, ErroDePermissao (doc 18)
    │   ├── armazenamento.ts                 # implementações local e S3
    │   ├── excel/                            # utilitários ExcelJS
    │   ├── fila/                             # pg-boss: registro e definição das tarefas
    │   ├── logger.ts                         # logs estruturados sem dado pessoal
    │   └── env.ts                            # validação das variáveis de ambiente na inicialização
    │
    ├── utilitarios/
    │   ├── cpf.ts                            # validação, máscara, normalização
    │   ├── data.ts                           # fuso America/Sao_Paulo, formatação pt-BR
    │   ├── numero.ts                         # km, litros, formatação
    │   ├── placa.ts
    │   └── geo.ts                            # distância, formatação de coordenada
    │
    ├── offline/                              # PWA e sincronização (RF022)
    │   ├── service-worker.ts
    │   ├── fila-local.ts                     # IndexedDB
    │   └── sincronizador.ts
    │
    ├── estilos/
    │   ├── globals.css
    │   └── tema.ts                           # tokens de cor e tipografia (doc 11)
    │
    ├── tipos/
    │   ├── sessao.d.ts
    │   └── api.ts                            # contratos de resposta compartilhados
    │
    └── middleware.ts                         # proteção de rota por perfil (RF041)

tests/
├── unitarios/          # Vitest: regras e serviços
├── integracao/         # contratos HTTP e proteções, com banco descartável
└── ponta-a-ponta/      # roteiros HTTP com sessões reais de admin e motorista
```

## Regras de organização

1. **Prisma só dentro de `*.repositorio.ts`.** Nenhum componente, action ou rota importa o client
   diretamente — isso mantém a troca de ORM e os testes viáveis.
2. **Regra de negócio só em `*.regras.ts`**, em funções puras, sem acesso a banco, HTTP ou data
   do sistema (o "agora" é sempre recebido por parâmetro). São elas que os testes unitários cobrem.
3. **Toda mutação passa por `acao-segura.ts`.** É o que torna a auditoria (RF037) e a autorização
   (RF041) estruturais, não dependentes de lembrança.
4. **`componentes/` não conhece domínio.** Se um componente precisa saber o que é uma "corrida",
   ele pertence a `modulos/corrida/componentes/`.
5. **Nada de `utils.ts` genérico.** Cada utilitário tem nome de assunto.
6. **Um esquema Zod por entrada**, exportado do módulo e reutilizado no formulário, na action e na rota
   de API — nunca duplicado.
7. **Nomes de arquivos e pastas em português**, acompanhando o domínio e a linguagem do cliente;
   palavras-chave da linguagem e nomes de bibliotecas permanecem em inglês.
