const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MANUAL_DOWNLOAD_NOTICE,
  buildChannelFallbackError,
  buildDesktopFeed,
  buildReleaseDownloadUrl,
  isManualDownloadPlatform,
  isUpdateNetworkError,
  withManualDownloadNotice,
} = require("../../electron/updaterPolicy");

test("Windows and macOS use manual browser download policy", () => {
  assert.equal(isManualDownloadPlatform("darwin"), true);
  assert.equal(isManualDownloadPlatform("win32"), true);
  assert.equal(isManualDownloadPlatform("linux"), false);
});

test("GitHub 通道手动下载固定指向 latest 页", () => {
  // git tag 是补零格式（如 v01.00.01），按版本拼 tag/vX.Y.Z 会 404；
  // 而检查到更新后 latest 页必然存在，所以一律指向它。
  assert.equal(
    buildReleaseDownloadUrl("v1.4.6"),
    "https://github.com/PIPCLOUD-GH/glean/releases/latest",
  );
  assert.equal(
    buildReleaseDownloadUrl("invalid"),
    "https://github.com/PIPCLOUD-GH/glean/releases/latest",
  );
  assert.equal(
    buildReleaseDownloadUrl("1.0.1", "github", "win32", "x64"),
    "https://github.com/PIPCLOUD-GH/glean/releases/latest",
  );
});

test("自建通道直接给出 /latest/ 目录下的安装包地址", () => {
  assert.equal(
    buildReleaseDownloadUrl("1.0.1", "selfhosted", "win32", "x64"),
    "https://download.glean.pipcloud.cn/latest/Glean-1.0.1-setup.exe",
  );
  assert.equal(
    buildReleaseDownloadUrl("1.0.1", "selfhosted", "darwin", "arm64"),
    "https://download.glean.pipcloud.cn/latest/Glean-1.0.1-arm64.dmg",
  );
  assert.equal(
    buildReleaseDownloadUrl("invalid", "selfhosted", "win32", "x64"),
    "https://download.glean.pipcloud.cn/latest/",
  );
});

test("feed 配置按通道切换，GitHub 固定指向 PIPCLOUD-GH 仓库", () => {
  assert.deepEqual(buildDesktopFeed("github"), {
    provider: "github",
    owner: "PIPCLOUD-GH",
    repo: "glean",
    releaseType: "release",
  });
  assert.deepEqual(buildDesktopFeed("selfhosted"), {
    provider: "generic",
    url: "https://download.glean.pipcloud.cn/latest/",
  });
  // 缺省/未知取值按默认 GitHub 处理
  assert.deepEqual(buildDesktopFeed(undefined), buildDesktopFeed("github"));
});

test("双通道都失败时给出明确的网络或双源不可用提示", () => {
  const bothNetwork = buildChannelFallbackError(
    new Error("net::ERR_CONNECTION_RESET"),
    new Error("getaddrinfo ENOTFOUND download.glean.pipcloud.cn"),
  );
  assert.match(bothNetwork, /均无法访问，请检查网络/);
  const mixed = buildChannelFallbackError(
    new Error("HTTP 500"),
    new Error('Cannot find channel "latest.yml"'),
  );
  assert.match(mixed, /两个更新源均不可用/);
  assert.match(mixed, /latest\.yml/);
  assert.equal(isUpdateNetworkError(new Error("net::ERR_TIMED_OUT")), true);
  assert.equal(isUpdateNetworkError(new Error("Cannot find channel")), false);
});

test("manual download notice is prepended exactly once", () => {
  assert.equal(withManualDownloadNotice(""), MANUAL_DOWNLOAD_NOTICE);
  const value = withManualDownloadNotice("修复若干问题");
  assert.equal(value, `${MANUAL_DOWNLOAD_NOTICE}\n\n修复若干问题`);
  assert.equal(withManualDownloadNotice(value), value);
});
