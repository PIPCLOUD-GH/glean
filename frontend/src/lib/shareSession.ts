const SHARE_SESSION_KEY = "glean-share-session-v1";

function randomSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * A tab-scoped anonymous visit identifier. It is never sent outside Glean's
 * `/api/shared/*` endpoints and contains no account or device information.
 */
export function getShareSessionId(): string {
  if (typeof window === "undefined") return "server-render";
  try {
    const existing = window.sessionStorage.getItem(SHARE_SESSION_KEY);
    if (existing) return existing;
    const created = randomSessionId();
    window.sessionStorage.setItem(SHARE_SESSION_KEY, created);
    return created;
  } catch {
    const state = window as typeof window & { __gleanShareSessionId?: string };
    if (!state.__gleanShareSessionId) state.__gleanShareSessionId = randomSessionId();
    return state.__gleanShareSessionId;
  }
}

export function withShareSessionHeader(headers?: HeadersInit): Headers {
  const next = new Headers(headers || {});
  next.set("X-Share-Session", getShareSessionId());
  return next;
}
