# 35 · Fechamento do mês

Itens 2 a 7 das observações do cliente de 07/10/2026 (levantamento no doc 34):
hora extra, km excedido, pedágio, feriados, ciclo do dia 16 ao dia 15 e
boletim de medição. O sistema passa a fazer as duas planilhas que a empresa
montava à mão — `Relatorio HE` e `BM` —, no mesmo desenho.

## Regras confirmadas

Confirmadas pelo Pedro com o cliente em 07/10/2026. Todas ficam em
**Configurações → Fechamento do mês** e podem mudar sem deploy.

| Regra | Valor |
| --- | --- |
| Ciclo | Do dia 16 ao dia 15 do mês seguinte (`ciclo_dia_inicio`). |
| Hora extra | **Diária** de R$ 105,00 por dia com hora extra, uma vez por dia. Não é por hora: os minutos aparecem na planilha só para conferência. |
| Quando há hora extra | Entrou antes das 06:00 **ou** saiu depois do horário (`he_exige_ambas = não`). **Sem tolerância:** um minuto antes ou depois já conta (confirmado em 07/10). |
| Saída de referência | 18:00 de segunda a quinta; 17:00 de sexta a domingo; 17:00 em feriado. |
| Turno da noite | 18:00 às 07:00 do dia seguinte. Vale para quem está escalado no turno NOITE ou dirige uma van com categoria "Van noturna". |
| Km excedido do motorista | R$ 3,00 por km acima de 130 km **no dia**, pela diferença dos odômetros do dia **menos o km rodado entre uma corrida e outra** (ver abaixo). |
| Valor do dia no boletim | Valor mensal da van ÷ 22 (`medicao_divisor`). |
| Dia extra no boletim | Sábado, domingo e feriado cadastrado. |

Duas jornadas do mesmo motorista no mesmo dia (manhã e tarde, troca de van)
viram **um dia**: uma diária, o km somado contra um limite só.

**Km fora das corridas não conta** (cliente, 09/10/2026). Cada corrida começa
no odômetro em que a anterior terminou, então só sobra km entre duas corridas
quando o fim de uma é corrigido para baixo depois de a seguinte começar — o
caso de 08/10, em que o motorista lançou numa corrida os 65 km que rodou fora
de serviço — ou quando outro dia mexeu no odômetro da van no meio deste. Esse
km sai do dia no pagamento e no boletim. O trecho depois da última corrida
(volta à base até encerrar o dia) continua contando. Para descontar, o
administrador corrige a corrida em **Corridas → Corrigir esta corrida**; a
correção também refaz o km e os passageiros guardados do dia encerrado.

## Onde fica cada coisa

- **Feriados** (`/admin/feriados`): cadastro por ano, com botão que acrescenta
  os nacionais (fixos e Sexta-feira Santa). Carnaval e Corpus Christi são ponto
  facultativo e ficam de fora — cadastre à mão se forem folga.
- **Contrato da van** (tela do veículo): cliente, categoria do boletim (ônibus,
  van diurna, van noturna), valor mensal, valor do km excedido, valor do dia
  extra, km incluídos por dia (vazio usa os 130 das configurações) e a linha.
  Fica na trilha de auditoria, antes e depois.
- **Pedágio** (`/app/pedagio`, link "Registrar pedágio" na tela inicial do
  motorista com o dia aberto): valor, forma de pagamento (dinheiro, cartão,
  TAG) e praça opcional. Fica preso à jornada e à van. **Só com sinal** — não
  entra na fila sem conexão.
- **Fechamento do mês** (`/admin/fechamento`, só administrador): escolhe o
  período, mostra os avisos (vans sem contrato, dias abertos, horários a
  conferir), o pagamento por motorista, o resumo do boletim e as planilhas já
  geradas. "Gerar planilhas" cria as duas de novo a cada clique, sem apagar as
  anteriores.
- **Painel**: cartões "Motoristas com hora extra" (com o valor das diárias) e
  "Pedágios no dia", que levam ao fechamento do período daquele dia.

## Guia ilustrado

`public/guias/guia-fechamento-mes-bordo.pdf` (9 páginas, com capturas da tela e
a reprodução das duas planilhas, usando dados de exemplo). Abre pelo "Como fazer" da
tela Fechamento do mês e em Como usar. **Só com login**, ao contrário dos guias de
instalação: traz as regras de pagamento. Montado por script a partir de capturas do
Edge sem janela contra o banco de desenvolvimento; o cenário de exemplo foi apagado
depois.

## As planilhas

**Pagamento dos motoristas** — abas Resumo (por motorista), Hora extra, Km
excedente e Identificação (regras usadas, quem gerou e quando). A aba Hora extra
tem **as mesmas 16 colunas do `Relatorio HE`, na mesma ordem**: DATA, PLACA,
MOTORISTA, TIPO VEÍCULO (ÔNIBUS ou VAN), ORIGEM, CANTEIRO, TURNO, H. REF.
INICIAL, H. INICIAL, HE INICIAL, H. REF. FINAL, H. FINAL, HE FINAL, TOTAL HE,
VLR HE e VLR TOTAL — mais CONFERIR no fim. Com a regra nova, VLR HE é a diária e
VLR TOTAL é a diária quando o dia teve hora extra (antes: preço da hora e horas
× preço). Subtotal por motorista, TOTAL GERAL, filtro no cabeçalho e impressão
em A4 deitado. Diferença: o `Relatorio HE` tinha uma linha para cada dia do
período; aqui só entram os dias trabalhados. ORIGEM e CANTEIRO vêm da linha do
contrato da van.

**Boletim de medição** — aba Boletim no formato do `BM`. Cabeçalho como o do
BM: razão social ao centro, CONTRATO e PERÍODO à direita (Configurações → Razão
social e Número do contrato no boletim). Um bloco por van com Nº, PLACA, LINHA,
EMPRESA (o cliente do contrato da van), DESCRIÇÃO DAS LINHAS, os dias do ciclo
nas colunas e as linhas NORMAL, KM EXCEDIDO e EXTRA S/D/F, com TOTAL, VALOR
UNITÁRIO, VALOR DIA e VALOR MEDIÇÃO; na última linha do bloco, o motorista, o
destino e a categoria. Sábado, domingo e feriado destacados no cabeçalho. No pé,
o quadro por categoria, **horas extras**, **pedágios** e o **TOTAL GERAL MEDIÇÃO
= veículos + horas extras + pedágios**, como no BM atual. A célula de horas
extras vem com as diárias do período e pode ser ajustada à mão antes de enviar.
Impressão em A3 deitado, com o cabeçalho em toda página, como o BM. Abas
Pedágios, Pendências e Identificação.

As planilhas usam fórmulas, como as do cliente, e recalculam ao abrir.

## Geração automática

No dia `ciclo_dia_inicio` (16), às **8h** de São Paulo, o cron gera as duas
planilhas do período que terminou na véspera e avisa os administradores
(notificação interna "Arquivo pronto"). Às 8h e não à meia-noite porque o turno
da noite só termina às 7h. Uma segunda passagem na mesma hora reconhece o aviso
já dado e não gera de novo.

## Horário do celular

Abrir ou encerrar o dia sem sinal guarda o horário do aparelho, dentro de
limites (até 2 minutos no futuro, até 48 horas de atraso, nunca antes do
início). A jornada fica marcada, e o fechamento põe esse dia em "conferir".
Dia encerrado só no dia seguinte também vai para conferência: o horário do
encerramento não é o fim real do trabalho.

## O que ficou de fora

- **Diferença com o Resumo do dia:** o "Total do dia" do diário soma o km das
  viagens; o fechamento usa a diferença do odômetro (regra confirmada). Num dia
  com trajeto fora de viagem registrada, os dois números diferem.
- O BM atual cobra horas extras e pedágios de um período anterior ("01/07 a
  15/07" num BM de 16/07 a 15/08). Aqui os dois são do mesmo período do
  boletim; se o cliente quiser a defasagem, ajuste a célula.
- O valor de hora extra cobrado do cliente pode não ser o mesmo pago ao
  motorista (o `Relatorio HE` usava R$ 150/h). O boletim sai com as diárias.

## Dados

Migração `20261007120000_fechamento_mensal` (aditiva): tabela `feriado`, tabela
`pedagio`, colunas de contrato em `veiculo`, `inicio_pelo_aparelho` e
`fim_pelo_aparelho` em `jornada`, e o tipo de arquivo `FECHAMENTO_MENSAL`
(download só para administrador).
