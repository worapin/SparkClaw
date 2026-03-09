<script lang="ts">
  import { onMount } from "svelte";
  import { getUsage, getUsageHistory } from "$lib/api";
  import type { UsageSummary } from "@sparkclaw/shared/types";

  let usage = $state<UsageSummary | null>(null);
  let history = $state<UsageSummary[]>([]);
  let loading = $state(true);
  let error = $state("");
  let selectedPeriod = $state("");

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    error = "";
    try {
      const [usageResult, historyResult] = await Promise.all([
        getUsage(selectedPeriod || undefined),
        getUsageHistory(6),
      ]);
      usage = usageResult;
      history = historyResult.history;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function handlePeriodChange(e: Event) {
    selectedPeriod = (e.target as HTMLSelectElement).value;
    loadData();
  }

  let maxTotal = $derived(
    history.length > 0
      ? Math.max(...history.map((h) => (h.items ?? []).reduce((sum, item) => sum + item.quantity, 0)), 1)
      : 1
  );

  function periodTotal(h: UsageSummary): number {
    return (h.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
  }
</script>

<svelte:head>
  <title>Usage - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-display text-3xl">Usage</h1>
      <select
        value={selectedPeriod}
        onchange={handlePeriodChange}
        class="px-4 py-2.5 rounded-xl border border-warm-200 text-sm bg-white"
      >
        <option value="">Current Period</option>
        <option value="last">Last Period</option>
      </select>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading usage data...</p>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p class="text-red-700 text-sm">{error}</p>
      </div>
    {:else}
      <!-- Usage Summary -->
      {#if usage}
        <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
          <h2 class="font-display text-lg mb-4">
            {usage.period ?? "Current Period"} Summary
          </h2>
          {#if usage.items && usage.items.length > 0}
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="text-left text-warm-400 font-medium pb-3">Type</th>
                  <th class="text-right text-warm-400 font-medium pb-3">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {#each usage.items as item}
                  <tr class="border-t border-warm-100">
                    <td class="py-3">{item.type}</td>
                    <td class="py-3 text-right font-medium">{item.quantity.toLocaleString()}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="text-warm-500 text-sm">No usage recorded for this period.</p>
          {/if}
        </div>

        <!-- Usage by Instance -->
        {#if usage.items.some(i => i.instanceId)}
          <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
            <h2 class="font-display text-lg mb-4">Usage by Instance</h2>
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="text-left text-warm-400 font-medium pb-3">Instance</th>
                  <th class="text-left text-warm-400 font-medium pb-3">Type</th>
                  <th class="text-right text-warm-400 font-medium pb-3">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {#each usage.items.filter(i => i.instanceId) as item}
                  <tr class="border-t border-warm-100">
                    <td class="py-3 font-medium">{item.instanceName ?? item.instanceId}</td>
                    <td class="py-3">{item.type}</td>
                    <td class="py-3 text-right">{item.quantity.toLocaleString()}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}

      <!-- History Chart -->
      {#if history.length > 0}
        <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
          <h2 class="font-display text-lg mb-4">6-Month History</h2>
          <div class="flex items-end gap-3 h-48">
            {#each history as h}
              {@const total = periodTotal(h)}
              {@const heightPct = (total / maxTotal) * 100}
              <div class="flex-1 flex flex-col items-center justify-end h-full">
                <span class="text-xs text-warm-500 mb-1 font-medium">{total.toLocaleString()}</span>
                <div
                  class="w-full bg-terra-500 rounded-t-lg transition-all"
                  style="height: {Math.max(heightPct, 2)}%"
                ></div>
                <span class="text-xs text-warm-400 mt-2">{h.period ?? ""}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</section>
