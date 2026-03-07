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
      if (result.status === "pending" && !pollingActive) startPolling();
      else if (result.status !== "pending") stopPolling();
    }
  }

  function startPolling() {
    pollingActive = true;
    pollTimer = setInterval(async () => {
      try { await refreshInstance(); } catch { stopPolling(); }
    }, 5000);
  }

  function stopPolling() {
    pollingActive = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
  }

  async function handleLogout() {
    await logout();
    goto("/");
  }
</script>

<svelte:head>
  <title>Dashboard - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="font-display text-3xl">Dashboard</h1>
        {#if user}
          <p class="text-warm-500 mt-1">Welcome back, {user.email}</p>
        {/if}
      </div>
      <div class="flex gap-3">
        <a href="/account" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-2 rounded-lg hover:bg-warm-100">Settings</a>
        <button onclick={handleLogout} class="text-sm font-medium text-warm-500 hover:text-warm-900 transition-colors px-3 py-2 rounded-lg hover:bg-warm-100">Log out</button>
      </div>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading your dashboard...</p>
      </div>
    {:else if !user}
      <p class="text-warm-500">Redirecting to login...</p>
    {:else if !user.subscription}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center stagger">
        <div class="w-16 h-16 bg-warm-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="font-display text-2xl mb-2">No active subscription</h2>
        <p class="text-warm-500 mb-6">Subscribe to create your OpenClaw instance.</p>
        <a href="/pricing" class="btn-lift inline-block bg-terra-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-terra-600 transition-colors">Choose a Plan</a>
      </div>
    {:else}
      <div class="grid md:grid-cols-3 gap-6 stagger">
        <!-- Subscription card -->
        <div class="md:col-span-1 bg-white rounded-2xl border border-warm-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display text-lg">Plan</h2>
            <span class="text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full">{user.subscription.status}</span>
          </div>
          <div class="mb-4">
            <div class="font-display text-3xl text-terra-500 capitalize">{user.subscription.plan}</div>
          </div>
          <a href="/account" class="block w-full text-sm font-medium text-warm-600 text-center border border-warm-200 rounded-lg py-2 hover:bg-warm-50 transition-colors">
            Manage plan
          </a>
        </div>

        <!-- Instance card -->
        <div class="md:col-span-2 bg-white rounded-2xl border border-warm-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-display text-lg">Instance</h2>
            {#if instance}
              <div class="flex items-center gap-2">
                {#if instance.status === "ready"}
                  <span class="w-2.5 h-2.5 bg-green-500 rounded-full pulse-dot"></span>
                  <span class="text-xs font-semibold text-green-700">Ready</span>
                {:else if instance.status === "pending"}
                  <span class="w-2.5 h-2.5 bg-amber-500 rounded-full pulse-dot"></span>
                  <span class="text-xs font-semibold text-amber-700">Provisioning</span>
                {:else if instance.status === "error"}
                  <span class="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                  <span class="text-xs font-semibold text-red-700">Error</span>
                {:else}
                  <span class="w-2.5 h-2.5 bg-warm-400 rounded-full"></span>
                  <span class="text-xs font-semibold text-warm-600">Suspended</span>
                {/if}
              </div>
            {/if}
          </div>

          {#if !instance || instance.status === "pending"}
            <div class="text-center py-6">
              <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-warm-500">Spinning up your OpenClaw instance...</p>
              <p class="text-warm-400 text-sm mt-1">This usually takes about a minute. Auto-refreshing...</p>
            </div>
          {:else if instance.status === "ready"}
            <div class="bg-warm-50 rounded-xl p-4 border border-warm-100 mb-4">
              <div class="text-sm text-warm-500 mb-1">Instance URL</div>
              {#if instance.customDomain && instance.domainStatus === "ready"}
                <a href={instance.url} target="_blank" rel="noopener" class="text-terra-500 font-medium hover:underline break-all">{instance.url}</a>
                <div class="text-xs text-warm-400 mt-1 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Custom domain active
                </div>
              {:else if instance.customDomain}
                <a href={instance.url} target="_blank" rel="noopener" class="text-terra-500 font-medium hover:underline break-all">{instance.url}</a>
                <div class="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  Custom domain: {instance.domainStatus}
                </div>
              {:else}
                <a href={instance.url} target="_blank" rel="noopener" class="text-terra-500 font-medium hover:underline break-all">{instance.url}</a>
              {/if}
            </div>
            <div class="flex gap-3">
              <a href="{instance.url}/setup" target="_blank" rel="noopener" class="btn-lift flex-1 bg-terra-500 text-white py-2.5 rounded-xl font-semibold text-sm text-center hover:bg-terra-600 transition-colors">Open Setup</a>
              <a href={instance.url} target="_blank" rel="noopener" class="flex-1 bg-warm-100 text-warm-700 py-2.5 rounded-xl font-semibold text-sm text-center hover:bg-warm-200 transition-colors border border-warm-200">Open Console</a>
            </div>
          {:else if instance.status === "error"}
            <div class="bg-red-50 border border-red-200 rounded-xl p-4">
              <p class="text-red-700 font-medium text-sm">We couldn't create your instance. Please contact support.</p>
            </div>
          {:else if instance.status === "suspended"}
            <div class="text-center py-4">
              <p class="text-warm-500 mb-4">Your subscription has been canceled. Instance is suspended.</p>
              <a href="/pricing" class="btn-lift inline-block bg-terra-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors">Re-subscribe</a>
            </div>
          {/if}
        </div>
      </div>

      <!-- Quick actions -->
      <div class="mt-8">
        <h2 class="font-display text-xl mb-4">Quick start</h2>
        <div class="grid md:grid-cols-3 gap-4 stagger">
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f4ac;</div>
            <h3 class="font-semibold text-sm mb-1">Connect Telegram</h3>
            <p class="text-warm-500 text-xs">Set up your first channel in 2 minutes</p>
          </a>
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f916;</div>
            <h3 class="font-semibold text-sm mb-1">Configure LLM</h3>
            <p class="text-warm-500 text-xs">Choose your AI model and persona</p>
          </a>
          <a href="/docs" class="card-hover bg-white rounded-xl border border-warm-200 p-5 block">
            <div class="text-2xl mb-2">&#x1f4d6;</div>
            <h3 class="font-semibold text-sm mb-1">Read the docs</h3>
            <p class="text-warm-500 text-xs">Full guide to get the most from OpenClaw</p>
          </a>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm shadow-lg animate-fade-up z-50">
        {error}
      </div>
    {/if}
  </div>
</section>
