# 11 · UX/UI

> Base nas respostas do cliente: estilo **"minimalista, simples"**, sem referência visual externa,
> logo existente ⚠️ *(V-18)*, funcionamento em **celular, tablet e computador**.

---

## Princípio condutor

**O motorista tem 15 segundos e uma mão livre.**

O sistema falha se registrar der mais trabalho que não registrar. Por isso, na área do motorista:
uma ação principal por tela, botões grandes, nenhum campo que o sistema possa preencher sozinho e
nenhuma navegação em profundidade. Na área administrativa, o princípio se inverte: densidade de
informação, filtros à mão e exportação sempre visível.

## Estilo visual

**Tom:** funcional e sóbrio. Interface de trabalho, não de vitrine. Sem ilustrações decorativas,
sem gradientes, sem sombras pesadas.

**Cores** — paleta provisória neutra até o recebimento da identidade visual ⚠️ *(V-18)*:

| Papel | Claro | Escuro | Uso |
|---|---|---|---|
| Fundo | `#FFFFFF` | `#0F1115` | Base da página |
| Superfície | `#F6F7F9` | `#171A20` | Cards, tabelas, cabeçalhos |
| Borda | `#E2E5EA` | `#2A2F38` | Separadores |
| Texto principal | `#12151A` | `#F2F4F7` | Conteúdo |
| Texto secundário | `#5A6270` | `#9AA3B2` | Rótulos e apoio |
| Ação primária | `#1D4ED8` | `#3B82F6` | Botão principal, links |
| Sucesso | `#15803D` | `#22C55E` | Confirmações, jornada encerrada |
| Atenção | `#B45309` | `#F59E0B` | Pendências, divergências |
| Erro | `#B91C1C` | `#EF4444` | Erros, ações destrutivas |
| Em andamento | `#7C3AED` | `#A78BFA` | Corrida ativa |

Regra: **estado nunca é comunicado só por cor** — sempre acompanha rótulo textual ou ícone (RNF022).

**Tipografia:** uma única família sem serifa de alta legibilidade (Inter, com fallback para a fonte
do sistema). Escala: 12 / 14 / 16 / 20 / 24 / 32 px. No mobile, o corpo mínimo é 16 px — abaixo
disso o iOS aplica zoom automático nos campos.

**Espaçamento:** grade de 4 px (4, 8, 12, 16, 24, 32, 48). Raio de borda 8 px. Uma única elevação
sutil para cards; modais com sobreposição escurecida.

**Ícones:** conjunto único, traço uniforme (Lucide), sempre acompanhados de rótulo em ações críticas.

## Hierarquia

1. **Uma ação primária por tela.** Botão preenchido, largura total no mobile. Ações secundárias em
   contorno; ações destrutivas em vermelho e nunca adjacentes à primária.
2. **O estado do dia é o herói** na tela do motorista: ocupa o topo, com tipografia grande.
3. **Números antes de rótulos** nos indicadores do dashboard: valor em destaque, descrição abaixo.
4. **Tabelas administrativas** com cabeçalho fixo, zebra sutil, alinhamento à direita para números.

## Navegação

| Contexto | Padrão |
|---|---|
| Motorista (mobile) | Sem menu lateral. Cabeçalho com data e avatar; no máximo 3 destinos na barra inferior: **Meu dia**, **Histórico**, **Perfil**. Profundidade máxima de 2 níveis. |
| Administrador (desktop) | Menu lateral fixo agrupado: *Operação* (Dashboard, Jornadas, Corridas), *Cadastros* (Usuários, Veículos, Rotas), *Saídas* (Relatórios, Arquivos, Importação), *Sistema* (Notificações, Auditoria, Configurações). |
| Administrador (tablet/mobile) | Menu lateral recolhido em gaveta; tabelas convertidas em cartões. |
| Retorno | Toda tela de detalhe tem "voltar" explícito que preserva os filtros da listagem de origem. |

## Responsividade

| Faixa | Comportamento |
|---|---|
| < 480 px | Coluna única; botões em largura total; tabelas viram cartões; barra inferior de navegação |
| 480–768 px | Coluna única com mais respiro; cards de indicadores em 2 colunas |
| 768–1024 px | Menu em gaveta; grades de 2 colunas; tabelas com rolagem horizontal contida |
| > 1024 px | Menu lateral fixo; grades de 3–4 colunas; tabelas completas |

Nenhuma tela pode gerar rolagem horizontal na página. Conteúdo largo (tabela, mapa) rola dentro do
próprio contêiner.

## Feedback de ações

- **Imediato (< 100 ms):** estado visual do controle (pressionado, desabilitado).
- **Curto (< 1 s):** botão entra em estado de carregamento com rótulo "Salvando…" e permanece
  desabilitado para evitar duplo envio.
- **Concluído:** *toast* de sucesso de 3 segundos, no topo em desktop e na base em mobile, com texto
  específico ("Corrida encerrada. 12,4 km registrados").
- **Atualização otimista** apenas em ações reversíveis (marcar parada); ações irreversíveis aguardam
  a confirmação do servidor.

## Estados de carregamento

- Listas e cards: **skeleton** com a mesma forma do conteúdo final — nunca tela branca ou *spinner* solto.
- Navegação entre telas: barra de progresso fina no topo.
- Ações longas (exportação): modal com progresso e a possibilidade de continuar usando o sistema,
  com aviso de que o arquivo ficará disponível em "Arquivos gerados".
- Mapa: área com dimensão reservada antes de carregar, para não deslocar o layout.

## Estados vazios

Cada estado vazio precisa dizer **o que aconteceu**, **por quê** e **qual é a próxima ação**:

| Situação | Texto | Ação |
|---|---|---|
| Motorista sem jornada | "Você ainda não iniciou seu dia." | Botão "Iniciar meu dia" |
| Jornada sem corridas | "Nenhuma corrida registrada ainda." | Botão "Iniciar corrida" |
| Dashboard sem movimento | "Nenhuma operação registrada hoje." | Link para dias anteriores |
| Filtro sem resultado | "Nenhum resultado para os filtros aplicados." | Botão "Limpar filtros" |
| Sem cadastro | "Nenhum veículo cadastrado." | Botão "Cadastrar veículo" |
| Corrida sem GPS | "Sem localização registrada nesta corrida." | Explicação do motivo |

Distinguir sempre "não existe nada" de "o filtro não encontrou nada" — são problemas diferentes.

## Mensagens de erro

Padrão de escrita: **o que houve → por que → o que fazer**. Sem termos técnicos, sem código de erro
visível ao usuário final (exceto o identificador de suporte na tela 500).

| Situação | Mensagem |
|---|---|
| Campo obrigatório | "Informe o odômetro inicial." |
| Odômetro menor que o anterior | "O odômetro não pode ser menor que 84.320 km, último valor registrado para esta van." |
| Corrida já aberta | "Você já tem uma corrida em andamento. Encerre-a para iniciar outra." |
| Sem conexão | "Sem conexão. Seu registro foi salvo no aparelho e será enviado automaticamente." |
| Permissão negada | "Você não tem acesso a esta área." |
| Erro do servidor | "Não conseguimos concluir agora. Tente novamente em alguns instantes." |

Erros de formulário aparecem **junto ao campo**, em vermelho, com o foco levado ao primeiro campo
inválido e vínculo por `aria-describedby`.

## Confirmações e modais

- Modal de confirmação **apenas** para as ações irreversíveis definidas em RN024. Excesso de modal
  treina o usuário a confirmar sem ler.
- Todo modal traz: título com o verbo da ação, descrição da consequência concreta, botão primário
  com o verbo ("Encerrar jornada" — nunca "OK") e botão de cancelar.
- Ações destrutivas de cadastro exigem confirmação com o nome do registro visível.
- O encerramento de jornada mostra o **resumo dos totais** dentro do modal — é a última chance de conferência.
- Fechamento por `Esc` e por clique fora, exceto em ações destrutivas.
- Formulário com alterações não salvas alerta antes de sair.

## Acessibilidade

- Contraste mínimo 4,5:1 para texto e 3:1 para elementos gráficos.
- Alvos de toque de no mínimo **44 × 44 px** na área do motorista.
- Navegação completa por teclado, com foco visível e ordem lógica; modal com foco preso e retorno ao
  gatilho ao fechar.
- Todo campo tem rótulo associado — `placeholder` nunca substitui rótulo.
- Mensagens de status anunciadas por `aria-live` para leitores de tela.
- Ícones sem texto recebem rótulo acessível.
- A interface respeita `prefers-reduced-motion`.
- O sistema funciona com zoom de 200% sem perda de conteúdo.

## Padrões específicos do produto

**Cartão de corrida em andamento:** borda colorida à esquerda, cronômetro em tempo real, rota em
destaque, botão de encerrar fixo na base da tela (*sticky*), fora do alcance acidental do polegar
ao rolar.

**Indicador de sincronização:** faixa discreta e permanente no topo da área do motorista —
"Sincronizado" em cinza, "3 registros pendentes" em âmbar, "Sem conexão" em cinza escuro. Nunca
bloqueia a tela.

**Campos numéricos operacionais** (odômetro, passageiros): `inputmode="numeric"`, tamanho de fonte
ampliado, sem setas de incremento, com o último valor conhecido exibido como referência abaixo do campo.

**Seleção de rota:** lista com as rotas mais usadas pelo motorista no topo, busca sempre visível,
item com origem → destino em uma linha e turno como etiqueta.

**Marcação "editado":** registros alterados exibem etiqueta discreta com autor e data, clicável para
abrir o histórico — transparência sem poluir a leitura.
