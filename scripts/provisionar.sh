#!/usr/bin/env bash
# =============================================================================
# Bordo — provisionamento do servidor (V-02 · US046 · doc 24)
#
# Prepara um servidor Ubuntu/Debian limpo para receber o Bordo. Roda como root,
# uma vez, e é **idempotente**: repetir não estraga nada, o que importa porque
# provisionamento quase nunca dá certo na primeira tentativa.
#
#   curl -fsSL <url-do-script> -o provisionar.sh
#   sudo bash provisionar.sh
#
# O que ele NÃO faz, de propósito:
#
#   - não sobe a aplicação. Falta o `.env.producao` preenchido e o DNS
#     apontando, e subir antes disso queima tentativas de emissão do
#     certificado na Let's Encrypt, que tem limite semanal por domínio;
#   - não aplica migração. Isso é passo deliberado do deploy, com backup
#     imediatamente antes (doc 24);
#   - não abre a porta do banco. O PostgreSQL só é alcançável pela rede interna
#     do compose — expor 5432 é o caminho mais curto para um incidente.
# =============================================================================

set -euo pipefail

USUARIO_DEPLOY="${USUARIO_DEPLOY:-bordo}"
RAIZ="${RAIZ:-/opt/bordo}"

registrar() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
aviso()     { printf '\033[1;33m [!]\033[0m %s\n' "$1"; }
erro()      { printf '\033[1;31m [x]\033[0m %s\n' "$1" >&2; }

if [ "$(id -u)" -ne 0 ]; then
  erro "Rode como root: sudo bash $0"
  exit 1
fi

if ! command -v apt-get > /dev/null 2>&1; then
  erro "Este script pressupõe Ubuntu ou Debian (apt-get)."
  exit 1
fi

# --- 1 · sistema em dia ------------------------------------------------------
registrar "Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

registrar "Instalando utilitários básicos"
apt-get install -y -qq ca-certificates curl gnupg lsb-release ufw

# --- 2 · atualizações de segurança automáticas -------------------------------
# Um servidor que ninguém atualiza é um servidor que acumula falha conhecida.
# Só as de segurança, sem reinício automático: reiniciar sozinho no meio do
# turno derrubaria a operação.
registrar "Ligando atualizações automáticas de segurança"
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

# --- 3 · Docker do repositório oficial ---------------------------------------
# Não o `docker.io` do Debian: ele costuma estar atrás e não traz o plugin
# `compose`, que o `docker-compose.yml` deste projeto exige.
if command -v docker > /dev/null 2>&1 && docker compose version > /dev/null 2>&1; then
  registrar "Docker já instalado — $(docker --version)"
else
  registrar "Instalando o Docker Engine e o plugin compose"
  install -m 0755 -d /etc/apt/keyrings
  DISTRO="$(. /etc/os-release && echo "$ID")"
  curl -fsSL "https://download.docker.com/linux/${DISTRO}/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${DISTRO} $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
fi

# --- 4 · usuário de deploy ---------------------------------------------------
# A aplicação não roda como root, e quem faz deploy não precisa ser root.
if id "$USUARIO_DEPLOY" > /dev/null 2>&1; then
  registrar "Usuário '$USUARIO_DEPLOY' já existe"
else
  registrar "Criando o usuário '$USUARIO_DEPLOY'"
  adduser --system --group --shell /bin/bash --home "/home/$USUARIO_DEPLOY" "$USUARIO_DEPLOY"
fi
usermod -aG docker "$USUARIO_DEPLOY"

# --- 5 · firewall ------------------------------------------------------------
# Três portas, e só. A 443/udp é o HTTP/3 que o Caddy serve.
registrar "Configurando o firewall"
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow 22/tcp comment 'ssh' > /dev/null
ufw allow 80/tcp comment 'http — desafio ACME e redirecionamento' > /dev/null
ufw allow 443/tcp comment 'https' > /dev/null
ufw allow 443/udp comment 'http/3' > /dev/null
ufw --force enable > /dev/null
ufw status numbered

# --- 6 · endurecimento do SSH ------------------------------------------------
# Só desliga a senha se já houver chave autorizada: fazer isso antes tranca
# quem estiver provisionando do lado de fora.
registrar "Conferindo o acesso por SSH"
CHAVES="/root/.ssh/authorized_keys"
if [ -s "$CHAVES" ]; then
  sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "  autenticação por senha desligada (há chave autorizada)"
else
  aviso "Nenhuma chave em $CHAVES — a senha continua habilitada."
  aviso "Instale sua chave pública e rode de novo para endurecer o SSH."
fi

# --- 7 · diretório da aplicação ---------------------------------------------
registrar "Preparando $RAIZ"
mkdir -p "$RAIZ"
chown -R "$USUARIO_DEPLOY:$USUARIO_DEPLOY" "$RAIZ"

# --- 8 · segredos ------------------------------------------------------------
# Gerados aqui e não escolhidos por gente: senha inventada por humano é a que
# vaza. O arquivo nasce com 600 e dono do usuário de deploy.
ENV_PROD="$RAIZ/.env.producao"
if [ -f "$ENV_PROD" ]; then
  registrar "$ENV_PROD já existe — preservado"
else
  registrar "Gerando segredos em $ENV_PROD"
  SESSAO="$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48)"
  SENHA_BANCO="$(openssl rand -base64 32 | tr -d '\n/+=' | cut -c1-32)"

  cat > "$ENV_PROD" <<CONF
# Gerado por provisionar.sh em $(date -Iseconds).
# PREENCHA os campos marcados com PREENCHER antes de subir.

APP_AMBIENTE=producao
APP_URL=https://PREENCHER
TZ=America/Sao_Paulo
LOG_NIVEL=info
VERSAO=1.0.0

DOMINIO=PREENCHER
EMAIL_ACME=PREENCHER

POSTGRES_USER=bordo
POSTGRES_PASSWORD=${SENHA_BANCO}
POSTGRES_DB=bordo

SESSAO_SECRET=${SESSAO}

WHATSAPP_CANAL=link
BACKUP_RETENCAO_DIAS=14
CONF

  chmod 600 "$ENV_PROD"
  chown "$USUARIO_DEPLOY:$USUARIO_DEPLOY" "$ENV_PROD"
fi

# --- 9 · o que falta ---------------------------------------------------------
IP_PUBLICO="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo 'não detectado')"

cat <<FIM

$(registrar "Servidor pronto. O que falta é seu:")

  1. DNS — aponte o domínio para este servidor ANTES de subir:

         A    bordo.seudominio.com.br   ->  ${IP_PUBLICO}

     O desafio da Let's Encrypt bate na porta 80 deste host. Subir antes de o
     DNS propagar gasta tentativas de emissão, que são limitadas por semana.

  2. Código — copie o repositório para ${RAIZ}.

  3. Preencha os PREENCHER em ${ENV_PROD}
     (APP_URL, DOMINIO, EMAIL_ACME). Os segredos já estão gerados.

  4. Confira o DNS antes de subir:

         dig +short bordo.seudominio.com.br    # precisa devolver ${IP_PUBLICO}

  5. Suba, migre e confira:

         cd ${RAIZ}
         docker compose --env-file .env.producao build
         docker compose --env-file .env.producao run --rm migrador
         docker compose --env-file .env.producao up -d
         curl -fsS https://bordo.seudominio.com.br/api/health

  6. ENSAIE A RESTAURAÇÃO antes de considerar o sistema no ar. É critério de
     aceitação da US046, não zelo excessivo — ver a seção 6 do doc 24.

FIM
