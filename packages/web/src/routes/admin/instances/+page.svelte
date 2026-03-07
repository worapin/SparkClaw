<script lang="ts">
  import { onMount } from "svelte";
  import { getAdminInstances } from "$lib/api";
  import { Card, Badge, Spinner, Table } from "$lib";

  let loading = $state(true);
  let instances = $state<Array<{
    id: string;
    url: string | null;
    customDomain: string | null;
    status: string;
    domainStatus: string;
    setupCompleted: boolean;
    createdAt: string;
    user: { email: string };
    subscription: { plan: string };
  }>>([]);
  let pagination = $state({ page: 1, totalPages: 1, total: 0 });
  let statusFilter = $state("");

  async function loadInstances(page: number = 1) {
    loading = true;
    try {
      const result = await getAdminInstances(page, statusFilter || undefined);
      instances = result.instances;
      pagination = result.pagination;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadInstances();
  });

  $effect(() => {
    if (statusFilter !== undefined) {
      loadInstances(1);
    }
  });

  function getStatusBadgeVariant(status: string): "success" | "warning" | "error" | "default" {
    switch (status) {
      case "ready": return "success";
      case "pending": return "warning";
      case "error": return "error";
      default: return "default";
    }
  }
</script>

<svelte:head>
  <title>Instances - Admin - SparkClaw</title>
</svelte:head>

<section class="p-6">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-display text-2xl">Instances</h1>
      <div class="flex gap-2">
        <select
          bind:value={statusFilter}
          class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg bg-white"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="error">Error</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
    </div>

    <Card>
      {#if loading}
        <div class="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      {:else}
        <Table
          columns={[
            { key: "user", header: "User" },
            { key: "domain", header: "Domain" },
            { key: "status", header: "Status" },
            { key: "plan", header: "Plan" },
            { key: "setup", header: "Setup" },
            { key: "createdAt", header: "Created" },
          ]}
          rows={instances.map(i => ({
            id: i.id,
            user: i.user.email,
            domain: i.customDomain ?? i.url ?? "-",
            status: i.status,
            plan: i.subscription.plan,
            setup: i.setupCompleted ? "✓" : "Pending",
            createdAt: new Date(i.createdAt).toLocaleDateString(),
          }))}
          rowAction={(row) => (
            row.url ? `<a href="${row.url}" target="_blank" class="text-terra-500 hover:underline text-sm">Open</a>` : ""
          )}
        />

        {#if pagination.totalPages > 1}
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-warm-100">
            <p class="text-sm text-warm-500">
              Showing {(pagination.page - 1) * 20 + 1} - {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div class="flex gap-2">
              <button
                onclick={() => loadInstances(pagination.page - 1)}
                disabled={pagination.page === 1}
                class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warm-50 transition-colors"
              >
                Previous
              </button>
              <button
                onclick={() => loadInstances(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warm-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </Card>
  </div>
</section>
