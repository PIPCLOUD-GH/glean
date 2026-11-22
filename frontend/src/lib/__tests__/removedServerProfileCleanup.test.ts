import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupRemovedServerProfiles } from "@/lib/removedServerProfileCleanup";

describe("遗留服务器资料清理", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("只删除多服务器专用键", async () => {
    localStorage.setItem("glean-server-profiles-v2", "[]");
    localStorage.setItem("glean-active-server-profile-v2", "old");
    localStorage.setItem("glean-server-profiles-v1", "[]");
    localStorage.setItem("glean-active-server-profile-v1", "old");
    localStorage.setItem("glean-cloud-login-records-v1", "[]");
    localStorage.setItem("glean-profile-credential-index-v1", JSON.stringify(["old"]));
    sessionStorage.setItem("glean-pending-profile-reauth-v1", "old");
    localStorage.setItem("glean-server-url", "http://127.0.0.1:3001");
    localStorage.setItem("glean-token", "token");

    await cleanupRemovedServerProfiles({ isNativePlatform: () => false });

    expect(localStorage.getItem("glean-server-profiles-v2")).toBeNull();
    expect(localStorage.getItem("glean-active-server-profile-v2")).toBeNull();
    expect(localStorage.getItem("glean-server-profiles-v1")).toBeNull();
    expect(localStorage.getItem("glean-active-server-profile-v1")).toBeNull();
    expect(localStorage.getItem("glean-cloud-login-records-v1")).toBeNull();
    expect(localStorage.getItem("glean-profile-credential-index-v1")).toBeNull();
    expect(sessionStorage.getItem("glean-pending-profile-reauth-v1")).toBeNull();
    expect(localStorage.getItem("glean-server-url")).toBe("http://127.0.0.1:3001");
    expect(localStorage.getItem("glean-token")).toBe("token");
  });

  it("Android 安全存储删除失败时保留索引供下次重试", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    localStorage.setItem("glean-profile-credential-index-v1", JSON.stringify(["one", "two"]));
    const removeSecureItem = vi.fn(async (key: string) => {
      if (key.includes("two")) throw new Error("remove failed");
    });

    await cleanupRemovedServerProfiles({ isNativePlatform: () => true, removeSecureItem });

    expect(removeSecureItem).toHaveBeenCalledWith("serverAccount.one.v1");
    expect(removeSecureItem).toHaveBeenCalledWith("serverAccount.two.v1");
    expect(localStorage.getItem("glean-profile-credential-index-v1")).toBe(JSON.stringify(["one", "two"]));
  });
});
