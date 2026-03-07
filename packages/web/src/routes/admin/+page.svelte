<script lang="ts">
  import { onMount } from "svelte";
  import { getAdminStats } from "$lib/api";
  import { Card, Badge, Spinner } from "$lib";

  let loading = $state(true);
  let stats = $state<{
    users: number;
    instances: number;
    subscriptions: number;
    instancesByStatus: Record<string, number>;
    subscriptionsByPlan: Record<string, number>;
    recentSignups: number;
  } | null>(null);

  onMount(async () => {
    try {
      stats = await getAdminStats();
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Admin Dashboard - SparkClaw</title>
</svelte:head>

<section class="p-6">
  <div class="max-w-7xl mx-auto">
    <h1 class="font-display text-2xl mb-6">Dashboard</h1>

    {#if loading}
      <div class="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    {:else if stats}
      <div class="grid md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="text-sm text-warm-500 mb-1">Total Users</div>
          <div class="font-display text-3xl text-terra-500">{stats.users}</div>
          <div class="text-xs text-warm-400 mt-2">+{stats.recentSignups} this week</div>
        </Card>
        
        <Card>
          <div class="text-sm text-warm-500 mb-1">Instances</div>
          <div class="font-display text-3xl text-terra-500">{stats.instances}</div>
          <div class="text-xs text-warm-400 mt-2">
            {stats.instancesByStatus.ready ?? 0} ready
          </div>
        </Card>
        
        <Card>
          <div class="text-sm text-warm-500 mb-1">Subscriptions</div>
          <div class="font-display text-3xl text-terra-500">{stats.subscriptions}</div>
          <div class="flex gap-2 mt-2">
            {#each Object.entries(stats.subscriptionsByPlan) as [plan, count]}
              <Badge variant="info" size="sm">{plan}: {count}</Badge>
            {/each}
          </div>
        </Card>
        
        <Card>
          <div class="text-sm text-warm-500 mb-1">Instance Status</div>
          <div class="space-y-2 mt-2">
            {#each Object.entries(stats.instancesByStatus) as [status, count]}
              <div class="flex items-center justify-between">
                <span class="text-sm capitalize">{status}</span>
                <Badge 
                  variant={status === 'ready' ? 'success' : status === 'error' ? 'error' : status === 'pending' ? 'warning' : 'default'}
                  size="sm"
                >
                  {count}
                </Badge>
              </div>
            {/each}
          </div>
        </Card>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <Card title="Quick Links">
          <div class="grid grid-cols-2 gap-4">
            <a href="/admin/users" class="p-4 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors text-center">
              <div class="text-2xl mb-2">👥</div>
              <div class="font-medium text-sm">Manage Users</div>
            </a>
            <a href="/admin/instances" class="p-4 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors text-center">
              <div class="text-2xl mb-2">🖥️</div>
              <div class="font-medium text-sm">View Instances</div>
            </a>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" class="p-4 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors text-center">
              <div class="text-2xl mb-2">💳</div>
              <div class="font-medium text-sm">Stripe Dashboard</div>
            </a>
            <a href="https://railway.app" target="_blank" rel="noopener" class="p-4 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors text-center">
              <div class="text-2xl mb-2">🚂</div>
              <div class="font-medium text-sm">Railway Dashboard</div>
            </a>
          </div>
        </Card>

        <Card title="Recent Activity">
          <p class="text-warm-500 text-sm">
            Activity tracking coming soon. Monitor user signups, instance deployments, and subscription changes.
          </p>
        </Card>
      </div>
    {/if}
  </div>
</section>
