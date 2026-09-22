import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import type { Permission } from "@/lib/admin/permissions";
import { reportError } from "@/lib/sentry-report";

type PermissionResult = {
  admin: any | null; // returning the Admin document
  error?: NextResponse;
};

const PERM_MAPPING: Record<Permission, string> = {
  "tutor:add": "canCreateTuitionPosts",
  "tutor:remove": "canDeletePosts",
  "candidate:add": "canCreateJobPosts",
  "candidate:remove": "canDeletePosts",
  "application:approve": "canEditPosts",
  "application:reject": "canEditPosts",
  "communication:send": "canCallApplicants",
  "faculty:add": "canManageRenownedTeachers",
  "faculty:remove": "canManageRenownedTeachers",
  "faculty:approve": "canManageRenownedTeachers",
  "calendar:create": "canManageJobs",
  "calendar:edit": "canManageJobs",
  "ledger:entry": "canViewPayments",
  "admin:invite": "canCreateAdmins",
  "admin:terminate": "canTerminateAdmins",
  "admin:role_change": "canEditAdmins",
  "admin:view_metrics": "canViewAnalytics",
  "superadmin:manage": "canManageAdmins",
  "whatsapp:manage": "canManageWhatsAppGroups",
  "payment:recover": "canRecoverPayments",
};

export function requirePermission(...required: Permission[]) {
  return async function permissionGuard(
    _req: Request,
  ): Promise<PermissionResult> {
    await dbConnect();
    const { userId } = await auth();

    if (!userId) {
      return {
        admin: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    let metadata = {} as Record<string, unknown>;
    try {
      const claims = (await auth()).sessionClaims;
      metadata = (claims?.publicMetadata ?? {}) as Record<string, unknown>;
      if (metadata.isAdmin !== true) {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        metadata = clerkUser.publicMetadata as Record<string, unknown>;
      }
    } catch (error) {
      reportError(error, {
        tags: { area: "admin-permissions", operation: "clerk-permission-enrichment" },
      });
    }

    const admin = await Admin.findOne({ clerkId: userId }).lean();

    if (!admin || !admin.isActive) {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Forbidden: admin not active" },
          { status: 403 },
        ),
      };
    }

    if (required.length === 0 || admin.role === "super_admin") {
      return { admin };
    }

    const adminPerms = (admin.permissions || {}) as Record<string, unknown>;
    const clerkPerms = (metadata.permissions || metadata) as Record<string, unknown>;

    const hasAll = required.every((perm) => {
      const mappedKey = PERM_MAPPING[perm];
      if (!mappedKey) return false;
      return adminPerms[mappedKey] === true || clerkPerms[mappedKey] === true;
    });

    if (!hasAll) {
      return {
        admin: null,
        error: NextResponse.json(
          { error: "Insufficient permissions", required },
          { status: 403 },
        ),
      };
    }

    return { admin };
  };
}

export async function getAdminFromRequest(_req: Request) {
  await dbConnect();
  const { userId } = await auth();
  if (!userId) return null;
  return await Admin.findOne({ clerkId: userId }).lean();
}
