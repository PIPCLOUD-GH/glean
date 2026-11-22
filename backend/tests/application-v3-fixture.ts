import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

export const exampleDirectory = fileURLToPath(new URL("../../examples/plugins/hello-glean-app/", import.meta.url));
export const V3_GATES = ["GLEAN_EXTENSIONS_V21", "GLEAN_UI_EXTENSIONS", "GLEAN_UI_LAYOUT_EDITOR", "GLEAN_SANDBOXED_PLUGIN_UI", "GLEAN_EXTENSION_V3_CORE", "GLEAN_EXTENSION_V3_APP_PAGES"];
export async function examplePackage(id = "gleanlab.hello-app") {
  const manifest = JSON.parse(fs.readFileSync(path.join(exampleDirectory, "manifest.json"), "utf8")); manifest.id = id;
  const zip = new JSZip(); zip.file("manifest.json", JSON.stringify(manifest));
  for (const file of Object.keys(manifest.contributes.uiAssets)) zip.file(file, fs.readFileSync(path.join(exampleDirectory, file)));
  return zip.generateAsync({ type: "nodebuffer" });
}
