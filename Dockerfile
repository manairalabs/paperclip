# ── Base ──────────────────────────────────────────────────────────────
FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ── Install ALL deps (dev + prod) for building ──────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/gemini-local/package.json packages/adapters/gemini-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/
COPY packages/plugins/sdk/package.json packages/plugins/sdk/
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

# ── Build everything ─────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @paperclipai/ui build
RUN pnpm --filter @paperclipai/plugin-sdk build
RUN pnpm --filter @paperclipai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

# ── Prune to production deps only ────────────────────────────────────
FROM base AS prune
WORKDIR /app
COPY --from=build /app /app
RUN pnpm prune --prod \
  && pnpm store prune \
  && rm -rf /app/.git /app/tests /app/evals /app/docs /app/doc \
            /app/report /app/releases /app/scripts /app/docker

# ── Production ───────────────────────────────────────────────────────
FROM base AS production
WORKDIR /app

# 1. Root workspace config
COPY --chown=node:node --from=prune /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc /app/

# 2. Root production node_modules (pruned)
COPY --chown=node:node --from=prune /app/node_modules /app/node_modules

# 3. Server: compiled dist + node_modules (contains tsx) + package.json
COPY --chown=node:node --from=prune /app/server/package.json /app/server/package.json
COPY --chown=node:node --from=prune /app/server/node_modules /app/server/node_modules
COPY --chown=node:node --from=build /app/server/dist /app/server/dist

# 4. UI: only the built static assets
COPY --chown=node:node --from=build /app/ui/dist /app/ui/dist

# 5. Workspace packages that export .ts (resolved at runtime via tsx):
#    shared, db, adapter-utils need src/ directories
COPY --chown=node:node --from=prune /app/packages/shared /app/packages/shared
COPY --chown=node:node --from=prune /app/packages/db /app/packages/db
COPY --chown=node:node --from=prune /app/packages/adapter-utils /app/packages/adapter-utils

# 6. plugin-sdk exports from dist/ (already compiled) + needs node_modules for zod etc.
COPY --chown=node:node --from=prune /app/packages/plugins/sdk /app/packages/plugins/sdk
COPY --chown=node:node --from=build /app/packages/plugins/sdk/dist /app/packages/plugins/sdk/dist

# 7. Adapter packages (export .ts, resolved via tsx at runtime)
COPY --chown=node:node --from=prune /app/packages/adapters /app/packages/adapters

# 8. CLI: source + node_modules (runs via tsx at runtime)
COPY --chown=node:node --from=prune /app/cli /app/cli

# 9. Skills directory (referenced at runtime)
COPY --chown=node:node --from=build /app/skills /app/skills

# Install system tools for agents
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    jq ripgrep fd-find python3 python3-pip \
    build-essential \
  && ln -sf /usr/bin/fdfind /usr/bin/fd \
  && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Install global agent CLIs + browser tools
RUN npm install --global --omit=dev \
    @anthropic-ai/claude-code@latest \
    @openai/codex@latest \
    playwright \
    qmd \
  && npx playwright install --with-deps chromium \
  && npm cache clean --force \
  && mkdir -p /paperclip \
  && chown node:node /paperclip

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

VOLUME ["/paperclip"]
EXPOSE 3100

USER node
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
