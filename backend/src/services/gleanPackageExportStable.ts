import {
  createGleanPackageExport,
  type PreparedMarkdownPackageNote,
} from "./gleanPackageExport";
import { ensureGleanInstanceEnvironment } from "./gleanInstanceIdentity";
import { addPermissionsToGleanPackageExport } from "./roundTripPermissionTransfer";

export type { PreparedMarkdownPackageNote };

type StableExportParams = Parameters<typeof createGleanPackageExport>[0] & {
  includePermissions?: boolean;
};

/**
 * Ensure all user-facing Round-trip packages carry a stable sourceInstanceId.
 * Permission/member data remains an explicit admin-only extension and is omitted by default.
 */
export async function createStableGleanPackageExport(
  params: StableExportParams,
): Promise<Awaited<ReturnType<typeof createGleanPackageExport>>> {
  ensureGleanInstanceEnvironment();
  const { includePermissions = false, ...baseParams } = params;
  const result = await createGleanPackageExport(baseParams);
  if (!includePermissions) return result;
  if (!baseParams.workspaceId) throw new Error("成员与权限只能随工作区 Glean 无损包导出");
  return addPermissionsToGleanPackageExport({
    result,
    userId: baseParams.userId,
    workspaceId: baseParams.workspaceId,
  });
}
