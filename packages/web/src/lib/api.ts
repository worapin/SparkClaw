import type { MeResponse, InstanceResponse, Plan, SetupWizardState, ApiKeyResponse, LlmKeyResponse, OrgResponse, OrgMemberResponse, UsageSummary, ScheduledJobResponse, AuditLogResponse, EnvVarResponse, CustomSkillResponse, InstanceHealthResponse, InstanceLogEntry, SkillExecutionResult } from "@sparkclaw/shared/types";
import type { SaveSetupInput } from "@sparkclaw/shared/schemas";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function sendOtp(email: string) {
  return request<{ ok: boolean }>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(email: string, code: string) {
  return request<{ ok: boolean; redirect: string }>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export async function logout() {
  return request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function getMe() {
  return request<MeResponse>("/api/me");
}

// ── Instances ─────────────────────────────────────────────────────────────────

export async function getInstances() {
  return request<{ instances: InstanceResponse[] }>("/api/instances");
}

export async function getInstanceById(id: string) {
  return request<InstanceResponse>(`/api/instances/${id}`);
}

export async function createInstance(instanceName?: string) {
  return request<{ success: boolean; message: string }>("/api/instances", {
    method: "POST",
    body: JSON.stringify({ instanceName }),
  });
}

export async function deleteInstance(id: string) {
  return request<{ success: boolean }>(`/api/instances/${id}`, {
    method: "DELETE",
  });
}

/** @deprecated Use getInstances() instead */
export async function getInstance() {
  return request<InstanceResponse | { instance: null }>("/api/instance");
}

// ── Checkout ──────────────────────────────────────────────────────────────────

export async function createCheckout(plan: Plan) {
  return request<{ url: string }>("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function getSetupState(instanceId: string) {
  return request<{ state: SetupWizardState | null }>(`/api/setup/state?instanceId=${instanceId}`);
}

export async function saveSetup(data: SaveSetupInput) {
  return request<{ success: boolean }>("/api/setup/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function checkAdmin() {
  return request<{ isAdmin: boolean; user: { id: string; email: string } | null }>("/api/admin/check");
}

export async function getAdminStats() {
  return request<{
    users: number;
    instances: number;
    subscriptions: number;
    instancesByStatus: Record<string, number>;
    subscriptionsByPlan: Record<string, number>;
    recentSignups: number;
  }>("/api/admin/stats");
}

export async function getAdminUsers(page: number = 1, search: string = "") {
  return request<{
    users: Array<{
      id: string;
      email: string;
      role: string;
      createdAt: string;
      subscription: { plan: string; status: string } | null;
      instances: Array<{ id: string; status: string; url: string | null }>;
      instanceCount: number;
    }>;
    pagination: { page: number; totalPages: number; total: number };
  }>(`/api/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`);
}

// ── TOTP ─────────────────────────────────────────────────────────────────────

export async function getTotpStatus() {
  return request<{ enabled: boolean; hasBackupCodes: boolean }>("/api/totp/status");
}

export async function setupTotp() {
  return request<{ secret: string; uri: string; backupCodes: string[] }>("/api/totp/setup", { method: "POST" });
}

export async function verifyTotp(code: string) {
  return request<{ success: boolean }>("/api/totp/verify", { method: "POST", body: JSON.stringify({ code }) });
}

export async function disableTotp(code: string) {
  return request<{ success: boolean }>("/api/totp/disable", { method: "POST", body: JSON.stringify({ code }) });
}

// ── API Keys ─────────────────────────────────────────────────────────────────

export async function getApiKeys() {
  return request<{ keys: ApiKeyResponse[] }>("/api/keys");
}

export async function createApiKey(data: { name: string; scopes: string[]; expiresInDays?: number }) {
  return request<{ key: string; id: string }>("/api/keys", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteApiKey(id: string) {
  return request<{ success: boolean }>(`/api/keys/${id}`, { method: "DELETE" });
}

// ── LLM Keys ─────────────────────────────────────────────────────────────────

export async function getLlmKeys() {
  return request<{ keys: LlmKeyResponse[] }>("/api/llm-keys");
}

export async function createLlmKey(data: { provider: string; name: string; apiKey: string }) {
  return request<{ success: boolean; id: string }>("/api/llm-keys", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteLlmKey(id: string) {
  return request<{ success: boolean }>(`/api/llm-keys/${id}`, { method: "DELETE" });
}

export async function getAdminInstances(page: number = 1, status?: string) {
  return request<{
    instances: Array<{
      id: string;
      url: string | null;
      customDomain: string | null;
      status: string;
      domainStatus: string;
      setupCompleted: boolean;
      createdAt: string;
      user: { email: string };
      subscription: { plan: string };
    }>;
    pagination: { page: number; totalPages: number; total: number };
  }>(`/api/admin/instances?page=${page}${status ? `&status=${status}` : ""}`);
}

// ── Organizations ────────────────────────────────────────────────────────────

export async function getOrgs() {
  return request<{ orgs: OrgResponse[] }>("/api/orgs");
}

export async function createOrg(name: string) {
  return request<OrgResponse>("/api/orgs", { method: "POST", body: JSON.stringify({ name }) });
}

export async function getOrgMembers(orgId: string) {
  return request<{ members: OrgMemberResponse[] }>(`/api/orgs/${orgId}/members`);
}

export async function inviteOrgMember(orgId: string, email: string, role: string) {
  return request<{ success: boolean }>(`/api/orgs/${orgId}/invite`, { method: "POST", body: JSON.stringify({ email, role }) });
}

export async function updateMemberRole(orgId: string, memberId: string, role: string) {
  return request<{ success: boolean }>(`/api/orgs/${orgId}/members/${memberId}`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export async function removeOrgMember(orgId: string, memberId: string) {
  return request<{ success: boolean }>(`/api/orgs/${orgId}/members/${memberId}`, { method: "DELETE" });
}

export async function deleteOrg(orgId: string) {
  return request<{ success: boolean }>(`/api/orgs/${orgId}`, { method: "DELETE" });
}

export async function acceptOrgInvite(token: string) {
  return request<{ success: boolean }>(`/api/orgs/invite/${token}/accept`, { method: "POST" });
}

// ── Usage ────────────────────────────────────────────────────────────────────

export async function getUsage(period?: string) {
  return request<UsageSummary>(`/api/usage${period ? `?period=${period}` : ""}`);
}

export async function getUsageHistory(months?: number) {
  return request<{ history: UsageSummary[] }>(`/api/usage/history${months ? `?months=${months}` : ""}`);
}

// ── Admin Audit ──────────────────────────────────────────────────────────────

export async function getAdminAuditLogs(page: number = 1, action?: string) {
  return request<{
    logs: AuditLogResponse[];
    pagination: { page: number; totalPages: number; total: number };
  }>(`/api/admin/audit?page=${page}${action ? `&action=${action}` : ""}`);
}

// ── Instance Actions ────────────────────────────────────────────────────────

export async function instanceAction(id: string, action: "start" | "stop" | "restart") {
  return request<{ success: boolean; action: string; status: string }>(`/api/instances/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function getInstanceHealth(id: string) {
  return request<InstanceHealthResponse>(`/api/instances/${id}/health`);
}

export function getInstanceLogsUrl(id: string): string {
  return `${API_BASE}/api/instances/${id}/logs`;
}

export async function getInstanceLogs(id: string) {
  return request<{ logs: InstanceLogEntry[] }>(`/api/instances/${id}/logs`);
}

// ── Env Vars ────────────────────────────────────────────────────────────────

export async function getEnvVars(instanceId: string) {
  return request<{ vars: EnvVarResponse[] }>(`/api/env-vars?instanceId=${instanceId}`);
}

export async function createEnvVar(data: { instanceId: string; key: string; value: string; isSecret: boolean }) {
  return request<{ success: boolean; id: string }>("/api/env-vars", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEnvVar(id: string, value: string) {
  return request<{ success: boolean }>(`/api/env-vars/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

export async function deleteEnvVar(id: string) {
  return request<{ success: boolean }>(`/api/env-vars/${id}`, {
    method: "DELETE",
  });
}

// ── Scheduled Jobs ──────────────────────────────────────────────────────────

export async function getScheduledJobs(instanceId: string) {
  return request<{ jobs: ScheduledJobResponse[] }>(`/api/jobs?instanceId=${instanceId}`);
}

export async function createScheduledJob(data: { instanceId: string; name: string; cronExpression: string; taskType: string; config?: Record<string, unknown> }) {
  return request<{ success: boolean; id: string }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateScheduledJob(id: string, data: { name?: string; cronExpression?: string; config?: Record<string, unknown>; enabled?: boolean }) {
  return request<{ success: boolean }>(`/api/jobs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteScheduledJob(id: string) {
  return request<{ success: boolean }>(`/api/jobs/${id}`, {
    method: "DELETE",
  });
}

// ── Custom Skills ───────────────────────────────────────────────────────────

export async function getCustomSkills(instanceId: string) {
  return request<{ skills: CustomSkillResponse[] }>(`/api/skills?instanceId=${instanceId}`);
}

export async function createCustomSkill(data: { instanceId: string; name: string; description?: string; language: string; code: string; triggerType?: string; triggerValue?: string; timeout?: number }) {
  return request<{ success: boolean; id: string }>("/api/skills", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCustomSkill(id: string, data: { description?: string; code?: string; enabled?: boolean; triggerType?: string; triggerValue?: string; timeout?: number }) {
  return request<{ success: boolean }>(`/api/skills/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomSkill(id: string) {
  return request<{ success: boolean }>(`/api/skills/${id}`, {
    method: "DELETE",
  });
}

export async function executeCustomSkill(id: string) {
  return request<SkillExecutionResult>(`/api/skills/${id}/execute`, {
    method: "POST",
  });
}

// ── Billing ─────────────────────────────────────────────────────────────────

export async function getBillingPortalUrl() {
  return request<{ url: string }>("/api/billing/portal", { method: "POST" });
}

export async function cancelSubscription() {
  return request<{ success: boolean }>("/api/billing/cancel", { method: "POST" });
}

export async function deleteAccount() {
  return request<{ success: boolean }>("/api/billing/account", { method: "DELETE" });
}
