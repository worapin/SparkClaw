<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getMe, logout } from "$lib/api";
  import type { MeResponse } from "@sparkclaw/shared/types";

  let user = $state<MeResponse | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      user = await getMe();
    } catch {
      goto("/auth");
    } finally {
      loading = false;
    }
  });

  async function handleLogout() {
    await logout();
    goto("/");
  }
</script>

<svelte:head>
  <title>Account - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-2xl mx-auto stagger">
    <h1 class="font-display text-3xl mb-8">Account Settings</h1>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading...</p>
      </div>
    {:else if user}
      <!-- Profile -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-4">Profile</h2>
        <div class="flex items-center gap-4 mb-4">
          <div class="w-14 h-14 bg-terra-100 text-terra-600 rounded-full flex items-center justify-center font-display text-xl">{user.email[0].toUpperCase()}</div>
          <div>
            <div class="font-medium">{user.email}</div>
            <div class="text-warm-500 text-sm">Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      <!-- Subscription -->
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-4">Subscription</h2>
        {#if user.subscription}
          <div class="flex items-center justify-between p-4 bg-warm-50 rounded-xl border border-warm-100 mb-4">
            <div>
              <div class="font-semibold text-lg capitalize">{user.subscription.plan} Plan</div>
              <div class="text-warm-500 text-sm">
                {#if user.subscription.currentPeriodEnd}
                  Next billing {new Date(user.subscription.currentPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

      <!-- Danger zone -->
      <div class="bg-white rounded-2xl border border-red-200 p-6">
        <h2 class="font-display text-lg mb-2 text-red-700">Danger Zone</h2>
        <p class="text-warm-500 text-sm mb-4">Canceling your subscription will suspend your instance. Your data is kept for 30 days.</p>
        <button class="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors">Cancel subscription</button>
      </div>
    {/if}
  </div>
</section>
