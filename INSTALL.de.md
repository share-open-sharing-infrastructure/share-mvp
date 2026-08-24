# AllerLeih selbst hosten — Docker-Stack mit Caddy

Schritt-für-Schritt-Anleitung, um eine eigene AllerLeih-Instanz aus den beiden offiziellen
Container-Images hochzufahren: **Frontend** (SvelteKit) + **Backend** (PocketBase), davor
**Caddy** als Reverse Proxy mit automatischem HTTPS. Rechne mit 30–45 Minuten.

*English version: [INSTALL.md](INSTALL.md) · Alle Dateien dieser Anleitung liegen im Ordner
**[`deploy/`](deploy)** ([auf GitHub ansehen](https://github.com/share-open-sharing-infrastructure/share-mvp/tree/main/deploy)).
Die technische Referenz zu einzelnen Variablen steht in
[`docs/operations/self-hosting.md`](docs/operations/self-hosting.md) — diese Anleitung hier ist
der Weg von null bis „läuft".*

> [!WARNING]
> **Vor dem öffentlichen Betrieb zwingend [Schritt 9](#schritt-9--pflicht-vor-dem-livegang) lesen.**
> Das unveränderte Frontend-Image zeigt das **Impressum und die Rechtstexte des
> Upstream-Betreibers** (AllerLeih e.V., Lüneburg). Für eine öffentliche Instanz in Deutschland
> ist das nicht zulässig — und das Impressum ist derzeit **nicht** per Env-Variable änderbar.

---

## Inhalt

1. [Voraussetzungen](#voraussetzungen)
2. [Wie der Stack aufgebaut ist](#wie-der-stack-aufgebaut-ist)
3. [Welche Dateien du bearbeitest](#welche-dateien-du-bearbeitest)
4. [Schritt 1 — Dateien holen](#schritt-1--dateien-holen)
5. [Schritt 2 — DNS setzen](#schritt-2--dns-setzen)
6. [Schritt 3 — Datenverzeichnis anlegen](#schritt-3--datenverzeichnis-anlegen)
7. [Schritt 4 — `.env` ausfüllen](#schritt-4--env-ausfüllen)
8. [Schritt 5 — Caddy installieren und konfigurieren](#schritt-5--caddy-installieren-und-konfigurieren)
9. [Schritt 6 — Stack starten](#schritt-6--stack-starten)
10. [Schritt 7 — Superuser anlegen](#schritt-7--superuser-anlegen)
11. [Schritt 8 — Funktionsprüfung](#schritt-8--funktionsprüfung)
12. [Schritt 9 — Pflicht vor dem Livegang](#schritt-9--pflicht-vor-dem-livegang)
13. [Schritt 10 — E-Mail (SMTP)](#schritt-10--e-mail-smtp)
14. [Schritt 11 — Backup](#schritt-11--backup)
15. [Betrieb: Updates, Rollback, Logs](#betrieb-updates-rollback-logs)
16. [Troubleshooting](#troubleshooting)

---

## Voraussetzungen

| | |
|---|---|
| Host | Linux-Server mit öffentlicher IPv4 (IPv6 optional), ~1 GB RAM, ~5 GB Platte |
| Docker | Docker Engine ≥ 24 |
| Docker Compose | **≥ 2.24** — ältere Versionen verstehen die `env_file:`-Langform in `compose.yaml` nicht. Prüfen: `docker compose version` |
| DNS | **zwei** Hostnamen, die du auf diesen Host zeigen lässt (z. B. `app.example.org` + `pb.example.org`) |
| Ports | 80 und 443 von außen erreichbar (Caddy braucht 80 für die Zertifikatsausstellung) |
| Accounts | Ein kostenloser [OpenRouteService](https://openrouteservice.org)-API-Key (Adresssuche + Fahrzeiten). Optional: SMTP-Zugang, [Mistral](https://mistral.ai)-Key |

Diese Anleitung wurde gegen folgende Stände verifiziert: Docker 29.7.2, Docker Compose 5.5.0,
`allerleih-frontend:latest` (`sha-1a76ab6`), `allerleih-backend:latest` (`sha-7d00249`), Caddy 2.

---

## Wie der Stack aufgebaut ist

```
                          ┌──────────────────────────────────────────┐
   Browser ──── HTTPS ───▶│  Caddy (auf dem Host, Port 80/443)       │
                          │  app.example.org  ──▶ 127.0.0.1:3000     │──▶ Frontend-Container
                          │  pb.example.org   ──▶ 127.0.0.1:8090     │──▶ Backend-Container
                          └──────────────────────────────────────────┘        │
                                        ▲                                     │ SQLite + Uploads
   Frontend-Container ───────────────────┘                            ┌───────▼────────┐
   (spricht PocketBase über https://pb.example.org an,                │ deploy/pb_data │
    NICHT über das Docker-Netz)                                       └────────────────┘
```

**Der wichtigste Punkt der ganzen Anleitung:** PocketBase braucht einen **eigenen öffentlichen
Hostnamen**. Der Browser spricht direkt mit PocketBase — Realtime-Updates (SSE), Bild-URLs und
alle clientseitigen Aufrufe laufen dorthin. Trägst du in `PUBLIC_PB_URL` die
Compose-interne Adresse `http://backend:8090` ein, rendern die Seiten trotzdem: serverseitig
funktioniert diese Adresse ja. Im Browser bricht dann alles — **ohne eine einzige Fehlermeldung**.

Beide Container veröffentlichen ihre Ports **nur auf `127.0.0.1`**. Von außen ist ausschließlich
Caddy erreichbar; PocketBase hat kein eigenes TLS und darf nie direkt ins Netz.

---

## Welche Dateien du bearbeitest

| Datei | Woher sie kommt | Was du daran änderst |
|---|---|---|
| **`deploy/.env`** | Kopie von [`deploy/.env.docker.example`](deploy/.env.docker.example) | **Alles Inhaltliche**: Hostnamen, Keys, Passwörter, SMTP. Enthält Secrets ⇒ `chmod 600`, niemals committen. |
| **`/etc/caddy/Caddyfile`** | Kopie von [`deploy/Caddyfile`](deploy/Caddyfile) | Die **zwei Platzhalter-Hostnamen**. Optional: die IP-Allowlist für die Admin-Oberfläche. |
| **`deploy/compose.yaml`** | [Repo](deploy/compose.yaml), unverändert übernehmen | **Nichts.** Image-Versionen werden über `.env` gesteuert, nicht hier. |
| **`deploy/pb_data/`** | Legst du in Schritt 3 selbst an | Nur einmal `chown`. Danach nie wieder von Hand anfassen — das ist die komplette Datenbank. |

---

## Schritt 1 — Dateien holen

Du brauchst **nicht** das ganze Repository — die Images kommen fertig von GHCR. Drei Dateien
genügen:

```bash
mkdir -p ~/allerleih && cd ~/allerleih
BASE=https://raw.githubusercontent.com/share-open-sharing-infrastructure/share-mvp/main/deploy
curl -fsSLO "$BASE/compose.yaml"
curl -fsSLO "$BASE/Caddyfile"
curl -fsSL  "$BASE/.env.docker.example" -o .env.docker.example
cp .env.docker.example .env && chmod 600 .env
ls -l
```

Alternativ das ganze Repo klonen und in `deploy/` arbeiten:

```bash
git clone https://github.com/share-open-sharing-infrastructure/share-mvp.git
cd share-mvp/deploy && cp .env.docker.example .env && chmod 600 .env
```

Alle weiteren Befehle laufen **in diesem Verzeichnis** (dort, wo `compose.yaml` liegt).

---

## Schritt 2 — DNS setzen

Beide Namen müssen auf die öffentliche IP dieses Hosts zeigen — **bevor** Caddy startet, sonst
schlägt die Zertifikatsausstellung fehl.

```
app.example.org.   A     203.0.113.10      (und AAAA, falls IPv6 vorhanden)
pb.example.org.    A     203.0.113.10
```

Prüfen:

```bash
dig +short app.example.org
dig +short pb.example.org
```

Firewall: Port **80 und 443** müssen von außen offen sein. Port 80 wird für die
HTTP-01-Challenge von Let's Encrypt gebraucht, auch wenn später alles über HTTPS läuft.

---

## Schritt 3 — Datenverzeichnis anlegen

`pb_data/` ist ein **Bind-Mount**, kein Docker-Volume. Ein Bind-Mount erbt die Rechte des Images
**nicht** — und der Backend-Container läuft als fester, nicht-privilegierter Benutzer
**uid/gid 1001**. Ohne diesen Schritt startet das Backend nicht.

```bash
mkdir -p pb_data
sudo chown 1001:1001 pb_data
```

Kein `sudo` verfügbar? Dasselbe über Docker:

```bash
mkdir -p pb_data
docker run --rm -v "$PWD/pb_data":/mnt alpine:3.22 chown 1001:1001 /mnt
```

Kontrolle — es muss `1001 1001` dastehen:

```bash
ls -ldn pb_data
# drwxr-xr-x 2 1001 1001 40 ... pb_data
```

> Vergisst du das, bricht der Backend-Container beim Start mit
> `unable to open database file (14)` ab. Das ist der SQLite-Fehlercode für „kann die
> Datenbankdatei nicht öffnen" — der Prozess darf schlicht nicht in das Verzeichnis schreiben.

---

## Schritt 4 — `.env` ausfüllen

Öffne `.env` (die Kopie aus Schritt 1) im Editor. Beide Container lesen **dieselbe** Datei.

### 4.1 Die sieben Pflichtwerte des Frontends

Fehlt einer davon — oder ist er leer —, **startet der Frontend-Container nicht** und nennt im Log
jeden fehlenden Namen einzeln. Das ist Absicht: eine halb konfigurierte Instanz soll gar nicht
erst hochkommen.

| Variable | Wert | Wie du ihn bekommst |
|---|---|---|
| `PUBLIC_PB_URL` | `https://pb.example.org/` | Dein PocketBase-Hostname aus Schritt 2. **Nie** `http://backend:8090`. |
| `PUBLIC_VAPID_PUBLIC_KEY` | langer Base64-String | siehe 4.2 |
| `VAPID_PRIVATE_KEY` | kürzerer Base64-String | siehe 4.2 |
| `VAPID_SUBJECT` | `mailto:kontakt@example.org` | eigene Kontaktadresse |
| `ORS_API_KEY` | API-Key | kostenlos auf [openrouteservice.org](https://openrouteservice.org) registrieren |
| `PB_SUPERUSER_EMAIL` | `admin@example.org` | frei wählbar — genau diese Adresse legst du in Schritt 7 an |
| `PB_SUPERUSER_PASSWORD` | starkes Passwort | `openssl rand -base64 24` |

### 4.2 VAPID-Schlüsselpaar erzeugen (für Push-Benachrichtigungen)

**Niemals** ein Beispiel- oder fremdes Schlüsselpaar übernehmen:

```bash
npx --yes web-push generate-vapid-keys
```

Ohne Node auf dem Host geht es auch per Container:

```bash
docker run --rm node:24-alpine npx --yes web-push generate-vapid-keys
```

Ausgabe → `Public Key:` nach `PUBLIC_VAPID_PUBLIC_KEY`, `Private Key:` nach `VAPID_PRIVATE_KEY`.

### 4.3 Praktisch ebenso wichtig (kein Startabbruch, aber sonst kaputt)

| Variable | Wert | Was ohne sie passiert |
|---|---|---|
| `ORIGIN` | `https://app.example.org` (ohne Slash am Ende) | **Jede** Formularaktion inkl. Login schlägt mit „Cross-site POST form submissions are forbidden" fehl. Muss exakt dem entsprechen, was Nutzer im Browser eingeben. |
| `FRONTEND_URL` | `https://app.example.org` | Backend-Variable. Bestimmt die Links in Registrierungs- und Passwort-Reset-Mails — falsch gesetzt zeigen sie ins Leere. |
| `APP_URL` | `https://pb.example.org` | Backend-Variable. Basis für Mail-Logos und den Abmeldelink im Wochen-Digest. |
| `PUBLIC_SITE_ORIGIN` | `https://app.example.org` | Ohne diesen Wert trägt deine `sitemap.xml` **`https://allerleih.org/`** als Adresse ein — du meldest Suchmaschinen also fremde URLs. |
| `PUBLIC_INSTANCE_CITY` | z. B. `Marburg` | Sonst steht überall „Lüneburg". |

### 4.4 Optional

`MISTRAL_API_KEY` (KI-Fotoanalyse; ohne ihn antwortet nur `/api/analyze-item` mit 503),
`PUBLIC_APP_NAME`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_ANALYTICS_*`, sowie die
`BACKEND_IMAGE_TAG`/`FRONTEND_IMAGE_TAG`-Pins (siehe [Betrieb](#betrieb-updates-rollback-logs)).

> [!CAUTION]
> **Jede Variable, die mit `PUBLIC_` beginnt, landet im ausgelieferten HTML** — und zwar die
> komplette `PUBLIC_*`-Umgebung, nicht nur die Werte, die eine Seite tatsächlich benutzt. Schreibe
> dort niemals ein Secret hinein. Umgekehrt geprüft: `ORS_API_KEY` und `PB_SUPERUSER_PASSWORD`
> tauchen im gerenderten HTML **nicht** auf.

---

## Schritt 5 — Caddy installieren und konfigurieren

### 5.1 Installieren (Debian/Ubuntu)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

Das Paket startet Caddy direkt als systemd-Dienst `caddy` und liest `/etc/caddy/Caddyfile`.

### 5.2 Konfiguration einsetzen

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo sed -i -e 's/app\.example\.org/app.deine-domain.de/' \
            -e 's/pb\.example\.org/pb.deine-domain.de/' /etc/caddy/Caddyfile
```

Danach steht in `/etc/caddy/Caddyfile` im Kern nur das hier:

```caddyfile
app.deine-domain.de {
	reverse_proxy 127.0.0.1:3000
}

pb.deine-domain.de {
	reverse_proxy 127.0.0.1:8090 {
		flush_interval -1
	}
}
```

`flush_interval -1` schaltet die Antwortpufferung für PocketBase ab. Caddy erkennt den
SSE-Stream (`text/event-stream`) zwar von selbst und leitet ihn ungepuffert weiter — die Zeile
steht explizit da, damit man sich nicht darauf verlassen muss. *(Bei nginx statt Caddy ist
`proxy_buffering off;` an dieser Stelle **Pflicht**, sonst kommen Realtime-Updates nie an.)*

### 5.3 Optional, aber empfohlen: Admin-Oberfläche einschränken

`https://pb.deine-domain.de/_/` ist die PocketBase-Administration — voller, ungefilterter
Datenbankzugriff. Standardmäßig ist sie so öffentlich wie der Rest der API. Im mitgelieferten
`Caddyfile` steht dafür ein auskommentierter Block; einkommentieren und die eigenen
IP-Bereiche eintragen:

```caddyfile
pb.deine-domain.de {
	reverse_proxy 127.0.0.1:8090 {
		flush_interval -1
	}

	@admin_denied {
		path /_/*
		not remote_ip 203.0.113.0/24 198.51.100.7
	}
	abort @admin_denied
}
```

Wirkung (getestet): Anfragen an `/_/*` von nicht gelisteten IPs werden hart abgebrochen, die
normale API unter `/api/*` bleibt unberührt erreichbar.

### 5.4 Prüfen und aktivieren

```bash
sudo caddy validate --config /etc/caddy/Caddyfile   # muss "Valid configuration" sagen
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Beim ersten Start holt Caddy die Zertifikate für beide Namen. Das dauert einige Sekunden;
`journalctl -u caddy -f` zeigt `certificate obtained successfully`.

---

## Schritt 6 — Stack starten

```bash
docker compose pull
docker compose up -d
```

Compose startet zuerst das Backend, wartet, bis dessen Healthcheck **healthy** meldet, und erst
dann das Frontend. Das ist gewollt: PocketBase wendet beim Start alle offenen Migrationen an, und
ein Frontend, das schneller da ist, liefert beim ersten Aufruf eine kaputte Startseite.

Erwartete Ausgabe:

```
 Container allerleih-backend-1   Healthy
 Container allerleih-frontend-1  Started
```

Status kontrollieren — beide müssen `Up … (healthy)` sein:

```bash
docker compose ps
docker compose logs -f          # Abbruch mit Strg-C
```

---

## Schritt 7 — Superuser anlegen

```bash
docker compose exec backend /app/pocketbase superuser upsert admin@example.org 'DEIN-PASSWORT'
```

Erwartete Ausgabe: `Successfully saved superuser "admin@example.org"!`

**Nimm exakt dieselben Werte wie in `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`.** Das
Frontend meldet sich damit zur Laufzeit selbst an — für den `/admin`-Bereich und die öffentlichen
Statistiken. Weichen die Werte voneinander ab, startet zwar alles, aber der Admin-Bereich bleibt
leer.

Der Befehl funktioniert auch am laufenden Container; ein Neustart ist nicht nötig.

---

## Schritt 8 — Funktionsprüfung

Alle sieben Prüfungen einmal durchgehen. So sieht ein gesunder Stack aus:

```bash
# 1) Backend direkt (nur lokal erreichbar)
curl -s http://127.0.0.1:8090/api/health
# → {"message":"API is healthy.","code":200,"data":{}}

# 2) Frontend direkt
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
# → 200

# 3) Frontend über HTTPS
curl -s -o /dev/null -w '%{http_code}\n' https://app.deine-domain.de/
# → 200

# 4) PocketBase über HTTPS
curl -s https://pb.deine-domain.de/api/health
# → {"message":"API is healthy.",...}

# 5) Realtime/SSE — muss SOFORT etwas ausgeben, nicht erst nach dem Timeout
timeout 6 curl -sN https://pb.deine-domain.de/api/realtime
# → event:PB_CONNECT  mit einer clientId

# 6) Admin-Oberfläche
curl -s -o /dev/null -w '%{http_code}\n' https://pb.deine-domain.de/_/
# → 200   (bzw. abgebrochene Verbindung, wenn du 5.3 aktiviert hast und von außen testest)

# 7) Der Härtetest: eine echte Formularaktion. Prüft in einem Rutsch ORIGIN,
#    den Reverse Proxy und dass das Frontend PocketBase erreicht.
curl -s -X POST 'https://app.deine-domain.de/auth/login?/login' \
  -H 'Origin: https://app.deine-domain.de' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'x-sveltekit-action: true' \
  --data 'email=nobody@example.org&password=falsch'
# → {"type":"failure","status":400,...  "E-Mail-Adresse oder Passwort falsch."}
```

Prüfung 7 ist die aussagekräftigste. Kommt dort **HTTP 403**, stimmt `ORIGIN` nicht. Kommt
`{"type":"error"...,"Internal Error"}` (HTTP 500), erreicht der Frontend-Container die Adresse aus
`PUBLIC_PB_URL` nicht — siehe [Troubleshooting](#troubleshooting).

Zum Schluss einmal im Browser `https://app.deine-domain.de` aufrufen, registrieren und einlogen.

---

## Schritt 9 — Pflicht vor dem Livegang

### 9.1 Rechtstexte ersetzen

Die Datenbank wird mit den **echten Rechtstexten von allerleih.org** vorbelegt — nachgeprüft auf
einer frischen Instanz:

| Dokument | Titel im Auslieferungszustand |
|---|---|
| `docType = tos` | „Allgemeine Geschäftsbedingungen — allerleih.org" (Version 1.3) |
| `docType = privacy` | „Datenschutzerklärung — allerleih.org" (Version 2.9) |

Das sind bindende Dokumente, denen deine Nutzer beim Registrieren zustimmen — und sie nennen
einen **fremden Vertragspartner**. Vor der ersten echten Anmeldung ersetzen:

1. `https://pb.deine-domain.de/_/` öffnen, Sammlung `legal_documents`.
2. Beide Datensätze öffnen und `title` + `body` durch deine eigenen Texte ersetzen.
3. Solange noch niemand zugestimmt hat, ist **kein** Versionssprung nötig. Später schon —
   siehe [`docs/operations/updating-legal-documents.md`](docs/operations/updating-legal-documents.md).

### 9.2 Impressum — der offene Punkt

> [!WARNING]
> Das unveränderte Frontend-Image zeigt unter `/misc/imprint` folgendes an — nachgeprüft:
> **AllerLeih e.V., Lüner Weg 17, 21337 Lüneburg**, samt namentlich genannter Vertreter und
> Vereinsregisternummer. Also die echten Daten des Upstream-Betreibers.

Für eine öffentlich erreichbare Instanz in Deutschland ist ein korrektes Impressum nach § 5 DDG
(vormals § 5 TMG) Pflicht. **Es gibt dafür aktuell keine Env-Variable** — die Werte stehen fest
verdrahtet in `src/lib/instance.ts` (Block `imprint:`, ~Zeile 224). Zwei Wege:

- **Warten**, bis [Issue #629](https://github.com/share-open-sharing-infrastructure/share-mvp/issues/629)
  gemergt ist (PR #664 ist offen). Danach wird das Impressum per Env gesetzt und auf einer
  nicht-Flaggschiff-Instanz sogar erzwungen.
- **Eigenes Image bauen**: Repo forken, den `imprint`-Block in `src/lib/instance.ts` durch die
  eigenen Daten ersetzen, `docker build -t meine-registry/allerleih-frontend:eigen .`, pushen und
  in `.env` per `FRONTEND_IMAGE_TAG` bzw. direkt in `compose.yaml` einsetzen.

Bis dahin: die Instanz nicht öffentlich bewerben oder mit `robots.txt`/Zugangsschutz privat halten.

### 9.3 `PUBLIC_SITE_ORIGIN` setzen

Ohne diesen Wert trägt `https://app.deine-domain.de/sitemap.xml` als erste Adresse
`https://allerleih.org/` ein (nachgeprüft) — du lieferst Suchmaschinen also fremde URLs. Setze
`PUBLIC_SITE_ORIGIN` in `.env` und starte mit `docker compose up -d` neu.

---

## Schritt 10 — E-Mail (SMTP)

Ohne SMTP werden Bestätigungsmails zur Registrierung, Passwort-Resets und Digests **stillschweigend
nicht** versendet — es gibt keine Fehlermeldung.

In `.env`:

```dotenv
SMTP_HOST=mail.example.org
SMTP_PORT=587
SMTP_USERNAME=noreply@example.org
SMTP_PASSWORD=…
SMTP_TLS=false          # false = STARTTLS (Port 587), true = implizites TLS (Port 465)
SENDER_ADDRESS=noreply@example.org
SENDER_NAME=AllerLeih
```

Danach `docker compose up -d backend`. Die Werte werden beim Backend-Start angewendet — **nur
wenn `SMTP_HOST` gesetzt ist**. Ein leerer Wert setzt nichts zurück, du kannst Mail also
alternativ komplett über die Admin-Oberfläche konfigurieren. Testmail: Admin-UI →
*Settings* → *Mail settings* → *Send test email*.

Für Zustellbarkeit (SPF/DKIM/DMARC) siehe
[`docs/operations/mail-deliverability.md`](docs/operations/mail-deliverability.md).

---

## Schritt 11 — Backup

`pb_data/` ist der **gesamte** veränderliche Zustand: SQLite-Datenbank und alle hochgeladenen
Bilder. Zwei Wege:

```bash
# A) PocketBase-eigenes Backup (konsistent, im laufenden Betrieb)
#    Admin-UI → Settings → Backups → "New backup". Liegt danach in pb_data/backups/.

# B) Verzeichnis sichern, Backend vorher anhalten
docker compose stop backend
tar czf pb_data-$(date +%F).tgz pb_data
docker compose start backend
```

- `pb_data` **nicht** auf NFS/CIFS legen — SQLite braucht echtes File-Locking.
- Die laufende Datenbankdatei einfach wegzukopieren kann einen inkonsistenten Stand erwischen;
  nimm Weg A oder B.
- **Einen Restore mindestens einmal testen.** Ein ungetestetes Backup ist kein Backup.
- Ein Backup enthält dieselben personenbezogenen Daten wie die Instanz — E-Mail-Adressen,
  Koordinaten, Nachrichten, Bilder. Zugriff beschränken, außer Haus verschlüsseln,
  Aufbewahrungsfrist festlegen.

---

## Betrieb: Updates, Rollback, Logs

### Versionen festnageln

`:latest` zieht immer den neuesten Build. Für den Produktivbetrieb in `.env` pinnen:

```dotenv
BACKEND_IMAGE_TAG=sha-7d00249
FRONTEND_IMAGE_TAG=sha-1a76ab6
```

Die verfügbaren Tags stehen auf den GHCR-Paketseiten der beiden Images. Damit ist ein Update eine
bewusste, einzeilige Änderung — und `compose.yaml` bleibt unangetastet.

### Update durchführen

```bash
# 1. IMMER zuerst sichern (siehe Schritt 11) — ein Update ist eine Schemamigration.
docker compose stop backend && tar czf pb_data-$(date +%F).tgz pb_data && docker compose start backend

# 2. Neue Images holen und neu erzeugen
docker compose pull && docker compose up -d

# 3. Mitlesen
docker compose logs -f backend
docker compose ps
```

Beim Start des Backends laufen alle offenen Migrationen automatisch durch.

> [!IMPORTANT]
> **Ein Tag-Rollback macht eine Migration nicht rückgängig.** PocketBase migriert nicht abwärts.
> Nach einem Update, das das Schema geändert hat, führt der Rückweg über das Backup aus Schritt 11
> — nicht über das Zurücksetzen des Tags.

### Nützliche Befehle

```bash
docker compose logs -f frontend        # nur Frontend
docker compose restart frontend        # Neustart nach .env-Änderung: besser `up -d`
docker compose up -d                   # übernimmt geänderte .env-Werte
docker compose down                    # stoppt alles; pb_data bleibt erhalten
docker compose exec backend sh         # Shell im Backend-Container
sudo journalctl -u caddy -f            # Proxy-Logs
```

Nach jeder `.env`-Änderung `docker compose up -d` — ein bloßes `restart` liest die Datei nicht neu.

---

## Troubleshooting

| Symptom | Ursache | Lösung |
|---|---|---|
| Backend-Container beendet sich sofort, Log: `unable to open database file (14)` | `pb_data` gehört nicht uid 1001 | Schritt 3 nachholen: `sudo chown 1001:1001 pb_data` |
| Frontend startet nicht, Log: `AllerLeih cannot start: N required environment variable(s) are missing or empty` | Pflichtvariable fehlt oder ist leer | Der Log **nennt jede fehlende Variable samt Zweck**. In `.env` ergänzen, `docker compose up -d`. |
| Login/Registrierung antwortet **403** | `ORIGIN` fehlt oder passt nicht exakt zum aufgerufenen Hostnamen | `ORIGIN=https://app.deine-domain.de` (ohne Slash am Ende), `docker compose up -d` |
| Login antwortet **500**, Frontend-Log zeigt `ECONNREFUSED` und `HTTP error status codes must be between 400 and 599 — 0 is invalid` | Der Frontend-**Container** erreicht `PUBLIC_PB_URL` nicht (DNS im Container zeigt woanders hin, oder die Firewall blockt den Weg über die eigene öffentliche IP) | Test: `docker compose exec frontend wget -qO- https://pb.deine-domain.de/api/health`. Schlägt das fehl, in `compose.yaml` beim `frontend`-Dienst ergänzen: `extra_hosts: ['pb.deine-domain.de:host-gateway']` |
| Seite lädt, aber keine Bilder und keine Live-Updates | `PUBLIC_PB_URL` zeigt auf eine intern-only-Adresse | Auf den **öffentlichen** PocketBase-Hostnamen ändern, `docker compose up -d` |
| Realtime-Updates kommen verzögert oder gar nicht | Der Proxy puffert den SSE-Stream | Bei Caddy `flush_interval -1` im `pb`-Block; bei nginx `proxy_buffering off;` |
| Caddy bekommt kein Zertifikat | DNS zeigt nicht (oder noch nicht) hierher, oder Port 80 ist zu | `dig +short …` prüfen, Firewall öffnen, `sudo journalctl -u caddy -e` lesen |
| `docker compose config` meldet Fehler bei `env_file` | Compose älter als 2.24 | Docker Compose aktualisieren |
| Bestätigungsmails kommen nicht an | SMTP nicht konfiguriert, oder `FRONTEND_URL` falsch | Schritt 10; Links in der Mail prüfen |
| Admin-Oberfläche `/_/` nicht erreichbar | IP-Allowlist aus 5.3 aktiv | Eigene IP eintragen, `sudo systemctl reload caddy` |

---

## Verwandte Dokumente

- **[`deploy/`](deploy)** — die drei Dateien dieser Anleitung
  ([auf GitHub](https://github.com/share-open-sharing-infrastructure/share-mvp/tree/main/deploy))
- [`docs/operations/self-hosting.md`](docs/operations/self-hosting.md) — technische Referenz,
  Variable für Variable
- [`docs/architecture.md`](docs/architecture.md) — Architektur, Routen, Auth-Ablauf
- [`docs/operations/updating-legal-documents.md`](docs/operations/updating-legal-documents.md) —
  Rechtstexte versionieren
- [`docs/operations/mail-deliverability.md`](docs/operations/mail-deliverability.md) — SPF/DKIM/DMARC
- [INSTALL.md](INSTALL.md) — English version of this guide
