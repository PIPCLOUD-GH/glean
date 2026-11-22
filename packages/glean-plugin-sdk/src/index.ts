import type { GleanHostApi } from "./hostApi.generated.js";
import type { GleanPluginErrorCode } from "./errors.generated.js";

export * from "./hostApi.generated.js";
export * from "./contributions.generated.js";
export * from "./errors.generated.js";
export * from "./mock.generated.js";

export type JsonObject = Record<string, unknown>;
export type ActionResult = { success?: boolean; data?: unknown; text?: string } | unknown;

export interface NoteSummary {
  id: string; notebookId: string; title: string; contentText?: string; contentFormat: string;
  workspaceId: string | null; version: number; createdAt: string; updatedAt: string;
}
export interface Note extends NoteSummary { content: string }
export interface Notebook { id: string; parentId: string | null; name: string; description?: string; icon?: string; color?: string | null; workspaceId: string | null; createdAt: string; updatedAt: string }
export interface Tag { id: string; name: string; color: string; workspaceId: string | null; createdAt: string }
export interface Task extends JsonObject { id: string; title: string; userId: string; workspaceId: string | null; isCompleted: number; priority: number }
export interface Attachment { id: string; noteId: string; filename: string; mimeType: string; size: number; createdAt: string }
export interface DiaryEntry extends JsonObject { id: string; userId: string; workspaceId: string | null; contentText: string; mood: string; createdAt: string }
export interface Mindmap extends JsonObject { id: string; userId: string; workspaceId: string | null; title: string; data?: unknown; createdAt?: string; updatedAt?: string }

export interface PluginExecutionInfo { executionId: string; correlationId?: string; causationId?: string; depth?: number; idempotencyKey?: string }
export interface PluginActionContext<TInput extends JsonObject = JsonObject> { input: TInput; glean: GleanHostApi; execution?: PluginExecutionInfo }
export type PluginActionHandler<TInput extends JsonObject = JsonObject> = (context: PluginActionContext<TInput>) => ActionResult | Promise<ActionResult>;
export interface GleanPluginDefinition {
  activate?(context: { glean: GleanHostApi }): void | Promise<void>;
  actions: Record<string, PluginActionHandler>;
  deactivate?(): void | Promise<void>;
}

export class GleanPluginError extends Error {
  constructor(message: string, readonly code: GleanPluginErrorCode = "PLUGIN_ERROR") {
    super(message);
    this.name = "GleanPluginError";
  }
}

/** 编译期保留完整类型，运行时原样返回，不夹带业务实现或凭证。 */
export function definePlugin<T extends GleanPluginDefinition>(plugin: T): T { return plugin; }
export { getPluginAppClient, type PluginAppClient, type PluginInspectorResource, type PluginInspectorMetadata } from "./appUi.js";
