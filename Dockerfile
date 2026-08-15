# AllerLeih frontend (SvelteKit, adapter-node) — official multi-stage image for GHCR (#628).
#
# Two stages so devDependencies, sources and build caches never ship in the final image. Since
# #627 the app reads ALL configuration at RUNTIME via `$env/dynamic/*` — the build stage needs no
# application env vars at all, so this exact image serves any AllerLeih instance; only the env
# passed to `docker run` differs. See README.md → "Run with Docker (self-hosting)" and
# docs/architecture.md → "Running the official container image" for the full runtime-var
# reference and reverse-proxy notes (ORIGIN / BODY_SIZE_LIMIT).

ARG NODE_VERSION=24.19.0

# --- Build stage ----------------------------------------------------------
# --platform=$BUILDPLATFORM: the compiled output is platform-neutral JS and no production
# dependency runs an install/postinstall script, so this stage always runs natively on the build
# host (fast) even when cross-building for arm64 — only the small runtime `npm ci` below is
# emulated.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# NODE_ENV stays UNSET here: with NODE_ENV=production `npm ci` would skip devDependencies, and
# the entire build toolchain (vite, svelte-check, tailwind, …) lives there. The `prepare` script
# (`svelte-kit sync || echo ''`) is guarded to survive running before `COPY . .`.
RUN npm ci --no-audit --no-fund
COPY . .
# No build ARGs / no app env here: since #627 every app var is read at runtime, so `npm run
# build` produces one generic, instance-agnostic artefact regardless of who builds it or where
# it later runs.
# Source maps are stripped in THIS layer, right after the build. Docker's layered filesystem means
# a later `RUN find … -delete` in the runtime stage would only add a whiteout on top of the `COPY
# --from=build` layer — the .map bytes stay in that earlier layer and still ship in the pushed
# image. Kept out of `vite.config.ts`'s `build.sourcemap` (rather than done here) so the Uberspace
# deploy artefact, built by a different job, is unaffected.
RUN npm run build && find build -name '*.map' -delete

# --- Runtime stage ----------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
# adapter-node's own default is 512K; the 10 MB parity with the current Uberspace deploy exists
# ONLY through this variable — svelte.config.js's `bodySize` option passed to adapter() is not a
# real adapter-node option (only `out`/`precompress`/`envPrefix` are) and is silently a no-op.
# See docs/architecture.md → "Running the official container image".
ENV BODY_SIZE_LIMIT=10485760
LABEL org.opencontainers.image.source="https://github.com/share-open-sharing-infrastructure/share-mvp"
LABEL org.opencontainers.image.description="AllerLeih — SvelteKit frontend for the item-sharing platform"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
WORKDIR /app
# WORKDIR creates /app as root:root (mode 0755). Without this chown, `USER node` below cannot
# write into /app (`npm ci` fails with EACCES creating node_modules) — reassign ownership to the
# alpine image's built-in `node` user/group before copying anything or switching user.
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
USER node
# --ignore-scripts: none of the five runtime dependencies (pocketbase, web-push, papaparse,
# debounce, @mistralai/mistralai) has an install/postinstall script; skipping them is a small,
# free supply-chain hardening now that this stage runs as non-root anyway.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build --chown=node:node /app/build ./build
EXPOSE 3000
# /robots.txt is on the unprotected-route allowlist (src/hooks.server.ts) and renders purely from
# $lib/instance.ts — no PocketBase call — so a PocketBase outage never fails this healthcheck.
# The alpine node image has no curl, hence `node -e` + fetch().
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "build"]
