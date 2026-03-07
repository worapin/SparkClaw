<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getMe, getInstance, createCheckout, logout } from "$lib/api";
  import { planSchema } from "@sparkclaw/shared/schemas";
  import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";

  let user = $state<MeResponse | null>(null);
  let instance = $state<InstanceResponse | null>(null);
  let loading = $state(true);
  let error = $state("");
  let pollingActive = $state(false);

  let pollTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    loadDashboard();
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  });

  async function loadDashboard() {
    try {
      user = await getMe();

      const rawPlan = page.url.searchParams.get("plan");
      if (rawPlan && !user.subscription) {
        const parsed = planSchema.safeParse(rawPlan);
        if (parsed.success) {
          const { url } = await createCheckout(parsed.data);
          window.location.href = url;
          return;
        }
      }

      if (user.subscription) {
        await refreshInstance();
      }
    } catch {
      goto("/auth");
      return;
    } finally {
      loading = false;
    }
  }

  async function refreshInstance() {
    const result = await getInstance();
    if ("id" in result) {
      instance = result;

      if (result.status === "pending" && !pollingActive) {
        startPolling();
      } else if (result.status !== "pending") {
        stopPolling();
      }
    }
  }

  function startPolling() {
    pollingActive = true;
    pollTimer = setInterval(async () => {
      try {
        await refreshInstance();
      } catch {
        stopPolling();
      }
    }, 5000);
  }

  function stopPolling() {
    pollingActive = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  async function handleLogout() {
    await logout();
    goto("/");
  }
</script>

<svelte:head>
  <title>Dashboard - SparkClaw</title>
</svelte:head>

<main>
  <div class="dashboard">
    <header>
      <h1>Dashboard</h1>
      {#if user}
        <div class="user-info">
          <span>{user.email}</span>
          <button onclick={handleLogout}>Log out</button>
        </div>
      {/if}
    </header>

    {#if loading}
      <section class="card">
        <div class="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </section>
    {:else if !user}
      <p>Redirecting to login...</p>
    {:else if !user.subscription}
      <section class="card">
        <h2>No active subscription</h2>
        <p>Subscribe to create your OpenClaw instance.</p>
        <a href="/pricing" class="cta">Choose a Plan</a>
      </section>
    {:else if !instance}
      <section class="card">
        <h2>Setting up...</h2>
        <div class="loading-spinner"></div>
        <p>Your instance is being provisioned. This usually takes about a minute.</p>
      </section>
    {:else}
      <section class="card">
        <h2>Subscription</h2>
        <p><strong>Plan:</strong> {user.subscription.plan}</p>
        <p><strong>Status:</strong> <span class="status-badge status-{user.subscription.status}">{user.subscription.status}</span></p>
      </section>

      <section class="card">
        <h2>Instance</h2>
        {#if instance.status === "pending"}
          <div class="loading-spinner"></div>
          <p>We're spinning up your OpenClaw instance...</p>
          <p class="hint">This usually takes about a minute. Auto-refreshing...</p>
        {:else if instance.status === "ready"}
          <p><strong>Status:</strong> <span class="status-badge status-ready">Ready</span></p>
          <p><strong>URL:</strong> <a href={instance.url} target="_blank" rel="noopener">{instance.url}</a></p>
          <div class="actions">
            <a href="{instance.url}/setup" target="_blank" rel="noopener" class="cta">Open Setup</a>
            <a href={instance.url} target="_blank" rel="noopener" class="cta secondary">Open Console</a>
          </div>
        {:else if instance.status === "error"}
          <p><strong>Status:</strong> <span class="status-badge status-error">Error</span></p>
          <p>We couldn't create your instance. Please contact support.</p>
          {#if instance.url}
            <p class="error-detail">Error: {instance.url}</p>
          {/if}
        {:else if instance.status === "suspended"}
          <p><strong>Status:</strong> <span class="status-badge status-suspended">Suspended</span></p>
          <p>Your subscription has been canceled. Instance is suspended.</p>
          <a href="/pricing" class="cta">Re-subscribe</a>
        {/if}
      </section>
    {/if}

    {#if error}
      <div class="toast error">{error}</div>
    {/if}
  </div>
</main>

<style>
  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 8px 0;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .hint {
    color: #6b7280;
    font-size: 0.875rem;
  }
  .status-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .status-active, .status-ready { background: #dcfce7; color: #166534; }
  .status-error { background: #fee2e2; color: #991b1b; }
  .status-suspended, .status-past_due { background: #fef3c7; color: #92400e; }
  .status-pending { background: #e0e7ff; color: #3730a3; }
  .error-detail {
    color: #991b1b;
    background: #fee2e2;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  .toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.875rem;
    z-index: 100;
  }
  .toast.error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
  }
</style>
