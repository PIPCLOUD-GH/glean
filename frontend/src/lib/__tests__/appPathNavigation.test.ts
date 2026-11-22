import { describe, expect, it } from "vitest";
import {
  buildAppPathUrl,
  resolveCurrentAppPathname,
} from "../appPathNavigation";

describe("app path navigation", () => {
  it("keeps V3 app routes out of the server prefix and preserves reverse proxy deployment paths", () => {
    expect(resolveCurrentAppPathname("https://note.example.com/apps", false)).toBe("/apps");
    expect(resolveCurrentAppPathname("https://note.example.com/glean/apps/gleanlab.hello-app/home", false)).toBe("/apps/gleanlab.hello-app/home");
    expect(buildAppPathUrl("/apps/gleanlab.hello-app/home", "https://note.example.com/glean/apps", false)).toBe("/glean/apps/gleanlab.hello-app/home");
    expect(buildAppPathUrl("/", "https://note.example.com/glean/apps/gleanlab.hello-app/home", false)).toBe("/glean/");
    // A deployment mounted at /apps/ must keep its API prefix. The app directory uses /apps.
    expect(resolveCurrentAppPathname("https://note.example.com/apps/", false)).toBe("/");
  });
  it.each([
    ["/notes/note-two", "https://note.example.com/glean/notes/note-one", "/glean/notes/note-two"],
    ["/sheets/sheet-one", "https://note.example.com/glean/notes/note-one", "/glean/sheets/sheet-one"],
    ["/", "https://note.example.com/glean/notes/note-one", "/glean/"],
    ["/notes/note-two", "https://note.example.com/notes/note-one", "/notes/note-two"],
  ])("应用导航 %s 保留部署前缀", (appPath, currentHref, expected) => {
    expect(buildAppPathUrl(appPath, currentHref, false)).toBe(expected);
  });

  it.each([
    ["https://note.example.com/glean/notes/note-one", "/notes/note-one"],
    ["https://note.example.com/glean/mindmaps/map-one", "/mindmaps/map-one"],
    ["https://note.example.com/glean/sheets/sheet-one", "/sheets/sheet-one"],
    ["https://note.example.com/glean/trash", "/trash"],
  ])("子路径 URL %s 解析为应用路由", (href, expected) => {
    expect(resolveCurrentAppPathname(href, false)).toBe(expected);
  });

  it.each([
    ["/issues", "https://note.example.com/glean/", "/glean/issues"],
    ["/issues/issue-one", "https://note.example.com/glean/issues", "/glean/issues/issue-one"],
    ["/", "https://note.example.com/glean/issues/issue-one", "/glean/"],
    ["/issues", "https://note.example.com/mindmaps/demo", "/issues"],
    ["/issues", "https://note.example.com/glean/mindmaps/demo", "/glean/issues"],
  ])("议题导航 %s 保留部署前缀", (appPath, currentHref, expected) => {
    expect(buildAppPathUrl(appPath, currentHref, false)).toBe(expected);
  });

  it.each([
    ["https://note.example.com/glean/issues", "/issues"],
    ["https://note.example.com/glean/issues/issue-one/", "/issues/issue-one/"],
    ["https://note.example.com/issues/issue-one", "/issues/issue-one"],
  ])("议题 URL %s 解析为应用路由", (href, expected) => {
    expect(resolveCurrentAppPathname(href, false)).toBe(expected);
  });

  it.each([
    ["file:///C:/Glean/frontend/index.html?serverUrl=https%3A%2F%2Fnote.example.com%2Fglean", false],
    ["https://localhost/?serverUrl=https%3A%2F%2Fnote.example.com%2Fglean", true],
  ])("原生议题导航保留服务器参数 %s", (href, native) => {
    const url = buildAppPathUrl("/issues/issue-one", String(href), Boolean(native));
    expect(new URL(url).searchParams.get("serverUrl")).toBe("https://note.example.com/glean");
    expect(resolveCurrentAppPathname(url, Boolean(native))).toBe("/issues/issue-one");
  });

  it("keeps normal web navigation paths unchanged", () => {
    expect(buildAppPathUrl("/public", "https://note.example.com/", false)).toBe("/public");
    expect(resolveCurrentAppPathname("https://note.example.com/public/demo", false)).toBe("/public/demo");
  });

  it("stores desktop public routes on the existing file entry URL", () => {
    const nextUrl = buildAppPathUrl(
      "/public/demo-token",
      "file:///C:/Program%20Files/Glean/frontend/index.html?serverUrl=http%3A%2F%2F127.0.0.1%3A3001",
      false,
    );
    const parsed = new URL(nextUrl);

    expect(parsed.pathname).toBe("/C:/Program%20Files/Glean/frontend/index.html");
    expect(parsed.searchParams.get("serverUrl")).toBe("http://127.0.0.1:3001");
    expect(parsed.searchParams.get("gleanAppPath")).toBe("/public/demo-token");
    expect(resolveCurrentAppPathname(nextUrl, false)).toBe("/public/demo-token");
  });

  it("stores Capacitor public routes on the existing app entry URL", () => {
    const nextUrl = buildAppPathUrl(
      "/public/demo-token",
      "https://localhost/?serverUrl=http%3A%2F%2Fnote.example.com",
      true,
    );
    const parsed = new URL(nextUrl);

    expect(parsed.origin).toBe("https://localhost");
    expect(parsed.pathname).toBe("/");
    expect(parsed.searchParams.get("serverUrl")).toBe("http://note.example.com");
    expect(parsed.searchParams.get("gleanAppPath")).toBe("/public/demo-token");
    expect(resolveCurrentAppPathname(nextUrl, true)).toBe("/public/demo-token");
  });

  it("returns to the workspace without dropping the desktop server address", () => {
    const nextUrl = buildAppPathUrl(
      "/",
      "file:///opt/glean/frontend/index.html?serverUrl=https%3A%2F%2Fnote.example.com&gleanAppPath=%2Fpublic",
      false,
    );
    const parsed = new URL(nextUrl);

    expect(parsed.pathname).toBe("/opt/glean/frontend/index.html");
    expect(parsed.searchParams.get("serverUrl")).toBe("https://note.example.com");
    expect(parsed.searchParams.has("gleanAppPath")).toBe(false);
    expect(resolveCurrentAppPathname(nextUrl, false)).toBe("/");
  });
});
