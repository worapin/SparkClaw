<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    getMe,
    logout,
    getTotpStatus,
    setupTotp,
    verifyTotp,
    disableTotp,
    getApiKeys,
    createApiKey,
    deleteApiKey,
    getLlmKeys,
    createLlmKey,
    deleteLlmKey,
  } from "$lib/api";
  import type { MeResponse, ApiKeyResponse, LlmKeyResponse } from "@sparkclaw/shared/types";

  const ALL_SCOPES = ["instance:read", "instance:write", "setup:read", "setup:write"] as const;
  const LLM_PROVIDERS = ["openai", "anthropic", "google", "ollama"] as const;

  // ── Core state ───────────────────────────────────────────────────────────────

  let user = $state<MeResponse | null>(null);
  let loading = $state(true);

  // ── TOTP state ───────────────────────────────────────────────────────────────

  let totpEnabled = $state(false);
  let totpLoading = $state(false);
  let totpSetupData = $state<{ secret: string; uri: string; backupCodes: string[] } | null>(null);
  let totpVerifyCode = $state("");
  let totpDisableCode = $state("");
  let totpError = $state("");
  let showDisableConfirm = $state(false);

  // ── API Keys state ───────────────────────────────────────────────────────────

  let apiKeys = $state<ApiKeyResponse[]>([]);
  let showApiKeyForm = $state(false);
  let newApiKeyName = $state("");
  let newApiKeyScopes = $state<string[]>([]);
  let createdApiKey = $state<string | null>(null);
  let apiKeyError = $state("");
  let apiKeyLoading = $state(false);
  let apiKeyCopied = $state(false);

  // ── LLM Keys state ──────────────────────────────────────────────────────────

  let llmKeys = $state<LlmKeyResponse[]>([]);
  let showLlmKeyForm = $state(false);
  let newLlmProvider = $state<string>("openai");
  let newLlmName = $state("");
  let newLlmApiKey = $state("");
  let llmKeyError = $state("");
  let llmKeyLoading = $state(false);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  onMount(async () => {
    try {
      const [meResult, totpResult, apiKeysResult, llmKeysResult] = await Promise.all([
        getMe(),
        getTotpStatus().catch(() => ({ enabled: false, hasBackupCodes: false })),
        getApiKeys().catch(() => ({ keys: [] })),
        getLlmKeys().catch(() => ({ keys: [] })),
      ]);
      user = meResult;
      totpEnabled = totpResult.enabled;
      apiKeys = apiKeysResult.keys;
      llmKeys = llmKeysResult.keys;
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });

  // ── TOTP handlers ────────────────────────────────────────────────────────────

  async function handleSetupTotp() {
    totpError = "";
    totpLoading = true;
    try {
      totpSetupData = await setupTotp();
    } catch (e: any) {
      totpError = e.message || "Failed to start 2FA setup";
    } finally {
      totpLoading = false;
    }
  }

  async function handleVerifyTotp() {
    totpError = "";
    totpLoading = true;
    try {
      await verifyTotp(totpVerifyCode);
      totpEnabled = true;
      totpSetupData = null;
      totpVerifyCode = "";
    } catch (e: any) {
      totpError = e.message || "Invalid verification code";
    } finally {
      totpLoading = false;
    }
  }

  async function handleDisableTotp() {
    totpError = "";
    totpLoading = true;
    try {
      await disableTotp(totpDisableCode);
      totpEnabled = false;
      showDisableConfirm = false;
      totpDisableCode = "";
    } catch (e: any) {
      totpError = e.message || "Invalid code";
    } finally {
      totpLoading = false;
    }
  }

  // ── API Key handlers ─────────────────────────────────────────────────────────

  async function handleCreateApiKey() {
    apiKeyError = "";
    if (!newApiKeyName.trim()) {
      apiKeyError = "Name is required";
      return;
    }
    if (newApiKeyScopes.length === 0) {
      apiKeyError = "Select at least one scope";
      return;
    }
    apiKeyLoading = true;
    try {
      const result = await createApiKey({ name: newApiKeyName, scopes: newApiKeyScopes });
      createdApiKey = result.key;
      const refreshed = await getApiKeys();
      apiKeys = refreshed.keys;
      newApiKeyName = "";
      newApiKeyScopes = [];
      showApiKeyForm = false;
    } catch (e: any) {
      apiKeyError = e.message || "Failed to create API key";
    } finally {
      apiKeyLoading = false;
    }
  }

  async function handleDeleteApiKey(id: string) {
    try {
      await deleteApiKey(id);
      apiKeys = apiKeys.filter((k) => k.id !== id);
    } catch (e: any) {
      apiKeyError = e.message || "Failed to delete key";
    }
  }

  function toggleScope(scope: string) {
    if (newApiKeyScopes.includes(scope)) {
      newApiKeyScopes = newApiKeyScopes.filter((s) => s !== scope);
    } else {
      newApiKeyScopes = [...newApiKeyScopes, scope];
    }
  }

  async function copyApiKey() {
    if (createdApiKey) {
      await navigator.clipboard.writeText(createdApiKey);
      apiKeyCopied = true;
      setTimeout(() => (apiKeyCopied = false), 2000);
    }
  }

  // ── LLM Key handlers ────────────────────────────────────────────────────────

  async function handleCreateLlmKey() {
    llmKeyError = "";
    if (!newLlmName.trim()) {
      llmKeyError = "Name is required";
      return;
    }
    if (!newLlmApiKey.trim()) {
      llmKeyError = "API key is required";
      return;
    }
    llmKeyLoading = true;
    try {
      await createLlmKey({ provider: newLlmProvider, name: newLlmName, apiKey: newLlmApiKey });
      const refreshed = await getLlmKeys();
      llmKeys = refreshed.keys;
      newLlmProvider = "openai";
      newLlmName = "";
      newLlmApiKey = "";
      showLlmKeyForm = false;
    } catch (e: any) {
      llmKeyError = e.message || "Failed to add LLM key";
    } finally {
      llmKeyLoading = false;
    }
  }

  async function handleDeleteLlmKey(id: string) {
    try {
      await deleteLlmKey(id);
      llmKeys = llmKeys.filter((k) => k.id !== id);
    } catch (e: any) {
      llmKeyError = e.message || "Failed to delete key";
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await logout();
    goto("/");
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatProvider(provider: string) {
    const map: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic", google: "Google", ollama: "Ollama" };
    return map[provider] || provider;
  }
</script>

<svelte:head>
  <title>Account - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-2xl mx-auto stagger">
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-display text-3xl">Account Settings</h1>
      <button onclick={handleLogout} class="text-sm text-warm-500 hover:text-warm-700 transition-colors">Sign out</button>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading...</p>
      </div>
    {:else if user}
      <!-- ── Profile ──────────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-4">Profile</h2>
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 bg-terra-100 text-terra-600 rounded-full flex items-center justify-center font-display text-xl">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <div class="font-medium">{user.email}</div>
            <div class="text-warm-500 text-sm">
              Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      <!-- ── Security ─────────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-6">Security</h2>

        <!-- Two-Factor Authentication -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-warm-800">Two-Factor Authentication</h3>
            {#if totpEnabled}
              <span class="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full">Enabled</span>
            {/if}
          </div>
          <p class="text-warm-500 text-sm mb-4">
            Add an extra layer of security to your account using a time-based one-time password (TOTP).
          </p>

          {#if totpError}
            <div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">{totpError}</div>
          {/if}

          {#if totpEnabled && !showDisableConfirm}
            <button
              onclick={() => (showDisableConfirm = true)}
              class="text-sm font-medium text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors"
            >
              Disable 2FA
            </button>
          {:else if totpEnabled && showDisableConfirm}
            <div class="p-4 bg-warm-50 rounded-xl border border-warm-100">
              <p class="text-sm text-warm-700 mb-3">Enter your current TOTP code to disable 2FA:</p>
              <div class="flex gap-3">
                <input
                  type="text"
                  bind:value={totpDisableCode}
                  placeholder="000000"
                  maxlength="6"
                  class="w-32 px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400 font-mono text-center tracking-widest"
                />
                <button
                  onclick={handleDisableTotp}
                  disabled={totpLoading || totpDisableCode.length < 6}
                  class="text-sm font-medium text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {totpLoading ? "Verifying..." : "Confirm Disable"}
                </button>
                <button
                  onclick={() => { showDisableConfirm = false; totpDisableCode = ""; totpError = ""; }}
                  class="text-sm text-warm-500 hover:text-warm-700 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          {:else if totpSetupData}
            <div class="p-4 bg-warm-50 rounded-xl border border-warm-100 space-y-4">
              <div>
                <p class="text-sm font-medium text-warm-700 mb-2">Scan this with your authenticator app, or enter the secret manually:</p>
                <div class="bg-white border border-warm-200 rounded-xl p-4 text-center">
                  <code class="text-sm font-mono text-warm-800 break-all select-all">{totpSetupData.secret}</code>
                </div>
              </div>

              {#if totpSetupData.backupCodes.length > 0}
                <div>
                  <p class="text-sm font-medium text-warm-700 mb-2">Backup codes (save these somewhere safe):</p>
                  <div class="bg-white border border-warm-200 rounded-xl p-4 grid grid-cols-2 gap-1.5">
                    {#each totpSetupData.backupCodes as code}
                      <code class="text-xs font-mono text-warm-600 select-all">{code}</code>
                    {/each}
                  </div>
                </div>
              {/if}

              <div>
                <p class="text-sm font-medium text-warm-700 mb-2">Enter the 6-digit code from your app to verify:</p>
                <div class="flex gap-3">
                  <input
                    type="text"
                    bind:value={totpVerifyCode}
                    placeholder="000000"
                    maxlength="6"
                    class="w-32 px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400 font-mono text-center tracking-widest"
                  />
                  <button
                    onclick={handleVerifyTotp}
                    disabled={totpLoading || totpVerifyCode.length < 6}
                    class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 disabled:opacity-50"
                  >
                    {totpLoading ? "Verifying..." : "Verify & Enable"}
                  </button>
                  <button
                    onclick={() => { totpSetupData = null; totpVerifyCode = ""; totpError = ""; }}
                    class="text-sm text-warm-500 hover:text-warm-700 px-3"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {:else}
            <button
              onclick={handleSetupTotp}
              disabled={totpLoading}
              class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 disabled:opacity-50"
            >
              {totpLoading ? "Setting up..." : "Enable 2FA"}
            </button>
          {/if}
        </div>

        <!-- Divider -->
        <div class="border-t border-warm-100 mb-6"></div>

        <!-- API Keys -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-warm-800">API Keys</h3>
            {#if !showApiKeyForm && !createdApiKey}
              <button
                onclick={() => { showApiKeyForm = true; apiKeyError = ""; }}
                class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600"
              >
                Create API Key
              </button>
            {/if}
          </div>
          <p class="text-warm-500 text-sm mb-4">
            Use API keys to authenticate programmatic access to your SparkClaw instance.
          </p>

          {#if apiKeyError}
            <div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">{apiKeyError}</div>
          {/if}

          <!-- Newly created key (show once) -->
          {#if createdApiKey}
            <div class="p-4 bg-green-50 border border-green-200 rounded-xl mb-4">
              <p class="text-sm font-medium text-green-800 mb-2">API key created! Copy it now -- you won't be able to see it again.</p>
              <div class="flex items-center gap-2">
                <code class="flex-1 text-sm font-mono bg-white border border-green-200 rounded-lg px-3 py-2 select-all break-all">{createdApiKey}</code>
                <button
                  onclick={copyApiKey}
                  class="shrink-0 border border-green-300 text-green-700 px-3 py-2 rounded-lg text-sm hover:bg-green-100 transition-colors"
                >
                  {apiKeyCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onclick={() => (createdApiKey = null)}
                class="text-sm text-green-700 hover:text-green-800 mt-2"
              >
                Dismiss
              </button>
            </div>
          {/if}

          <!-- Create form -->
          {#if showApiKeyForm}
            <div class="p-4 bg-warm-50 rounded-xl border border-warm-100 mb-4 space-y-4">
              <div>
                <label for="api-key-name" class="text-sm font-medium text-warm-700 mb-1.5 block">Name</label>
                <input
                  id="api-key-name"
                  type="text"
                  bind:value={newApiKeyName}
                  placeholder="e.g. CI/CD Pipeline"
                  class="w-full px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400"
                />
              </div>
              <div>
                <span class="text-sm font-medium text-warm-700 mb-1.5 block">Scopes</span>
                <div class="flex flex-wrap gap-2">
                  {#each ALL_SCOPES as scope}
                    <label class="flex items-center gap-2 text-sm text-warm-700 bg-white border border-warm-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-warm-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={newApiKeyScopes.includes(scope)}
                        onchange={() => toggleScope(scope)}
                        class="rounded border-warm-300 text-terra-500 focus:ring-terra-500"
                      />
                      <code class="text-xs">{scope}</code>
                    </label>
                  {/each}
                </div>
              </div>
              <div class="flex gap-3">
                <button
                  onclick={handleCreateApiKey}
                  disabled={apiKeyLoading}
                  class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 disabled:opacity-50"
                >
                  {apiKeyLoading ? "Creating..." : "Create Key"}
                </button>
                <button
                  onclick={() => { showApiKeyForm = false; newApiKeyName = ""; newApiKeyScopes = []; apiKeyError = ""; }}
                  class="border border-warm-200 text-warm-700 px-4 py-2 rounded-xl text-sm hover:bg-warm-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          <!-- Existing keys list -->
          {#if apiKeys.length > 0}
            <div class="space-y-3">
              {#each apiKeys as key (key.id)}
                <div class="flex items-center justify-between p-4 bg-warm-50 rounded-xl border border-warm-100">
                  <div class="min-w-0">
                    <div class="font-medium text-sm">{key.name}</div>
                    <div class="text-warm-500 text-xs mt-0.5">
                      <code class="font-mono">{key.keyPrefix}...</code>
                      <span class="mx-1.5">&middot;</span>
                      {key.scopes.join(", ")}
                      <span class="mx-1.5">&middot;</span>
                      Created {formatDate(key.createdAt)}
                      {#if key.expiresAt}
                        <span class="mx-1.5">&middot;</span>
                        Expires {formatDate(key.expiresAt)}
                      {/if}
                    </div>
                  </div>
                  <button
                    onclick={() => handleDeleteApiKey(key.id)}
                    class="shrink-0 text-xs text-red-500 hover:text-red-700 ml-4"
                  >
                    Delete
                  </button>
                </div>
              {/each}
            </div>
          {:else if !showApiKeyForm}
            <p class="text-warm-400 text-sm">No API keys yet.</p>
          {/if}
        </div>
      </div>

      <!-- ── LLM Keys (BYOK) ─────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-lg">LLM Keys (BYOK)</h2>
          {#if !showLlmKeyForm}
            <button
              onclick={() => { showLlmKeyForm = true; llmKeyError = ""; }}
              class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600"
            >
              Add Key
            </button>
          {/if}
        </div>
        <p class="text-warm-500 text-sm mb-4">
          Bring your own API keys for LLM providers. Keys are encrypted at rest.
        </p>

        {#if llmKeyError}
          <div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">{llmKeyError}</div>
        {/if}

        <!-- Create LLM key form -->
        {#if showLlmKeyForm}
          <div class="p-4 bg-warm-50 rounded-xl border border-warm-100 mb-4 space-y-4">
            <div>
              <label for="llm-provider" class="text-sm font-medium text-warm-700 mb-1.5 block">Provider</label>
              <select
                id="llm-provider"
                bind:value={newLlmProvider}
                class="w-full px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400 bg-white"
              >
                {#each LLM_PROVIDERS as provider}
                  <option value={provider}>{formatProvider(provider)}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="llm-name" class="text-sm font-medium text-warm-700 mb-1.5 block">Name</label>
              <input
                id="llm-name"
                type="text"
                bind:value={newLlmName}
                placeholder="e.g. Production GPT-4"
                class="w-full px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400"
              />
            </div>
            <div>
              <label for="llm-api-key" class="text-sm font-medium text-warm-700 mb-1.5 block">API Key</label>
              <input
                id="llm-api-key"
                type="password"
                bind:value={newLlmApiKey}
                placeholder="sk-..."
                class="w-full px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-400 font-mono"
              />
            </div>
            <div class="flex gap-3">
              <button
                onclick={handleCreateLlmKey}
                disabled={llmKeyLoading}
                class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 disabled:opacity-50"
              >
                {llmKeyLoading ? "Adding..." : "Add Key"}
              </button>
              <button
                onclick={() => { showLlmKeyForm = false; newLlmProvider = "openai"; newLlmName = ""; newLlmApiKey = ""; llmKeyError = ""; }}
                class="border border-warm-200 text-warm-700 px-4 py-2 rounded-xl text-sm hover:bg-warm-50"
              >
                Cancel
              </button>
            </div>
          </div>
        {/if}

        <!-- Existing LLM keys list -->
        {#if llmKeys.length > 0}
          <div class="space-y-3">
            {#each llmKeys as key (key.id)}
              <div class="flex items-center justify-between p-4 bg-warm-50 rounded-xl border border-warm-100">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm">{key.name}</span>
                    <span class="text-xs font-medium bg-warm-100 text-warm-600 px-2 py-0.5 rounded-full">{formatProvider(key.provider)}</span>
                  </div>
                  <div class="text-warm-500 text-xs mt-0.5">
                    Created {formatDate(key.createdAt)}
                    {#if key.lastUsedAt}
                      <span class="mx-1.5">&middot;</span>
                      Last used {formatDate(key.lastUsedAt)}
                    {/if}
                  </div>
                </div>
                <button
                  onclick={() => handleDeleteLlmKey(key.id)}
                  class="shrink-0 text-xs text-red-500 hover:text-red-700 ml-4"
                >
                  Delete
                </button>
              </div>
            {/each}
          </div>
        {:else if !showLlmKeyForm}
          <p class="text-warm-400 text-sm">No LLM keys configured.</p>
        {/if}
      </div>

      <!-- ── Subscription ─────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-4">Subscription</h2>
        {#if user.subscription}
          <div class="flex items-center justify-between p-4 bg-warm-50 rounded-xl border border-warm-100 mb-4">
            <div>
              <div class="font-semibold text-lg capitalize">{user.subscription.plan} Plan</div>
              <div class="text-warm-500 text-sm">
                {#if user.subscription.currentPeriodEnd}
                  Next billing {new Date(user.subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {/if}
              </div>
            </div>
            <span class="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full capitalize">{user.subscription.status}</span>
          </div>
          <div class="flex gap-3">
            <a href="/pricing" class="flex-1 text-sm font-medium text-warm-700 text-center border border-warm-200 rounded-lg py-2.5 hover:bg-warm-50 transition-colors">Change plan</a>
            <button class="flex-1 text-sm font-medium text-warm-700 border border-warm-200 rounded-lg py-2.5 hover:bg-warm-50 transition-colors">Billing portal</button>
          </div>
        {:else}
          <p class="text-warm-500 mb-4">No active subscription.</p>
          <a href="/pricing" class="inline-block text-sm font-semibold text-terra-500 hover:text-terra-600 transition-colors">Choose a plan &rarr;</a>
        {/if}
      </div>

      <!-- ── Danger Zone ──────────────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-red-200 p-6">
        <h2 class="font-display text-lg mb-2 text-red-700">Danger Zone</h2>
        <p class="text-warm-500 text-sm mb-4">Canceling your subscription will suspend your instance. Your data is kept for 30 days.</p>
        <button class="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors">
          Cancel subscription
        </button>
      </div>
    {/if}
  </div>
</section>
