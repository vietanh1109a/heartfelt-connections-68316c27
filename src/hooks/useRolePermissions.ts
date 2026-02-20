import { useAdmin } from "./useAdmin";
import { useModeratorPermissions } from "./useModeratorPermissions";

export type { TabPermission } from "./useModeratorPermissions";

export function useRolePermissions() {
  const { isAdmin, isModerator } = useAdmin();
  const { data: permissions } = useModeratorPermissions();

  const canViewTab = (tab: string): boolean => {
    if (isAdmin) return true;
    if (!isModerator) return false;
    return permissions?.find(p => p.tab === tab)?.can_view ?? false;
  };

  const canEditTab = (tab: string): boolean => {
    if (isAdmin) return true;
    if (!isModerator) return false;
    return permissions?.find(p => p.tab === tab)?.can_edit ?? false;
  };

  return { isAdmin, isModerator, canViewTab, canEditTab };
}

