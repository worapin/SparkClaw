import type { MeResponse, InstanceResponse, Plan } from "@sparkclaw/shared/types";

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

export async function getMe() {
  return request<MeResponse>("/api/me");
}

export async function getInstance() {
  return request<InstanceResponse | { instance: null }>("/api/instance");
}

export async function createCheckout(plan: Plan) {
  return request<{ url: string }>("/api/checkout", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}
