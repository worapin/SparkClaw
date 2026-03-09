<script lang="ts">
  let activeSection = $state('authentication');

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'user', label: 'User' },
    { id: 'instances', label: 'Instances' },
    { id: 'env-vars', label: 'Environment Variables' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'totp', label: 'TOTP (2FA)' },
    { id: 'llm-keys', label: 'LLM Keys (BYOK)' },
    { id: 'organizations', label: 'Organizations' },
    { id: 'usage', label: 'Usage' },
    { id: 'jobs', label: 'Scheduled Jobs' },
    { id: 'skills', label: 'Custom Skills' },
    { id: 'setup', label: 'Setup' },
  ];

  function scrollToSection(id: string) {
    activeSection = id;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleScroll() {
    const offset = 120;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i].id);
      if (el && el.getBoundingClientRect().top <= offset) {
        activeSection = sections[i].id;
        break;
      }
    }
  }
</script>

<svelte:head>
  <title>API Reference - SparkClaw</title>
</svelte:head>

<svelte:window onscroll={handleScroll} />

<section class="pt-24 pb-20 px-6">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-12">
      <div class="inline-block mb-4 px-3 py-1 bg-terra-50 text-terra-600 rounded-full text-xs font-semibold uppercase tracking-wider">API Reference</div>
      <h1 class="font-display text-4xl mb-3">REST API Documentation</h1>
      <p class="text-warm-500 text-lg max-w-2xl">Complete reference for the SparkClaw REST API. All endpoints use JSON request and response bodies.</p>
    </div>

    <div class="flex gap-8">
      <!-- Sidebar Navigation -->
      <nav class="hidden lg:block w-56 shrink-0">
        <div class="sticky top-24 space-y-1">
          {#each sections as section}
            <button
              onclick={() => scrollToSection(section.id)}
              class="block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {activeSection === section.id ? 'bg-terra-50 text-terra-600 font-semibold' : 'text-warm-500 hover:text-warm-700 hover:bg-warm-100'}"
            >
              {section.label}
            </button>
          {/each}
        </div>
      </nav>

      <!-- Main Content -->
      <div class="flex-1 min-w-0 space-y-12">

        <!-- Overview -->
        <div id="overview" class="scroll-mt-24">
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <h2 class="font-display text-2xl mb-4">Overview</h2>
            <div class="space-y-4 text-warm-700 text-sm leading-relaxed">
              <p>The SparkClaw API is organized around REST principles. All requests and responses use JSON format.</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <p class="text-warm-400 text-xs font-mono mb-1">Base URL</p>
                <code class="text-warm-100 text-sm font-mono">https://api.sparkclaw.com</code>
              </div>
              <div>
                <h3 class="font-display text-lg mb-2 text-warm-900">Authentication</h3>
                <p>The API uses <strong>cookie-based session authentication</strong>. After authenticating via the <code class="bg-warm-100 px-1.5 py-0.5 rounded text-xs font-mono">/auth/*</code> endpoints, the server sets an HTTP-only session cookie. All subsequent requests must include this cookie.</p>
                <p class="mt-2">For programmatic access, use <strong>API keys</strong> sent via the <code class="bg-warm-100 px-1.5 py-0.5 rounded text-xs font-mono">Authorization: Bearer &lt;key&gt;</code> header.</p>
              </div>
              <div>
                <h3 class="font-display text-lg mb-2 text-warm-900">Error Responses</h3>
                <p>Errors return a JSON body with an <code class="bg-warm-100 px-1.5 py-0.5 rounded text-xs font-mono">error</code> field:</p>
                <div class="bg-warm-900 rounded-xl p-4 mt-2">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "error": "Unauthorized" }`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Authentication -->
        <div id="authentication" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Authentication</h2>

          <!-- POST /auth/send-otp -->
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/auth/send-otp</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Send a one-time password to the specified email address.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "email": "user@example.com"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "ok": true
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <!-- POST /auth/verify-otp -->
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/auth/verify-otp</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Verify the OTP code and establish a session. Sets a session cookie on success.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "email": "user@example.com",
  "code": "123456"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "ok": true,
  "redirect": "/dashboard"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <!-- POST /auth/logout -->
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/auth/logout</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">End the current session and clear the session cookie.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "ok": true
}`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- User -->
        <div id="user" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">User</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/me</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get the current authenticated user's profile, subscription status, and feature flags.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "usr_abc123",
  "email": "user@example.com",
  "plan": "pro",
  "totpEnabled": false,
  "createdAt": "2025-01-15T00:00:00Z"
}`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Instances -->
        <div id="instances" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Instances</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/instances</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all instances belonging to the authenticated user.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "inst_abc123",
    "name": "My Bot",
    "status": "running",
    "createdAt": "2025-01-15T00:00:00Z"
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/instances/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get detailed information about a specific instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "inst_abc123",
  "name": "My Bot",
  "status": "running",
  "region": "us-east-1",
  "createdAt": "2025-01-15T00:00:00Z"
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/instances</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new instance. An optional name can be provided.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceName": "My New Bot"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "inst_def456",
  "name": "My New Bot",
  "status": "provisioning"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/instances/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Permanently delete an instance and all associated data.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/instances/:id/action</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Perform a lifecycle action on an instance: start, stop, or restart.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "action": "restart"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/instances/:id/health</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get the current health status of an instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "status": "healthy",
  "uptime": 86400,
  "lastCheck": "2025-01-16T12:00:00Z"
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/instances/:id/logs</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Retrieve instance logs. Supports Server-Sent Events (SSE) for real-time streaming by setting the <code class="bg-warm-100 px-1.5 py-0.5 rounded text-xs font-mono">Accept: text/event-stream</code> header.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "logs": [
    {
      "timestamp": "2025-01-16T12:00:00Z",
      "level": "info",
      "message": "Bot connected to Telegram"
    }
  ]
}`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Environment Variables -->
        <div id="env-vars" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Environment Variables</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/env-vars?instanceId=:instanceId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all environment variables for an instance. Secret values are redacted.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "env_abc123",
    "key": "API_TOKEN",
    "value": "***",
    "isSecret": true
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/env-vars</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new environment variable for an instance.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceId": "inst_abc123",
  "key": "API_TOKEN",
  "value": "sk-secret-value",
  "isSecret": true
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "env_def456",
  "key": "API_TOKEN",
  "isSecret": true
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold font-mono uppercase">PATCH</span>
              <code class="text-sm font-mono text-warm-900">/api/env-vars/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Update the value of an existing environment variable.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "value": "new-secret-value"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/env-vars/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Delete an environment variable.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- API Keys -->
        <div id="api-keys" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">API Keys</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/keys</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all API keys for the authenticated user. Key values are not returned.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "key_abc123",
    "name": "CI/CD Key",
    "scopes": ["instances:read", "instances:write"],
    "lastUsedAt": "2025-01-16T12:00:00Z",
    "expiresAt": "2025-07-16T00:00:00Z"
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/keys</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new API key. The full key value is returned only once in this response.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "name": "CI/CD Key",
  "scopes": ["instances:read", "instances:write"],
  "expiresInDays": 180
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "key_def456",
  "key": "sc_live_abc123...",
  "name": "CI/CD Key"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/keys/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Revoke and delete an API key. This action is irreversible.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- TOTP -->
        <div id="totp" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">TOTP (2FA)</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/totp/status</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Check whether TOTP two-factor authentication is enabled for the current user.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "enabled": true
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/totp/setup</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Initialize TOTP setup. Returns a secret and QR code URI for authenticator apps.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "otpauth://totp/SparkClaw:user@example.com?secret=..."
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/totp/verify</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Verify a TOTP code to complete setup or authenticate.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "code": "123456"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/totp/disable</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Disable TOTP two-factor authentication for the current user.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- LLM Keys -->
        <div id="llm-keys" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">LLM Keys (BYOK)</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/llm-keys</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all stored LLM provider API keys. Key values are redacted.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "llm_abc123",
    "provider": "openai",
    "label": "Production Key",
    "maskedKey": "sk-...xyz"
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/llm-keys</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Store a new LLM provider API key (Bring Your Own Key).</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "provider": "openai",
  "label": "Production Key",
  "apiKey": "sk-..."
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "llm_def456",
  "provider": "openai",
  "label": "Production Key"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/llm-keys/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Delete a stored LLM provider API key.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Organizations -->
        <div id="organizations" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Organizations</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all organizations the authenticated user belongs to.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "org_abc123",
    "name": "My Team",
    "role": "owner",
    "memberCount": 5
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new organization. The authenticated user becomes the owner.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "name": "My Team"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "org_def456",
  "name": "My Team"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/:id/members</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all members of an organization.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "mem_abc123",
    "email": "member@example.com",
    "role": "admin",
    "joinedAt": "2025-01-15T00:00:00Z"
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/:id/invite</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Send an invitation to join the organization.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "email": "newmember@example.com",
  "role": "member"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold font-mono uppercase">PATCH</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/:id/members/:memberId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Update a member's role within the organization.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "role": "admin"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/:id/members/:memberId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Remove a member from the organization.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Delete an organization. Only the owner can perform this action.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/orgs/invite/:token/accept</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Accept an organization invitation using the invite token.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true, "orgId": "org_abc123" }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Usage -->
        <div id="usage" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Usage</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/usage</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get the current billing period's usage summary.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "messages": 1250,
  "messagesLimit": 5000,
  "tokensUsed": 450000,
  "periodStart": "2025-01-01T00:00:00Z",
  "periodEnd": "2025-02-01T00:00:00Z"
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/usage/history</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get historical usage data across past billing periods.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "period": "2025-01",
    "messages": 4200,
    "tokensUsed": 1500000
  }
]`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Scheduled Jobs -->
        <div id="jobs" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Scheduled Jobs</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/jobs?instanceId=:instanceId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all scheduled jobs for an instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "job_abc123",
    "name": "Daily Report",
    "cron": "0 9 * * *",
    "enabled": true,
    "lastRunAt": "2025-01-16T09:00:00Z"
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/jobs</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new scheduled job for an instance.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceId": "inst_abc123",
  "name": "Daily Report",
  "cron": "0 9 * * *",
  "prompt": "Generate a daily summary report"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "job_def456",
  "name": "Daily Report",
  "cron": "0 9 * * *"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold font-mono uppercase">PATCH</span>
              <code class="text-sm font-mono text-warm-900">/api/jobs/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Update an existing scheduled job.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "cron": "0 10 * * *",
  "enabled": false
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/jobs/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Delete a scheduled job.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Skills -->
        <div id="skills" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Custom Skills</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/skills?instanceId=:instanceId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">List all custom skills for an instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`[
  {
    "id": "skill_abc123",
    "name": "Weather Lookup",
    "description": "Fetch current weather for a location",
    "enabled": true
  }
]`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/skills</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Create a new custom skill for an instance.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceId": "inst_abc123",
  "name": "Weather Lookup",
  "description": "Fetch current weather for a location",
  "code": "async function run(params) { ... }"
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "id": "skill_def456",
  "name": "Weather Lookup"
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold font-mono uppercase">PATCH</span>
              <code class="text-sm font-mono text-warm-900">/api/skills/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Update an existing custom skill.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "description": "Updated description",
  "enabled": false
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/skills/:id</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Delete a custom skill.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/skills/:id/execute</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Execute a custom skill manually with optional parameters.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "params": {
    "location": "San Francisco"
  }
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "result": "72°F, Sunny",
  "executionTimeMs": 230
}`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Setup -->
        <div id="setup" class="scroll-mt-24 space-y-4">
          <h2 class="font-display text-2xl">Setup</h2>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold font-mono uppercase">GET</span>
              <code class="text-sm font-mono text-warm-900">/api/setup/state?instanceId=:instanceId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Get the current state of the setup wizard for an instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "step": 2,
  "channels": {
    "telegram": { "configured": true },
    "discord": { "configured": false }
  },
  "llmConfigured": true
}`}</code></pre>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/setup/save</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Save the current setup wizard configuration.</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceId": "inst_abc123",
  "config": {
    "botName": "My Assistant",
    "systemPrompt": "You are a helpful assistant."
  }
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold font-mono uppercase">POST</span>
              <code class="text-sm font-mono text-warm-900">/api/setup/channel</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Save credentials for a messaging channel (Telegram, Discord, LINE, etc.).</p>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Request Body</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{
  "instanceId": "inst_abc123",
  "type": "telegram",
  "credentials": {
    "botToken": "123456:ABC-DEF..."
  }
}`}</code></pre>
                </div>
              </div>
              <div>
                <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
                <div class="bg-warm-900 rounded-xl p-4">
                  <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold font-mono uppercase">DELETE</span>
              <code class="text-sm font-mono text-warm-900">/api/setup/channel/:type?instanceId=:instanceId</code>
            </div>
            <p class="text-warm-500 text-sm mb-4">Remove a channel configuration from an instance.</p>
            <div>
              <p class="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Response</p>
              <div class="bg-warm-900 rounded-xl p-4">
                <pre class="text-sm text-warm-200 font-mono overflow-x-auto"><code>{`{ "ok": true }`}</code></pre>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</section>
