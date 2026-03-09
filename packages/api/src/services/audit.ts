import { db, auditLogs } from "@sparkclaw/shared/db";

export type AuditAction =
  | "login"
  | "logout"
  | "totp_enabled"
  | "totp_disabled"
  | "api_key_created"
  | "api_key_deleted"
  | "instance_created"
  | "instance_deleted"
  | "setup_saved"
  | "channel_configured"
  | "channel_deleted"
  | "llm_key_added"
  | "llm_key_deleted"
  | "org_created"
  | "org_member_invited"
  | "org_member_removed"
  | "org_member_role_changed"
  | "scheduled_job_created"
  | "scheduled_job_updated"
  | "scheduled_job_deleted";

export async function logAudit(params: {
  userId: string;
  action: AuditAction;
  instanceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      instanceId: params.instanceId ?? null,
      metadata: params.metadata ?? null,
      ip: params.ip ?? null,
    });
  } catch {
    // Audit logging should never break the main flow
    console.error("Failed to write audit log", params);
  }
}
