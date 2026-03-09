<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    getInstanceById,
    instanceAction,
    getInstanceHealth,
    getInstanceLogs,
    getEnvVars,
    createEnvVar,
    updateEnvVar,
    deleteEnvVar,
    getScheduledJobs,
    createScheduledJob,
    updateScheduledJob,
    deleteScheduledJob,
    getCustomSkills,
    createCustomSkill,
    updateCustomSkill,
    deleteCustomSkill,
    executeCustomSkill,
  } from "$lib/api";
  import type {
    InstanceResponse,
    InstanceHealthResponse,
    InstanceLogEntry,
    EnvVarResponse,
    ScheduledJobResponse,
    CustomSkillResponse,
    SkillExecutionResult,
  } from "@sparkclaw/shared/types";

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

  // ── Core state ──────────────────────────────────────────────────────────────
  let instanceId = $derived(page.params.id);
  let instance = $state<InstanceResponse | null>(null);
  let loading = $state(true);
  let error = $state("");
  let activeTab = $state<"controls" | "logs" | "envvars" | "jobs" | "skills">("controls");

  // ── Instance Controls ───────────────────────────────────────────────────────
  let actionInProgress = $state("");
  let health = $state<InstanceHealthResponse | null>(null);
  let healthLoading = $state(false);
  let healthTimer: ReturnType<typeof setInterval> | undefined;

  // ── Logs ────────────────────────────────────────────────────────────────────
  let logs = $state<InstanceLogEntry[]>([]);
  let logFilter = $state<"all" | "info" | "warn" | "error" | "debug">("all");
  let autoScroll = $state(true);
  let logStreamAbort: AbortController | null = null;
  let logContainerEl: HTMLDivElement | undefined;
  let logsConnected = $state(false);

  let filteredLogs = $derived(
    logFilter === "all" ? logs : logs.filter((l) => l.level === logFilter)
  );

  // ── Env Vars ────────────────────────────────────────────────────────────────
  let envVars = $state<EnvVarResponse[]>([]);
  let envVarsLoading = $state(false);
  let envForm = $state({ key: "", value: "", isSecret: false });
  let envFormError = $state("");
  let envFormSaving = $state(false);
  let editingEnvId = $state<string | null>(null);
  let editingEnvValue = $state("");
  let envEditSaving = $state(false);
  let deletingEnvId = $state<string | null>(null);

  // ── Scheduled Jobs ──────────────────────────────────────────────────────────
  let jobs = $state<ScheduledJobResponse[]>([]);
  let jobsLoading = $state(false);
  let showJobForm = $state(false);
  let jobForm = $state({
    name: "",
    cronExpression: "",
    taskType: "backup" as "backup" | "report" | "data_sync" | "webhook",
    config: "{}",
    enabled: true,
  });
  let jobFormError = $state("");
  let jobFormSaving = $state(false);
  let editingJobId = $state<string | null>(null);
  let deletingJobId = $state<string | null>(null);

  // ── Custom Skills ───────────────────────────────────────────────────────────
  let skills = $state<CustomSkillResponse[]>([]);
  let skillsLoading = $state(false);
  let showSkillForm = $state(false);
  let skillForm = $state({
    name: "",
    language: "typescript" as "python" | "typescript",
    description: "",
    code: "",
    triggerType: "manual" as "manual" | "cron" | "event" | "webhook",
    triggerValue: "",
    timeout: 30,
  });
  let skillFormError = $state("");
  let skillFormSaving = $state(false);
  let editingSkillId = $state<string | null>(null);
  let deletingSkillId = $state<string | null>(null);
  let executingSkillId = $state<string | null>(null);
  let skillExecutionResult = $state<SkillExecutionResult | null>(null);
  let showExecutionResult = $state(false);

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  onMount(() => {
    loadInstance();
    return () => {
      if (healthTimer) clearInterval(healthTimer);
      stopLogStream();
    };
  });

  // ── Data Loading ────────────────────────────────────────────────────────────
  async function loadInstance() {
    loading = true;
    error = "";
    try {
      instance = await getInstanceById(instanceId);
      await loadHealth();
      startHealthPolling();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function loadHealth() {
    healthLoading = true;
    try {
      health = await getInstanceHealth(instanceId);
    } catch {
      // Health endpoint may not be available
    } finally {
      healthLoading = false;
    }
  }

  function startHealthPolling() {
    if (healthTimer) clearInterval(healthTimer);
    healthTimer = setInterval(loadHealth, 30_000);
  }

  // ── Instance Actions ────────────────────────────────────────────────────────
  async function handleAction(action: "start" | "stop" | "restart") {
    actionInProgress = action;
    error = "";
    try {
      const result = await instanceAction(instanceId, action);
      if (result.success) {
        instance = await getInstanceById(instanceId);
        await loadHealth();
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      actionInProgress = "";
    }
  }

  // ── Uptime Formatter ────────────────────────────────────────────────────────
  function formatUptime(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return "N/A";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(" ");
  }

  // ── Status helpers ──────────────────────────────────────────────────────────
  function statusColor(status: string): string {
    switch (status) {
      case "ready": return "bg-green-500";
      case "pending": return "bg-amber-500";
      case "error": return "bg-red-500";
      default: return "bg-warm-400";
    }
  }

  function statusTextColor(status: string): string {
    switch (status) {
      case "ready": return "text-green-700";
      case "pending": return "text-amber-700";
      case "error": return "text-red-700";
      default: return "text-warm-600";
    }
  }

  function statusLabel(status: string): string {
    switch (status) {
      case "ready": return "Ready";
      case "pending": return "Provisioning";
      case "error": return "Error";
      case "suspended": return "Suspended";
      default: return status;
    }
  }

  // ── Log Streaming ───────────────────────────────────────────────────────────
  async function startLogStream() {
    stopLogStream();
    logsConnected = false;
    const abort = new AbortController();
    logStreamAbort = abort;
    try {
      const res = await fetch(`${API_BASE}/api/instances/${instanceId}/logs`, {
        headers: { Accept: "text/event-stream" },
        credentials: "include",
        signal: abort.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Log stream failed: HTTP ${res.status}`);
      }
      logsConnected = true;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const entry: InstanceLogEntry = JSON.parse(line.slice(6));
              logs = [...logs.slice(-499), entry];
              if (autoScroll && logContainerEl) {
                requestAnimationFrame(() => {
                  logContainerEl?.scrollTo({ top: logContainerEl.scrollHeight });
                });
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && (e as DOMException).name === "AbortError")) {
        console.error("Log stream error:", e);
      }
    } finally {
      logsConnected = false;
    }
  }

  function stopLogStream() {
    if (logStreamAbort) {
      logStreamAbort.abort();
      logStreamAbort = null;
    }
    logsConnected = false;
  }

  function clearLogs() {
    logs = [];
  }

  // ── Env Vars ────────────────────────────────────────────────────────────────
  async function loadEnvVars() {
    envVarsLoading = true;
    try {
      const result = await getEnvVars(instanceId);
      envVars = result.vars;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      envVarsLoading = false;
    }
  }

  async function handleCreateEnvVar() {
    envFormError = "";
    if (!envForm.key.trim() || !envForm.value.trim()) {
      envFormError = "Key and value are required.";
      return;
    }
    envFormSaving = true;
    try {
      await createEnvVar({
        instanceId,
        key: envForm.key.toUpperCase().trim(),
        value: envForm.value.trim(),
        isSecret: envForm.isSecret,
      });
      envForm = { key: "", value: "", isSecret: false };
      await loadEnvVars();
    } catch (e) {
      envFormError = (e as Error).message;
    } finally {
      envFormSaving = false;
    }
  }

  function startEditEnv(env: EnvVarResponse) {
    editingEnvId = env.id;
    editingEnvValue = env.isSecret ? "" : env.value;
  }

  async function saveEnvEdit() {
    if (!editingEnvId) return;
    envEditSaving = true;
    try {
      await updateEnvVar(editingEnvId, editingEnvValue);
      editingEnvId = null;
      editingEnvValue = "";
      await loadEnvVars();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      envEditSaving = false;
    }
  }

  function cancelEnvEdit() {
    editingEnvId = null;
    editingEnvValue = "";
  }

  async function handleDeleteEnvVar(id: string) {
    deletingEnvId = id;
    try {
      await deleteEnvVar(id);
      await loadEnvVars();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deletingEnvId = null;
    }
  }

  // ── Scheduled Jobs ──────────────────────────────────────────────────────────
  async function loadJobs() {
    jobsLoading = true;
    try {
      const result = await getScheduledJobs(instanceId);
      jobs = result.jobs;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      jobsLoading = false;
    }
  }

  function openJobForm(job?: ScheduledJobResponse) {
    if (job) {
      editingJobId = job.id;
      jobForm = {
        name: job.name,
        cronExpression: job.cronExpression,
        taskType: job.taskType as typeof jobForm.taskType,
        config: job.config ? JSON.stringify(job.config, null, 2) : "{}",
        enabled: job.enabled,
      };
    } else {
      editingJobId = null;
      jobForm = { name: "", cronExpression: "", taskType: "backup", config: "{}", enabled: true };
    }
    jobFormError = "";
    showJobForm = true;
  }

  async function handleSaveJob() {
    jobFormError = "";
    if (!jobForm.name.trim() || !jobForm.cronExpression.trim()) {
      jobFormError = "Name and cron expression are required.";
      return;
    }
    let config: Record<string, unknown> | undefined = undefined;
    try {
      config = JSON.parse(jobForm.config) ?? undefined;
    } catch {
      jobFormError = "Config must be valid JSON.";
      return;
    }
    jobFormSaving = true;
    try {
      if (editingJobId) {
        await updateScheduledJob(editingJobId, {
          name: jobForm.name.trim(),
          cronExpression: jobForm.cronExpression.trim(),
          config,
          enabled: jobForm.enabled,
        });
      } else {
        await createScheduledJob({
          instanceId,
          name: jobForm.name.trim(),
          cronExpression: jobForm.cronExpression.trim(),
          taskType: jobForm.taskType,
          config,
        });
      }
      showJobForm = false;
      await loadJobs();
    } catch (e) {
      jobFormError = (e as Error).message;
    } finally {
      jobFormSaving = false;
    }
  }

  async function toggleJobEnabled(job: ScheduledJobResponse) {
    try {
      await updateScheduledJob(job.id, { enabled: !job.enabled });
      await loadJobs();
    } catch (e) {
      error = (e as Error).message;
    }
  }

  async function handleDeleteJob(id: string) {
    deletingJobId = id;
    try {
      await deleteScheduledJob(id);
      await loadJobs();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deletingJobId = null;
    }
  }

  // ── Custom Skills ───────────────────────────────────────────────────────────
  async function loadSkills() {
    skillsLoading = true;
    try {
      const result = await getCustomSkills(instanceId);
      skills = result.skills;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      skillsLoading = false;
    }
  }

  function openSkillForm(skill?: CustomSkillResponse) {
    if (skill) {
      editingSkillId = skill.id;
      skillForm = {
        name: skill.name,
        language: skill.language as typeof skillForm.language,
        description: skill.description || "",
        code: skill.code,
        triggerType: skill.triggerType as typeof skillForm.triggerType,
        triggerValue: skill.triggerValue || "",
        timeout: skill.timeout,
      };
    } else {
      editingSkillId = null;
      skillForm = {
        name: "",
        language: "typescript",
        description: "",
        code: "",
        triggerType: "manual",
        triggerValue: "",
        timeout: 30,
      };
    }
    skillFormError = "";
    showSkillForm = true;
  }

  async function handleSaveSkill() {
    skillFormError = "";
    if (!skillForm.name.trim() || !skillForm.code.trim()) {
      skillFormError = "Name and code are required.";
      return;
    }
    skillFormSaving = true;
    try {
      if (editingSkillId) {
        await updateCustomSkill(editingSkillId, {
          description: skillForm.description.trim() || undefined,
          code: skillForm.code,
          triggerType: skillForm.triggerType,
          triggerValue: skillForm.triggerValue.trim() || undefined,
          timeout: skillForm.timeout,
        });
      } else {
        await createCustomSkill({
          instanceId,
          name: skillForm.name.trim(),
          language: skillForm.language,
          description: skillForm.description.trim() || undefined,
          code: skillForm.code,
          triggerType: skillForm.triggerType,
          triggerValue: skillForm.triggerValue.trim() || undefined,
          timeout: skillForm.timeout,
        });
      }
      showSkillForm = false;
      await loadSkills();
    } catch (e) {
      skillFormError = (e as Error).message;
    } finally {
      skillFormSaving = false;
    }
  }

  async function handleDeleteSkill(id: string) {
    deletingSkillId = id;
    try {
      await deleteCustomSkill(id);
      await loadSkills();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      deletingSkillId = null;
    }
  }

  async function handleExecuteSkill(id: string) {
    executingSkillId = id;
    skillExecutionResult = null;
    try {
      skillExecutionResult = await executeCustomSkill(id);
      showExecutionResult = true;
      await loadSkills();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      executingSkillId = null;
    }
  }

  // ── Tab switching with lazy data loading ────────────────────────────────────
  function switchTab(tab: typeof activeTab) {
    activeTab = tab;
    if (tab === "logs" && !logsConnected && logs.length === 0) {
      startLogStream();
    } else if (tab !== "logs") {
      stopLogStream();
    }
    if (tab === "envvars" && envVars.length === 0) loadEnvVars();
    if (tab === "jobs" && jobs.length === 0) loadJobs();
    if (tab === "skills" && skills.length === 0) loadSkills();
  }

  // ── Log level colors ────────────────────────────────────────────────────────
  function logLevelColor(level: string): string {
    switch (level) {
      case "info": return "text-warm-500";
      case "warn": return "text-amber-600";
      case "error": return "text-red-600";
      case "debug": return "text-blue-500";
      default: return "text-warm-400";
    }
  }

  function logLevelBg(level: string): string {
    switch (level) {
      case "info": return "bg-warm-100 text-warm-600";
      case "warn": return "bg-amber-100 text-amber-700";
      case "error": return "bg-red-100 text-red-700";
      case "debug": return "bg-blue-100 text-blue-700";
      default: return "bg-warm-100 text-warm-500";
    }
  }

  function formatTimestamp(ts: string): string {
    try {
      return new Date(ts).toLocaleTimeString();
    } catch {
      return ts;
    }
  }

  function formatDateTime(ts: string | null): string {
    if (!ts) return "Never";
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }
</script>

<svelte:head>
  <title>{instance?.instanceName || "Instance"} - SparkClaw</title>
</svelte:head>

<section class="pt-24 pb-20 px-6">
  <div class="max-w-6xl mx-auto">
    <!-- Back + Header -->
    <div class="mb-6">
      <button
        onclick={() => goto("/dashboard")}
        class="text-sm text-warm-500 hover:text-warm-700 transition-colors flex items-center gap-1 mb-4"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {#if loading}
        <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
          <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-warm-500">Loading instance...</p>
        </div>
      {:else if error && !instance}
        <div class="bg-white rounded-2xl border border-warm-200 p-12 text-center">
          <p class="text-red-600 mb-4">{error}</p>
          <button onclick={loadInstance} class="bg-terra-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors">
            Retry
          </button>
        </div>
      {:else if instance}
        <!-- Instance Header Card -->
        <div class="bg-white rounded-2xl border border-warm-200 p-6 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div>
                <h1 class="font-display text-2xl">{instance.instanceName || `Instance ${instance.id.slice(0, 8)}`}</h1>
                <p class="text-warm-400 text-sm mt-0.5">{instance.id}</p>
              </div>
              <div class="flex items-center gap-2 ml-2">
                <span class="w-2.5 h-2.5 rounded-full {statusColor(instance.status)} {instance.status === 'pending' ? 'animate-pulse' : ''}"></span>
                <span class="text-sm font-semibold {statusTextColor(instance.status)}">{statusLabel(instance.status)}</span>
              </div>
            </div>
            {#if instance.url}
              <a href={instance.url} target="_blank" rel="noopener" class="text-terra-500 text-sm font-medium hover:underline">
                {instance.customDomain || instance.url}
              </a>
            {/if}
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="flex gap-1 bg-warm-100 rounded-xl p-1 mb-6">
          {#each [
            { id: "controls", label: "Controls" },
            { id: "logs", label: "Logs" },
            { id: "envvars", label: "Env Vars" },
            { id: "jobs", label: "Jobs" },
            { id: "skills", label: "Skills" },
          ] as tab (tab.id)}
            <button
              onclick={() => switchTab(tab.id as typeof activeTab)}
              class="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors {activeTab === tab.id ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'}"
            >
              {tab.label}
            </button>
          {/each}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- Tab: Controls & Health                                            -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        {#if activeTab === "controls"}
          <div class="grid lg:grid-cols-2 gap-6">
            <!-- Instance Controls -->
            <div class="bg-white rounded-2xl border border-warm-200 p-6">
              <h2 class="font-display text-lg mb-5">Instance Controls</h2>
              <div class="flex flex-wrap gap-3">
                <button
                  onclick={() => handleAction("start")}
                  disabled={!!actionInProgress}
                  class="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress === "start"}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {:else}
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  {/if}
                  Start
                </button>
                <button
                  onclick={() => handleAction("stop")}
                  disabled={!!actionInProgress}
                  class="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress === "stop"}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {:else}
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                  {/if}
                  Stop
                </button>
                <button
                  onclick={() => handleAction("restart")}
                  disabled={!!actionInProgress}
                  class="flex items-center gap-2 bg-amber-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress === "restart"}
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {:else}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 005.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 013.51 15"/></svg>
                  {/if}
                  Restart
                </button>
              </div>
            </div>

            <!-- Health Monitor -->
            <div class="bg-white rounded-2xl border border-warm-200 p-6">
              <div class="flex items-center justify-between mb-5">
                <h2 class="font-display text-lg">Health Monitor</h2>
                <div class="flex items-center gap-2">
                  {#if healthLoading}
                    <div class="w-4 h-4 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin"></div>
                  {/if}
                  <span class="text-xs text-warm-400">Auto-refresh 30s</span>
                </div>
              </div>

              {#if health}
                <div class="space-y-4">
                  <!-- API Health -->
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-warm-600">API Health</span>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full {health.checks.api ? 'bg-green-500' : 'bg-red-500'}"></span>
                      <span class="text-sm font-medium {health.checks.api ? 'text-green-700' : 'text-red-700'}">
                        {health.checks.api ? "Healthy" : "Unhealthy"}
                      </span>
                    </div>
                  </div>

                  <!-- Uptime -->
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-warm-600">Uptime</span>
                    <span class="text-sm font-medium text-warm-900">{formatUptime(health.uptime)}</span>
                  </div>

                  <!-- Channel Statuses -->
                  {#if Object.keys(health.checks.channels).length > 0}
                    <div class="border-t border-warm-100 pt-3">
                      <span class="text-xs text-warm-400 uppercase tracking-wide font-semibold">Channels</span>
                      <div class="mt-2 space-y-2">
                        {#each Object.entries(health.checks.channels) as [channel, ok]}
                          <div class="flex items-center justify-between">
                            <span class="text-sm text-warm-600 capitalize">{channel}</span>
                            <div class="flex items-center gap-2">
                              <span class="w-2 h-2 rounded-full {ok ? 'bg-green-500' : 'bg-red-500'}"></span>
                              <span class="text-xs font-medium {ok ? 'text-green-700' : 'text-red-700'}">
                                {ok ? "Connected" : "Disconnected"}
                              </span>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {:else}
                    <p class="text-warm-400 text-sm">No channels configured.</p>
                  {/if}

                  <!-- Last checked -->
                  <div class="text-xs text-warm-400 pt-2 border-t border-warm-100">
                    Last checked: {formatDateTime(health.lastChecked)}
                  </div>
                </div>
              {:else}
                <p class="text-warm-400 text-sm">Health data unavailable.</p>
              {/if}
            </div>
          </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- Tab: Logs                                                         -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        {:else if activeTab === "logs"}
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <h2 class="font-display text-lg">Logs</h2>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full {logsConnected ? 'bg-green-500 animate-pulse' : 'bg-warm-300'}"></span>
                  <span class="text-xs text-warm-400">{logsConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <!-- Level filter -->
                <select
                  bind:value={logFilter}
                  class="text-xs border border-warm-200 rounded-lg px-2 py-1.5 text-warm-600 bg-white"
                >
                  <option value="all">All levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="debug">Debug</option>
                </select>

                <!-- Auto-scroll toggle -->
                <button
                  onclick={() => autoScroll = !autoScroll}
                  class="text-xs px-3 py-1.5 rounded-lg border transition-colors {autoScroll ? 'bg-terra-500 text-white border-terra-500' : 'border-warm-200 text-warm-500 hover:bg-warm-50'}"
                >
                  Auto-scroll
                </button>

                <!-- Connect/Disconnect -->
                {#if logsConnected}
                  <button onclick={stopLogStream} class="text-xs px-3 py-1.5 rounded-lg border border-warm-200 text-warm-500 hover:bg-warm-50 transition-colors">
                    Disconnect
                  </button>
                {:else}
                  <button onclick={startLogStream} class="text-xs px-3 py-1.5 rounded-lg bg-terra-500 text-white hover:bg-terra-600 transition-colors">
                    Connect
                  </button>
                {/if}

                <button onclick={clearLogs} class="text-xs px-3 py-1.5 rounded-lg border border-warm-200 text-warm-500 hover:bg-warm-50 transition-colors">
                  Clear
                </button>
              </div>
            </div>

            <!-- Log container -->
            <div
              bind:this={logContainerEl}
              class="bg-warm-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs leading-relaxed"
            >
              {#if filteredLogs.length === 0}
                <p class="text-warm-500">{logsConnected ? "Waiting for logs..." : "Connect to start streaming logs."}</p>
              {:else}
                {#each filteredLogs as log}
                  <div class="flex gap-3 py-0.5 hover:bg-white/5 rounded px-1">
                    <span class="text-warm-500 shrink-0">{formatTimestamp(log.timestamp)}</span>
                    <span class="shrink-0 uppercase font-bold w-12 text-right {logLevelColor(log.level)}">{log.level}</span>
                    <span class="text-warm-200 break-all">{log.message}</span>
                  </div>
                {/each}
              {/if}
            </div>

            <div class="flex items-center justify-between mt-3">
              <span class="text-xs text-warm-400">{filteredLogs.length} log entries</span>
              <span class="text-xs text-warm-400">Max 500 entries retained</span>
            </div>
          </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- Tab: Env Vars                                                     -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        {:else if activeTab === "envvars"}
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-display text-lg">Environment Variables</h2>
              <button onclick={loadEnvVars} class="text-xs text-warm-400 hover:text-warm-600 transition-colors">
                Refresh
              </button>
            </div>

            <!-- Add form -->
            <div class="bg-warm-50 rounded-xl border border-warm-100 p-4 mb-5">
              <h3 class="text-sm font-semibold text-warm-700 mb-3">Add Variable</h3>
              <div class="flex flex-wrap gap-3 items-end">
                <div class="flex-1 min-w-[160px]">
                  <label class="text-xs text-warm-500 mb-1 block">Key</label>
                  <input
                    type="text"
                    bind:value={envForm.key}
                    oninput={() => envForm.key = envForm.key.toUpperCase()}
                    placeholder="MY_VARIABLE"
                    class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                  />
                </div>
                <div class="flex-1 min-w-[200px]">
                  <label class="text-xs text-warm-500 mb-1 block">Value</label>
                  <input
                    type="text"
                    bind:value={envForm.value}
                    placeholder="value"
                    class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                  />
                </div>
                <label class="flex items-center gap-2 cursor-pointer pb-0.5">
                  <input type="checkbox" bind:checked={envForm.isSecret} class="rounded border-warm-300 text-terra-500 focus:ring-terra-500" />
                  <span class="text-xs text-warm-600">Secret</span>
                </label>
                <button
                  onclick={handleCreateEnvVar}
                  disabled={envFormSaving}
                  class="bg-terra-500 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors disabled:opacity-50"
                >
                  {envFormSaving ? "Adding..." : "Add"}
                </button>
              </div>
              {#if envFormError}
                <p class="text-red-600 text-xs mt-2">{envFormError}</p>
              {/if}
            </div>

            <!-- Table -->
            {#if envVarsLoading}
              <div class="text-center py-8">
                <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto"></div>
              </div>
            {:else if envVars.length === 0}
              <p class="text-warm-400 text-sm text-center py-8">No environment variables configured.</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-warm-100">
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Key</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Value</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Type</th>
                      <th class="text-right py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each envVars as env (env.id)}
                      <tr class="border-b border-warm-50 hover:bg-warm-50/50">
                        <td class="py-2.5 px-3 font-mono text-warm-800">{env.key}</td>
                        <td class="py-2.5 px-3">
                          {#if editingEnvId === env.id}
                            <div class="flex items-center gap-2">
                              <input
                                type="text"
                                bind:value={editingEnvValue}
                                class="flex-1 px-2 py-1 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                              />
                              <button
                                onclick={saveEnvEdit}
                                disabled={envEditSaving}
                                class="text-xs text-terra-500 font-semibold hover:text-terra-600"
                              >
                                {envEditSaving ? "..." : "Save"}
                              </button>
                              <button onclick={cancelEnvEdit} class="text-xs text-warm-400 hover:text-warm-600">
                                Cancel
                              </button>
                            </div>
                          {:else}
                            <span class="font-mono text-warm-600">
                              {env.isSecret ? "********" : env.value}
                            </span>
                          {/if}
                        </td>
                        <td class="py-2.5 px-3">
                          {#if env.isSecret}
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Secret</span>
                          {:else}
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warm-100 text-warm-600">Plain</span>
                          {/if}
                        </td>
                        <td class="py-2.5 px-3 text-right">
                          <div class="flex items-center justify-end gap-2">
                            <button
                              onclick={() => startEditEnv(env)}
                              class="text-xs text-warm-400 hover:text-terra-500 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onclick={() => handleDeleteEnvVar(env.id)}
                              disabled={deletingEnvId === env.id}
                              class="text-xs text-warm-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {deletingEnvId === env.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- Tab: Scheduled Jobs                                               -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        {:else if activeTab === "jobs"}
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-display text-lg">Scheduled Jobs</h2>
              <div class="flex items-center gap-2">
                <button onclick={loadJobs} class="text-xs text-warm-400 hover:text-warm-600 transition-colors">
                  Refresh
                </button>
                <button
                  onclick={() => openJobForm()}
                  class="bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
                >
                  Add Job
                </button>
              </div>
            </div>

            {#if jobsLoading}
              <div class="text-center py-8">
                <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto"></div>
              </div>
            {:else if jobs.length === 0}
              <p class="text-warm-400 text-sm text-center py-8">No scheduled jobs configured.</p>
            {:else}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-warm-100">
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Name</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Cron</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Type</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Status</th>
                      <th class="text-left py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Last Run</th>
                      <th class="text-right py-2.5 px-3 text-xs font-semibold text-warm-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each jobs as job (job.id)}
                      <tr class="border-b border-warm-50 hover:bg-warm-50/50">
                        <td class="py-2.5 px-3 font-medium text-warm-800">{job.name}</td>
                        <td class="py-2.5 px-3 font-mono text-warm-600 text-xs">{job.cronExpression}</td>
                        <td class="py-2.5 px-3">
                          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warm-100 text-warm-600 capitalize">
                            {job.taskType.replace("_", " ")}
                          </span>
                        </td>
                        <td class="py-2.5 px-3">
                          <button
                            onclick={() => toggleJobEnabled(job)}
                            class="inline-flex items-center gap-1.5 text-xs font-medium transition-colors {job.enabled ? 'text-green-700' : 'text-warm-400'}"
                          >
                            <span class="w-2 h-2 rounded-full {job.enabled ? 'bg-green-500' : 'bg-warm-300'}"></span>
                            {job.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td class="py-2.5 px-3 text-xs text-warm-500">{formatDateTime(job.lastRunAt)}</td>
                        <td class="py-2.5 px-3 text-right">
                          <div class="flex items-center justify-end gap-2">
                            <button onclick={() => openJobForm(job)} class="text-xs text-warm-400 hover:text-terra-500 transition-colors">
                              Edit
                            </button>
                            <button
                              onclick={() => handleDeleteJob(job.id)}
                              disabled={deletingJobId === job.id}
                              class="text-xs text-warm-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              {deletingJobId === job.id ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>

          <!-- Job Form Modal -->
          {#if showJobForm}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
                <h3 class="font-display text-xl mb-4">{editingJobId ? "Edit Job" : "New Job"}</h3>
                <div class="space-y-4">
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Name</label>
                    <input
                      type="text"
                      bind:value={jobForm.name}
                      placeholder="Daily backup"
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Cron Expression</label>
                    <input
                      type="text"
                      bind:value={jobForm.cronExpression}
                      placeholder="0 2 * * *"
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Task Type</label>
                    <select
                      bind:value={jobForm.taskType}
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                    >
                      <option value="backup">Backup</option>
                      <option value="report">Report</option>
                      <option value="data_sync">Data Sync</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Config (JSON)</label>
                    <textarea
                      bind:value={jobForm.config}
                      rows="4"
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 resize-y"
                    ></textarea>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" bind:checked={jobForm.enabled} class="rounded border-warm-300 text-terra-500 focus:ring-terra-500" />
                    <span class="text-sm text-warm-600">Enabled</span>
                  </label>
                  {#if jobFormError}
                    <p class="text-red-600 text-xs">{jobFormError}</p>
                  {/if}
                </div>
                <div class="flex gap-3 mt-6">
                  <button
                    onclick={() => showJobForm = false}
                    class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onclick={handleSaveJob}
                    disabled={jobFormSaving}
                    class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-terra-500 text-white hover:bg-terra-600 transition-colors disabled:opacity-50"
                  >
                    {jobFormSaving ? "Saving..." : editingJobId ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          {/if}

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- Tab: Custom Skills                                                -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        {:else if activeTab === "skills"}
          <div class="bg-white rounded-2xl border border-warm-200 p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="font-display text-lg">Custom Skills</h2>
              <div class="flex items-center gap-2">
                <button onclick={loadSkills} class="text-xs text-warm-400 hover:text-warm-600 transition-colors">
                  Refresh
                </button>
                <button
                  onclick={() => openSkillForm()}
                  class="bg-terra-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
                >
                  Add Skill
                </button>
              </div>
            </div>

            {#if skillsLoading}
              <div class="text-center py-8">
                <div class="w-6 h-6 border-2 border-warm-200 border-t-terra-500 rounded-full animate-spin mx-auto"></div>
              </div>
            {:else if skills.length === 0}
              <p class="text-warm-400 text-sm text-center py-8">No custom skills created.</p>
            {:else}
              <div class="grid md:grid-cols-2 gap-4">
                {#each skills as skill (skill.id)}
                  <div class="border border-warm-200 rounded-xl p-5 hover:border-warm-300 transition-colors">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="font-semibold text-warm-900">{skill.name}</h3>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold {skill.language === 'typescript' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">
                        {skill.language === "typescript" ? "TS" : "PY"}
                      </span>
                    </div>

                    {#if skill.description}
                      <p class="text-warm-500 text-sm mb-3 line-clamp-2">{skill.description}</p>
                    {/if}

                    <div class="flex flex-wrap gap-2 mb-3 text-xs">
                      <span class="px-2 py-0.5 rounded-full bg-warm-100 text-warm-600 capitalize">
                        {skill.triggerType}
                        {#if skill.triggerValue}
                          : {skill.triggerValue}
                        {/if}
                      </span>
                      <span class="px-2 py-0.5 rounded-full {skill.enabled ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-400'}">
                        {skill.enabled ? "Active" : "Inactive"}
                      </span>
                      {#if skill.lastRunStatus}
                        <span class="px-2 py-0.5 rounded-full {skill.lastRunStatus === 'success' ? 'bg-green-100 text-green-700' : skill.lastRunStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-warm-100 text-warm-500'}">
                          Last: {skill.lastRunStatus}
                        </span>
                      {/if}
                    </div>

                    {#if skill.lastRunAt}
                      <p class="text-xs text-warm-400 mb-3">Last run: {formatDateTime(skill.lastRunAt)}</p>
                    {/if}

                    <div class="flex items-center gap-2 pt-3 border-t border-warm-100">
                      <button
                        onclick={() => handleExecuteSkill(skill.id)}
                        disabled={executingSkillId === skill.id}
                        class="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors disabled:opacity-50"
                      >
                        {#if executingSkillId === skill.id}
                          <div class="w-3 h-3 border-2 border-green-300 border-t-green-600 rounded-full animate-spin"></div>
                          Running...
                        {:else}
                          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          Run
                        {/if}
                      </button>
                      <span class="text-warm-200">|</span>
                      <button onclick={() => openSkillForm(skill)} class="text-xs text-warm-400 hover:text-terra-500 transition-colors">
                        Edit
                      </button>
                      <span class="text-warm-200">|</span>
                      <button
                        onclick={() => handleDeleteSkill(skill.id)}
                        disabled={deletingSkillId === skill.id}
                        class="text-xs text-warm-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        {deletingSkillId === skill.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Skill Form Modal -->
          {#if showSkillForm}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div class="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                <h3 class="font-display text-xl mb-4">{editingSkillId ? "Edit Skill" : "New Skill"}</h3>
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="text-xs text-warm-500 mb-1 block">Name</label>
                      <input
                        type="text"
                        bind:value={skillForm.name}
                        placeholder="My Skill"
                        class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                      />
                    </div>
                    <div>
                      <label class="text-xs text-warm-500 mb-1 block">Language</label>
                      <select
                        bind:value={skillForm.language}
                        class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                      >
                        <option value="typescript">TypeScript</option>
                        <option value="python">Python</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Description</label>
                    <input
                      type="text"
                      bind:value={skillForm.description}
                      placeholder="What does this skill do?"
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-warm-500 mb-1 block">Code</label>
                    <textarea
                      bind:value={skillForm.code}
                      rows="12"
                      placeholder={skillForm.language === "typescript" ? "export default async function() {\n  // Your code here\n  return { result: 'ok' };\n}" : "def run():\n    # Your code here\n    return {'result': 'ok'}"}
                      class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500 resize-y leading-relaxed"
                    ></textarea>
                  </div>
                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label class="text-xs text-warm-500 mb-1 block">Trigger Type</label>
                      <select
                        bind:value={skillForm.triggerType}
                        class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                      >
                        <option value="manual">Manual</option>
                        <option value="cron">Cron</option>
                        <option value="event">Event</option>
                        <option value="webhook">Webhook</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-xs text-warm-500 mb-1 block">Trigger Value</label>
                      <input
                        type="text"
                        bind:value={skillForm.triggerValue}
                        placeholder={skillForm.triggerType === "cron" ? "0 * * * *" : skillForm.triggerType === "event" ? "message.received" : ""}
                        class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                      />
                    </div>
                    <div>
                      <label class="text-xs text-warm-500 mb-1 block">Timeout (s)</label>
                      <input
                        type="number"
                        bind:value={skillForm.timeout}
                        min="1"
                        max="300"
                        class="w-full px-3 py-2 border border-warm-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/30 focus:border-terra-500"
                      />
                    </div>
                  </div>
                  {#if skillFormError}
                    <p class="text-red-600 text-xs">{skillFormError}</p>
                  {/if}
                </div>
                <div class="flex gap-3 mt-6">
                  <button
                    onclick={() => showSkillForm = false}
                    class="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onclick={handleSaveSkill}
                    disabled={skillFormSaving}
                    class="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-terra-500 text-white hover:bg-terra-600 transition-colors disabled:opacity-50"
                  >
                    {skillFormSaving ? "Saving..." : editingSkillId ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Execution Result Modal -->
          {#if showExecutionResult && skillExecutionResult}
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="font-display text-xl">Execution Result</h3>
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold {skillExecutionResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    {skillExecutionResult.success ? "Success" : "Failed"}
                  </span>
                </div>
                <div class="bg-warm-900 rounded-xl p-4 mb-4 max-h-60 overflow-y-auto">
                  <pre class="text-warm-200 text-xs font-mono whitespace-pre-wrap">{skillExecutionResult.output || "(no output)"}</pre>
                  {#if skillExecutionResult.error}
                    <pre class="text-red-400 text-xs font-mono whitespace-pre-wrap mt-2">{skillExecutionResult.error}</pre>
                  {/if}
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-warm-400">Duration: {skillExecutionResult.duration}ms</span>
                  <button
                    onclick={() => showExecutionResult = false}
                    class="bg-terra-500 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-terra-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/if}
      {/if}
    </div>

    <!-- Error toast -->
    {#if error && instance}
      <div class="fixed bottom-6 right-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm shadow-lg z-50 flex items-center gap-3">
        <span>{error}</span>
        <button onclick={() => error = ""} class="text-red-400 hover:text-red-600">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/if}
  </div>
</section>
