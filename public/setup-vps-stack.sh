#!/usr/bin/env bash
# ==============================================================================
# RADIO SYNAPSE - SCRIPT D'INSTALLATION VPS (ISOLATION DES PORTS RADIO 8000-8500)
# OS cible : Debian 13 (Trixie) / Debian 12 / Ubuntu
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Ce script doit être exécuté en root (sudo bash setup-vps-stack.sh)"
  exit 1
fi

echo "============================================================"
echo "🚀 DÉPLOIEMENT INFRASTRUCTURE RADIO SYNAPSE"
echo "============================================================"

# 1. Dépendances système
echo "📦 [1/6] Mise à jour du système et installation des outils..."
apt-get update -y
apt-get install -y curl wget git ufw htop jq net-tools ca-certificates gnupg lsb-release

# 2. Installation Docker
echo "🐳 [2/6] Installation du moteur Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker installé."
else
  echo "✅ Docker est déjà présent."
fi

# 3. Réseau interne partagé
echo "🔗 [3/6] Configuration du réseau partagé synapse-net..."
docker network create synapse-net 2>/dev/null || true

# 4. Nginx Proxy Manager (Ports web standards)
echo "🌐 [4/6] Déploiement de Nginx Proxy Manager..."
mkdir -p /opt/synapse/npm/data /opt/synapse/npm/letsencrypt
cat << 'EOF' > /opt/synapse/npm/docker-compose.yml
services:
  app:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: synapse-npm
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - synapse-net

networks:
  synapse-net:
    external: true
EOF
cd /opt/synapse/npm && docker compose up -d

# 5. Icecast2 (Port natif 8000 réattribué au streaming)
echo "📻 [5/6] Déploiement du serveur de flux Icecast2..."
mkdir -p /opt/synapse/icecast
cat << 'EOF' > /opt/synapse/icecast/docker-compose.yml
services:
  icecast:
    image: 'moul/icecast:latest'
    container_name: synapse-icecast
    restart: unless-stopped
    environment:
      - ICECAST_SOURCE_PASSWORD=synapse_source_live_pass
      - ICECAST_ADMIN_PASSWORD=synapse_admin_root_pass
      - ICECAST_ADMIN_USERNAME=admin
      - ICECAST_PORT=8000
    ports:
      - '8000:8000'
    networks:
      - synapse-net

networks:
  synapse-net:
    external: true
EOF
cd /opt/synapse/icecast && docker compose up -d

# 6. Liquidsoap (Régie & Harbor DJ sur le port 8005)
echo "🎛️ [6/6] Déploiement de Liquidsoap..."
mkdir -p /opt/synapse/liquidsoap/music /opt/synapse/liquidsoap/logs

cat << 'EOF' > /opt/synapse/liquidsoap/radio.liq
set("log.file.path", "/var/log/liquidsoap/radio.log")
set("log.level", 3)
set("harbor.bind_addr", "0.0.0.0")

# Entrée DJ en direct (Port 8005 dans la plage audio)
live_harbor = input.harbor(
  "live-dj",
  port=8005,
  password="synapse_harbor_live_pass",
  auth=fun(u,p) -> u == "streamer" and p == "synapse_harbor_live_pass"
)

# Musique automatique & sécurité
autodj = playlist(mode="random", "/var/music")
security_silence = blank()

# Priorité : Direct DJ > AutoDJ > Silence
radio = fallback(track_sensitive=false, [live_harbor, autodj, security_silence])

# Sortie vers le conteneur Icecast sur le réseau Docker interne
output.icecast(
  %mp3(bitrate=320, samplerate=44100),
  host="synapse-icecast",
  port=8000,
  password="synapse_source_live_pass",
  mount="/live-synapse.mp3",
  name="Radio Synapse - Master Stream",
  description="Flux audio haute fidélité Radio Synapse",
  url="https://radiosynapse.fr",
  radio
)
EOF

cat << 'EOF' > /opt/synapse/liquidsoap/docker-compose.yml
services:
  liquidsoap:
    image: 'savonet/liquidsoap:v2.2.5'
    container_name: synapse-liquidsoap
    restart: unless-stopped
    volumes:
      - ./radio.liq:/etc/liquidsoap/radio.liq
      - ./music:/var/music
      - ./logs:/var/log/liquidsoap
    ports:
      - '8005:8005'
    networks:
      - synapse-net
    command: ["liquidsoap", "/etc/liquidsoap/radio.liq"]

networks:
  synapse-net:
    external: true
EOF
cd /opt/synapse/liquidsoap && docker compose up -d

# 7. Supabase (Kong déplacé hors de la plage audio)
echo "⚡ Déploiement de Supabase..."
mkdir -p /opt/synapse/supabase
cd /opt/synapse/supabase

if [ ! -d "/opt/synapse/supabase/volumes" ]; then
  rm -rf /tmp/supabase-repo
  git clone --depth 1 https://github.com/supabase/supabase.git /tmp/supabase-repo
  cp -a /tmp/supabase-repo/docker/. /opt/synapse/supabase/
  rm -rf /tmp/supabase-repo
fi

if [ ! -f "/opt/synapse/supabase/.env" ]; then
  cp /opt/synapse/supabase/.env.example /opt/synapse/supabase/.env

  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)

  create_jwt() {
    local role="$1"
    local secret="$2"
    local header payload unsigned_token signature
    header=$(printf '{"alg":"HS256","typ":"JWT"}' | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    payload=$(printf '{"iss":"supabase","role":"%s","exp":1983412800}' "$role" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    unsigned_token="${header}.${payload}"
    signature=$(printf "%s" "$unsigned_token" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    printf "%s.%s" "$unsigned_token" "$signature"
  }

  ANON_KEY=$(create_jwt "anon" "$JWT_SECRET")
  SERVICE_ROLE_KEY=$(create_jwt "service_role" "$JWT_SECRET")

  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|g" /opt/synapse/supabase/.env
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|g" /opt/synapse/supabase/.env
  sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|g" /opt/synapse/supabase/.env
  sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|g" /opt/synapse/supabase/.env
  sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://db.radiosynapse.fr|g" /opt/synapse/supabase/.env
  sed -i "s|SITE_URL=.*|SITE_URL=https://radiosynapse.fr|g" /opt/synapse/supabase/.env
  
  # Déplacement du port hôte de Kong vers 54321 pour libérer totalement 8000-8500
  sed -i "s|KONG_HTTP_PORT=.*|KONG_HTTP_PORT=54321|g" /opt/synapse/supabase/.env
fi

# Raccordement de Kong au réseau synapse-net
cat << 'EOF' > /opt/synapse/supabase/docker-compose.override.yml
services:
  kong:
    networks:
      - default
      - synapse-net

networks:
  synapse-net:
    name: synapse-net
    external: true
EOF

docker compose up -d

# 8. Filtrage Pare-feu (Seuls les ports vitaux sont ouverts)
echo "🛡️ Configuration des règles UFW..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # Web HTTP (NPM)
ufw allow 443/tcp   # Web HTTPS (NPM)
ufw allow 81/tcp    # Admin NPM
ufw allow 8000/tcp  # Icecast (Radio master)
ufw allow 8005/tcp  # Liquidsoap (Direct DJ Harbor)
ufw --force enable

PUBLIC_IP=$(curl -s ifconfig.me || echo "VOTRE_IP")

echo "============================================================"
echo "🎉 INFRASTRUCTURE DÉPLOYÉE SANS CONFLIT DE PORTS"
echo "============================================================"
echo ""
echo "Plage 8000-8500 sanctuarisée pour l'audio :"
echo "• Icecast2 Stream   : http://${PUBLIC_IP}:8000/live-synapse.mp3"
echo "• Harbor DJ Direct  : Port 8005 (Mount: /live-dj, User: streamer)"
echo ""
echo "Services Web & Base de données (hors plage radio) :"
echo "• Nginx Proxy UI    : http://${PUBLIC_IP}:81"
echo "• Supabase Kong     : Port 54321 (accessible en interne via http://kong:8000)"
echo "• Supabase Studio   : Port 3000 (accessible en interne via http://studio:3000)"
