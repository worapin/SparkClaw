<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { checkAdmin } from "$lib/api";
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let loading = $state(true);
  let isAdmin = $state(false);

  onMount(async () => {
    try {
      const result = await checkAdmin();
      isAdmin = result.isAdmin;
      if (!result.isAdmin) {
        goto("/dashboard");
      }
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <section class="pt-24 pb-20 px-6">
    <div class="max-w-7xl mx-auto text-center">
      <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-warm-500">Checking admin access...</p>
    </div>
  </section>
{:else if isAdmin}
  <div class="min-h-screen bg-warm-50">
    <!-- Admin Header -->
    <header class="bg-white border-b border-warm-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <a href="/admin" class="font-display text-xl text-terra-500">SparkClaw Admin</a>
          <nav class="hidden md:flex items-center gap-1 ml-8">
            <a href="/admin" class="px-3 py-2 rounded-lg text-sm font-medium text-warm-600 hover:bg-warm-100 transition-colors">Dashboard</a>
            <a href="/admin/users" class="px-3 py-2 rounded-lg text-sm font-medium text-warm-600 hover:bg-warm-100 transition-colors">Users</a>
            <a href="/admin/instances" class="px-3 py-2 rounded-lg text-sm font-medium text-warm-600 hover:bg-warm-100 transition-colors">Instances</a>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <a href="/dashboard" class="text-sm text-warm-500 hover:text-warm-700 transition-colors">View Site →</a>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main>
      {@render children()}
    </main>
  </div>
{/if}
