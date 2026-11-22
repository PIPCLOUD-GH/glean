import crypto from "crypto";
import { getDb } from "../db/schema";

const INSTANCE_ID_KEY = "glean_instance_id";
const VALID_INSTANCE_ID = /^[A-Za-z0-9._:-]{8,160}$/;

function normalized(value: unknown): string | null {
  const candidate = String(value || "").trim();
  return candidate && VALID_INSTANCE_ID.test(candidate) ? candidate : null;
}

/**
 * Return a stable ID for the logical Glean instance.
 *
 * Operators may pin GLEAN_INSTANCE_ID explicitly. Otherwise the first export creates a UUID in
 * system_settings, so application restarts and ordinary upgrades keep the same source identity.
 */
export function getGleanInstanceId(): string {
  const configured = normalized(process.env.GLEAN_INSTANCE_ID);
  if (configured) return configured;

  const db = getDb();
  const existing = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(INSTANCE_ID_KEY) as
    | { value: string }
    | undefined;
  const stored = normalized(existing?.value);
  if (stored) return stored;

  const generated = crypto.randomUUID();
  db.prepare(`
    INSERT INTO system_settings (key, value, updatedAt)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO NOTHING
  `).run(INSTANCE_ID_KEY, generated);
  const persisted = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(INSTANCE_ID_KEY) as
    | { value: string }
    | undefined;
  return normalized(persisted?.value) || generated;
}

/** The existing exporter reads GLEAN_INSTANCE_ID while building manifest.json. */
export function ensureGleanInstanceEnvironment(): string {
  const id = getGleanInstanceId();
  if (!normalized(process.env.GLEAN_INSTANCE_ID)) process.env.GLEAN_INSTANCE_ID = id;
  return id;
}
