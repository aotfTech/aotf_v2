"use client";

import { useUser } from "@clerk/nextjs";
import type { AdminPermissionKey } from "@/lib/admin/admin-permissions";
import { useMemo } from "react";

/**
 * A hook to check if the current admin has specific permissions based on their Clerk session metadata.
 */
export function useAdminPermissions() {
  const { user, isLoaded } = useUser();

  const permissions = useMemo<Record<string, boolean>>(() => {
    if (!isLoaded || !user) return {};

    const metadata = (user.publicMetadata ?? {}) as Record<string, unknown>;
    
    // If the user is a super_admin, they implicitly have all permissions
    if (metadata.role === "super_admin") {
      return { _isSuperAdmin: true };
    }

    return {
      ...(metadata as Record<string, boolean>),
      ...((metadata.permissions ?? {}) as Record<string, boolean>),
    };
  }, [user, isLoaded]);

  const hasPermission = (permission: AdminPermissionKey) => {
    if (!isLoaded) return false;
    if (permissions._isSuperAdmin) return true;
    return permissions[permission] === true;
  };

  const hasAnyPermission = (perms: AdminPermissionKey[]) => {
    if (!isLoaded) return false;
    if (permissions._isSuperAdmin) return true;
    return perms.some((p) => permissions[p] === true);
  };

  const hasAllPermissions = (perms: AdminPermissionKey[]) => {
    if (!isLoaded) return false;
    if (permissions._isSuperAdmin) return true;
    return perms.every((p) => permissions[p] === true);
  };

  return {
    isLoaded,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    role: (user?.publicMetadata?.role as string) || null,
  };
}
