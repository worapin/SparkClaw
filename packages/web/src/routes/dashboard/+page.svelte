<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getMe, getInstances, createInstance, deleteInstance, createCheckout, logout } from "$lib/api";
  import { planSchema } from "@sparkclaw/shared/schemas";
  import type { MeResponse, InstanceResponse } from "@sparkclaw/shared/types";
  import { userInstances, selectedInstanceId } from "$lib/stores/instance";
  import Skeleton from "$lib/components/Skeleton.svelte";

  let user = $state<MeResponse | null>(null);
  let instances = $state<InstanceResponse[]>([]);
  let loading = $state(true);
  let error = $state("");
  let creating = $state(false);
  let showUpgradeModal = $state(false);
  let deleteConfirmId = $state<string | null>(null);
  let deleting = $state(false);

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

      // Handle ?plan= redirect to checkout
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
        await refreshInstances();
      }
    } catch {
      goto("/auth");
      return;
    } finally {
      loading = false;
    }
  }

  async function refreshInstances() {
    const result = await getInstances();
    instances = result.instances;
    userInstances.set(instances);

    // Auto-select first instance if none selected
    if (instances.length > 0) {
      selectedInstanceId.subscribe((id) => {
        if (!id || !instances.find((i) => i.id === id)) {
          selectedInstanceId.set(instances[0].id);
        }
      })();
    }

    // Poll if any instance is pending
    const hasPending = instances.some((i) => i.status === "pending");
    if (hasPending && !pollTimer) {
      pollTimer = setInterval(async () => {
        try {
          const r = await getInstances();
          instances = r.instances;
          userInstances.set(instances);
          if (!r.instances.some((i) => i.status === "pending")) {
            clearInterval(pollTimer);
            pollTimer = undefined;
          }
        } catch {
          /* ignore */
        }
      }, 5000);
    } else if (!hasPending && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  async function handleCreateInstance() {
    if (!user) return;
    if (user.instanceCount >= user.instanceLimit) {
      showUpgradeModal = true;
      return;
    }
    creating = true;
    error = "";
    try {
      await createInstance();
      user = await getMe();
      await refreshInstances();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("limit") || msg.includes("UPGRADE")) {
        showUpgradeModal = true;
      } else {
        error = msg;
      }
    } finally {
      creating = false;
    }
  }

  async function handleDeleteInstance(id: string) {
    deleting = true;
    error = "";
    try {
      await deleteInstance(id);
      user = await getMe();
      await refreshInstances();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deleting = false;
      deleteConfirmId = null;
    }
  }

  async function handleLogout() {
    await logout();
    goto("/");
  }

  function statusColor(status: string) {
    switch (status) {
      case "ready": return "bg-green-500";
      case "pending": return "bg-amber-500";
      case "error": return "bg-red-500";
      default: return "bg-warm-400";
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case "ready": return "Ready";
      case "pending": return "Provisioning";
      case "error": return "Error";
      case "suspended": return "Suspended";
      default: return status;
    }
  }
</script>

<svelte:head>
  <title>Dashboard - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8 soft-card p-5">
      <div>
        <h1 class="font-display text-3xl">Control Center</h1>
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
      <!-- Plan skeleton -->
      <div class="flex items-center justify-between soft-card p-5 mb-6">
        <div class="flex items-center gap-4">
          <Skeleton width="80px" height="24px" />
          <div class="h-6 w-px bg-warm-200"></div>
          <Skeleton width="100px" height="20px" />
        </div>
        <Skeleton width="120px" height="44px" rounded="xl" />
      </div>

      <!-- Instance skeletons -->
      <div class="grid md:grid-cols-2 gap-4">
        {#each Array(2) as _}
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center justify-between mb-4">
              <Skeleton width="150px" height="24px" />
              <Skeleton width="60px" height="20px" rounded="full" />
            </div>
            <Skeleton width="100%" height="60px" class="mb-4" />
            <div class="flex gap-2">
              <Skeleton width="80px" height="36px" rounded="lg" />
              <Skeleton width="80px" height="36px" rounded="lg" />
            </div>
          </div>
        {/each}
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
      <!-- Plan info bar -->
      <div class="flex items-center justify-between bg-white rounded-2xl border border-warm-200 p-5 mb-6">
        <div class="flex items-center gap-4">
          <div>
            <span class="font-display text-lg capitalize text-terra-500">{user.subscription.plan}</span>
            <span class="text-warm-400 text-sm ml-2">plan</span>
          </div>
          <div class="h-6 w-px bg-warm-200"></div>
          <div class="text-sm text-warm-500">
            {user.instanceCount} / {user.instanceLimit} instances
          </div>
        </div>
        <button
          onclick={handleCreateInstance}
          disabled={creating}
          class="btn-primary px-5 py-2.5 text-sm disabled:opacity-50 flex items-center gap-2"
        >
          {#if creating}
            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Creating...
          {:else}
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            New Instance
          {/if}
        </button>
      </div>

      <!-- Instance grid -->
      {#if instances.length === 0}
        <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
          <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-warm-500">Spinning up your first OpenClaw instance...</p>
          <p class="text-warm-400 text-sm mt-1">This usually takes about a minute. Auto-refreshing...</p>
        </div>
      {:else}
        <div class="grid md:grid-cols-2 gap-4 stagger">
          {#each instances as inst (inst.id)}
            <div class="soft-card p-6 card-hover">
              <!-- Instance header -->
              <div class="flex items-center justify-between mb-4">
                <h3 class="font-display text-lg truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</h3>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="w-2.5 h-2.5 rounded-full {statusColor(inst.status)} {inst.status === 'pending' ? 'animate-pulse' : ''}"></span>
                  <span class="text-xs font-semibold {inst.status === 'ready' ? 'text-green-700' : inst.status === 'pending' ? 'text-amber-700' : inst.status === 'error' ? 'text-red-700' : 'text-warm-600'}">{statusLabel(inst.status)}</span>
                </div>
              </div>

              {#if inst.status === "pending"}
                <div class="text-center py-4">
                  <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-3"></div>
                  <p class="text-warm-400 text-sm">Provisioning...</p>
                </div>
              {:else if inst.status === "ready"}
                <!-- URL -->
                <div class="bg-warm-50 rounded-xl p-3 border border-warm-100 mb-4">
                  <div class="text-xs text-warm-400 mb-1">URL</div>
                  <a href={inst.url} target="_blank" rel="noopener" class="text-terra-500 text-sm font-medium hover:underline break-all">{inst.customDomain || inst.url}</a>
                  {#if inst.customDomain && inst.domainStatus === "ready"}
                    <div class="text-xs text-warm-400 mt-1 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Custom domain active
                    </div>
                  {:else if inst.customDomain && inst.domainStatus !== "ready"}
                    <div class="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                      Domain: {inst.domainStatus}
                    </div>
                  {/if}
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                  <a href="/dashboard/{inst.id}" class="btn-lift flex-1 bg-terra-500 text-white py-2 rounded-xl font-semibold text-xs text-center hover:bg-terra-600 transition-colors">Manage</a>
                  <a href="/setup?instance={inst.id}" class="flex-1 bg-warm-100 text-warm-700 py-2 rounded-xl font-semibold text-xs text-center hover:bg-warm-200 transition-colors border border-warm-200">Setup</a>
                  <button onclick={() => deleteConfirmId = inst.id} class="px-3 py-2 rounded-xl text-warm-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-warm-200" aria-label="Delete instance">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              {:else if inst.status === "error"}
                <div class="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                  <p class="text-red-700 text-sm">Provisioning failed. Contact support.</p>
                </div>
                <button onclick={() => deleteConfirmId = inst.id} class="text-xs text-red-600 hover:underline">Remove</button>
              {:else if inst.status === "suspended"}
                <div class="text-center py-3">
                  <p class="text-warm-500 text-sm mb-3">Subscription canceled. Instance suspended.</p>
                  <a href="/pricing" class="text-xs font-semibold text-terra-500 hover:text-terra-600">Re-subscribe</a>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

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

    <!-- Delete Confirmation Modal -->
    {#if deleteConfirmId}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="font-display text-xl mb-2">Delete Instance?</h3>
          <p class="text-warm-500 text-sm mb-6">This will permanently delete the instance and all its channel configurations. This cannot be undone.</p>
          <div class="flex gap-3">
            <button onclick={() => deleteConfirmId = null} class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors">Cancel</button>
            <button
              onclick={() => deleteConfirmId && handleDeleteInstance(deleteConfirmId)}
              disabled={deleting}
              class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Upgrade Modal -->
    {#if showUpgradeModal}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="font-display text-xl mb-2">Instance Limit Reached</h3>
          <p class="text-warm-500 text-sm mb-2">
            Your <span class="font-semibold capitalize">{user?.subscription?.plan}</span> plan allows up to <span class="font-semibold">{user?.instanceLimit}</span> instance{user?.instanceLimit === 1 ? '' : 's'}.
          </p>
          <p class="text-warm-500 text-sm mb-6">Upgrade your plan to create more instances.</p>
          <div class="flex gap-3">
            <button onclick={() => showUpgradeModal = false} class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors">Cancel</button>
            <a href="/pricing" class="flex-1 btn-lift py-2.5 rounded-xl font-semibold text-sm bg-terra-500 text-white text-center hover:bg-terra-600 transition-colors">Upgrade Plan</a>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error toast -->
    {#if error}
      <div class="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm shadow-lg animate-fade-up z-50">
        {error}
      </div>
    {/if}
  </div>
</section>
