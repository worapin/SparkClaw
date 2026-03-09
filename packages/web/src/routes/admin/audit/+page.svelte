<script lang="ts">
  import { onMount } from "svelte";
  import { getAdminAuditLogs } from "$lib/api";
  import type { AuditLogResponse } from "@sparkclaw/shared/types";

  let logs = $state<AuditLogResponse[]>([]);
  let pagination = $state({ page: 1, totalPages: 1, total: 0 });
  let loading = $state(true);
  let error = $state("");
  let actionFilter = $state("");

  onMount(() => {
    loadLogs();
  });

  async function loadLogs(page: number = 1) {
    loading = true;
    error = "";
    try {
      const result = await getAdminAuditLogs(page, actionFilter || undefined);
      logs = result.logs;
      pagination = result.pagination;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function handleFilterChange(e: Event) {
    actionFilter = (e.target as HTMLSelectElement).value;
    loadLogs(1);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  const actionTypes = [
    "user.login",
    "user.logout",
    "instance.create",
    "instance.delete",
    "setup.save",
    "subscription.create",
    "subscription.cancel",
    "admin.action",
    "org.create",
    "org.delete",
    "org.invite",
    "org.member.remove",
  ];
</script>

<svelte:head>
  <title>Audit Logs - Admin - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-display text-3xl">Audit Logs</h1>
      <select
        value={actionFilter}
        onchange={handleFilterChange}
        class="px-4 py-2.5 rounded-xl border border-warm-200 text-sm bg-white"
      >
        <option value="">All Actions</option>
        {#each actionTypes as action}
          <option value={action}>{action}</option>
        {/each}
      </select>
    </div>

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading audit logs...</p>
      </div>
    {:else if error}
      <div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <p class="text-red-700 text-sm">{error}</p>
      </div>
    {:else}
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        {#if logs.length === 0}
          <p class="text-warm-500 text-sm text-center py-8">No audit logs found.</p>
        {:else}
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="text-left text-warm-400 font-medium pb-3">Action</th>
                <th class="text-left text-warm-400 font-medium pb-3">User</th>
                <th class="text-left text-warm-400 font-medium pb-3">Instance</th>
                <th class="text-left text-warm-400 font-medium pb-3">IP</th>
                <th class="text-left text-warm-400 font-medium pb-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {#each logs as log (log.id)}
                <tr class="border-t border-warm-100">
                  <td class="py-3">
                    <span class="px-2 py-0.5 rounded-md bg-warm-100 text-warm-700 text-xs font-mono">{log.action}</span>
                  </td>
                  <td class="py-3 text-warm-600">{log.user?.email ?? "-"}</td>
                  <td class="py-3 text-warm-600">{log.instanceId ?? "-"}</td>
                  <td class="py-3 text-warm-400 font-mono text-xs">{log.ip ?? "-"}</td>
                  <td class="py-3 text-warm-400">{formatDate(log.createdAt)}</td>
                </tr>
              {/each}
            </tbody>
          </table>

          <!-- Pagination -->
          {#if pagination.totalPages > 1}
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-warm-100">
              <p class="text-sm text-warm-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div class="flex gap-2">
                <button
                  onclick={() => loadLogs(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warm-50 transition-colors"
                >
                  Previous
                </button>
                <button
                  onclick={() => loadLogs(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warm-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</section>
