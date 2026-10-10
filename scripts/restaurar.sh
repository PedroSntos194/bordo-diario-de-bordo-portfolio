#!/bin/sh
# =============================================================================
# Bordo — restauração do banco (US046 · RNF013)
#
# O critério de aceitação da US046 não é "ter backup": é **restauração testada e
# documentada**. Cópia nunca restaurada é uma suposição, não uma garantia — e a
# hora de descobrir que ela não presta não é durante um incidente.
#
# USO
#
#   Ensaio (recomendado, mensal) — restaura num banco descartável e confere:
#     docker compose --env-file .env.producao run --rm \
#       -e ALVO=bordo_ensaio backup /usr/local/bin/restaurar.sh /backups/bordo_AAAA-MM-DD_HHMM.dump
#
#   Restauração real — SOBRESCREVE o banco de produção:
#     docker compose --env-file .env.producao stop app agendador
#     docker compose --env-file .env.producao run --rm \
#       -e ALVO="$POSTGRES_DB" -e CONFIRMO=sim backup \
#       /usr/local/bin/restaurar.sh /backups/bordo_AAAA-MM-DD_HHMM.dump
#     docker compose --env-file .env.producao start app agendador
#
# Parar a aplicação e o agendador antes é obrigatório: restaurar por baixo de
# processos que estão escrevendo produz um estado que não corresponde a nenhum
# instante real do sistema.
# =============================================================================

set -eu

# Encoding declarado, nunca herdado.
#
# Sem isto, o `psql` deduz a codificação do cliente pela locale do host. Num
# host que não seja UTF-8 — o Windows de quem desenvolve, por exemplo — um
# acento dentro de um comando SQL vira byte inválido e o comando falha. Com
# `set -eu`, isso derruba o script **depois** de a restauração ter dado certo,
# e a operação lê o código de saída como "a cópia não presta".
#
# O ensaio de 29/08/2026 foi exatamente assim: o banco restaurou inteiro e o
# script reportou falha na conferência.
PGCLIENTENCODING=UTF8
export PGCLIENTENCODING

DUMP="${1:?informe o caminho do arquivo .dump}"
ALVO="${ALVO:?defina ALVO com o nome do banco de destino}"

registrar() {
  echo "[$(date -Iseconds)] restauração: $1"
}

if [ ! -f "$DUMP" ]; then
  registrar "ERRO: arquivo não encontrado: ${DUMP}"
  exit 1
fi

if ! pg_restore --list "$DUMP" > /dev/null 2>&1; then
  registrar "ERRO: arquivo ilegível ou corrompido: ${DUMP}"
  exit 1
fi

# Sobrescrever produção exige intenção declarada. Sem isto, um comando repetido
# do histórico do shell apaga o banco.
if [ "$ALVO" = "${PGDATABASE:-}" ] && [ "${CONFIRMO:-}" != "sim" ]; then
  registrar "RECUSADO: ${ALVO} é o banco em uso."
  registrar "Para sobrescrevê-lo, repita o comando com CONFIRMO=sim."
  registrar "Para apenas ensaiar, use um ALVO diferente (ex.: bordo_ensaio)."
  exit 1
fi

registrar "destino=${ALVO} · origem=${DUMP}"

# Recria o banco do zero: restaurar por cima de tabelas existentes deixa resíduo
# do estado anterior e o resultado não é nem o backup nem o que havia antes.
psql --dbname=postgres --quiet --command="DROP DATABASE IF EXISTS \"${ALVO}\";"
psql --dbname=postgres --quiet --command="CREATE DATABASE \"${ALVO}\";"

pg_restore \
  --dbname="$ALVO" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$DUMP"

registrar "restaurado · conferindo"

# Conferência mínima: as tabelas que sustentam a operação existem e têm linhas.
# Restauração que "termina sem erro" e devolve banco vazio já aconteceu com
# gente demais para confiar só no código de saída do pg_restore.
# O SQL vai em ASCII puro e a frase é montada aqui fora.
#
# `PGCLIENTENCODING` acima já resolve o caso conhecido, mas a conferência é o
# último passo antes de alguém declarar um sistema recuperado: ela não deve
# depender de negociação de codificação com o banco. Números atravessam
# qualquer locale.
CONFERE="$(psql --dbname="$ALVO" --tuples-only --no-align --field-separator=' ' --command="
  SELECT
    (SELECT count(*) FROM usuario),
    (SELECT count(*) FROM jornada),
    (SELECT count(*) FROM corrida),
    (SELECT count(*) FROM log_auditoria);
")"

# shellcheck disable=SC2086
set -- $CONFERE
registrar "conteúdo: $1 usuários, $2 jornadas, $3 corridas, $4 registros de auditoria"

USUARIOS="$1"
if [ "$USUARIOS" -eq 0 ]; then
  registrar "ERRO: banco restaurado sem nenhum usuário — a cópia não presta."
  exit 1
fi

registrar "concluído com sucesso"
