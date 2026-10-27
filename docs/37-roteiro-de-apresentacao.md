# 37 · Roteiro de apresentação

Uma apresentação de **5 a 7 minutos** para explicar o problema, mostrar o produto e defender as
decisões de engenharia. O objetivo é demonstrar um fluxo completo e explicar por que ele existe.

## Preparação

- Abra `/apresentacao` com o servidor iniciado e percorra a demonstração antes de apresentar.
- Confira o tamanho da janela e o zoom. Use uma janela estreita para mostrar a experiência do
  motorista no celular e uma janela maior para a visão administrativa.
- Deixe o README e `docs/13-arquitetura.md` abertos para a conversa técnica.
- Se também for mostrar a operação completa, prepare antecipadamente um banco **exclusivo de
  demonstração** com as migrações e `npm run seed:demo`, conforme o README. Guarde a senha impressa
  pelo seed e confira o login dos dois perfis antes da apresentação.
- O seed prepara uma operação na data em que é executado. Se o banco foi preparado em outro dia,
  confira a data dos registros e use os filtros de data para encontrá-los.
- Para demonstrar exportações grandes e rotinas automáticas na instalação local, inicie também
  `npm run agendador` em outro terminal. Ele é um processo separado do servidor web.
- Use somente dados fictícios e confira o conteúdo das outras abas que pretende compartilhar.

A apresentação e sua demonstração no navegador não gravam registros no banco. A operação real
usa autenticação, PostgreSQL, serviços de domínio e os mecanismos de sincronização do projeto.
Para a vitrine, não é necessário criar jornadas nem entregar credenciais aos espectadores.

## 1. O problema · 45 segundos

Abra `/apresentacao` e apresente o contexto:

> O Bordo foi criado para substituir o diário de bordo em papel de uma frota de vans. No papel,
> registros incompletos precisam ser redigitados, e a administração tem dificuldade para conferir
> viagens, quilometragem e horas de trabalho. O motorista precisa registrar com poucos passos, e
> quem administra precisa transformar esses registros em informação conferível.

Explique que esta é uma versão de portfólio de um projeto real, com marca e dados fictícios.
Não atribua percentuais de economia, adoção ou redução de erros sem uma medição disponível.

## 2. O motorista registra a rotina · 2 minutos

Use a demonstração fictícia acessível pela apresentação e siga os controles exibidos na tela.
Conte a sequência de trabalho: escolher a van, informar o odômetro, registrar uma corrida e
acompanhar seu encerramento. Prefira explicar uma viagem a percorrer todos os menus.

Destaque o que o motorista confirma e o que o sistema pode obter automaticamente. A quilometragem
é calculada pelo odômetro; o GPS complementa o registro e sua ausência não deve bloquear a rotina.

Na operação completa, vale mostrar uma corrida já em andamento e explicar suas paradas antes de
encerrá-la. A jornada é o dia de trabalho; uma corrida é uma viagem dentro desse dia.

## 3. A administração confere e fecha · 1 minuto

Apresente a visão administrativa da demonstração. Relacione os indicadores à rotina mostrada:
quem começou, quem tem corrida em andamento e quem precisa de acompanhamento.

Mostre como o registro chega à conferência e ao fechamento mensal. Explique que os filtros
delimitam o período e que as planilhas tornam os valores verificáveis. Na operação completa,
abra o fechamento e mostre os avisos que precisam ser resolvidos antes de gerar os arquivos.

## 4. As decisões de engenharia · 1 a 2 minutos

Escolha dois ou três pontos conforme o público:

- **Monólito modular:** Next.js reúne interface e servidor; os módulos separam validação, regras
  puras, casos de uso e acesso aos dados. Essa divisão permite testar as regras e manter uma
  implantação simples para o tamanho da operação.
- **Integridade:** as mutações usam um fluxo comum de autorização, validação e auditoria, e as
  restrições do PostgreSQL protegem regras de concorrência. Mostre um exemplo no código se houver
  interesse, em vez de enumerar todas as bibliotecas.
- **Trabalho sem sinal:** na operação real, ações entram numa fila local e são sincronizadas com
  proteção contra duplicidade. Explique a diferença entre registrar no aparelho e confirmar o
  recebimento no servidor.
- **Dados e fechamento:** instantes são gravados em UTC, a data operacional segue o fuso de São
  Paulo e os cálculos monetários usam centavos. Exportações acima do limite síncrono entram numa
  fila processada fora da requisição web.

Use `docs/13-arquitetura.md` para explicar as escolhas e `docs/00-como-navegar-o-codigo.md` para
localizar um fluxo. Os testes unitários e os fluxos HTTP com banco descartável estão documentados
no projeto; apresente resultados de uma execução recente se quiser citar a validação realizada.

## 5. Limites e encerramento · 30 a 45 segundos

Explique os limites com clareza:

- A vitrine contém uma simulação com dados fictícios. Seus controles não comprovam, sozinhos,
  autenticação, persistência, funcionamento offline ou geração real de arquivos.
- A demonstração completa desses recursos usa o aplicativo com PostgreSQL e os dados de seed.
  Mostrar um indicador de falta de conexão não substitui testar a sincronização real.
- Mapas dependem de serviços externos; GPS e instalação como PWA dependem do navegador, das
  permissões e de um contexto seguro, como HTTPS ou localhost.
- Automação de WhatsApp e rotinas agendadas dependem do canal e da infraestrutura configurados.
  No canal por link, uma pessoa ainda precisa revisar e enviar a mensagem no WhatsApp.

Feche retomando o fluxo demonstrado: o motorista registra uma viagem; a administração acompanha,
confere e prepara o fechamento. Deixe as demais funcionalidades para perguntas.
