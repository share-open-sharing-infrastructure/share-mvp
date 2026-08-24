# Self-hosting AllerLeih — the Docker stack with Caddy

A step-by-step guide to bringing up your own AllerLeih instance from the two official container
images: the **frontend** (SvelteKit) and the **backend** (PocketBase), with **Caddy** in front as
a reverse proxy with automatic HTTPS. Budget 30–45 minutes.

*Deutsche Fassung: [INSTALL.de.md](INSTALL.de.md) · Every file this guide uses lives in the
**[`deploy/`](deploy)** folder
([view on GitHub](https://github.com/share-open-sharing-infrastructure/share-mvp/tree/main/deploy)).
For a per-variable technical reference see
[`docs/operations/self-hosting.md`](docs/operations/self-hosting.md) — this document is the path
from nothing to a running instance.*

> [!WARNING]
> **Read [step 9](#step-9--mandatory-before-going-live) before running this publicly.** The stock
> frontend image serves the **upstream operator's own imprint and legal documents** (AllerLeih
> e.V., Lüneburg). For a public instance in Germany that is not acceptable — and the imprint
> currently **cannot** be changed through an environment variable.

---

## Contents

1. [Prerequisites](#prerequisites)
2. [How the stack fits together](#how-the-stack-fits-together)
3. [Which files you edit](#which-files-you-edit)
4. [Step 1 — Get the files](#step-1--get-the-files)
5. [Step 2 — Point DNS at the host](#step-2--point-dns-at-the-host)
6. [Step 3 — Create the data directory](#step-3--create-the-data-directory)
7. [Step 4 — Fill in `.env`](#step-4--fill-in-env)
8. [Step 5 — Install and configure Caddy](#step-5--install-and-configure-caddy)
9. [Step 6 — Start the stack](#step-6--start-the-stack)
10. [Step 7 — Create the superuser](#step-7--create-the-superuser)
11. [Step 8 — Verify it works](#step-8--verify-it-works)
12. [Step 9 — Mandatory before going live](#step-9--mandatory-before-going-live)
13. [Step 10 — Email (SMTP)](#step-10--email-smtp)
14. [Step 11 — Backups](#step-11--backups)
15. [Operations: updates, rollback, logs](#operations-updates-rollback-logs)
16. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| | |
|---|---|
| Host | Linux server with a public IPv4 (IPv6 optional), ~1 GB RAM, ~5 GB disk |
| Docker | Docker Engine ≥ 24 |
| Docker Compose | **≥ 2.24** — older versions don't understand the long-form `env_file:` syntax in `compose.yaml`. Check with `docker compose version` |
| DNS | **two** hostnames pointing at this host (e.g. `app.example.org` + `pb.example.org`) |
| Ports | 80 and 443 reachable from the internet (Caddy needs 80 to issue certificates) |
| Accounts | A free [OpenRouteService](https://openrouteservice.org) API key (address autocomplete + travel times). Optional: SMTP credentials, a [Mistral](https://mistral.ai) key |

This guide was verified against: Docker 29.7.2, Docker Compose 5.5.0,
`allerleih-frontend:latest` (`sha-1a76ab6`), `allerleih-backend:latest` (`sha-7d00249`), Caddy 2.

---

## How the stack fits together

```
                          ┌──────────────────────────────────────────┐
   Browser ──── HTTPS ───▶│  Caddy (on the host, ports 80/443)       │
                          │  app.example.org  ──▶ 127.0.0.1:3000     │──▶ frontend container
                          │  pb.example.org   ──▶ 127.0.0.1:8090     │──▶ backend container
                          └──────────────────────────────────────────┘        │
                                        ▲                                     │ SQLite + uploads
   frontend container ───────────────────┘                            ┌───────▼────────┐
   (reaches PocketBase via https://pb.example.org,                    │ deploy/pb_data │
    NOT over the Docker network)                                      └────────────────┘
```

**The single most important point in this guide:** PocketBase needs its **own public hostname**.
The browser talks to PocketBase directly — realtime updates (SSE), file URLs and every
client-side call go there. If you put the compose-internal address `http://backend:8090` into
`PUBLIC_PB_URL`, pages still render, because that address does work server-side. In the browser
everything breaks — **with no error message anywhere**.

Both containers publish their ports on **`127.0.0.1` only**. Caddy is the sole public entry
point; PocketBase has no TLS of its own and must never face the internet directly.

---

## Which files you edit

| File | Where it comes from | What you change |
|---|---|---|
| **`deploy/.env`** | copy of [`deploy/.env.docker.example`](deploy/.env.docker.example) | **Everything substantive**: hostnames, keys, passwords, SMTP. Holds secrets ⇒ `chmod 600`, never commit it. |
| **`/etc/caddy/Caddyfile`** | copy of [`deploy/Caddyfile`](deploy/Caddyfile) | The **two placeholder hostnames**. Optionally the IP allowlist for the admin UI. |
| **`deploy/compose.yaml`** | [the repo](deploy/compose.yaml), taken as-is | **Nothing.** Image versions are controlled through `.env`, not here. |
| **`deploy/pb_data/`** | you create it in step 3 | One `chown`, once. Never touch it by hand afterwards — it is the entire database. |

---

## Step 1 — Get the files

You do **not** need the whole repository — the images come prebuilt from GHCR. Three files are
enough:

```bash
mkdir -p ~/allerleih && cd ~/allerleih
BASE=https://raw.githubusercontent.com/share-open-sharing-infrastructure/share-mvp/main/deploy
curl -fsSLO "$BASE/compose.yaml"
curl -fsSLO "$BASE/Caddyfile"
curl -fsSL  "$BASE/.env.docker.example" -o .env.docker.example
cp .env.docker.example .env && chmod 600 .env
ls -l
```

Or clone the repository and work inside `deploy/`:

```bash
git clone https://github.com/share-open-sharing-infrastructure/share-mvp.git
cd share-mvp/deploy && cp .env.docker.example .env && chmod 600 .env
```

Every command below runs **in that directory** — wherever `compose.yaml` lives.

---

## Step 2 — Point DNS at the host

Both names must resolve to this host's public IP **before** Caddy starts, or certificate issuance
fails.

```
app.example.org.   A     203.0.113.10      (plus AAAA if you have IPv6)
pb.example.org.    A     203.0.113.10
```

Check:

```bash
dig +short app.example.org
dig +short pb.example.org
```

Firewall: ports **80 and 443** must be open. Port 80 is needed for Let's Encrypt's HTTP-01
challenge even though all traffic ends up on HTTPS.

---

## Step 3 — Create the data directory

`pb_data/` is a **bind mount**, not a named volume. A bind mount does **not** inherit ownership
from the image, and the backend container runs as a fixed, non-root **uid/gid 1001**. Skip this
step and the backend will not start.

```bash
mkdir -p pb_data
sudo chown 1001:1001 pb_data
```

No `sudo`? Do the same through Docker:

```bash
mkdir -p pb_data
docker run --rm -v "$PWD/pb_data":/mnt alpine:3.22 chown 1001:1001 /mnt
```

Verify — it must read `1001 1001`:

```bash
ls -ldn pb_data
# drwxr-xr-x 2 1001 1001 40 ... pb_data
```

> Skip it and the backend container dies at startup with `unable to open database file (14)` —
> SQLite's error code for "cannot open the database file". The process simply isn't allowed to
> write into that directory.

---

## Step 4 — Fill in `.env`

Open the `.env` you copied in step 1. Both containers read the **same** file.

### 4.1 The frontend's seven required values

If any one of them is missing — or empty — the **frontend container refuses to start** and names
every offender in its log. That is deliberate: a half-configured instance should not come up at
all.

| Variable | Value | How to get it |
|---|---|---|
| `PUBLIC_PB_URL` | `https://pb.example.org/` | Your PocketBase hostname from step 2. **Never** `http://backend:8090`. |
| `PUBLIC_VAPID_PUBLIC_KEY` | long base64 string | see 4.2 |
| `VAPID_PRIVATE_KEY` | shorter base64 string | see 4.2 |
| `VAPID_SUBJECT` | `mailto:contact@example.org` | your own contact address |
| `ORS_API_KEY` | API key | register for free at [openrouteservice.org](https://openrouteservice.org) |
| `PB_SUPERUSER_EMAIL` | `admin@example.org` | your choice — you create exactly this account in step 7 |
| `PB_SUPERUSER_PASSWORD` | strong password | `openssl rand -base64 24` |

### 4.2 Generate the VAPID key pair (web push)

**Never** reuse an example or someone else's key pair:

```bash
npx --yes web-push generate-vapid-keys
```

No Node on the host? Use a container:

```bash
docker run --rm node:24-alpine npx --yes web-push generate-vapid-keys
```

Put `Public Key:` into `PUBLIC_VAPID_PUBLIC_KEY` and `Private Key:` into `VAPID_PRIVATE_KEY`.

### 4.3 Just as important in practice (no startup check, but broken without them)

| Variable | Value | What breaks without it |
|---|---|---|
| `ORIGIN` | `https://app.example.org` (no trailing slash) | **Every** form action, login included, fails with "Cross-site POST form submissions are forbidden". Must match exactly what users type in the browser. |
| `FRONTEND_URL` | `https://app.example.org` | Backend variable. Drives the links in registration and password-reset mail — wrong value, dead links. |
| `APP_URL` | `https://pb.example.org` | Backend variable. Base for mail logos and the weekly digest's unsubscribe link. |
| `PUBLIC_SITE_ORIGIN` | `https://app.example.org` | Without it your `sitemap.xml` advertises **`https://allerleih.org/`** — you'd be submitting someone else's URLs to search engines. |
| `PUBLIC_INSTANCE_CITY` | e.g. `Marburg` | Otherwise the UI says "Lüneburg" everywhere. |

### 4.4 Optional

`MISTRAL_API_KEY` (AI photo analysis; without it only `/api/analyze-item` answers 503),
`PUBLIC_APP_NAME`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_ANALYTICS_*`, and the
`BACKEND_IMAGE_TAG`/`FRONTEND_IMAGE_TAG` pins (see
[Operations](#operations-updates-rollback-logs)).

> [!CAUTION]
> **Every variable starting with `PUBLIC_` ends up in the served HTML** — the whole `PUBLIC_*`
> environment, not just the values a page actually reads. Never put a secret there. Verified the
> other way round: `ORS_API_KEY` and `PB_SUPERUSER_PASSWORD` do **not** appear in the rendered
> HTML.

---

## Step 5 — Install and configure Caddy

### 5.1 Install (Debian/Ubuntu)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

The package starts Caddy as a systemd service named `caddy`, reading `/etc/caddy/Caddyfile`.

### 5.2 Install the configuration

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo sed -i -e 's/app\.example\.org/app.your-domain.org/' \
            -e 's/pb\.example\.org/pb.your-domain.org/' /etc/caddy/Caddyfile
```

At its core `/etc/caddy/Caddyfile` then contains just this:

```caddyfile
app.your-domain.org {
	reverse_proxy 127.0.0.1:3000
}

pb.your-domain.org {
	reverse_proxy 127.0.0.1:8090 {
		flush_interval -1
	}
}
```

`flush_interval -1` disables response buffering for PocketBase. Caddy already detects the SSE
stream (`text/event-stream`) and forwards it unbuffered — the line is spelled out so you don't
have to take that on faith. *(With nginx instead of Caddy, `proxy_buffering off;` on that route is
**mandatory**, or realtime updates never arrive.)*

### 5.3 Optional but recommended: restrict the admin UI

`https://pb.your-domain.org/_/` is the PocketBase admin panel — full, unrestricted database
access. By default it is as public as the rest of the API. The shipped `Caddyfile` carries a
commented-out block for this; uncomment it and fill in your own ranges:

```caddyfile
pb.your-domain.org {
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

Verified behaviour: requests to `/_/*` from non-listed IPs are dropped, while the regular API
under `/api/*` stays reachable.

### 5.4 Validate and activate

```bash
sudo caddy validate --config /etc/caddy/Caddyfile   # must print "Valid configuration"
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

On first start Caddy obtains certificates for both names. That takes a few seconds;
`journalctl -u caddy -f` shows `certificate obtained successfully`.

---

## Step 6 — Start the stack

```bash
docker compose pull
docker compose up -d
```

Compose starts the backend first, waits for its healthcheck to report **healthy**, and only then
starts the frontend. That ordering is on purpose: PocketBase applies pending migrations at
startup, and a frontend that gets there first serves a broken homepage on the first request.

Expected output:

```
 Container allerleih-backend-1   Healthy
 Container allerleih-frontend-1  Started
```

Check the state — both must read `Up … (healthy)`:

```bash
docker compose ps
docker compose logs -f          # Ctrl-C to stop following
```

---

## Step 7 — Create the superuser

```bash
docker compose exec backend /app/pocketbase superuser upsert admin@example.org 'YOUR-PASSWORD'
```

Expected output: `Successfully saved superuser "admin@example.org"!`

**Use exactly the values from `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`.** The frontend
authenticates with them at runtime — for the `/admin` area and the public statistics. If they
differ, everything still starts, but the admin area stays empty.

The command works against the running container; no restart needed.

---

## Step 8 — Verify it works

Run all seven checks once. This is what a healthy stack looks like:

```bash
# 1) Backend directly (loopback only)
curl -s http://127.0.0.1:8090/api/health
# → {"message":"API is healthy.","code":200,"data":{}}

# 2) Frontend directly
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
# → 200

# 3) Frontend over HTTPS
curl -s -o /dev/null -w '%{http_code}\n' https://app.your-domain.org/
# → 200

# 4) PocketBase over HTTPS
curl -s https://pb.your-domain.org/api/health
# → {"message":"API is healthy.",...}

# 5) Realtime/SSE — must print IMMEDIATELY, not after the timeout
timeout 6 curl -sN https://pb.your-domain.org/api/realtime
# → event:PB_CONNECT  with a clientId

# 6) Admin UI
curl -s -o /dev/null -w '%{http_code}\n' https://pb.your-domain.org/_/
# → 200   (or a dropped connection if you enabled 5.3 and test from outside)

# 7) The real test: an actual form action. Exercises ORIGIN, the reverse proxy
#    and the frontend's own reachability of PocketBase in one shot.
curl -s -X POST 'https://app.your-domain.org/auth/login?/login' \
  -H 'Origin: https://app.your-domain.org' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'x-sveltekit-action: true' \
  --data 'email=nobody@example.org&password=wrong'
# → {"type":"failure","status":400,...  "E-Mail-Adresse oder Passwort falsch."}
```

Check 7 is the most informative one. **HTTP 403** there means `ORIGIN` is wrong.
`{"type":"error"...,"Internal Error"}` (HTTP 500) means the frontend container cannot reach
`PUBLIC_PB_URL` — see [Troubleshooting](#troubleshooting).

Finally, open `https://app.your-domain.org` in a browser, register and log in.

---

## Step 9 — Mandatory before going live

### 9.1 Replace the seeded legal documents

The database ships pre-seeded with **allerleih.org's actual legal documents** — verified on a
fresh instance:

| Document | Title as shipped |
|---|---|
| `docType = tos` | "Allgemeine Geschäftsbedingungen — allerleih.org" (version 1.3) |
| `docType = privacy` | "Datenschutzerklärung — allerleih.org" (version 2.9) |

These are binding documents your users consent to at registration, and they name a **different
contracting party**. Replace them before the first real signup:

1. Open `https://pb.your-domain.org/_/`, collection `legal_documents`.
2. Open both records and replace `title` + `body` with your own texts.
3. As long as nobody has consented yet, **no** version bump is required. Later it is — see
   [`docs/operations/updating-legal-documents.md`](docs/operations/updating-legal-documents.md).

### 9.2 The imprint — the open gap

> [!WARNING]
> The stock frontend image serves this at `/misc/imprint` — verified: **AllerLeih e.V., Lüner Weg
> 17, 21337 Lüneburg**, including named representatives and the association register number. That
> is the upstream operator's real data.

A public instance in Germany legally requires a correct imprint under § 5 DDG (formerly § 5 TMG).
**There is no environment variable for it today** — the values are hardcoded in
`src/lib/instance.ts` (the `imprint:` block, around line 224). Two options:

- **Wait** for [issue #629](https://github.com/share-open-sharing-infrastructure/share-mvp/issues/629)
  to land (PR #664 is open). After that the imprint is set via env, and on a non-flagship instance
  it is even enforced at startup.
- **Build your own image**: fork the repo, replace the `imprint` block in `src/lib/instance.ts`
  with your own data, `docker build -t your-registry/allerleih-frontend:custom .`, push it, and
  reference it via `FRONTEND_IMAGE_TAG` or directly in `compose.yaml`.

Until then, don't advertise the instance publicly, or keep it private behind access control.

### 9.3 Set `PUBLIC_SITE_ORIGIN`

Without it, `https://app.your-domain.org/sitemap.xml` lists `https://allerleih.org/` as its first
entry (verified) — you'd hand search engines someone else's URLs. Set `PUBLIC_SITE_ORIGIN` in
`.env` and re-run `docker compose up -d`.

---

## Step 10 — Email (SMTP)

Without SMTP, registration verification mail, password resets and digests are **silently not
sent** — there is no error.

In `.env`:

```dotenv
SMTP_HOST=mail.example.org
SMTP_PORT=587
SMTP_USERNAME=noreply@example.org
SMTP_PASSWORD=…
SMTP_TLS=false          # false = STARTTLS (port 587), true = implicit TLS (port 465)
SENDER_ADDRESS=noreply@example.org
SENDER_NAME=AllerLeih
```

Then `docker compose up -d backend`. The values are applied at backend startup — **only when
`SMTP_HOST` is set**. An empty value resets nothing, so you can equally configure mail entirely
through the admin UI. Test mail: admin UI → *Settings* → *Mail settings* → *Send test email*.

For deliverability (SPF/DKIM/DMARC) see
[`docs/operations/mail-deliverability.md`](docs/operations/mail-deliverability.md).

---

## Step 11 — Backups

`pb_data/` is the **entire** mutable state: the SQLite database and every uploaded image. Two
ways:

```bash
# A) PocketBase's own backup (consistent, while the server keeps running)
#    Admin UI → Settings → Backups → "New backup". Lands in pb_data/backups/.

# B) Copy the directory with the backend stopped
docker compose stop backend
tar czf pb_data-$(date +%F).tgz pb_data
docker compose start backend
```

- Do **not** put `pb_data` on NFS/CIFS — SQLite needs real file locking.
- Copying the live database file can capture an inconsistent snapshot; use option A or B.
- **Test a restore at least once.** An untested backup is not a backup.
- A backup holds the same personal data as the live instance — email addresses, coordinates,
  messages, images. Restrict access, encrypt it off-host, define a retention period.

---

## Operations: updates, rollback, logs

### Pin your versions

`:latest` always resolves to the newest build. For production, pin in `.env`:

```dotenv
BACKEND_IMAGE_TAG=sha-7d00249
FRONTEND_IMAGE_TAG=sha-1a76ab6
```

Available tags are listed on each image's GHCR package page. An upgrade then becomes a
deliberate, one-line change — and `compose.yaml` stays untouched.

### Perform an update

```bash
# 1. ALWAYS back up first (see step 11) — an upgrade is a schema migration.
docker compose stop backend && tar czf pb_data-$(date +%F).tgz pb_data && docker compose start backend

# 2. Pull the new images and recreate
docker compose pull && docker compose up -d

# 3. Watch it come back
docker compose logs -f backend
docker compose ps
```

Any pending migrations apply automatically when the backend starts.

> [!IMPORTANT]
> **Rolling back an image tag does not roll back a migration.** PocketBase has no automatic
> down-migration. After an upgrade that changed the schema, the way back is the backup from step
> 11 — not switching the tag back.

### Useful commands

```bash
docker compose logs -f frontend        # frontend only
docker compose restart frontend        # after an .env change prefer `up -d`
docker compose up -d                   # picks up changed .env values
docker compose down                    # stops everything; pb_data survives
docker compose exec backend sh         # shell inside the backend container
sudo journalctl -u caddy -f            # proxy logs
```

After every `.env` change run `docker compose up -d` — a plain `restart` does not re-read the
file.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Backend container exits immediately, log says `unable to open database file (14)` | `pb_data` is not owned by uid 1001 | Do step 3: `sudo chown 1001:1001 pb_data` |
| Frontend won't start, log says `AllerLeih cannot start: N required environment variable(s) are missing or empty` | A required variable is missing or empty | The log **names every missing variable and what it's for**. Add it to `.env`, run `docker compose up -d`. |
| Login/registration answers **403** | `ORIGIN` missing or not an exact match for the hostname in use | `ORIGIN=https://app.your-domain.org` (no trailing slash), `docker compose up -d` |
| Login answers **500**, frontend log shows `ECONNREFUSED` and `HTTP error status codes must be between 400 and 599 — 0 is invalid` | The frontend **container** can't reach `PUBLIC_PB_URL` (container DNS resolves it elsewhere, or the firewall blocks the hairpin route via your own public IP) | Test with `docker compose exec frontend wget -qO- https://pb.your-domain.org/api/health`. If that fails, add to the `frontend` service in `compose.yaml`: `extra_hosts: ['pb.your-domain.org:host-gateway']` |
| Pages load but no images and no live updates | `PUBLIC_PB_URL` points at an internal-only address | Change it to the **public** PocketBase hostname, `docker compose up -d` |
| Realtime updates arrive late or never | The proxy is buffering the SSE stream | Caddy: `flush_interval -1` in the `pb` block; nginx: `proxy_buffering off;` |
| Caddy gets no certificate | DNS doesn't point here (yet), or port 80 is closed | Check `dig +short …`, open the firewall, read `sudo journalctl -u caddy -e` |
| `docker compose config` errors on `env_file` | Compose older than 2.24 | Upgrade Docker Compose |
| Verification mail never arrives | SMTP not configured, or `FRONTEND_URL` wrong | Step 10; check the links inside the mail |
| Admin UI `/_/` unreachable | The IP allowlist from 5.3 is active | Add your own address, `sudo systemctl reload caddy` |

---

## Related documents

- **[`deploy/`](deploy)** — the three files this guide uses
  ([on GitHub](https://github.com/share-open-sharing-infrastructure/share-mvp/tree/main/deploy))
- [`docs/operations/self-hosting.md`](docs/operations/self-hosting.md) — technical reference,
  variable by variable
- [`docs/architecture.md`](docs/architecture.md) — architecture, routes, auth flow
- [`docs/operations/updating-legal-documents.md`](docs/operations/updating-legal-documents.md) —
  versioning the legal documents
- [`docs/operations/mail-deliverability.md`](docs/operations/mail-deliverability.md) — SPF/DKIM/DMARC
- [INSTALL.de.md](INSTALL.de.md) — deutsche Fassung dieser Anleitung
