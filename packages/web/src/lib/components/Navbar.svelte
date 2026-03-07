<script lang="ts">
  import { page } from '$app/state';

  let mobileOpen = $state(false);

  const isActive = (path: string) => page.url.pathname === path;
</script>

<nav class="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-warm-50/80 border-b border-warm-200">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2.5 group">
      <div class="w-8 h-8 bg-terra-500 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform">
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
      </div>
      <span class="font-display text-xl text-warm-900">SparkClaw</span>
    </a>

    <div class="hidden md:flex items-center gap-8 text-sm font-medium text-warm-600">
      <a href="/pricing" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/pricing')}>Pricing</a>
      <a href="/docs" class="hover:text-warm-900 transition-colors" class:text-warm-900={isActive('/docs')}>Docs</a>
    </div>

    <div class="hidden md:flex items-center gap-3">
      <a href="/auth" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors px-3 py-1.5">Log in</a>
      <a href="/pricing" class="text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg hover:bg-warm-800 transition-colors">Get Started</a>
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
      <a href="/pricing" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Pricing</a>
      <a href="/docs" class="block text-sm font-medium text-warm-700 hover:text-warm-900" onclick={() => mobileOpen = false}>Docs</a>
      <hr class="border-warm-200" />
      <a href="/auth" class="block text-sm font-medium text-warm-700" onclick={() => mobileOpen = false}>Log in</a>
      <a href="/pricing" class="block text-sm font-semibold bg-warm-900 text-warm-50 px-4 py-2 rounded-lg text-center" onclick={() => mobileOpen = false}>Get Started</a>
    </div>
  {/if}
</nav>
