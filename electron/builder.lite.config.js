/**
 * Stable release wrapper around the Lite desktop builder configuration.
 *
 * Lite uses an explicit latest-lite channel so release.sh can collect the
 * metadata without mixing it with the full latest channel.
 */
const base = require("./builder.lite.base.config.js");

const { artifactName: _legacyWindowsArtifactName, ...baseWin } = base.win || {};
const win = {
  ...baseWin,
};

module.exports = {
  ...base,
  artifactBuildCompleted: require("../scripts/lib/macos-update-runtime.cjs"),
  publish: (base.publish || []).map((provider) => ({
    ...provider,
    channel: "latest-lite",
  })),
  files: [
    ...(Array.isArray(base.files) ? base.files : []),
    "!electron/builder.base.config.js",
    "!electron/builder.lite.base.config.js",
  ],
  win,
  nsis: {
    ...(base.nsis || {}),
    artifactName: "Glean-Lite-${version}-setup.${ext}",
  },
  portable: {
    ...(base.portable || {}),
    artifactName: "Glean-Lite-${version}-portable.${ext}",
  },
  mac: {
    ...(base.mac || {}),
    artifactName: "Glean-Lite-${version}-${arch}.${ext}",
  },
  dmg: {
    ...(base.dmg || {}),
    artifactName: "Glean-Lite-${version}-${arch}.${ext}",
  },
  linux: {
    ...(base.linux || {}),
    artifactName: "Glean-Lite-${version}-${arch}.${ext}",
  },
  appImage: {
    ...(base.appImage || {}),
    artifactName: "Glean-Lite-${version}-${arch}.${ext}",
  },
};
