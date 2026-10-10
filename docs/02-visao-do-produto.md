# 02 · Visão do produto

## Nome do projeto

**Bordo** — Diário de Bordo Digital
Cliente: empresa de transporte por vans — nome omitido nesta versão de portfólio.

Alternativas de nome, caso o cliente prefira: *RotaViva* e *VanLog*.

## Descrição do produto

O **Bordo** é um sistema web responsivo (PWA) de registro operacional de vans. O motorista abre o
aplicativo no celular, inicia a jornada do dia, registra cada corrida — rota, destino, horário e
localização — e encerra ao final. O sistema calcula automaticamente quilometragem, tempo e
totais do dia, monta a planilha consolidada em Excel e a disponibiliza ao administrador, que
acompanha tudo por um painel com indicadores, mapa, filtros e histórico auditável.

Ele substitui a folha de papel por um registro que **se preenche quase sozinho**: data e hora vêm
do relógio, a localização vem do GPS, a rota vem do cadastro e o motorista só confirma e completa
o que a máquina não sabe (odômetro, passageiros, ocorrências).

## Problema que será resolvido

> "Os motoristas param de não anotar o diário de bordo." — resposta do cliente

Hoje o diário de bordo é uma planilha em papel. Ela é esquecida, preenchida pela metade, perdida
ou redigitada manualmente por alguém no escritório. O resultado é que a empresa **não tem
informação confiável sobre a própria operação**: não sabe quantos km rodou cada van, quais rotas
foram efetivamente feitas, a que horas, nem tem qualquer comprovação em caso de incidente.

O Bordo resolve isso em três frentes:

1. **Facilidade** — registrar leva menos esforço do que não registrar.
2. **Cobrança** — o sistema sabe quem não registrou e avisa.
3. **Consolidação automática** — a planilha do administrador deixa de ser trabalho manual.

## Objetivo principal

> "Planilhar o dia a dia do motorista." — resposta do cliente

Produzir, sem digitação manual e com confiabilidade auditável, o registro diário completo da
operação de cada van: quem dirigiu, qual veículo, quais rotas, quais destinos, em que horários,
por onde passou e quantos quilômetros rodou.

## Público-alvo

Empresa com frota própria de vans para transporte (fretamento/transporte de colaboradores),
porte pequeno a médio, **~60 usuários**, operação diária, gestão centralizada em poucos
administradores e equipe de campo com baixo apetite por burocracia digital.

## Tipos de usuários

| Perfil | Quantidade estimada | Dispositivo predominante | Objetivo no sistema |
|---|---|---|---|
| **Motorista** | ~55 ⚠️ *(V-17)* | Celular (Android, tela pequena, conexão instável) | Registrar a jornada e as corridas do dia no menor tempo possível |
| **Administrador** | ~5 ⚠️ *(V-17)* | Computador, eventualmente tablet | Cadastrar usuários/veículos/rotas, acompanhar o dia, extrair relatórios, auditar |
| *Supervisor* 💡 | a definir | Computador | Acompanhar e relatar sem poder administrar usuários — **sugestão, fora do MVP** |

## Proposta de valor

**Para o motorista:** três toques no celular substituem o preenchimento da folha. Nada de caneta,
nada de papel amassado, nada de lembrar horário no fim do dia.

**Para o administrador:** o resumo do dia chega pronto, em Excel, com quilometragem calculada,
sem redigitação e sem cobrar ninguém por telefone. Se algo foi alterado, o sistema mostra quem
alterou, quando e qual era o valor anterior.

**Para a empresa:** dados confiáveis de operação (km, rotas, horários, ocorrências) que sustentam
decisões de custo, manutenção e dimensionamento de frota, além de comprovação documental.

## Principais fluxos de utilização

### Fluxo macro do motorista (o fluxo descrito pelo cliente)

```
Motorista
→ acessa o sistema no celular
→ faz login com CPF e senha
→ abre a jornada do dia (veículo + odômetro inicial)
→ inicia a corrida escolhendo a rota (ou cria uma corrida avulsa)
→ sistema captura data, hora e localização automaticamente
→ registra paradas/destinos ao longo do trajeto
→ realiza o encerramento da corrida (odômetro, passageiros, observação)
→ encerra a jornada do dia
→ sistema gera a planilha consolidada
→ envia o resumo do dia ao administrador (WhatsApp)
```

### Fluxo macro do administrador

```
Administrador
→ faz login
→ vê o dashboard do dia (vans em operação, jornadas abertas, km acumulado, pendências)
→ acompanha corridas em andamento e trajetos no mapa
→ consulta o histórico com filtros (data, motorista, veículo, rota)
→ corrige registros quando necessário (com justificativa registrada em auditoria)
→ gera e exporta relatórios em Excel
→ administra usuários, veículos e rotas
→ consulta logs de atividade e histórico de alterações
```

### Momentos-chave do produto

| Momento | O que precisa acontecer para o produto dar certo |
|---|---|
| Primeiro acesso do motorista | Login simples com CPF, troca de senha, aviso de privacidade, tela inicial óbvia |
| Início da corrida | Menos de 15 segundos, com rota pré-selecionada e GPS automático |
| Área sem sinal | Registro salvo localmente e sincronizado depois, sem o usuário perceber ⚠️ *(V-08)* |
| Fim do dia | Um botão encerra tudo e o resumo já sai pronto |
| Segunda-feira do administrador | Relatório da semana anterior em Excel em menos de 1 minuto |
