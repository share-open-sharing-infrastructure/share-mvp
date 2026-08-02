# Mail Deliverability — Operations

How to keep AllerLeih's outbound mail (verification/reset links, "new message" notifications,
the weekly digest, GDPR retention notices) out of spam folders. This is the **operational**
runbook — DNS setup, live diagnosis, env vars, rollout. For the code that builds every mail
(plaintext alternative, anti-spam headers, one-click unsubscribe), see the backend's
`pb_hooks/services/mail.js`, `pb_hooks/services/unsubscribe.js` and `pb_hooks/utils/urls.js` —
none of that lives in this repo; this repo only documents it (see
[integration-sync.md](integration-sync.md) for the precedent of a backend-running feature
documented here because the backend repo has no `docs/` folder of its own).

Issue: share-mvp #607 "Prevent mails from landing in spam".

## 1. Diagnostic checklist (NOT part of the #607 PR — live production diagnosis)

The code changes in #607 fix everything that can be fixed *in the codebase*. The issue's
acceptance criteria also asked for a live diagnosis against production, which is deliberately
**out of scope for this PR** (it needs a real deployed instance, not a code review) and is
tracked here so it has a documented place to be worked through:

- [ ] Send a real test mail from production (trigger a "new message" notification or the
      digest test route — see §9) to **mail-tester.com** and to a **Gmail** address.
- [ ] From the Gmail copy, open "Show original" and record the `Authentication-Results:` header
      verbatim (expect `spf=pass dkim=pass dmarc=pass`).
- [ ] Copy the `[mail]` line from the **production** startup log (see §6.1) — confirms whether
      SMTP was actually configured from the environment on that deploy, and with which
      host/port/TLS/sender.
- [ ] Record the **effective** `SENDER_ADDRESS` and `APP_URL` the production process is actually
      running with (`ps`/supervisord env, not just what's in the deploy config — a stale
      supervisord process from before a config change may still be running the old values).

Until these are done, treat deliverability as unverified even though the code-level fixes are in.

## 2. SPF

Check the TXT record on the **sending domain** (the domain in `SENDER_ADDRESS`, not necessarily
the site's public domain):

```bash
dig +short TXT <domain> | grep spf1
```

Must include the sending relay (`include:<relay-spf>`) and end in `-all` (hard fail), not `~all`
(soft fail) or `+all` (never enforced — effectively no SPF at all).

## 3. DKIM

Check the selector's TXT record (the relay/SMTP provider assigns the selector name):

```bash
dig +short <selector>._domainkey.<domain> TXT
```

Key should be **2048-bit**; the private key must be installed at the relay actually sending on
`SENDER_ADDRESS`'s behalf.

## 4. DMARC

```bash
dig +short _dmarc.<domain> TXT
```

Roll out gradually: start at `p=none` with `rua=mailto:...` (reporting only, no enforcement),
watch the aggregate reports for a few weeks, then move to `p=quarantine` and eventually
`p=reject`. The property that matters here is **alignment** — the domain in the `From:` header
must match (or be a subdomain of) the domain SPF/DKIM authenticate. This is exactly the property
`DIGEST_SENDER_ADDRESS` can break if set carelessly — see the warning in §8.

## 5. PTR / rDNS, HELO, MX

- Reverse DNS (PTR) for the sending relay's IP should resolve to a hostname that itself resolves
  back to that IP (forward-confirmed rDNS).
- `SMTP_LOCAL_NAME` (HELO/EHLO name) should match that hostname if the relay requires a specific
  one; otherwise leave it unset.
- The sending domain's MX records should be consistent with where it actually expects mail
  (mostly relevant if the domain also receives mail).

## 6. Verification

- **mail-tester.com** — send a test mail to the address it gives you, then check the score and
  the itemized SPF/DKIM/DMARC/blacklist/content breakdown.
- **Google Postmaster Tools** / **Microsoft SNDS** — register the sending IP/domain for
  reputation and spam-rate feedback over time (a single test mail can't reveal this).
- **Raw headers of a delivered mail** — look for `Authentication-Results:` with
  `spf=pass dkim=pass dmarc=pass`, and confirm `Message-ID:` and `Date:` are both present (added
  by the mailer library itself; #607 does not set these manually — see §7).

### 6.1 Startup log — confirm which path is actually sending

`mail_config.pb.js` logs a `[mail]` line on every boot:

| Log line | Meaning |
|---|---|
| `[mail] SMTP configured from environment` (+ host/port/tls/sender) | `SMTP_HOST` was set and applied — mail goes through your configured relay. |
| `[mail] SMTP already matches environment — no change` | Same as above, idempotent no-op on this restart. |
| `[mail] SMTP_HOST not set — leaving existing mail settings untouched` | No env SMTP configured. If nothing was set via the admin UI either, PocketBase falls back to local **sendmail** — SPF will fail on any relay that doesn't recognize your box, and delivery to restricted providers becomes unreliable (the original #8 symptom). |
| `[mail] FAILED …` | The settings were rejected; mail is **not** configured. Fix and restart. |

If you don't see a `[mail] SMTP configured from environment` line in production, nothing below
this point matters yet — fix the SMTP configuration first.

## 7. What the code now delivers (acceptance against #607)

Confirm these are actually present in a delivered mail (not just in the source) before closing
out the issue:

- **Plaintext alternative** — every mail is `multipart/alternative` with a non-empty `text/plain`
  part (`pb_hooks/utils/htmlToText.js`), never HTML-only.
- **One-click unsubscribe** — the weekly digest only: `List-Unsubscribe` +
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), pointing at
  `GET`/`POST /api/unsubscribe/digest/{token}`. Transactional and retention mail deliberately
  carry **no** unsubscribe header (see `.claude/rules/retention.md` in the backend repo) —
  don't "fix" this as an oversight.
- **Anti-auto-reply headers** — `Auto-Submitted: auto-generated` and
  `X-Auto-Response-Suppress` on every send, plus `Precedence: bulk` on the digest only.
- **Pacing** — the digest paces its sends (`DIGEST_PACING_MS`/`DIGEST_BATCH_SIZE`/
  `DIGEST_BATCH_PAUSE_MS`, §8) as a courtesy to the receiving mail server on a large run.
- **Correct absolute links** — every link in a mail resolves to the right host: user-facing app
  links (items, search, conversations, `/auth/login`) use the **frontend** origin (`siteBase()`),
  while `pb_public` assets (the logo), `/api/files/...` and the unsubscribe endpoint use the
  **backend** origin (`assetBase()`). Before #607 both used the single `APP_URL`/`appURL` value,
  which 404'd digest item links and the retention-warning login link against the wrong host
  (finding B1) — see §8's `APP_URL` row for the resolution order that fixes this.
- **Logo loads** — `{{.ASSET_URL}}/AllerLeih.png` in the mail layout resolves to a reachable
  backend URL (single `/`, no more missing/doubled slash).

## 8. Environment variables

Full reference (with defaults) lives in the backend's `.claude/rules/config.md` and
`pb_hooks/constants.js`; this table is the operator-facing summary.

| Variable | Purpose | Notes |
|---|---|---|
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USERNAME`/`SMTP_PASSWORD`/`SMTP_TLS`/`SMTP_AUTH_METHOD`/`SMTP_LOCAL_NAME` | Real SMTP relay config | See the backend README's "Mail & SMTP configuration" for the full table. |
| `SENDER_ADDRESS` / `SENDER_NAME` | Transactional sender identity | Used for everything except a `kind: 'bulk'` send when `DIGEST_SENDER_ADDRESS` is set. |
| `APP_URL` | Backend origin fallback | **This is the backend origin** (assets, `/api/files/...`, unsubscribe), not a user-facing app link host. See the `APP_URL` trap below. |
| `FRONTEND_URL` | Frontend origin | User-facing app links (`siteBase()`) — items, search, conversations, `/auth/login`. |
| `UNSUBSCRIBE_SECRET` | HMAC secret for one-click digest-unsubscribe tokens | Generate with `openssl rand -hex 32`. **Must be set as a GitHub secret before the backend #607 PR is merged** — see the callout below. |
| `DIGEST_SENDER_ADDRESS` / `DIGEST_SENDER_NAME` | Optional separate sender identity for the weekly digest | Empty (default) = identical to today. **Do not set before SPF/DKIM/DMARC are configured for that address** — see the callout below. |
| `DIGEST_PACING_MS` / `DIGEST_BATCH_SIZE` / `DIGEST_BATCH_PAUSE_MS` | Anti-burst pacing for the digest send loop | Defaults `200` / `50` / `5000`. `0` disables the corresponding pause. A courtesy to the receiving mail server, not a hard rate limit. |

### The `APP_URL` trap

PocketBase sets `settings().meta.appURL` to `http://localhost:8090` **by default** — this is
PocketBase's own built-in value, not an empty string (empirically verified: the Settings model
rejects a blank `appURL` outright, so a real running instance can never actually have one). An
operator who configures SMTP through the admin UI and forgets to also set `APP_URL` therefore
ends up with a *populated but useless* value, not an obviously-missing one.

`assetBase()` (`pb_hooks/utils/urls.js`) resolves in this order:

1. an **explicitly-set** `APP_URL` env var (read raw) — honored even if it's a loopback value
   (the backend README's local-SMTP-testing recipe deliberately sets
   `APP_URL=http://127.0.0.1:8090`);
2. `settings().meta.appURL`, **unless it's a loopback host** (`localhost` / `127.0.0.0/8` /
   `[::1]`) — this is what catches the "SMTP configured via admin UI, `APP_URL` forgotten" case
   above;
3. `FRONTEND_URL`;
4. `''` — no usable absolute base.

**When the result is `''`, the `List-Unsubscribe` header is deliberately omitted (with an error
logged), never set to a broken/relative URL.** Check for this: an unsubscribe link silently
missing from a delivered digest, or a `[unsubscribe] no usable absolute base URL` error in the
log, means neither `APP_URL` nor `FRONTEND_URL` resolves to anything usable in production.

### `UNSUBSCRIBE_SECRET` — set before the backend PR merges

Generate it once, before deploying:

```bash
openssl rand -hex 32
```

Store it as a GitHub secret (`UNSUBSCRIBE_SECRET`) referenced by `.github/workflows/ci.yml`'s
deploy step. **Do this before the backend #607 PR is merged.** Without an explicit secret, the
unsubscribe tokens fall back to one derived from the `users` collection's auth-token secret; a
*later* introduction of an explicit `UNSUBSCRIBE_SECRET` (or any future auth-token-secret
rotation while still on the derived fallback) changes the signing key and invalidates every
unsubscribe link already sent in prior digests.

### `DIGEST_SENDER_ADDRESS` — do not set until DNS is ready

Leave `DIGEST_SENDER_ADDRESS`/`DIGEST_SENDER_NAME` **empty** until SPF/DKIM/DMARC are configured
and verified (§2–§4, §6) for that specific address/(sub)domain. Setting it before that is done
**worsens** deliverability: the digest would start sending under an identity with no
authentication behind it, failing DMARC alignment for exactly the mail this issue is trying to
get out of spam. `DIGEST_SENDER_NAME` alone (without `DIGEST_SENDER_ADDRESS`) never changes the
sender at all (`pb_hooks/services/mail.js` → `senderFor()`), so there's no partial-rollout path
here — it's all-or-nothing per address.

### Legacy `emailNotifications=false` rows — operator note (#607 finding B2)

Before this fix, `upsertUserPreferences`'s onboarding call site
(`upsertUserPreferences(pb, uid, { hasOnboarded: true })`) created `user_preferences` rows
*without* `emailNotifications`, which PocketBase's `bool` columns read back as `false` (no NULL
state) — silently opting those users out of **all** notification mail, not just the digest. This
PR hardens the create path going forward (see `$lib/server/userPreferences.ts`), but:

- **there is no automated backfill of existing `emailNotifications=false` rows** — a real,
  deliberate opt-out is indistinguishable from a row created by this trap, so blindly flipping
  them back to `true` would silently re-subscribe someone who explicitly opted out;
- **recommended operator action**: query the count of existing `user_preferences` rows with
  `emailNotifications = false` once, eyeball how large it is relative to the user base, and use
  judgment (a very large fraction relative to how few users have ever visited the notification
  toggle is a signal most of them are trap victims, not opt-outs). This is a one-time manual
  review, not a script to run repeatedly.
- The `digestEmails` migration, by contrast, **does** backfill every existing row to `true` — it
  is a brand-new column, so every existing row is unambiguously "never touched this setting" and
  the trap can't have produced a real opt-out for it yet.

## 9. Rollout

The backend deploys automatically on push to `main` (`.github/workflows/ci.yml`) and a restart
is required to pick up any `SMTP_*`/`SENDER_*`/`APP_URL`/`FRONTEND_URL`/`DIGEST_*`/
`UNSUBSCRIBE_SECRET` env change (`mail_config.pb.js` and the other hooks that read `constants.js`
only run their bootstrap logic once, at process start). CI already restarts the service as part
of the deploy, so a normal merge-to-`main` is sufficient — no manual restart needed unless you
change an env var **outside** of a deploy (e.g. editing the supervisord config directly).

To trigger a digest send on demand for testing (cron schedules can't be fired manually): set
`DIGEST_TEST_ROUTE=true` in a non-production environment and call
`POST /api/_test/run-digest` as a superuser. **Never set `DIGEST_TEST_ROUTE=true` in production**
— see the backend's `.claude/rules/http-endpoints.md`.

## 10. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Unsubscribe link returns 400 ("Link ungültig") | `UNSUBSCRIBE_SECRET` was rotated (or the derived fallback's source secret changed) after the mail was sent — see the callout in §8. |
| Unsubscribe link returns 503 | No secret configured or derivable at all (`[unsubscribe] no secret configured/derivable` in the log). |
| Digest/mail links point at `localhost:8090` or otherwise 404 | `APP_URL` is unset and `settings().meta.appURL` is still PocketBase's loopback default — see the `APP_URL` trap in §8. |
| Logo missing from mails | `assetBase()` resolved to `''` — check `APP_URL`/`FRONTEND_URL` per the trap above. |
| Digest item links 404 | `FRONTEND_URL` is unset, so `siteBase()` has nothing to fall back to beyond `settings().meta.appURL` (the backend host — wrong for a frontend page). |
| Mails only reach some/verified addresses | Classic sendmail-fallback symptom (see §6.1) — configure real SMTP via env vars. |
| `535 5.7.8 auth invalid` | Use the **full email address** as `SMTP_USERNAME`, not just the local part. |

## 11. Optional hardening

Consider a rate-limit rule for `/api/unsubscribe/` in the PocketBase admin UI (Settings →
rate limiting) if abuse is ever observed — the endpoint itself already has no user-enumeration
surface (see the backend's `pb_hooks/unsubscribe.pb.js` doc comment) and an unbounded HMAC-token
guess space, but a courtesy rate limit is cheap insurance against brute-force noise in the logs.
