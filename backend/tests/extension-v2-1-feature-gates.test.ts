import assert from "node:assert/strict";
import test from "node:test";
import { getExtensionPlatformFeatureFlags } from "../src/plugins/featureFlags";
import { EXTENSION_V21_TARGET_GLEAN_VERSION, GLEAN_VERSION } from "../src/plugins/types";

const KEYS = [
  "GLEAN_EXTENSIONS_V21",
  "GLEAN_PLUGIN_STUDIO",
  "GLEAN_UI_EXTENSIONS",
  "GLEAN_UI_LAYOUT_EDITOR",
  "GLEAN_SANDBOXED_PLUGIN_UI",
  "GLEAN_FILE_PROCESSING_EXTENSIONS",
  "GLEAN_EXPERIMENTAL_DOCUMENT_TYPES",
] as const;

function withEnv(values: Partial<Record<typeof KEYS[number], string>>, run: () => void): void {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    run();
  } finally {
    for (const key of KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("V2.1 feature gates fail closed by default", () => {
  withEnv({}, () => assert.deepEqual(getExtensionPlatformFeatureFlags(), {
    extensionsV21: false,
    pluginStudio: false,
    uiExtensions: false,
    uiLayoutEditor: false,
    sandboxedPluginUi: false,
    fileProcessingExtensions: false,
    experimentalDocumentTypes: false,
  }));
});

test("dependent V2.1 gates cannot bypass their parent capability", () => {
  withEnv({ GLEAN_PLUGIN_STUDIO: "true", GLEAN_FILE_PROCESSING_EXTENSIONS: "true", GLEAN_EXPERIMENTAL_DOCUMENT_TYPES: "true" }, () => {
    assert.deepEqual(getExtensionPlatformFeatureFlags(), {
      extensionsV21: false,
      pluginStudio: false,
      uiExtensions: false,
      uiLayoutEditor: false,
      sandboxedPluginUi: false,
      fileProcessingExtensions: false,
      experimentalDocumentTypes: false,
    });
  });
  withEnv({ GLEAN_EXTENSIONS_V21: "1", GLEAN_PLUGIN_STUDIO: "yes", GLEAN_UI_EXTENSIONS: "true", GLEAN_UI_LAYOUT_EDITOR: "on", GLEAN_SANDBOXED_PLUGIN_UI: "enabled", GLEAN_FILE_PROCESSING_EXTENSIONS: "on", GLEAN_EXPERIMENTAL_DOCUMENT_TYPES: "enabled" }, () => {
    assert.deepEqual(getExtensionPlatformFeatureFlags(), {
      extensionsV21: true,
      pluginStudio: true,
      uiExtensions: true,
      uiLayoutEditor: true,
      sandboxedPluginUi: true,
      fileProcessingExtensions: true,
      experimentalDocumentTypes: true,
    });
  });
});

test("1.5.3 host keeps the independent V2.1 compatibility target", () => {
  assert.equal(GLEAN_VERSION, "1.5.3");
  assert.equal(EXTENSION_V21_TARGET_GLEAN_VERSION, "1.6.0");
});
