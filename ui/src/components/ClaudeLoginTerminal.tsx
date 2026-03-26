import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { secretsApi } from "../api/secrets";

interface AuthSetupProps {
  agentId: string;
  companyId: string;
  adapterType: string;
  onTokenReady?: (envEntry: { type: "secret_ref"; secretId: string; version: string }) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="h-6 px-2 text-[10px] rounded border bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-muted-foreground"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// Claude Code: setup-token flow
function ClaudeSetupToken({ agentId, companyId, onTokenReady }: { agentId: string; companyId: string; onTokenReady?: (envEntry: { type: "secret_ref"; secretId: string; version: string }) => void }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  const saveToken = useMutation({
    mutationFn: async () => {
      if (!agentId || !companyId) {
        throw new Error("Agent not created yet — save the token after setup completes");
      }
      const secret = await secretsApi.create(companyId, {
        name: `claude-oauth-token-${agentId.slice(0, 8)}`,
        value: token.trim(),
        description: "Claude Code OAuth token for agent authentication",
      });
      await agentsApi.update(agentId, {
        adapterConfig: {
          env: {
            CLAUDE_CODE_OAUTH_TOKEN: {
              type: "secret_ref",
              secretId: secret.id,
              version: "latest",
            },
          },
        },
      }, companyId);
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleOnboardingSave = async () => {
    if (!token.trim() || !companyId || !onTokenReady) return;
    setSaving(true);
    setSaveError(null);
    try {
      const secret = await secretsApi.create(companyId, {
        name: `claude-oauth-token-onboarding`,
        value: token.trim(),
        description: "Claude Code OAuth token for agent authentication",
      });
      onTokenReady({ type: "secret_ref", secretId: secret.id, version: "latest" });
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save token");
    } finally {
      setSaving(false);
    }
  };

  // Onboarding mode: no agentId yet, create secret and pass ref via callback
  if (!agentId && onTokenReady) {
    if (saved) {
      return (
        <div className="text-xs text-green-600 dark:text-green-400 font-medium">
          Token saved securely. It will be applied when the agent is created.
        </div>
      );
    }
    return (
      <div className="space-y-3 text-xs">
        <div className="space-y-1">
          <p className="font-medium">Set up Claude Code authentication</p>
          <p className="text-muted-foreground">
            Run this command on your machine (where you have a browser and Claude Pro/Max subscription):
          </p>
          <div className="flex items-center gap-2">
            <pre className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded-md px-3 py-2 font-mono">
              claude setup-token
            </pre>
            <CopyButton text="claude setup-token" />
          </div>
          <p className="text-muted-foreground">
            Complete the OAuth flow in your browser. You'll get a token starting with <code className="bg-neutral-100 dark:bg-neutral-900 px-1 rounded">sk-ant-oat01-</code>
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Paste the token here</p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) void handleOnboardingSave(); }}
              placeholder="sk-ant-oat01-..."
              className="flex-1 h-8 px-2 text-xs rounded-md border bg-background font-mono"
              disabled={saving}
              autoFocus
            />
            <button
              onClick={() => void handleOnboardingSave()}
              disabled={!token.trim() || saving}
              className="h-8 px-3 text-xs rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Token"}
            </button>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
        Token saved securely. You can now retry the run.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="space-y-1">
        <p className="font-medium">Step 1: Generate a token on your machine</p>
        <p className="text-muted-foreground">
          Run this command where you have a browser and a Claude Pro/Max subscription:
        </p>
        <div className="flex items-center gap-2">
          <pre className="flex-1 bg-neutral-100 dark:bg-neutral-900 rounded-md px-3 py-2 font-mono">
            claude setup-token
          </pre>
          <CopyButton text="claude setup-token" />
        </div>
        <p className="text-muted-foreground">
          Complete the OAuth flow in your browser. You'll get a token starting with <code className="bg-neutral-100 dark:bg-neutral-900 px-1 rounded">sk-ant-oat01-</code>
        </p>
      </div>
      <div className="space-y-1">
        <p className="font-medium">Step 2: Paste the token here</p>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) saveToken.mutate(); }}
            placeholder="sk-ant-oat01-..."
            className="flex-1 h-8 px-2 text-xs rounded-md border bg-background font-mono"
            disabled={saveToken.isPending}
            autoFocus
          />
          <button
            onClick={() => saveToken.mutate()}
            disabled={!token.trim() || saveToken.isPending}
            className="h-8 px-3 text-xs rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveToken.isPending ? "Saving..." : "Save Token"}
          </button>
        </div>
        {saveToken.isError && (
          <p className="text-destructive">
            {saveToken.error instanceof Error ? saveToken.error.message : "Failed to save token"}
          </p>
        )}
      </div>
    </div>
  );
}

// Codex: device auth flow
function CodexDeviceAuth({ agentId, companyId }: { agentId: string; companyId: string }) {
  const [deviceUrl, setDeviceUrl] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [authDone, setAuthDone] = useState(false);

  const startAuth = useMutation({
    mutationFn: () => agentId
      ? agentsApi.codexDeviceAuth(agentId, companyId)
      : agentsApi.codexDeviceAuthForCompany(companyId),
    onSuccess: (data) => {
      setDeviceUrl(data.deviceUrl);
      setDeviceCode(data.deviceCode);
      // The codex login process runs in the background on the server.
      // It polls OpenAI and writes auth.json when the user completes auth.
      // We poll stdout for completion after a delay.
      if (data.deviceUrl && data.deviceCode) {
        const pollDone = setInterval(() => {
          // Re-call the endpoint — if codex is already authed, it returns quickly with no code
          agentsApi.codexDeviceAuth(agentId, companyId).then((check) => {
            if (!check.deviceCode && !check.deviceUrl && check.stdout) {
              clearInterval(pollDone);
              setAuthDone(true);
            }
          }).catch(() => {});
        }, 10000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollDone), 300000);
      }
    },
  });

  if (authDone) {
    return (
      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
        Codex authenticated successfully! You can now retry the run.
      </div>
    );
  }

  if (deviceUrl && deviceCode) {
    return (
      <div className="space-y-3 text-xs">
        <div className="space-y-1">
          <p className="font-medium">Step 1: Open this link in your browser</p>
          <div className="flex items-center gap-2">
            <a
              href={deviceUrl}
              className="text-blue-600 underline underline-offset-2 dark:text-blue-400"
              target="_blank"
              rel="noreferrer"
            >
              {deviceUrl}
            </a>
            <CopyButton text={deviceUrl} />
          </div>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Step 2: Enter this one-time code</p>
          <div className="flex items-center gap-2">
            <code className="bg-neutral-100 dark:bg-neutral-900 rounded-md px-3 py-2 font-mono text-sm font-bold tracking-wider">
              {deviceCode}
            </code>
            <CopyButton text={deviceCode} />
          </div>
          <p className="text-muted-foreground">
            After authenticating in your browser, this page will update automatically.
          </p>
        </div>
        <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-200">
            Prerequisite: Enable device code authorization in your <a href="https://chatgpt.com/#settings/Security" target="_blank" rel="noreferrer" className="underline">ChatGPT Security Settings</a>.
          </p>
        </div>
        <button
          onClick={() => setAuthDone(true)}
          className="h-7 px-3 text-xs rounded-md border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground"
        >
          I've completed authentication
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        Authenticate Codex with your ChatGPT subscription using device code authorization.
      </p>
      <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
        <p className="text-amber-800 dark:text-amber-200">
          Prerequisite: Enable device code authorization in your <a href="https://chatgpt.com/#settings/Security" target="_blank" rel="noreferrer" className="underline">ChatGPT Security Settings</a>.
        </p>
      </div>
      <button
        onClick={() => startAuth.mutate()}
        disabled={startAuth.isPending}
        className="h-8 px-3 text-xs rounded-md border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {startAuth.isPending ? "Starting..." : "Start Device Auth"}
      </button>
      {startAuth.isError && (
        <p className="text-destructive">
          {startAuth.error instanceof Error ? startAuth.error.message : "Failed to start device auth"}
        </p>
      )}
    </div>
  );
}

// Main component that switches based on adapter type
export function ClaudeLoginTerminal({ agentId, companyId, adapterType, onTokenReady }: AuthSetupProps) {
  if (adapterType === "codex_local") {
    return <CodexDeviceAuth agentId={agentId} companyId={companyId} />;
  }
  return <ClaudeSetupToken agentId={agentId} companyId={companyId} onTokenReady={onTokenReady} />;
}
