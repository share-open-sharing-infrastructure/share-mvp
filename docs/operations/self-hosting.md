# Self-hosting with Docker Compose

A reference `docker compose` stack that wires the two official images — `allerleih-backend`
(PocketBase) and `allerleih-frontend` (SvelteKit) — into a running instance, plus the first-run
checklist to take it from "containers are up" to "a real, legally compliant instance". Tracked
as share-mvp#630; pairs with #629 (making the remaining operator-specific values configurable —
see the imprint note in step 7 below for what's still open there).

**Files** (all in [`deploy/`](../../deploy)):

- [`compose.yaml`](../../deploy/compose.yaml) — the two services, bind-mounted PocketBase data,
  healthcheck-gated startup order.
- [`.env.docker.example`](../../deploy/.env.docker.example) — one shared env file covering both
  services; copy to `.env`.
- [`Caddyfile`](../../deploy/Caddyfile) — reverse-proxy example for the two-hostname
  architecture below, including the SSE note.

## Prerequisites

- **Docker Compose v2.24 or newer.** `compose.yaml`'s `env_file:` entries use the long-form
  `path:`/`required: false` syntax (added in compose-spec's `env_file.required` attribute,
  first shipped in Docker Compose v2.24.0) so that `docker compose config` still passes in a
  fresh clone, before `deploy/.env` exists. Check with `docker compose version`.
- A host reachable on two public hostnames (see "Architecture in one paragraph" below) — DNS and
  reverse-proxy setup are step 2 of "First run".

## Architecture in one paragraph

The browser talks to PocketBase **directly** — realtime subscriptions and file URLs
(`src/lib/client-pb.ts`) run client-side, and the frontend server's own PocketBase client reads
the exact same `PUBLIC_PB_URL`. That means **both** services need their own publicly reachable
hostname behind a reverse proxy (e.g. `app.example.org` for the frontend, `pb.example.org` for
PocketBase) — a setup where PocketBase is only reachable on the compose-internal network renders
pages fine but breaks realtime, item images, and every client-side API call. See
`compose.yaml`'s header comment for the full reasoning, and
[architecture.md → Running the official container image](../architecture.md#running-the-official-container-image)
for the per-variable reference this runbook builds on. PocketBase's realtime endpoint streams
over SSE; Caddy flushes those responses immediately without any extra config (see the
`Caddyfile`'s header comment) — an nginx-based proxy needs an explicit `proxy_buffering off;` on
that route instead.

## First run

Do these **in order** on a fresh machine, after `cd deploy && cp .env.docker.example .env`
(don't `docker compose up` yet — step 1 below has a mandatory host-side step first).

### 1. Prepare the bind-mounted data directory, then generate VAPID keys

**This stack uses bind mounts, not named volumes**, for `pb_data` — a deliberate deviation from
share-mvp#630's "named volume" wording (see `compose.yaml`'s header comment for the reasoning).
The consequence: a bind-mounted host directory does **not** inherit ownership from the image the
way a named volume would, and the backend image runs as a fixed, non-root **uid/gid 1001**. Skip
this step and the backend container fails to start with:

```
unable to open database file (14)
```

(verified against this exact stack — "14" is the SQLite error code for "unable to open database
file"; the process literally cannot open a database file on a directory it doesn't own.) Before
the first `docker compose up`, from the `deploy/` directory:

```bash
mkdir -p pb_data
sudo chown 1001:1001 pb_data
```

Then generate a VAPID key pair for Web Push — **never reuse an example or CI keypair** in
production:

```bash
npx web-push generate-vapid-keys
```

Put the public key in `PUBLIC_VAPID_PUBLIC_KEY`, the private key in `VAPID_PRIVATE_KEY`, and a
`mailto:`/`https:` contact URL in `VAPID_SUBJECT` — all three are **frontend** vars in `.env`.

**Is there a matching backend `VAPID_*` var?** No — verified in
`allerleih-backend/pb_hooks/constants.js`, which has no VAPID handling at all and says so
explicitly:

> NOTE: no VAPID / Web-Push config here on purpose. Web push is signed and sent exclusively by
> the SvelteKit frontend (…); this backend only stores and cleans up the `push_subscriptions`
> rows. Do not re-add `VAPID_*` — it would be dead config and a second source of truth for the
> operator to get wrong.

So the issue's open question ("is the backend's own `VAPID_*` still used, given push is sent
from the frontend server?") resolves to: **there is nothing left to clarify — the backend never
reads a `VAPID_*` variable in the first place.** Whatever removed it did so before this runbook
was written; there's no vestigial config to clean up.

### 2. Point DNS at this host and deploy the reverse proxy

Both services need their own publicly reachable hostname — see "Architecture in one paragraph"
above — before step 3 can reach the admin UI through it:

- [ ] Create A (and AAAA, if you have IPv6) records for both hostnames — e.g. `app.example.org`
  and `pb.example.org` — pointing at this host's IP.
- [ ] Copy `deploy/Caddyfile`, replace its two placeholder hostnames with your own, and deploy it
  to wherever Caddy runs on this host (see the Caddyfile's header comment for the host-vs.
  third-container choice), then (re)start/reload Caddy so it obtains certificates and starts
  proxying to the loopback ports `compose.yaml` publishes.
- [ ] Optional but recommended: the `pb.example.org` site in `deploy/Caddyfile` ships a commented
  `@admin_denied`/`remote_ip` block that restricts `/_/` (PocketBase's admin UI — full superuser
  access to the whole database) to trusted source IPs. Uncomment and fill in your own ranges, or
  put Basic Auth in front of `/_/` instead, before step 3 creates the superuser account that UI
  protects.

### 3. Bring the stack up and create the PocketBase superuser

```bash
docker compose up -d
docker compose exec backend /app/pocketbase superuser upsert admin@example.org <a-strong-password>
```

Use the **same** email/password as `PB_SUPERUSER_EMAIL`/`PB_SUPERUSER_PASSWORD` in `.env` — the
frontend reads those at runtime for the `/admin` gate and the public stats/`metrics_daily`
reads (`src/lib/server/superuser.ts`). The admin UI itself is reachable at
`https://pb.example.org/_/` through the reverse proxy — never at the loopback-only port
directly. It is a full superuser panel with unrestricted database access; see step 2's optional
IP-allowlist snippet if you haven't restricted it further than TLS alone.

### 4. Set `FRONTEND_URL` and `APP_URL`

Two **backend** vars in `.env` that `.env.docker.example` marks "practically required, or a
feature goes silently dead": get either wrong and registration/password-reset mail links point
at the wrong host — no crash, no error, it just surfaces later as users reporting broken
confirmation links.

- `FRONTEND_URL` — the frontend's **public** address (e.g. `https://app.example.org`, no
  trailing slash). Injected into the `users` collection's auth-mail links (registration
  verification, password reset).
- `APP_URL` — the backend's **own public** address (e.g. `https://pb.example.org`, no trailing
  slash). Used for mail-logo/asset URLs and the digest-unsubscribe link
  (`allerleih-backend/pb_hooks/utils/urls.js` → `assetBase()`). Falls back to `FRONTEND_URL` if
  unset, but set it explicitly to avoid landing on PocketBase's own built-in
  `http://localhost:8090` default the one time SMTP is configured only via the admin UI.

### 5. Configure SMTP

Set the `SMTP_*` vars in `.env` (host/port/username/password, `SMTP_TLS`). They're applied on
backend bootstrap **only when `SMTP_HOST` is set** — leaving it empty is a no-op, not a reset, so
you can also configure mail later via the PocketBase admin UI instead. Without SMTP configured
one way or the other, registration verification mail, password resets, and notification digests
are silently not sent.

### 6. Replace the seeded legal documents (mandatory before going live)

The `legal_documents` collection ships pre-seeded with **allerleih.org's own** Terms of Service
and privacy policy (`allerleih-backend/pb_migrations/1782400000_created_legal_documents.js`) — a
fresh instance starts out presenting someone else's legal texts, naming allerleih.org as the
contracting party. This is a real legal document users must consent to, not placeholder copy:
**replace it before anyone signs up for real.**

Since a fresh instance has no real users yet who've already consented, the simple path applies:
open each seeded row (`docType = tos` and `docType = privacy`) in the PocketBase admin and edit
`body`/`title` in place — no version bump, no re-consent flow needed for an instance with zero
prior consents. See [updating-legal-documents.md](updating-legal-documents.md) for the full
mechanics (including the version-bump path, which you'll need the *next* time you materially
change either document after real users exist).

### 7. Set the imprint and other instance-branding vars

**Legally mandatory** for any public instance in Germany: an imprint (§5 TMG) naming the actual
operator. **This is currently a gap, not a configuration step:** share-mvp#629 ("make the
remaining operator-specific values configurable") is still **open** as of this writing.
`src/lib/instance.ts`'s `imprint`, `feedbackEmail`, `social` and `links` fields are hardcoded to
the flagship instance's own operator data — there is **no env var** for any of them yet, and
`.env.docker.example` deliberately doesn't invent one that wouldn't do anything. Concretely, that
means:

- Running the stock `ghcr.io/…/allerleih-frontend` image unmodified puts **the upstream
  maintainer's real postal address** on your instance's `/misc/imprint` page. That is not a
  placeholder you can configure away today — it is factually wrong for your instance and not
  legally acceptable for a public instance in Germany.
- Until #629 ships, the only way to run your own imprint is to fork the frontend repo, edit that
  block in `src/lib/instance.ts` yourself, and build+publish your own image from that fork rather
  than the official one. That's a real hurdle for a non-technical operator, and worth flagging to
  anyone testing this stack for real self-hosting.

The other instance vars **are** already configurable and safe to skip (they default to the
flagship instance's own values, which is fine — they're not legally sensitive): `PUBLIC_SITE_ORIGIN`,
`PUBLIC_INSTANCE_CITY`, `PUBLIC_APP_NAME`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_ANALYTICS_ORIGIN` +
`PUBLIC_ANALYTICS_WEBSITE_ID` (analytics is opt-in — unset means no analytics script loads at
all). See
[architecture.md → Instance configuration (multi-city)](../architecture.md#instance-configuration-multi-city)
for what each does.

### 8. Set up backups

`pb_data` — now a bind-mounted host directory at `deploy/pb_data/` rather than a named volume —
is the entire mutable state: the SQLite database plus every uploaded file. Either:

- use PocketBase's own backup mechanism (admin UI, or `POST /api/backups`) — a consistent
  snapshot taken while the server keeps running, or
- stop the stack and copy the directory directly (from the `deploy/` directory):

  ```bash
  docker compose stop backend
  tar czf pb_data-backup-$(date +%F).tgz pb_data
  docker compose start backend
  ```

Don't put `pb_data` on NFS/CIFS — SQLite needs real file locking, and copying the live database
file while the server keeps running (without a WAL checkpoint) can capture an inconsistent
snapshot; prefer one of the two options above. Verify a restore at least once — an untested
backup is not a backup.

**A backup contains exactly the same personal data as the live instance** — email addresses, raw
geolocation coordinates, message content, and uploaded files — and needs the same care: restrict
who can access the backup file, encrypt it if it leaves this host (off-site storage, a backup
service), and define a retention period rather than keeping every snapshot forever.

## Legally mandatory vs. optional, at a glance

| Step | Mandatory for a public instance? |
|---|---|
| Replace the seeded ToS + privacy policy (step 6) | **Yes** — they're a binding legal document naming the wrong operator otherwise. |
| Imprint with your real operator data (step 7) | **Yes** (§5 TMG) — but **not currently possible via env** (share-mvp#629 open); requires a custom build until it ships. |
| VAPID keys (step 1) | **Yes** — `PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are all in `assertRequiredEnv()`'s required set (`src/lib/server/env.ts`): the frontend container **refuses to start** without them, exactly like `PB_SUPERUSER_*` below — and even once it starts, Web Push never fires without a real key pair. |
| PocketBase superuser + `PB_SUPERUSER_*` (step 3) | Practically yes — the frontend won't start without `PB_SUPERUSER_EMAIL`/`PASSWORD` set (`assertRequiredEnv()`), even though the superuser account itself only backs the `/admin` gate and public stats. |
| `FRONTEND_URL`/`APP_URL` (step 4) | Practically yes — no startup check catches a missing value (backend vars have no `assertRequiredEnv()`-style gate), but without them registration/password-reset mail links silently point at the wrong host. |
| SMTP (step 5) | Optional but strongly recommended — without it, registration/verification/reset mail and digests are silently not sent. |
| Backups (step 8) | Optional in the sense that nothing enforces it, but skipping it risks total data loss. |
| `PUBLIC_ANALYTICS_*`, `PUBLIC_APP_NAME`, `PUBLIC_CONTACT_EMAIL`, feedback/social links | Optional — safe to leave at their flagship defaults. |
| `MISTRAL_API_KEY` | Fully optional — unset just disables AI item-photo analysis. |

## Updating (image tags, migrations, rollback)

Bumping either image's tag and re-running `docker compose up -d` **automatically re-applies any
pending PocketBase migrations** the next time the `backend` container starts — that's how the
official image has always behaved (every `pb_migrations/*.js` file applies in filename order on
every `serve`, regardless of `--automigrate`, which only affects whether the *admin UI* tries to
write a new migration file). This is convenient, but it also means an upgrade is a schema
migration, not just a version bump:

1. **Back up `pb_data` first** (see step 8) — every time, before every upgrade, no exceptions.
2. Pull the new tags and recreate: `docker compose pull && docker compose up -d`.
3. Watch `docker compose logs -f backend` through the restart; confirm `docker compose ps` shows
   both containers `healthy`/`running` afterward.

**Pin, don't float, outside a quick trial.** `:latest` always resolves to the newest published
build; `compose.yaml`'s two image lines read `${BACKEND_IMAGE_TAG:-latest}` /
`${FRONTEND_IMAGE_TAG:-latest}` — set either in `.env` to a specific tag (`v1.2.3` or
`sha-<commit>` — see each image's package page on GHCR) so an upgrade is a deliberate, one-line
`.env` change you can review and roll back, without touching `compose.yaml` itself. **Rolling
back an image tag does
NOT roll back a schema migration** — PocketBase has no "migrate down automatically" on downgrade,
so rolling back after a migrating upgrade means restoring the pre-upgrade `pb_data` backup from
step 8, not just switching the tag back.

## Troubleshooting

- **Backend container exits/fails to become healthy on first start, `pb_data` permission
  errors in `docker compose logs backend`** → step 1's `chown 1001:1001` was skipped or targeted
  the wrong path. From the `deploy/` directory, confirm with `ls -ldn pb_data` that the owning
  uid/gid is `1001 1001` (`-d` reports the directory's own entry rather than listing its contents,
  which is what you need right after step 1, while `pb_data` is still empty; `-n` keeps the ids
  numeric, since uid 1001 has no matching name on the host).
- **Login "succeeds" but bounces straight back to the login page, with no error anywhere** →
  you are serving the stack over plain `http://` on something other than `localhost`. The login
  POST really does succeed (it answers `303 → /onboarding` and sets `pb_auth`), but that cookie is
  issued `HttpOnly; Secure; SameSite=Lax`, and browsers refuse to store a `Secure` cookie that
  arrived over plain HTTP unless the host is a loopback address. The very next request therefore
  carries no cookie at all, the server sees an anonymous visitor, and the auth guard sends it back
  to `/auth/login`. Nothing is logged, because nothing failed. This is not a misconfiguration to
  work around — it is why step 2 puts TLS in front of the stack; the whole app is unusable over
  plain HTTP on a public or LAN address. If you want a quick pre-TLS smoke test, reach it at
  `http://localhost:3000` (loopback is exempt from the `Secure` rule), and expect anything
  client-side that talks to PocketBase to stay broken there, because `PUBLIC_PB_URL` cannot be a
  loopback address and a container address at the same time.
- **Every login/form submit fails with "Cross-site POST form submissions are forbidden"** →
  `ORIGIN` in `.env` doesn't exactly match the scheme+host+port users type into their browser.
  See [architecture.md → Running the official container image](../architecture.md#running-the-official-container-image)
  for the full explanation (this is the single most common self-hosting failure across both the
  bare-image and compose paths).
- **Homepage loads but item images/realtime chat never update** → `PUBLIC_PB_URL` is set to a
  compose-internal address (`http://backend:8090/`) instead of PocketBase's public,
  reverse-proxied hostname — see the "Architecture in one paragraph" section above.
- **`docker compose up` starts `frontend` before `backend` looks ready** → check
  `docker compose ps`; if `backend` never reaches `healthy`, `frontend` is correctly waiting
  forever on `depends_on: condition: service_healthy` rather than racing ahead — that's the
  gate from `compose.yaml` doing its job, not a bug.

## Related

- [architecture.md → Running the official container image](../architecture.md#running-the-official-container-image) — the canonical, per-variable runtime-config reference for the frontend image alone.
- [updating-legal-documents.md](updating-legal-documents.md) — the full ToS/privacy edit + re-consent mechanics referenced in step 6.
- [allerleih-backend `README.md` → "Run with Docker (self-hosting)"](https://github.com/share-open-sharing-infrastructure/allerleih-backend#run-with-docker-self-hosting) — the backend image's own bare-`docker run` path, superuser/backup recipes, and the uid/gid-1001 bind-mount note this runbook builds on.
- share-mvp#629 — will close the imprint/feedback/social-links gap noted in step 7.
