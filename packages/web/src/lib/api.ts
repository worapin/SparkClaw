import type { MeResponse, InstanceResponse, Plan, SetupWizardState } from "@sparkclaw/shared/types";
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
