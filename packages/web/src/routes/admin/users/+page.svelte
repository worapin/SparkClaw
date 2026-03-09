<script lang="ts">
  import { onMount } from "svelte";
  import { getAdminUsers } from "$lib/api";
  import { Card, Badge, Spinner, Input, Table } from "$lib";

  let loading = $state(true);
  let users = $state<Array<{
    id: string;
    email: string;
    role: string;
    createdAt: string;
    subscription: { plan: string; status: string } | null;
    instances: { id: string; status: string; url: string | null }[];
    instanceCount: number;
  }>>([]);
  let pagination = $state({ page: 1, totalPages: 1, total: 0 });
  let search = $state("");
  let searchTimeout: ReturnType<typeof setTimeout>;

  async function loadUsers(page: number = 1) {
    loading = true;
    try {
      const result = await getAdminUsers(page, search);
      users = result.users;
      pagination = result.pagination;
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadUsers();
  });

  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadUsers(1);
    }, 300);
  }

  $effect(() => {
    if (search !== undefined) handleSearch();
  });
</script>

<svelte:head>
  <title>Users - Admin - SparkClaw</title>
</svelte:head>

<section class="p-6">
  <div class="max-w-7xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="font-display text-2xl">Users</h1>
      <div class="w-64">
        <Input 
          placeholder="Search by email..." 
          bind:value={search}
          inputSize="sm"
        />
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
            { key: "email", header: "Email" },
            { key: "role", header: "Role" },
            { key: "plan", header: "Plan" },
            { key: "instanceStatus", header: "Instance" },
            { key: "createdAt", header: "Created" },
          ]}
          rows={users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            plan: u.subscription?.plan ?? "-",
            instanceStatus: u.instances.length > 0 ? `${u.instanceCount} instance${u.instanceCount !== 1 ? 's' : ''}` : "-",
            createdAt: new Date(u.createdAt).toLocaleDateString(),
          }))}
        />

        {#if pagination.totalPages > 1}
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-warm-100">
            <p class="text-sm text-warm-500">
              Showing {(pagination.page - 1) * 20 + 1} - {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div class="flex gap-2">
              <button
                onclick={() => loadUsers(pagination.page - 1)}
                disabled={pagination.page === 1}
                class="px-3 py-1.5 text-sm border border-warm-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warm-50 transition-colors"
              >
                Previous
              </button>
              <button
                onclick={() => loadUsers(pagination.page + 1)}
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
