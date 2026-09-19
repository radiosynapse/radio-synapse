# Guide d'Installation Provisoire (Mono-VPS Tout-en-Un)
## Radio Synapse • Architecture Démonstration & Démarrage Rapide

Ce guide fournit la procédure complète pour déployer l'intégralité de l'écosystème Radio Synapse sur un **unique VPS Linux** (Debian 12 Bookworm ou Ubuntu 22.04/24.04 LTS).

---

### 1. Vue d'Ensemble de l'Architecture Mono-VPS

Dans cette architecture provisoire, tous les composants tournent sur la même machine :
* **Application Web & Panel Admin** : Node.js (Vite / Express BFF sur le port `3000`)
* **Base de Données & Auth Realtime** : Supabase (Stack Docker complète PostgreSQL, Kong, Realtime, GoTrue sur le port `54321`)
* **Moteur Audio & Télécommande** : Liquidsoap 2.2+ (Telnet `8572`, Harbor DJ Live `8005`)
* **Serveur de Diffusion Audio** : Icecast 2 (port `8000`)
* **Reverse Proxy & SSL** : Nginx Proxy Manager ou Nginx classique (ports `80` et `443`)

---

### 2. Prérequis Matériels & Système

* **Système d'exploitation** : Debian 12 (recommandé) ou Ubuntu 22.04 LTS
* **Ressources minimales** : 2 vCPU, 4 Go de RAM, 40 Go de disque SSD
* **Nom de domaine** pointant vers l'IP du VPS (ex: `radiosynapse.fr`, `admin.radiosynapse.fr`, `stream.radiosynapse.fr`)
* Accès SSH avec privilèges `root` ou `sudo`

---

### 3. Étape 1 : Mise à jour du système et paquets de base

Connectez-vous à votre VPS en SSH :
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential certbot python3-certbot-nginx ffmpeg sox
```

---

### 4. Étape 2 : Installation & Configuration d'Icecast 2

Installez le serveur Icecast 2 :
```bash
sudo apt install -y icecast2
```
Lors de l'installation, Debian vous demande de configurer les mots de passe. Vous pouvez aussi éditer `/etc/icecast2/icecast.xml` :
```xml
<icecast>
    <location>France - VPS Provisoire</location>
    <admin>admin@radiosynapse.fr</admin>
    <limits>
        <clients>2500</clients>
        <sources>10</sources>
        <queue-size>524288</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>65535</burst-size>
    </limits>
    <authentication>
        <source-password>SourcePass_Synapse2026!</source-password>
        <relay-password>RelayPass_Synapse2026!</relay-password>
        <admin-user>admin</admin-user>
        <admin-password>AdminPass_Synapse2026!</admin-password>
    </authentication>
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>
    <mount type="normal">
        <mount-name>/synapse_hd.mp3</mount-name>
        <fallback-mount>/synapse_fallback.mp3</fallback-mount>
        <fallback-override>1</fallback-override>
        <bitrate>320</bitrate>
        <type>audio/mpeg</type>
    </mount>
    <mount type="normal">
        <mount-name>/synapse_club.mp3</mount-name>
        <bitrate>256</bitrate>
        <type>audio/mpeg</type>
    </mount>
    <mount type="normal">
        <mount-name>/synapse_chill.aac</mount-name>
        <bitrate>192</bitrate>
        <type>audio/aac</type>
    </mount>
</icecast>
```

Activez et démarrez le service Icecast :
```bash
sudo sed -i 's/ENABLE=false/ENABLE=true/g' /etc/default/icecast2
sudo systemctl restart icecast2
sudo systemctl enable icecast2
```

---

### 5. Étape 3 : Installation de Liquidsoap 2.2+

Sous Debian 12 / Ubuntu 22.04 :
```bash
sudo apt install -y liquidsoap
```
Vérifiez la version installée :
```bash
liquidsoap --version
```
Créez les répertoires audio pour les musiques et jingles :
```bash
sudo mkdir -p /var/media/synapse/music/heavy
sudo mkdir -p /var/media/synapse/music/night
sudo mkdir -p /var/media/synapse/music/soft
sudo mkdir -p /var/media/synapse/music/jingles
sudo chown -R liquidsoap:liquidsoap /var/media/synapse
```

Téléchargez ou copiez le script généré depuis le panel admin Synapse dans `/etc/liquidsoap/radio.liq` :
```bash
# Vérification de la syntaxe
liquidsoap --check /etc/liquidsoap/radio.liq

# Démarrage du démon systemd
sudo systemctl enable liquidsoap@radio
sudo systemctl start liquidsoap@radio
```

---

### 6. Étape 4 : Déploiement de Supabase (Base de Données PostgreSQL & Auth Realtime)

Vous pouvez lancer le script de déploiement automatique unifié fourni dans `/public/setup-vps-stack.sh` ou déployer manuellement la stack Docker Supabase :
```bash
# Exécution du script automatisé tout-en-un
sudo bash /public/setup-vps-stack.sh
```

Ou déployez Supabase via Docker Compose :
```bash
sudo mkdir -p /opt/supabase && cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Configuration de Kong sur le port 54321 pour libérer le port 8000 pour Icecast
sed -i 's/8000:8000/54321:8000/g' docker-compose.yml
docker compose up -d
```

Accédez à Supabase Studio (`http://VOTRE_IP:54323`) et exécutez le script SQL `SUPABASE_SQL_SCHEMA` pour créer toutes les tables `synapse_stations`, `synapse_messages`, `synapse_challenges`, `synapse_promotions`, `synapse_events`, `synapse_admin_data` et activer le Realtime.

---

### 7. Étape 5 : Déploiement de l'Application Node.js & Panel Admin

Installez Node.js 20 LTS :
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Déployez votre code dans `/var/www/radiosynapse` :
```bash
cd /var/www/radiosynapse
npm install
npm run build
```

Créez le service systemd `/etc/systemd/system/synapse-web.service` :
```ini
[Unit]
Description=Radio Synapse Web App & BFF
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/radiosynapse
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
Activez et démarrez l'application :
```bash
sudo systemctl daemon-reload
sudo systemctl enable synapse-web
sudo systemctl start synapse-web
```

---

### 8. Étape 6 : Configuration de Nginx & Certificats SSL Let's Encrypt

Créez la configuration de reverse proxy dans `/etc/nginx/sites-available/radiosynapse.conf` :
```nginx
# 1. Site Web Utilisateur & Panel Admin
server {
    server_name radiosynapse.fr www.radiosynapse.fr;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Passerelle Supabase Kong & API REST / Realtime
server {
    server_name api.radiosynapse.fr;

    location / {
        proxy_pass http://127.0.0.1:54321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}

# 3. Flux Audio Icecast Sécurisé HTTPS
server {
    server_name stream.radiosynapse.fr;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        tcp_nodelay on;
    }
}
```

Activez le site et obtenez les certificats SSL :
```bash
sudo ln -s /etc/nginx/sites-available/radiosynapse.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d radiosynapse.fr -d www.radiosynapse.fr -d db.radiosynapse.fr -d stream.radiosynapse.fr
```

---

### 9. Vérification Finale du Déploiement Mono-VPS

1. Ouvrez `https://radiosynapse.fr` : l'application web et le lecteur doivent démarrer.
2. Ouvrez le panel admin (`Touche 'A'` ou profil connecté avec rôle admin).
3. Rendez-vous dans **Régie > Console & Télécommande** : le statut Liquidsoap s'affiche en vert.
4. Lancez le test de stream dans **Radios & Encodeurs** : l'audio de Liquidsoap est relayé instantanément par Icecast sur `https://stream.radiosynapse.fr/synapse_hd.mp3`.
