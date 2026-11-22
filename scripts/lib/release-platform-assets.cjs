function normalizeVersion(version) {
  return String(version || "").replace(/^v/, "").trim();
}

function requiredMacReleaseAssets(version) {
  const normalized = normalizeVersion(version);
  if (!normalized) throw new Error("release version is required");
  return [
    `Glean-${normalized}-x64.dmg`,
    `Glean-${normalized}-arm64.dmg`,
    `Glean-${normalized}-x64.zip`,
    `Glean-${normalized}-arm64.zip`,
    "latest-mac.yml",
  ];
}

function findMissingMacReleaseAssets(assetNames, version) {
  const available = new Set(Array.from(assetNames || [], (name) => String(name)));
  return requiredMacReleaseAssets(version).filter((name) => !available.has(name));
}

function assertCompleteMacReleaseAssets(assetNames, version, source = "macOS release assets") {
  const missing = findMissingMacReleaseAssets(assetNames, version);
  if (missing.length > 0) {
    throw new Error(`${source} incomplete; missing: ${missing.join(", ")}`);
  }
  return requiredMacReleaseAssets(version);
}

function isMacManualDownloadZip(name) {
  return /^Glean-\d+\.\d+\.\d+(?:-[A-Za-z0-9._-]+)?-(?:x64|arm64)\.zip$/i.test(String(name || ""));
}

function requiredDebugReleaseAssets(platform, version) {
  const normalized = normalizeVersion(version);
  if (!normalized) throw new Error("release version is required");
  if (platform === "macos") return requiredMacReleaseAssets(normalized);
  if (platform === "windows") return [
    `Glean-${normalized}-setup.exe`,
    `Glean-${normalized}-portable.exe`,
    `Glean-${normalized}-setup.exe.blockmap`,
    "latest.yml",
  ];
  if (platform === "linux") return [
    `Glean-${normalized}-x86_64.AppImage`,
    `Glean-${normalized}-amd64.deb`,
    "latest-linux.yml",
  ];
  throw new Error("unsupported debug platform");
}

module.exports = {
  assertCompleteMacReleaseAssets,
  findMissingMacReleaseAssets,
  isMacManualDownloadZip,
  requiredMacReleaseAssets,
  requiredDebugReleaseAssets,
};
