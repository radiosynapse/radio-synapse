# Guide d'Installation Finale (Infrastructure Séparée Multi-VPS)
## Radio Synapse • Haute Disponibilité, Sécurité & Scalabilité

Ce guide documente l'architecture définitive en production de Radio Synapse, basée sur la séparation stricte des rôles :
* **VPS 1 (Maître Applicatif, Régie & Données)** : Application Web, Panel Admin, Base PocketBase, Moteur d'encodage Liquidsoap 2.2+, Médiathèque VPS et Port Harbor DJ Live.
* **VPS 2 (Relais de Diffusion Icecast Dédié Haute Capacité)** : Démon Icecast 2 optimisé pour absorber des milliers d'auditeurs simultanés sans impacter les performances de la régie ni de la base de données.

---

### 1. Schéma d'Architecture Réseau & Flux

```
[ Auditeurs Web & Mobile ]
           │ (HTTPS / TLS 1.3)
           ▼
┌───────────────────────────────────────────────────────────┐
│              VPS 2 : RELAIS DE DIFFUSION ICECAST          │
│ IP: 198.51.100.20  •  Domaine: stream.radiosynapse.fr     │
│ ───────────────────────────────────────────────────────── │
│  • Nginx Reverse Proxy SSL (Buffer off, TCP NoDelay)      │
│  • Icecast 2 Serveur Dédié (Cache 2MB, 15 000 listeners) │
└──────────────────────────▲────────────────────────────────┘
                           │ (Flux Source Sécurisé / IP Whitelist)
                           │ Port 8000 (Source Password)
┌──────────────────────────┴────────────────────────────────┐
│            VPS 1 : MAÎTRE APPLICATIF & RÉGIE LIQUIDSOAP   │
│ IP: 203.0.113.10   •  Domaines: radiosynapse.fr, db...    │
│ ───────────────────────────────────────────────────────── │
│  • Node.js 20 (Vite / Express BFF - Port 3000)            │
│  • PocketBase v0.40+ (SQLite WAL Realtime - Port 8090)     │
│  • Liquidsoap 2.2+ (AutoDJ, Smart Crossfade, Master Lim) │
│  • Harbor DJ Direct Input (Port 8005)                     │
│  • Stockage Audio Local (/var/media/synapse/music)        │
└───────────────────────────────────────────────────────────┘
```

---

### 2. Configuration du VPS 2 (Relais de Diffusion Icecast Dédié)

Le VPS 2 est dédié exclusivement au streaming audio. Il nécessite une bande passante élevée (ex: 1 Gbps non bridé).

#### A. Installation d'Icecast2 et Nginx sur VPS 2
```bash
sudo apt update && sudo apt install -y icecast2 nginx certbot python3-certbot-nginx
```

#### B. Configuration d'Icecast2 (`/etc/icecast2/icecast.xml` sur VPS 2)
```xml
<icecast>
    <location>Datacenter Paris - CDN Relay 01</location>
    <admin>noc@radiosynapse.fr</admin>
    <limits>
        <clients>15000</clients>
        <sources>20</sources>
        <queue-size>1048576</queue-size>
        <client-timeout>30</client-timeout>
        <header-timeout>15</header-timeout>
        <source-timeout>10</source-timeout>
        <burst-on-connect>1</burst-on-connect>
        <burst-size>131072</burst-size>
    </limits>
    <authentication>
        <!-- Mot de passe source utilisé uniquement par Liquidsoap (VPS 1) -->
        <source-password>SecretMasterSourceKey_2026!</source-password>
        <relay-password>SecretMasterRelayKey_2026!</relay-password>
        <admin-user>synapse_admin</admin-user>
        <admin-password>SecretAdminKey_2026!</admin-password>
    </authentication>
    <listen-socket>
        <port>8000</port>
        <bind-address>0.0.0.0</bind-address>
    </listen-socket>

    <!-- Point de montage HD 320 kbps -->
    <mount type="normal">
        <mount-name>/synapse_hd.mp3</mount-name>
        <fallback-mount>/synapse_fallback.mp3</fallback-mount>
        <fallback-override>1</fallback-override>
        <bitrate>320</bitrate>
        <type>audio/mpeg</type>
        <burst-size>131072</burst-size>
    </mount>

    <!-- Point de montage Clubbing 256 kbps -->
    <mount type="normal">
        <mount-name>/synapse_club.mp3</mount-name>
        <bitrate>256</bitrate>
        <type>audio/mpeg</type>
    </mount>

    <!-- Point de montage AAC Mobile 192 kbps -->
    <mount type="normal">
        <mount-name>/synapse_chill.aac</mount-name>
        <bitrate>192</bitrate>
        <type>audio/aac</type>
    </mount>

    <!-- Point de montage FLAC Audiophile Master -->
    <mount type="normal">
        <mount-name>/synapse_lossless.flac</mount-name>
        <bitrate>1411</bitrate>
        <type>audio/flac</type>
    </mount>
</icecast>
```

Activez et démarrez Icecast sur VPS 2 :
```bash
sudo sed -i 's/ENABLE=false/ENABLE=true/g' /etc/default/icecast2
sudo systemctl restart icecast2
sudo systemctl enable icecast2
```

#### C. Pare-feu Sécurisé sur VPS 2 (UFW)
Autorisez uniquement le port HTTP/HTTPS pour le public, et le port 8000 (Source Icecast) uniquement depuis l'IP de votre VPS 1 :
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Autoriser le port 8000 uniquement pour le VPS 1 (IP 203.0.113.10)
sudo ufw allow from 203.0.113.10 to any port 8000 proto tcp
sudo ufw enable
```

#### D. Nginx Reverse Proxy & SSL sur VPS 2 (`/etc/nginx/sites-available/stream.conf`)
```nginx
server {
    listen 80;
    server_name stream.radiosynapse.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stream.radiosynapse.fr;

    ssl_certificate /etc/letsencrypt/live/stream.radiosynapse.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.radiosynapse.fr/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        tcp_nodelay on;
        add_header Access-Control-Allow-Origin *;
    }
}
```
Activez le site et lancez Certbot :
```bash
sudo ln -s /etc/nginx/sites-available/stream.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d stream.radiosynapse.fr
sudo systemctl restart nginx
```

---

### 3. Configuration du VPS 1 (Maître Applicatif, Régie & BDD)

Sur le VPS 1 tournent l'application web utilisateur, le panel admin, PocketBase et le moteur Liquidsoap qui encode et envoie le son vers le VPS 2.

#### A. Configuration de Liquidsoap (`/etc/liquidsoap/radio.liq` sur VPS 1)
Dans la section d'encodage et d'envoi de flux, configurez l'adresse IP ou le nom de domaine de votre **VPS 2** :

```liq
# Paramètres du relais Icecast (VPS 2)
ICECAST_HOST = "198.51.100.20"  # IP du VPS 2
ICECAST_PORT = 8000
ICECAST_PASSWORD = "SecretMasterSourceKey_2026!"

# Envoi du flux Principal HD MP3 320 kbps vers le VPS 2
output.icecast(
  %mp3(bitrate=320, samplerate=44100, stereo=true),
  host = ICECAST_HOST,
  port = ICECAST_PORT,
  password = ICECAST_PASSWORD,
  mount = "/synapse_hd.mp3",
  name = "Radio Synapse HD",
  description = "Flux Principal Haute Définition",
  genre = "Electronic / Pop / Synthwave",
  url = "https://radiosynapse.fr",
  fallible = true,
  master_processed
)

# Envoi du flux Clubbing MP3 256 kbps vers le VPS 2
output.icecast(
  %mp3(bitrate=256, samplerate=44100, stereo=true),
  host = ICECAST_HOST,
  port = ICECAST_PORT,
  password = ICECAST_PASSWORD,
  mount = "/synapse_club.mp3",
  name = "Radio Synapse Club",
  description = "Clubbing & Live DJ Set",
  genre = "Club / House / Techno",
  url = "https://radiosynapse.fr",
  fallible = true,
  master_processed
)

# Envoi du flux AAC 192 kbps vers le VPS 2
output.icecast(
  %fdkaac(channels=2, samplerate=44100, bitrate=192, afterburner=true),
  host = ICECAST_HOST,
  port = ICECAST_PORT,
  password = ICECAST_PASSWORD,
  mount = "/synapse_chill.aac",
  name = "Radio Synapse Mobile AAC",
  description = "Flux Optimisé Mobile & Basse Consommation",
  genre = "Chill / Lo-Fi",
  url = "https://radiosynapse.fr",
  fallible = true,
  master_processed
)
```

Redémarrez le service Liquidsoap sur VPS 1 :
```bash
sudo systemctl restart liquidsoap@radio
```

#### B. Sécurisation du port Harbor DJ Live sur VPS 1
Le port Harbor `8005` (utilisé par les DJs pour se connecter en direct via BUTT, OBS ou Mixxx) reste sur le VPS 1 :
```bash
sudo ufw allow 8005/tcp comment "Liquidsoap Harbor DJ Live"
```

---

### 4. Avantages de cette Architecture Séparée

1. **Isolation de la bande passante** : Même avec 10 000 auditeurs écoutant le flux en 320 kbps (~3.2 Gbps de trafic réseau), le VPS 1 (Panel Admin, PocketBase, Node.js) conserve 100% de son CPU et de ses entrées/sorties disque pour l'application.
2. **Tolérance aux pannes & Relais multiples** : Vous pouvez à tout moment ajouter un **VPS 3** (par exemple situé en Amérique du Nord ou en Asie) configuré en esclave Icecast qui se synchronise automatiquement sur le VPS 2.
3. **Mises à jour sans coupure d'antenne** : Vous pouvez redémarrer le serveur web Node.js ou PocketBase sur le VPS 1 pour déployer une mise à jour applicative : l'antenne radio et les auditeurs connectés sur le VPS 2 continuent d'écouter sans aucune interruption grâce au buffer audio !
