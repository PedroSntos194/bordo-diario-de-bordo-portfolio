#!/bin/sh
# =============================================================================
# Bordo — cópia de segurança do banco (US046 · RNF013)
#
# Roda dentro do serviço `backup` do compose, uma vez por dia. Usa `pg_dump` no
# formato custom (`-Fc`): comprimido, e restaurável **seletivamente** por
# `pg_restore` — dá para recuperar uma tabela só, o que um dump em SQL puro não
# permite sem edição manual de um arquivo gigante.
#
# Falha do backup precisa ser barulhenta: o pior backup é o que ninguém sabe
# que parou de rodar. Por isso `set -e` e saída diferente de zero, que faz o
# contêiner reiniciar e aparecer no log.
# =============================================================================

set -eu

DESTINO="${DESTINO:-/backups}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
CARIMBO="$(date +%Y-%m-%d_%H%M)"
ARQUIVO="${DESTINO}/bordo_${CARIMBO}.dump"

registrar() {
  echo "[$(date -Iseconds)] backup: $1"
}

mkdir -p "$DESTINO"

registrar "iniciando · destino=${ARQUIVO}"

# `--no-owner` e `--no-privileges`: a restauração pode acontecer num servidor
# onde o papel do banco tem outro nome. Amarrar o dump ao dono atual é a causa
# mais comum de restauração que falha justamente no dia em que é necessária.
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$ARQUIVO"

TAMANHO="$(wc -c < "$ARQUIVO")"

# Um dump de banco com dados nunca tem poucos bytes. Se tiver, algo falhou em
# silêncio e é melhor descobrir agora do que na hora de restaurar.
if [ "$TAMANHO" -lt 1024 ]; then
  registrar "ERRO: arquivo suspeito de vazio (${TAMANHO} bytes)"
  rm -f "$ARQUIVO"
  exit 1
fi

# Verificação de integridade: lê o índice do dump de volta. Não prova que a
# restauração vai funcionar — só o ensaio descrito em `restaurar.sh` prova —,
# mas pega arquivo truncado, que é a falha silenciosa mais frequente.
if ! pg_restore --list "$ARQUIVO" > /dev/null 2>&1; then
  registrar "ERRO: dump ilegível, descartando"
  rm -f "$ARQUIVO"
  exit 1
fi

registrar "concluído · ${TAMANHO} bytes"

# Expurgo por retenção. Vem **depois** da verificação: manter uma cópia velha a
# mais é barato; apagar a antiga antes de confirmar que a nova presta, não.
REMOVIDOS="$(find "$DESTINO" -name 'bordo_*.dump' -type f -mtime "+${RETENCAO_DIAS}" -print -delete | wc -l)"
registrar "retenção de ${RETENCAO_DIAS} dias · ${REMOVIDOS} cópia(s) antiga(s) removida(s)"

# Aviso, não erro: o volume local é a primeira linha, não a única. Um servidor
# perdido leva junto o banco **e** as cópias que só existem nele (RNF013).
registrar "LEMBRETE: confirme que ${DESTINO} está sendo replicado para fora deste servidor"
