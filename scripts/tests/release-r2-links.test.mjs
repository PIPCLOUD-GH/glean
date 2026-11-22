import assert from "node:assert/strict";
import test from "node:test";
import { trustedMirrorNames, releaseDownloadLinks } from "../release-r2-links.mjs";

const tag = "v1.5.5";
const version = tag.slice(1);
const names = [
  "Glean-" + version + "-setup.exe",
  "Glean-" + version + "-arm64.dmg",
  "Glean-" + version + "-x64.dmg",
  "Glean-" + version + "-x86_64.AppImage",
  "Glean-" + version + "-amd64.deb",
  "Glean-" + version + ".apk",
  "glean-" + version + "-fpk-r1.fpk",
  "glean-clipper-0.5.0-edge.zip",
  "glean-clipper-0.5.0-firefox.zip",
  "glean-clipper-0.5.0.zip"
];
const extra = [
  "amd64_io.glean.note_1.5.5.0001.upk",
  "Glean-1.5.5-portable.exe",
  "Glean-1.5.5.aab"
];

const release = {
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: [...names,...extra].map((name,i)=>({
    name, size: 1000+i, browser_download_url:
      "https://github.com/PIPCLOUD-GH/glean/releases/download/" + tag + "/" + encodeURIComponent(name)
  }))
};
const manifest = {schema:1,version:tag,assets:names.map(name=>{
  const {size}=release.assets.find(asset=>asset.name===name);
  return {name,size};
})};

test("Gitee lists mirrored installers with GitHub backups and leaves UPK on GitHub", () => {
  assert.equal(trustedMirrorNames(release,manifest).size,10);
  const md=releaseDownloadLinks(release,manifest);
  for(const name of names) {
    assert.ok(md.includes("https://download.glean.example.com/"+tag+"/"+name),name);
    assert.ok(md.includes("https://github.com/PIPCLOUD-GH/glean/releases/download/"+tag+"/"+name),name);
  }
  for(const name of extra) {
    assert.ok(md.includes("https://github.com/PIPCLOUD-GH/glean/releases/download/"+tag+"/"+name));
    assert.ok(!md.includes("https://download.glean.example.com/"+tag+"/"+name));
  }
});

test("Missing, invalid, stale or tampered manifest never generates guessed R2 URLs", () => {
  const candidates=[
    {},
    {...manifest,version:"v1.5.6"},
    {...manifest,assets:manifest.assets.slice(1)},
    {...manifest,assets:manifest.assets.map((a,i)=>i===0?{...a,size:a.size+1}:a)},
    {...manifest,assets:manifest.assets.map((a,i)=>i===0?{...a,name:"amd64_io.glean.note_1.5.5.0001.upk"}:a)},
    {...manifest,assets:manifest.assets.map((a,i)=>i===0?manifest.assets[1]:a)}
  ];
  for(const invalid of candidates) {
    assert.equal(trustedMirrorNames(release,invalid).size,0);
    assert.ok(!releaseDownloadLinks(release,invalid).includes("https://download.glean.example.com/"));
  }
});

test("Never trust malicious GitHub URL or release asset names", () => {
  const poisoned = {...release,assets:[...release.assets,{
    name:"evil].zip",size:4000,browser_download_url:"https://evil.test/bad.zip"
  }]};
  assert.ok(!releaseDownloadLinks(poisoned,manifest).includes("evil.test"));
});
