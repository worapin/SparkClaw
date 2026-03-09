<script lang="ts">
  import { page } from '$app/state';
  import { userInstances, selectedInstanceId } from '$lib/stores/instance';

  let mobileOpen = $state(false);
  let switcherOpen = $state(false);

  const isActive = (path: string) => page.url.pathname === path;
  const isAppPage = $derived(
    page.url.pathname.startsWith('/dashboard') ||
    page.url.pathname.startsWith('/setup') ||
    page.url.pathname.startsWith('/account') ||
    page.url.pathname.startsWith('/orgs') ||
    page.url.pathname.startsWith('/usage')
  );

  let instances = $state<import("@sparkclaw/shared/types").InstanceResponse[]>([]);
  let currentId = $state<string | null>(null);

  userInstances.subscribe((v) => (instances = v));
  selectedInstanceId.subscribe((v) => (currentId = v));

  const currentInstance = $derived(instances.find((i) => i.id === currentId));

  function selectInstance(id: string) {
    selectedInstanceId.set(id);
    switcherOpen = false;
  }

  function statusDot(status: string) {
    switch (status) {
      case 'ready': return 'bg-green-500';
      case 'pending': return 'bg-amber-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-warm-400';
    }
  }
</script>

<nav class="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-warm-50/80 border-b border-warm-200">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a href="/" class="flex items-center gap-2.5 group">
        <div class="w-8 h-8 bg-terra-500 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <span class="font-display text-xl text-warm-900">SparkClaw</span>
      </a>

      <!-- Instance Switcher (only on app pages with instances) -->
      {#if isAppPage && instances.length > 0}
        <div class="hidden md:block relative">
          <button
            onclick={() => switcherOpen = !switcherOpen}
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-warm-200 hover:bg-warm-100 transition-colors text-sm"
          >
            <span class="w-2 h-2 rounded-full {currentInstance ? statusDot(currentInstance.status) : 'bg-warm-300'}"></span>
            <span class="font-medium text-warm-700 max-w-[140px] truncate">
              {currentInstance?.instanceName || `Instance ${currentId?.slice(0, 8) ?? '...'}`}
            </span>
            <svg class="w-4 h-4 text-warm-400 transition-transform {switcherOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>

          {#if switcherOpen}
            <!-- Backdrop -->
            <button class="fixed inset-0 z-40" onclick={() => switcherOpen = false} aria-label="Close"></button>
            <!-- Dropdown -->
            <div class="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-warm-200 shadow-lg z-50 py-1">
              {#each instances as inst (inst.id)}
                <button
                  onclick={() => selectInstance(inst.id)}
                  class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50 transition-colors text-left {inst.id === currentId ? 'bg-warm-50' : ''}"
                >
                  <span class="w-2 h-2 rounded-full shrink-0 {statusDot(inst.status)}"></span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-warm-800 truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</div>
                    {#if inst.customDomain}
                      <div class="text-xs text-warm-400 truncate">{inst.customDomain}</div>
                    {/if}
                  </div>
                  {#if inst.id === currentId}
                    <svg class="w-4 h-4 text-terra-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  {/if}
                </button>
              {/each}
              <div class="border-t border-warm-100 mt-1 pt-1">
                <a href="/dashboard" class="flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50 transition-colors text-sm text-terra-600 font-medium" onclick={() => switcherOpen = false}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Manage Instances
                </a>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="hidden md:flex items-center gap-8 text-sm font-medium text-warm-600">
      <a href="/pricing" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/pricing')}>Pricing</a>
      <a href="/docs" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/docs')}>Docs</a>
    </div>

    <div class="hidden md:flex items-center gap-3">
      {#if isAppPage}
        <a href="/dashboard" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/dashboard')}>Dashboard</a>
        <a href="/orgs" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/orgs')}>Teams</a>
        <a href="/usage" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/usage')}>Usage</a>
        <a href="/account" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5" class:text-warm-900={isActive('/account')}>Account</a>
      {:else}
        <a href="/auth" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5">Log in</a>
        <a href="/pricing" class="text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg hover:bg-warm-800 transition-colors">Get Started</a>
      {/if}
    </div>

    <!-- Mobile hamburger -->
    <button class="md:hidden p-2 text-warm-600" onclick={() => mobileOpen = !mobileOpen} aria-label="Menu">
      {#if mobileOpen}
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      {:else}
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      {/if}
    </button>
  </div>

  <!-- Mobile menu -->
  {#if mobileOpen}
    <div class="md:hidden border-t border-warm-200 bg-warm-50 px-6 py-4 space-y-3">
      <!-- Mobile instance switcher -->
      {#if isAppPage && instances.length > 0}
        <div class="pb-3 border-b border-warm-200">
          <div class="text-xs text-warm-400 font-medium uppercase tracking-wider mb-2">Instance</div>
          {#each instances as inst (inst.id)}
            <button
              onclick={() => { selectedInstanceId.set(inst.id); mobileOpen = false; }}
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left {inst.id === currentId ? 'bg-terra-50 text-terra-700' : 'text-warm-700 hover:bg-warm-100'}"
            >
              <span class="w-2 h-2 rounded-full {statusDot(inst.status)}"></span>
              <span class="text-sm font-medium truncate">{inst.instanceName || `Instance ${inst.id.slice(0, 8)}`}</span>
            </button>
          {/each}
        </div>
      {/if}

      <a href="/pricing" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Pricing</a>
      <a href="/docs" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Docs</a>
      <hr class="border-warm-200" />
      {#if isAppPage}
        <a href="/dashboard" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Dashboard</a>
        <a href="/orgs" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Teams</a>
        <a href="/usage" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Usage</a>
        <a href="/account" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Account</a>
      {:else}
        <a href="/auth" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Log in</a>
        <a href="/pricing" class="block text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg text-center" onclick={() => mobileOpen = false}>Get Started</a>
      {/if}
    </div>
  {/if}
</nav>
