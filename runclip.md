# Runclip Customizations

> Changes made to Paperclip for Runclip managed hosting. Keep in sync when merging upstream main.

## What is Runclip

Runclip is a managed Paperclip hosting service. Customers get a dedicated Paperclip instance on DigitalOcean with Claude Code and Codex pre-installed. They use their own Claude Code Max or Codex subscriptions.

## Custom Changes

### Claude Code Login UI (`ui/src/components/ClaudeLoginTerminal.tsx`)

**New file.** When a Claude Code agent run fails with `claude_auth_required`, shows a setup flow:
1. Instructions to run `claude setup-token` on the customer's machine
2. Copy button for the command
3. Token input field (password type)
4. Saves token as a sealed secret → sets `CLAUDE_CODE_OAUTH_TOKEN` env var on the agent

Uses `secretsApi.create()` to store token securely, then `agentsApi.update()` to set it as a `secret_ref` in the agent's `adapterConfig.env`.

### Agent Run Detail (`ui/src/pages/AgentDetail.tsx`)

- Imports `ClaudeLoginTerminal` component
- On `claude_auth_required` error, shows "Login to Claude Code" button
- Clicking it reveals the `ClaudeLoginTerminal` inline

### Docker Image

Built from this repo with extra global installs:
```dockerfile
RUN npm install --global @anthropic-ai/claude-code@latest @openai/codex@latest opencode-ai
```

Published to `manaira/paperclip:latest` on Docker Hub.

Build command (must be amd64 for DO droplets):
```bash
docker buildx build --platform linux/amd64 -t manaira/paperclip:latest --push .
```

### Dependencies Added

- `@xterm/xterm` and `@xterm/addon-fit` in `ui/package.json` (installed but not currently used — was for terminal approach, kept for potential future use)

## Files Changed from Upstream

| File | Change |
|------|--------|
| `ui/src/components/ClaudeLoginTerminal.tsx` | **New** — setup-token login flow |
| `ui/src/pages/AgentDetail.tsx` | Import + render ClaudeLoginTerminal |
| `ui/package.json` | Added xterm packages |

## Merging Upstream

When pulling from upstream `main`:

1. `git fetch upstream && git merge upstream/main`
2. Check for conflicts in `ui/src/pages/AgentDetail.tsx` — our changes are in the `RunDetail` component around the `claude_auth_required` error handling section
3. `ClaudeLoginTerminal.tsx` is a new file, unlikely to conflict
4. Rebuild and push Docker image after merge
