# 36 · Reabrir um dia encerrado antes da última saída

Caso de 08/10/2026: um motorista encerrou o dia às 08:51 depois da primeira viagem e
precisava sair novamente. A administração pode usar **Reabrir o dia** no detalhe
da jornada de hoje, informando um motivo. O dia e suas corridas são preservados;
os totais são recalculados no próximo encerramento.

## Correções da reabertura

- A próxima corrida e o encerramento do dia consideram o odômetro atual da van,
  além do início da jornada e das corridas já encerradas. Essa leitura é
  preservada ao reabrir. Se a corrida terminou em 1010 e o dia em 1020, a próxima
  corrida começa em 1020 e não se aceita um novo encerramento em 1015.
- A van precisa estar ativa e livre. Veículos inativos ou em manutenção não
  podem voltar à operação pela reabertura.
- Um resumo cancelado não pode voltar a constar como enviado por uma confirmação
  em uma tela antiga. A confirmação verifica o motorista, o encerramento da
  jornada e o status da notificação, inclusive na escrita no banco.

Nenhuma migração de banco é necessária. As correções usam o odômetro que já está
gravado no cadastro da van e mantêm o encerramento final vazio enquanto o dia
está em andamento. Também se aplicam ao início e encerramento sincronizados do
modo sem conexão, que usam os mesmos serviços.

## Como continuar as saídas

1. Na administração, abra **Jornadas** e a jornada de hoje do motorista.
2. Toque em **Reabrir o dia**, descreva o motivo e confirme.
3. No celular do motorista, atualize a tela **Meu dia**. Ela deve mostrar
   **Dia em andamento** e **Iniciar corrida**.
4. Registre a nova saída. Ao terminar uma viagem, use **Encerrar corrida**.
5. Use **Encerrar meu dia** depois da última viagem e envie o resumo atualizado.

O resumo enviado antes da reabertura permanece no WhatsApp do destinatário;
cancelar o registro no sistema permite enviar os novos totais ao finalizar.

## Verificação

Os testes da reabertura exercitam os serviços, validação, autorização e
repositórios reais, com sessão e Prisma simulados. Incluem o ciclo de reabrir,
iniciar a segunda corrida, encerrá-la e finalizar novamente, preservando a
primeira viagem. Os testes da confirmação incluem uma alteração concorrente
do status para cancelado entre a leitura e a escrita.

`npm run verificar` passou: formatação, lint, tipos e **831 testes em 60 arquivos**.
O build de produção também passou.
A suíte HTTP com PostgreSQL descartável não foi executada nesta máquina porque
o Docker Desktop não está em execução.

Esta alteração foi preparada localmente; a publicação em produção e o uso no
celular do motorista precisam ser confirmados depois da implantação.
