import { Elysia } from "elysia";
import { SESSION_COOKIE_NAME } from "@sparkclaw/shared/constants";
import { createOrgSchema, inviteOrgMemberSchema, updateOrgMemberRoleSchema } from "@sparkclaw/shared/schemas";
import type { OrgResponse, OrgMemberResponse, OrgRole } from "@sparkclaw/shared/types";
import { csrfMiddleware } from "../middleware/csrf.js";
import { verifySession } from "../services/session.js";
import { logAudit } from "../services/audit.js";
import { generateToken } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";
import { db, organizations, orgMembers, orgInvites, users } from "@sparkclaw/shared/db";
import { eq, and, desc, sql, count } from "drizzle-orm";

async function requireOrgMember(orgId: string, userId: string, requiredRoles?: string[]) {
  const member = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!member) return null;
  if (requiredRoles && !requiredRoles.includes(member.role)) return null;
  return member;
}

export const orgRoutes = new Elysia({ prefix: "/api/orgs" })
  .use(csrfMiddleware)
  .resolve(async ({ cookie, set }) => {
    const token = cookie[SESSION_COOKIE_NAME]?.value as string | undefined;
    if (!token) {
      set.status = 401;
      throw new Error("Not authenticated");
    }
    const user = await verifySession(token);
    if (!user) {
      set.status = 401;
      throw new Error("Invalid or expired session");
    }
    return { user };
  })
  .onError(({ set, error: err }) => {
    if (err instanceof Error && (err.message === "Not authenticated" || err.message === "Invalid or expired session")) {
      set.status = 401;
      return { error: err.message };
    }
  })
  // ── GET /api/orgs ───────────────────────────────────────────────────────────
  .get("/", async ({ user }) => {
    const memberships = await db.query.orgMembers.findMany({
      where: eq(orgMembers.userId, user.id),
      with: {
        org: {
          with: {
            members: true,
          },
        },
      },
    });

    const orgs: OrgResponse[] = memberships.map((m) => ({
      id: m.org.id,
      name: m.org.name,
      slug: m.org.slug,
      role: m.role as OrgRole,
      memberCount: m.org.members.length,
      createdAt: m.org.createdAt.toISOString(),
    }));

    return { orgs };
  })
  // ── POST /api/orgs ──────────────────────────────────────────────────────────
  .post("/", async ({ user, body, set }) => {
    const parsed = createOrgSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    const { name } = parsed.data;
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // Check slug uniqueness
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
    if (existing) {
      set.status = 409;
      return { error: "An organization with a similar name already exists" };
    }

    const [org] = await db
      .insert(organizations)
      .values({ name, slug, ownerId: user.id })
      .returning();

    await db.insert(orgMembers).values({
      orgId: org.id,
      userId: user.id,
      role: "owner",
    });

    await logAudit({
      userId: user.id,
      action: "org_created",
      metadata: { orgId: org.id, name, slug },
    });

    logger.info("Organization created", { userId: user.id, orgId: org.id });

    const response: OrgResponse = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: "owner",
      memberCount: 1,
      createdAt: org.createdAt.toISOString(),
    };

    return response;
  })
  // ── GET /api/orgs/:id ───────────────────────────────────────────────────────
  .get("/:id", async ({ user, params, set }) => {
    const member = await requireOrgMember(params.id, user.id);
    if (!member) {
      set.status = 404;
      return { error: "Organization not found" };
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, params.id),
      with: { members: true },
    });

    if (!org) {
      set.status = 404;
      return { error: "Organization not found" };
    }

    const response: OrgResponse = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: member.role as OrgRole,
      memberCount: org.members.length,
      createdAt: org.createdAt.toISOString(),
    };

    return response;
  })
  // ── GET /api/orgs/:id/members ───────────────────────────────────────────────
  .get("/:id/members", async ({ user, params, set }) => {
    const member = await requireOrgMember(params.id, user.id);
    if (!member) {
      set.status = 404;
      return { error: "Organization not found" };
    }

    const members = await db.query.orgMembers.findMany({
      where: eq(orgMembers.orgId, params.id),
      with: { user: true },
    });

    const response: OrgMemberResponse[] = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      role: m.role as OrgRole,
      createdAt: m.createdAt.toISOString(),
    }));

    return { members: response };
  })
  // ── POST /api/orgs/:id/invite ──────────────────────────────────────────────
  .post("/:id/invite", async ({ user, params, body, set }) => {
    const member = await requireOrgMember(params.id, user.id, ["owner", "admin"]);
    if (!member) {
      set.status = 403;
      return { error: "Only owners and admins can invite members" };
    }

    const parsed = inviteOrgMemberSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    const { email, role } = parsed.data;

    // Check if already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingUser) {
      const existingMember = await db.query.orgMembers.findFirst({
        where: and(
          eq(orgMembers.orgId, params.id),
          eq(orgMembers.userId, existingUser.id),
        ),
      });
      if (existingMember) {
        set.status = 409;
        return { error: "User is already a member of this organization" };
      }
    }

    const token = generateToken(16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(orgInvites)
      .values({
        orgId: params.id,
        email,
        role,
        token,
        invitedBy: user.id,
        expiresAt,
      })
      .returning();

    await logAudit({
      userId: user.id,
      action: "org_member_invited",
      metadata: { orgId: params.id, email, role },
    });

    logger.info("Org member invited", { orgId: params.id, email, invitedBy: user.id });

    return { invite: { id: invite.id, email, role, token, expiresAt: expiresAt.toISOString() } };
  })
  // ── POST /api/orgs/invite/:token/accept ────────────────────────────────────
  .post("/invite/:token/accept", async ({ user, params, set }) => {
    const invite = await db.query.orgInvites.findFirst({
      where: eq(orgInvites.token, params.token),
    });

    if (!invite) {
      set.status = 404;
      return { error: "Invite not found" };
    }

    if (invite.acceptedAt) {
      set.status = 400;
      return { error: "Invite has already been accepted" };
    }

    if (new Date() > invite.expiresAt) {
      set.status = 400;
      return { error: "Invite has expired" };
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      set.status = 403;
      return { error: "This invite is not for your account email" };
    }

    // Check if already a member
    const existingMember = await db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.orgId, invite.orgId),
        eq(orgMembers.userId, user.id),
      ),
    });
    if (existingMember) {
      set.status = 409;
      return { error: "You are already a member of this organization" };
    }

    await db.insert(orgMembers).values({
      orgId: invite.orgId,
      userId: user.id,
      role: invite.role,
    });

    await db
      .update(orgInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(orgInvites.id, invite.id));

    logger.info("Org invite accepted", { orgId: invite.orgId, userId: user.id });

    return { success: true, orgId: invite.orgId };
  })
  // ── PATCH /api/orgs/:id/members/:memberId ──────────────────────────────────
  .patch("/:id/members/:memberId", async ({ user, params, body, set }) => {
    const member = await requireOrgMember(params.id, user.id, ["owner", "admin"]);
    if (!member) {
      set.status = 403;
      return { error: "Only owners and admins can update member roles" };
    }

    const parsed = updateOrgMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      set.status = 400;
      return { error: "Invalid input", details: parsed.error.errors };
    }

    const targetMember = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.id, params.memberId), eq(orgMembers.orgId, params.id)),
    });

    if (!targetMember) {
      set.status = 404;
      return { error: "Member not found" };
    }

    // Can't change role of the owner
    if (targetMember.role === "owner") {
      set.status = 403;
      return { error: "Cannot change the owner's role" };
    }

    await db
      .update(orgMembers)
      .set({ role: parsed.data.role })
      .where(eq(orgMembers.id, params.memberId));

    await logAudit({
      userId: user.id,
      action: "org_member_role_changed",
      metadata: { orgId: params.id, memberId: params.memberId, newRole: parsed.data.role },
    });

    logger.info("Org member role updated", { orgId: params.id, memberId: params.memberId, newRole: parsed.data.role });

    return { success: true };
  })
  // ── DELETE /api/orgs/:id/members/:memberId ─────────────────────────────────
  .delete("/:id/members/:memberId", async ({ user, params, set }) => {
    const member = await requireOrgMember(params.id, user.id, ["owner", "admin"]);
    if (!member) {
      set.status = 403;
      return { error: "Only owners and admins can remove members" };
    }

    const targetMember = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.id, params.memberId), eq(orgMembers.orgId, params.id)),
    });

    if (!targetMember) {
      set.status = 404;
      return { error: "Member not found" };
    }

    // Owner can't remove themselves
    if (targetMember.role === "owner" && targetMember.userId === user.id) {
      set.status = 403;
      return { error: "Owner cannot remove themselves from the organization" };
    }

    // Can't remove the owner
    if (targetMember.role === "owner") {
      set.status = 403;
      return { error: "Cannot remove the owner" };
    }

    await db.delete(orgMembers).where(eq(orgMembers.id, params.memberId));

    await logAudit({
      userId: user.id,
      action: "org_member_removed",
      metadata: { orgId: params.id, memberId: params.memberId, removedUserId: targetMember.userId },
    });

    logger.info("Org member removed", { orgId: params.id, memberId: params.memberId });

    return { success: true };
  })
  // ── DELETE /api/orgs/:id ────────────────────────────────────────────────────
  .delete("/:id", async ({ user, params, set }) => {
    const member = await requireOrgMember(params.id, user.id, ["owner"]);
    if (!member) {
      set.status = 403;
      return { error: "Only the owner can delete the organization" };
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, params.id),
    });

    if (!org) {
      set.status = 404;
      return { error: "Organization not found" };
    }

    // Delete org (cascades to members and invites)
    await db.delete(organizations).where(eq(organizations.id, params.id));

    await logAudit({
      userId: user.id,
      action: "org_deleted",
      metadata: { orgId: params.id, name: org.name },
    });

    logger.info("Organization deleted", { userId: user.id, orgId: params.id });

    return { success: true };
  });
