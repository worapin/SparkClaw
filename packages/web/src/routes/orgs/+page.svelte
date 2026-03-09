<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getOrgs, createOrg, getOrgMembers, inviteOrgMember, updateMemberRole, removeOrgMember, deleteOrg } from "$lib/api";
  import type { OrgResponse, OrgMemberResponse } from "@sparkclaw/shared/types";

  let orgs = $state<OrgResponse[]>([]);
  let loading = $state(true);
  let error = $state("");

  // Create org
  let showCreateForm = $state(false);
  let newOrgName = $state("");
  let creating = $state(false);

  // Selected org
  let selectedOrg = $state<OrgResponse | null>(null);
  let members = $state<OrgMemberResponse[]>([]);
  let membersLoading = $state(false);

  // Invite
  let inviteEmail = $state("");
  let inviteRole = $state("member");
  let inviting = $state(false);

  // Confirmations
  let removeMemberId = $state<string | null>(null);
  let deleteOrgConfirm = $state(false);
  let deleting = $state(false);

  onMount(() => {
    loadOrgs();
  });

  async function loadOrgs() {
    loading = true;
    error = "";
    try {
      const result = await getOrgs();
      orgs = result.orgs;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return;
    creating = true;
    error = "";
    try {
      await createOrg(newOrgName.trim());
      newOrgName = "";
      showCreateForm = false;
      await loadOrgs();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      creating = false;
    }
  }

  async function selectOrg(org: OrgResponse) {
    selectedOrg = org;
    membersLoading = true;
    try {
      const result = await getOrgMembers(org.id);
      members = result.members;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      membersLoading = false;
    }
  }

  async function handleInvite() {
    if (!selectedOrg || !inviteEmail.trim()) return;
    inviting = true;
    error = "";
    try {
      await inviteOrgMember(selectedOrg.id, inviteEmail.trim(), inviteRole);
      inviteEmail = "";
      inviteRole = "member";
      const result = await getOrgMembers(selectedOrg.id);
      members = result.members;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      inviting = false;
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    if (!selectedOrg) return;
    error = "";
    try {
      await updateMemberRole(selectedOrg.id, memberId, newRole);
      const result = await getOrgMembers(selectedOrg.id);
      members = result.members;
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedOrg) return;
    error = "";
    try {
      await removeOrgMember(selectedOrg.id, memberId);
      removeMemberId = null;
      const result = await getOrgMembers(selectedOrg.id);
      members = result.members;
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function handleDeleteOrg() {
    if (!selectedOrg) return;
    deleting = true;
    error = "";
    try {
      await deleteOrg(selectedOrg.id);
      selectedOrg = null;
      members = [];
      deleteOrgConfirm = false;
      await loadOrgs();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deleting = false;
    }
  }

  function roleBadgeClass(role: string) {
    switch (role) {
      case "owner": return "bg-terra-100 text-terra-700";
      case "admin": return "bg-blue-50 text-blue-700";
      default: return "bg-warm-100 text-warm-600";
    }
  }
</script>

<svelte:head>
  <title>Organizations - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <h1 class="font-display text-3xl">Organizations</h1>
      <button
        onclick={() => showCreateForm = !showCreateForm}
        class="btn-lift bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
      >
        {showCreateForm ? "Cancel" : "Create Organization"}
      </button>
    </div>

    <!-- Create form -->
    {#if showCreateForm}
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <h2 class="font-display text-lg mb-4">New Organization</h2>
        <form onsubmit={(e) => { e.preventDefault(); handleCreateOrg(); }} class="flex gap-3">
          <input
            type="text"
            bind:value={newOrgName}
            placeholder="Organization name"
            class="flex-1 px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500"
          />
          <button
            type="submit"
            disabled={creating || !newOrgName.trim()}
            class="btn-lift bg-terra-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    {/if}

    {#if loading}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-warm-500">Loading organizations...</p>
      </div>
    {:else if orgs.length === 0 && !showCreateForm}
      <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
        <h2 class="font-display text-xl mb-2">No organizations yet</h2>
        <p class="text-warm-500 text-sm">Create an organization to collaborate with your team.</p>
      </div>
    {:else}
      <div class="grid md:grid-cols-3 gap-4 mb-8">
        {#each orgs as org (org.id)}
          <button
            onclick={() => selectOrg(org)}
            class="bg-white rounded-2xl border border-warm-200 p-6 text-left card-hover transition-all {selectedOrg?.id === org.id ? 'ring-2 ring-terra-500 border-terra-500' : ''}"
          >
            <h3 class="font-display text-lg mb-2 truncate">{org.name}</h3>
            <p class="text-warm-400 text-xs mb-3">/{org.slug}</p>
            <div class="flex items-center justify-between">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium {roleBadgeClass(org.role)}">{org.role}</span>
              <span class="text-warm-400 text-xs">{org.memberCount} member{org.memberCount !== 1 ? 's' : ''}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Selected org detail -->
    {#if selectedOrg}
      <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display text-lg">Members of {selectedOrg.name}</h2>
          {#if selectedOrg.role === "owner"}
            <button
              onclick={() => deleteOrgConfirm = true}
              class="text-sm text-red-600 hover:text-red-700 font-medium hover:underline"
            >
              Delete Organization
            </button>
          {/if}
        </div>

        {#if membersLoading}
          <div class="py-8 text-center">
            <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto"></div>
          </div>
        {:else}
          <table class="w-full text-sm">
            <thead>
              <tr>
                <th class="text-left text-warm-400 font-medium pb-3">Email</th>
                <th class="text-left text-warm-400 font-medium pb-3">Role</th>
                <th class="text-right text-warm-400 font-medium pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each members as member (member.id)}
                <tr class="border-t border-warm-100">
                  <td class="py-3">{member.email}</td>
                  <td class="py-3">
                    {#if selectedOrg.role === "owner" || selectedOrg.role === "admin"}
                      <select
                        value={member.role}
                        onchange={(e) => handleRoleChange(member.id, (e.target as HTMLSelectElement).value)}
                        disabled={member.role === "owner"}
                        class="px-2 py-1 rounded-lg border border-warm-200 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    {:else}
                      <span class="text-xs px-2.5 py-1 rounded-full font-medium {roleBadgeClass(member.role)}">{member.role}</span>
                    {/if}
                  </td>
                  <td class="py-3 text-right">
                    {#if member.role !== "owner" && (selectedOrg.role === "owner" || selectedOrg.role === "admin")}
                      {#if removeMemberId === member.id}
                        <span class="text-xs text-warm-500 mr-2">Sure?</span>
                        <button onclick={() => handleRemoveMember(member.id)} class="text-xs text-red-600 font-medium hover:underline mr-2">Yes</button>
                        <button onclick={() => removeMemberId = null} class="text-xs text-warm-500 hover:underline">No</button>
                      {:else}
                        <button onclick={() => removeMemberId = member.id} class="text-xs text-red-600 hover:underline">Remove</button>
                      {/if}
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>

          <!-- Invite form -->
          {#if selectedOrg.role === "owner" || selectedOrg.role === "admin"}
            <div class="mt-6 pt-6 border-t border-warm-100">
              <h3 class="font-display text-sm mb-3">Invite Member</h3>
              <form onsubmit={(e) => { e.preventDefault(); handleInvite(); }} class="flex gap-3">
                <input
                  type="email"
                  bind:value={inviteEmail}
                  placeholder="Email address"
                  class="flex-1 px-4 py-2.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500"
                />
                <select
                  bind:value={inviteRole}
                  class="px-3 py-2.5 rounded-xl border border-warm-200 text-sm bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  class="btn-lift bg-terra-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors disabled:opacity-50"
                >
                  {inviting ? "Inviting..." : "Invite"}
                </button>
              </form>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Delete Org Confirmation Modal -->
    {#if deleteOrgConfirm && selectedOrg}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 class="font-display text-xl mb-2">Delete Organization?</h3>
          <p class="text-warm-500 text-sm mb-6">This will permanently delete <strong>{selectedOrg.name}</strong> and remove all members. This cannot be undone.</p>
          <div class="flex gap-3">
            <button onclick={() => deleteOrgConfirm = false} class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors">Cancel</button>
            <button
              onclick={handleDeleteOrg}
              disabled={deleting}
              class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error toast -->
    {#if error}
      <div class="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm shadow-lg z-50">
        {error}
      </div>
    {/if}
  </div>
</section>
