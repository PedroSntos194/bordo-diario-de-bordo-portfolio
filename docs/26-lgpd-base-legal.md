# 26 · Base legal e registro de tratamento (V-09)

> **O que este documento é.** O inventário técnico do que o Bordo coleta, por
> que coleta, onde guarda e por quanto tempo — escrito para que a assessoria
> jurídica **revise e decida**, não para substituí-la.
>
> **O que este documento não é.** Uma opinião jurídica. Quem desenvolve o
> sistema descreve o comportamento dele; quem define base legal é o
> controlador, com apoio jurídico. As recomendações abaixo estão marcadas como
> tais e existem para dar um ponto de partida ao debate, não para encerrá-lo.

**Pendência V-09 · bloqueia o go-live.** Sem as decisões da seção 5 assinadas, o
sistema não deve entrar em produção com dados reais de pessoas reais.

---

## 1. Papéis

| Papel | Quem | Observação |
|---|---|---|
| **Controlador** | A empresa de transporte | Define finalidade e meios; é quem responde perante a ANPD e os titulares |
| **Operador** | — | Hoje não há. Se a hospedagem for terceirizada, o provedor é operador e exige contrato com cláusulas de tratamento |
| **Titulares** | Motoristas e administradores cadastrados | Todos são empregados ou prestadores da empresa |
| **Encarregado (DPO)** | ⚠️ **a definir** | A LGPD exige indicação e divulgação pública do contato (art. 41). Hoje o aviso de privacidade não traz nenhum |

> **Nota sobre passageiros.** O sistema registra **quantidade** de passageiros,
> nunca identidade. Nenhum dado pessoal de passageiro é coletado, e por isso
> eles não figuram como titulares. Se algum dia se quiser registrar quem
> embarcou, isso é tratamento novo e exige revisar este documento inteiro.

---

## 2. Registro das operações de tratamento

Levantado do esquema real do banco (`prisma/schema.prisma`), não da
documentação de requisitos — o que vale é o que o sistema efetivamente grava.

### 2.1 Dados cadastrais

| Dado | Tabela · campo | Finalidade | Sensível? |
|---|---|---|---|
| Nome | `usuario.nome` | Identificação nos registros e relatórios | Não |
| CPF | `usuario.cpf` | Identificação unívoca e credencial de acesso | Não, mas é identificador nacional |
| Telefone | `usuario.telefone` | Envio do resumo do dia por WhatsApp | Não |
| E-mail | `usuario.email` | Contato alternativo — **opcional, hoje não usado** | Não |
| Matrícula | `usuario.matricula` | Conciliação com o RH — **reservado, não usado (V-07)** | Não |
| CNH: número, categoria, validade | `usuario.cnh_*` | Verificar habilitação válida para dirigir | Não |
| Hash da senha | `usuario.senha_hash` | Autenticação (Argon2id, irreversível) | Credencial |

**Ponto de atenção:** `email` e `matricula` são coletáveis e **não têm uso
efetivo** no sistema. Minimização (art. 6º, III) recomenda não coletar o que
não se usa. Ver decisão **D-4**.

### 2.2 Dados de operação

| Dado | Tabela | Finalidade |
|---|---|---|
| Jornada: data, início, fim, odômetro, km | `jornada` | Controle operacional da frota |
| Corrida: rota, horários, km, passageiros | `corrida` | Registro do trajeto realizado |
| Paradas e eventos | `corrida_evento` | Detalhamento do trajeto |
| Ocorrências | `ocorrencia` | Registro de intercorrências |
| Abastecimento: litros, valor, odômetro | `abastecimento` | Custo e consumo da frota |
| Escala planejada | `escala`, `escala_rota` | Planejamento do dia |

Não são dados pessoais em si, mas **são vinculados a uma pessoa identificada**
pelo motorista da jornada — e portanto tratamento de dado pessoal.

### 2.3 Localização — o ponto crítico

| Dado | Tabela | Detalhe |
|---|---|---|
| Latitude/longitude | `ponto_localizacao.latitude`, `.longitude` | Precisão de 7 casas decimais (~1 cm) |
| Precisão informada pelo aparelho | `.precisao_metros` | |
| Momento da captura | `.capturado_em` (relógio do aparelho) e `.recebido_em` (servidor) | |
| Fonte da posição | `.origem` | GPS do aparelho, rede ou informada manualmente |
| Vínculo com a parada | `.corrida_evento_id` | Preenchido quando o ponto foi capturado numa parada; início e encerramento são reconhecidos pela ordem no tempo |

**Como funciona hoje, verificado no código:**

- a captura é **pontual**, em três momentos: início da corrida, parada
  registrada e encerramento;
- só acontece com **jornada aberta** — fora do turno, o sistema não pede
  posição;
- a recusa do motorista é **aceita**: a corrida é gravada e marcada como "sem
  localização", e nenhum registro é bloqueado por falta de GPS;
- **não há rastreamento contínuo.** O sistema não sabe onde a van está entre um
  ponto e outro.

Este é o tratamento de maior risco do sistema, e é sobre ele que a decisão
**D-1** precisa recair.

> ✅ **V-06 respondido em 29/08/2026: captura pontual, confirmada pelo cliente.**
> Rastreamento contínuo está descartado — não é o que o sistema faz nem o que o
> cliente pediu. Isso **fortalece o balanceamento**: o tratamento aqui é o de
> menor grau de intrusão possível para a finalidade, e essa é uma das perguntas
> centrais da avaliação de legítimo interesse.

### 2.4 Dados de acesso e auditoria

| Dado | Tabela | Retenção atual |
|---|---|---|
| Sessões: IP, user-agent, validade | `sessao` | Até expirar; expurgo automático |
| Trilha: quem alterou o quê, valores anterior e novo, IP | `log_auditoria` | 5 anos, **sem expurgo implementado** |
| Aceite do aviso: versão, data, IP | `aceite_privacidade` | Enquanto o vínculo existir |
| Notificações: telefone de destino e conteúdo | `notificacao` | Sem prazo definido |

**Duas lacunas aqui.** Ver decisões **D-2** e **D-5**.

### 2.5 Onde os dados vão parar fora do banco

| Destino | O que sai | Base contratual |
|---|---|---|
| **Planilhas geradas** (`.xlsx`) | Nome, veículo, rotas, horários, km, passageiros | Ficam no servidor, download autenticado |
| **WhatsApp** | Telefone do administrador e resumo do dia | ✅ **V-05 respondido: canal por link.** A mensagem é montada no aparelho de quem envia e disparada pelo app dele — **nenhum dado trafega por servidor da Meta a mando do sistema**. Some a transferência internacional e a figura de operador. Ver **D-3**, agora restrita à geocodificação |
| **Geocodificação** (Nominatim/OSM) | **Só o endereço que o administrador digita** para cadastrar uma parada de rota | ✅ **Nenhuma coordenada de motorista sai do sistema.** Conferido no código em 01/10/2026: a geocodificação reversa — coordenada → endereço — existe, mas **não está ligada a nenhuma tela**. Ligá-la passaria a enviar a posição do motorista a um terceiro no exterior. Ver **D-3** |
| **Mapa** (tiles OSM) | Requisição de área do mapa | Não envia posição do titular ao servidor de tiles |
| **Banco** (hoje Neon, São Paulo) | Tudo | Provedor é operador; região `sa-east-1` |

---

## 3. Base legal proposta — para discussão

**Recomendação técnica, sujeita a revisão jurídica.**

| Finalidade | Base sugerida | Raciocínio |
|---|---|---|
| Cadastro, CNH, autenticação | **Execução de contrato de trabalho** (art. 7º, V) e **obrigação legal** (art. 7º, II) | Verificar habilitação de quem dirige é dever do empregador |
| Diário de bordo, km, rotas, abastecimento | **Legítimo interesse** (art. 7º, IX) | Gestão da frota é interesse legítimo clássico; baixa intrusão |
| Localização pontual | **Legítimo interesse**, com LIA documentada | É o ponto que exige a avaliação formal — ver abaixo |
| Trilha de auditoria | **Obrigação legal** e **legítimo interesse** | Rastreabilidade é exigência de controle interno |
| Aceite do aviso | **Cumprimento de obrigação legal** (art. 9º) | É a prova da transparência |

### Por que não consentimento

Recomendação com convicção: **consentimento é base frágil na relação de
emprego** e, no caso do monitoramento, provavelmente inválida — há
desequilíbrio de poder entre empregador e empregado, e um consentimento que o
trabalhador não pode livremente recusar não é livre. Além disso, consentimento
revogável tornaria o diário de bordo inoperante no dia em que alguém revogasse.

O aceite do aviso de privacidade que o sistema já implementa (RF042) é **prova
de transparência**, não coleta de consentimento — e essa distinção precisa ficar
explícita no texto, porque hoje a tela pode dar a impressão contrária. Ver
decisão **D-6**.

### A LIA que falta

Legítimo interesse exige **avaliação de impacto documentada** (LIA), com três
etapas: finalidade legítima, necessidade e balanceamento com os direitos do
titular. Ela não existe hoje. Os elementos técnicos para escrevê-la estão neste
documento; a redação e o juízo são jurídicos.

Elementos que pesam **a favor** do balanceamento, todos já implementados:

- coleta pontual, não contínua;
- só durante a jornada aberta;
- recusa aceita sem penalizar o registro;
- acesso do titular aos próprios dados, com exportação (US035);
- prazo de retenção curto para localização (12 meses) e expurgo automático;
- transparência prévia com aceite registrado.

---

## 4. Direitos do titular — o que o sistema já faz e o que não faz

| Direito (art. 18) | Situação |
|---|---|
| Confirmação e acesso | ✅ Tela de perfil e exportação dos próprios registros |
| Correção | ⚠️ **Parcial** — via administrador, com auditoria. Não há canal do próprio titular |
| Anonimização/bloqueio/eliminação | ⚠️ **Parcial** — expurgo por prazo existe; não há atendimento a pedido individual |
| Portabilidade | ✅ Exportação em `.xlsx` |
| Informação sobre compartilhamento | ✅ Hoje nenhum dado do motorista é enviado a terceiro: o WhatsApp é por link (V-05) e a geocodificação reversa não está ligada (D-3) |
| Revogação | N/A se a base não for consentimento |
| Revisão de decisão automatizada | N/A — o sistema não decide nada automaticamente sobre pessoas |

**A lacuna real:** não existe procedimento para atender um pedido individual de
eliminação. Como o diário de bordo tem guarda de 5 anos por interesse do
controlador, a resposta provavelmente é "não se elimina antes do prazo, e eis o
fundamento" — mas isso precisa estar **escrito e decidido**, não improvisado no
dia em que alguém pedir.

---

## 5. Decisões que o jurídico precisa tomar

Esta é a parte acionável. Cada item bloqueia ou muda algo concreto.

| # | Decisão | O que muda no sistema |
|---|---|---|
| **D-1** | Base legal do tratamento de localização, com LIA escrita | Nada no código. É o que destrava o go-live |
| **D-2** | Prazo e destino da trilha de auditoria após 5 anos: eliminar ou **anonimizar** | Implementação no módulo de retenção. Hoje a trilha não tem expurgo, por conflito assumido entre RN027 (imutável) e RNF007 (prazo) |
| **D-3** | **Ligar ou não** o endereço aproximado de cada ponto do trajeto (geocodificação reversa no Nominatim) | **Hoje está desligado, e nenhuma coordenada sai.** A função existe porque a premissa do V-06 previa "endereço aproximado", mas nunca foi ligada a uma tela. Ligar é decisão de LGPD antes de ser decisão técnica: a posição do motorista passaria a ir para um terceiro no exterior. Se aprovado, é pouco código. Registro corrigido: uma versão anterior deste documento dizia que o envio já acontecia |
| **D-4** | Manter ou remover `email` e `matricula`, hoje coletáveis e sem uso | Remoção de dois campos do cadastro |
| **D-5** | Prazo de retenção das notificações (telefone + conteúdo) | Nova política no módulo de retenção |
| **D-6** | Texto final do aviso, deixando explícito que o aceite é **ciência**, não consentimento | Subir `VERSAO_AVISO_PRIVACIDADE`, o que força novo aceite de todos |
| **D-7** | Indicar o encarregado (DPO) e o canal de contato | Acrescentar ao aviso e ao rodapé |
| **D-8** | Previsão do monitoramento em política interna e/ou contrato de trabalho | Fora do sistema. É documento de RH |
| **D-9** | Procedimento de resposta a incidente, com prazo de comunicação à ANPD | Fora do sistema. Rascunho na seção 6 |
| **D-10** | Se a hospedagem for terceirizada: contrato de operador | Fora do sistema. Depende de V-01 e V-02 |

> **D-6 tem um efeito colateral que vale saber:** subir a versão do aviso obriga
> **todos** os usuários a aceitar de novo no próximo acesso. Se isso for feito
> depois do go-live, a frota inteira encontra a tela de aceite numa manhã. É
> mais barato fechar o texto **antes** da primeira subida.

---

## 6. Resposta a incidente — rascunho

Para o jurídico revisar e o cliente adotar. Não está implementado em lugar
nenhum; é procedimento humano.

1. **Detectar e conter.** Quem perceber aciona o responsável técnico. Se houver
   suspeita de acesso indevido, revogar as sessões ativas e trocar o
   `SESSAO_SECRET` — isso derruba todo mundo, o que é o comportamento desejado.
2. **Registrar.** Data, hora, o que se sabe, quem foi avisado. A trilha de
   auditoria ajuda a delimitar o alcance.
3. **Avaliar o risco** aos titulares: quais dados, quantas pessoas, se havia
   localização envolvida.
4. **Comunicar.** Havendo risco relevante, comunicar ANPD e titulares em prazo
   razoável (a ANPD orienta 3 dias úteis). **O prazo e o formato precisam ser
   fixados pelo jurídico.**
5. **Corrigir e registrar a lição**, como este projeto faz com defeito de
   código.

---

## 7. O que já está pronto do lado técnico

Para o jurídico saber com o que conta, sem precisar ler código:

- **Transparência com prova:** aviso apresentado no primeiro acesso, aceite
  gravado com versão, data, hora e IP (`aceite_privacidade`).
- **Minimização na localização:** pontual, só com jornada aberta, recusa aceita.
- **Retenção automatizada:** localização em 12 meses e planilhas em 60,
  configuráveis por tela, com expurgo semanal que **já foi executado de
  verdade**.
- **Segregação de acesso:** motorista só enxerga o próprio dado, imposto no
  servidor e não na tela — parâmetro vindo do cliente nunca decide alcance.
- **Trilha imutável:** toda alteração registra autor, data, valor anterior e
  novo. Senha, token e coordenada exata nunca entram no log técnico.
- **Acesso e portabilidade:** o motorista consulta e exporta os próprios
  registros.
- **Transporte cifrado:** HTTPS obrigatório em produção, com HSTS.
- **Senhas:** Argon2id, irreversível.

---

## 8. Como usar este documento

1. Enviar ao jurídico do cliente **junto com** o [aviso de privacidade
   atual](../src/modulos/privacidade/aviso-privacidade.ts) e o
   [doc 17](17-seguranca.md).
2. Pedir as dez decisões da seção 5. As que mudam código — **D-2, D-3, D-4,
   D-5, D-6** — voltam para desenvolvimento.
3. Nenhuma delas é grande: a maior é a anonimização da trilha (D-2), e as outras
   quatro somam poucos dias.
4. **D-1 e D-8 não geram código e são as que de fato liberam o go-live.**
