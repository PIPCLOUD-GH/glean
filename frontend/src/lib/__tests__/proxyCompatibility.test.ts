import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildServerPathCandidates,
  getResolvedApiBaseUrl,
  getResolvedWebSocketUrl,
} from "../serverUrl";

const apiSource = fs.readFileSync(path.resolve(__dirname, "../api.impl.ts"), "utf8");
const loginSource = fs.readFileSync(path.resolve(__dirname, "../../components/LoginPage.tsx"), "utf8");
const backendSource = fs.readFileSync(path.resolve(__dirname, "../../../../backend/src/index.ts"), "utf8");
const realtimeServerSource = fs.readFileSync(path.resolve(__dirname, "../../../../backend/src/services/realtime.ts"), "utf8");
const electronSetupSource = fs.readFileSync(path.resolve(__dirname, "../../../../electron/setupWindow.js"), "utf8");

describe("#771 reverse proxy compatibility candidates", () => {
  it("probes standard, /public/api and /publicapi without changing origin", () => {
    const candidates = buildServerPathCandidates("https://notes.example.com");

    expect(candidates.map(({ mode, apiBaseUrl, websocketUrl }) => ({ mode, apiBaseUrl, websocketUrl }))).toEqual([
      {
        mode: "standard",
        apiBaseUrl: "https://notes.example.com/api",
        websocketUrl: "wss://notes.example.com/ws",
      },
      {
        mode: "public-prefix",
        apiBaseUrl: "https://notes.example.com/public/api",
        websocketUrl: "wss://notes.example.com/public/ws",
      },
      {
        mode: "public-concat",
        apiBaseUrl: "https://notes.example.com/publicapi",
        websocketUrl: "wss://notes.example.com/publicws",
      },
    ]);
  });

  it("preserves a normal reverse-proxy path prefix", () => {
    const candidates = buildServerPathCandidates("https://notes.example.com/glean");

    expect(candidates.map((item) => item.apiBaseUrl)).toEqual([
      "https://notes.example.com/glean/api",
      "https://notes.example.com/glean/public/api",
      "https://notes.example.com/glean/publicapi",
    ]);
    expect(candidates.map((item) => item.websocketUrl)).toEqual([
      "wss://notes.example.com/glean/ws",
      "wss://notes.example.com/glean/public/ws",
      "wss://notes.example.com/glean/publicws",
    ]);
  });

  it("never downgrades HTTPS while constructing compatibility candidates", () => {
    for (const candidate of buildServerPathCandidates("https://notes.example.com:8443/glean")) {
      expect(candidate.serverBaseUrl.startsWith("https://")).toBe(true);
      expect(candidate.apiBaseUrl.startsWith("https://")).toBe(true);
      expect(candidate.websocketUrl.startsWith("wss://")).toBe(true);
      expect(new URL(candidate.apiBaseUrl).host).toBe("notes.example.com:8443");
      expect(new URL(candidate.websocketUrl).host).toBe("notes.example.com:8443");
    }
  });

  it("defaults to the standard path when no compatible path has been resolved yet", () => {
    expect(getResolvedApiBaseUrl("https://notes.example.com/glean")).toBe("https://notes.example.com/glean/api");
    expect(getResolvedWebSocketUrl("https://notes.example.com/glean")).toBe("wss://notes.example.com/glean/ws");
  });
});

describe("#771 connection probe integration contract", () => {
  it("validates Glean JSON instead of accepting an HTML 200 response", () => {
    expect(apiSource).toContain("probeHealthCandidate");
    expect(apiSource).toContain('contentType.includes("text/html")');
    expect(apiSource).toContain('payload.status !== "ok"');
    expect(apiSource).toContain('payload.service !== "glean"');
    expect(apiSource).toContain('res.headers.get("x-glean-proxy-compatibility-path")');
  });

  it("probes WebSocket separately and caches the resolved API/WS pair", () => {
    expect(apiSource).toContain("probeWebSocketCandidate");
    expect(apiSource).toContain('new WebSocket(`${websocketUrl}?probe=1`)');
    expect(apiSource).toContain("_cacheResolvedServerConnection({");
    expect(apiSource).toContain("websocketUrl: resolvedWebSocket.websocketUrl");
    expect(apiSource).toContain("websocketOk,");
  });

  it("uses the resolved API path for login instead of rebuilding /api manually", () => {
    expect(loginSource).toContain("const result = await testServerConnection(url)");
    expect(loginSource).toContain("getResolvedApiBaseUrl(baseUrl)");
    expect(loginSource).toContain("server.proxyCompatibilityEnabled");
    expect(loginSource).toContain("server.websocketUnavailable");
  });
});

describe("#771 server-side compatibility aliases", () => {
  it("narrowly maps Lucky/Nginx API rewrites back into the normal /api router", () => {
    expect(backendSource).toContain('pathname === "/public/api" || pathname.startsWith("/public/api/")');
    expect(backendSource).toContain('pathname === "/publicapi" || pathname.startsWith("/publicapi/")');
    expect(backendSource).toContain('headers.set("X-Glean-Proxy-Compatibility-Path", compatibilityPath)');
    const exposedHeaders = backendSource.match(/exposeHeaders:\s*\[([^\]]*)\]/)?.[1];
    expect(exposedHeaders).toContain('"X-Glean-Proxy-Compatibility-Path"');
    expect(exposedHeaders).toContain('"X-Request-Id"');
  });

  it("accepts only the three intended WebSocket paths and keeps real connections authenticated", () => {
    expect(realtimeServerSource).toContain('new Set(["/ws", "/public/ws", "/publicws"])');
    expect(realtimeServerSource).toContain('url.searchParams.get("probe") === "1"');
    expect(realtimeServerSource).toContain('const token = url.searchParams.get("token")');
    expect(realtimeServerSource).toContain("verifyLoginToken(token)");
  });
});

describe("#771 Electron server picker contract", () => {
  it("uses the same candidate order and reports compatibility mode", () => {
    expect(electronSetupSource).toContain('mode: "standard", apiPath: `${pathPrefix}/api`, websocketPath: `${pathPrefix}/ws`');
    expect(electronSetupSource).toContain('mode: "public-prefix", apiPath: `${pathPrefix}/public/api`, websocketPath: `${pathPrefix}/public/ws`');
    expect(electronSetupSource).toContain('mode: "public-concat", apiPath: `${pathPrefix}/publicapi`, websocketPath: `${pathPrefix}/publicws`');
    expect(electronSetupSource).toContain('payload?.service === "glean"');
    expect(electronSetupSource).toContain("已启用反向代理兼容");
  });
});
