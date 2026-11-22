import { executeGleanPackageImportWithBatch } from "./roundTripImportBatches";
import {
  attachRoundTripImportLinkUndo,
  captureRoundTripImportLinkUndo,
} from "./roundTripImportLinkUndo";
import {
  applyRoundTripPermissions,
  augmentRoundTripPermissionPreview,
  type RoundTripPermissionMappings,
} from "./roundTripPermissionTransfer";
import {
  importGleanPackageWithSync,
  type RoundTripImportParams,
} from "./gleanRoundTripSync";

export interface ImportParams extends RoundTripImportParams {
  applyPermissions?: boolean;
  permissionMappings?: RoundTripPermissionMappings;
}

export async function importGleanPackage(zipBuffer: Buffer, params: ImportParams): Promise<any> {
  if (params.dryRun) {
    const preview = await importGleanPackageWithSync(zipBuffer, params);
    return augmentRoundTripPermissionPreview(zipBuffer, params, preview);
  }

  const linkSnapshot = await captureRoundTripImportLinkUndo(zipBuffer, params.userId, params.workspaceId);
  let result = await executeGleanPackageImportWithBatch(zipBuffer, params);
  const batchId = String(result?.importBatch?.id || "");
  if (batchId && result?.success) {
    const attached = attachRoundTripImportLinkUndo(params.userId, batchId, linkSnapshot);
    if (!attached.available) {
      result.importBatch = {
        ...(result.importBatch || {}),
        undoAvailable: false,
        reason: attached.reason ?? result.importBatch?.reason ?? null,
      };
    }
    result = await applyRoundTripPermissions(zipBuffer, params, result, batchId);
  }
  return result;
}

export type {
  RoundTripSyncImportMode as RoundTripImportMode,
  RoundTripSyncStrategy as RoundTripConflictStrategy,
} from "./gleanRoundTripSync";
export type { ImportConflict } from "./gleanPackageImportV2";
