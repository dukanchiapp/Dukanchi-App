# syntax=docker/dockerfile:1.6
#
# Dukanchi production image — Fly.io Mumbai (bom1).
#
# Multi-stage:
#   1. builder  — all deps, prisma generate, Vite build, admin-panel build, then prune devDeps.
#   2. runtime  — slim base, only the artefacts + pruned node_modules + tsx (now a prod dep).
#
# Entrypoint stays `tsx server.ts` (`npm start`) — known-good on Railway and in
# native tooling. Switching to compiled JS requires source-wide `.js` extension
# imports and a moduleResolution change; tracked as a separate refactor.
#
# Healthcheck is intentionally NOT in this Dockerfile — Fly's `[[http_service.checks]]`
# handles the runtime probe via fly.toml.

# ─── Stage 1: builder ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

# Build-time native deps: build-essential/python3/pkg-config for node-gyp,
# libcairo/libpango/libjpeg/libgif/librsvg are needed by `canvas` (devDep) at
# install time. Runtime image does NOT need these — `canvas` is not in prod deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (prod + dev) for the build — Vite, TypeScript, Prisma CLI etc.
COPY package.json package-lock.json* ./
RUN npm ci

# Now the full source.
COPY . .

# Generate the Prisma client for the runtime engine (debian-openssl-3.0.x binary
# targets are already declared in prisma/schema.prisma's generator block).
RUN node_modules/.bin/prisma generate

# Build the customer frontend (Vite → dist/).
RUN npm run build:web

# Build the admin panel — Express serves admin-panel/dist as static at /admin-panel/*
# (src/app.ts:237-239). Without this the route 404s.
RUN cd admin-panel && npm ci && npm run build

# Drop devDeps to slim the node_modules that the runtime stage will copy.
# tsx survives (it was moved to dependencies) so the runtime can still `tsx server.ts`.
RUN npm prune --omit=dev


# ─── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Runtime needs OpenSSL (Prisma TLS to Neon) + ca-certificates (HTTPS upstreams).
# No native canvas libs here — `canvas` is devDep only.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node:22-bookworm-slim ships a non-root `node` user (uid 1000). Use it.
# Copies are chown'd so `node` can read everything without a recursive chown step.

# Pruned node_modules — production deps + tsx + the Prisma engine binary.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Server source: tsx reads server.ts and follows its import tree.
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/validators ./validators
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts

# Built static assets.
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/admin-panel/dist ./admin-panel/dist

# tsconfig + package metadata (tsx reads tsconfig for path mapping; `npm start`
# reads scripts.start).
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/tsconfig.server.json ./tsconfig.server.json
COPY --from=builder --chown=node:node /app/tsconfig.app.json ./tsconfig.app.json

USER node

EXPOSE 3000

# `npm start` → `tsx server.ts` (per package.json). Fly sets PORT; env.ts reads
# it; Express binds 0.0.0.0:$PORT (default 3000 in [env] block of fly.toml).
CMD ["npm", "start"]
