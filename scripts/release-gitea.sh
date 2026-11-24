#!/bin/bash
# Glean 一键发版（Linux 主打包机）：整包（NSIS setup + portable）+ 热更新包 → Gitea Release
#
# 用法：
#   bash scripts/release-gitea.sh [--tag v01.01.01] [--skip-upload]
#
# 前置（一次性准备，2026-11-24 已在打包机就位）：
#   1. Node 24+，根/backend/frontend 依赖已装（backend 用 npm install --ignore-scripts）
#   2. wine64 + /usr/local/bin/wine wrapper（内容为 exec /opt/wine/bin/wine64 "$@"，
#      electron-builder 注入 exe 资源用；注意 wrapper 不能是符号链接）
#   3. win32 原生产物备份目录 GLEAN_WIN32_NATIVE_DIR（默认 $HOME/glean-win32-native）：
#      better_sqlite3.node、.electron-abi.json、sharp-win32-x64/、ffmpeg-win32-x64.exe
#   4. 热更新私钥 GLEAN_HOT_UPDATE_PRIVATE_KEY_FILE（默认 $HOME/glean-secrets/glean-hot-update-private.pem，600）
#   5. Gitea token：环境变量 GITEA_TOKEN 或文件 GITEA_TOKEN_FILE（默认 $HOME/glean-secrets/glean-gitea-token）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NATIVE_DIR="${GLEAN_WIN32_NATIVE_DIR:-$HOME/glean-win32-native}"
KEY_FILE="${GLEAN_HOT_UPDATE_PRIVATE_KEY_FILE:-$HOME/glean-secrets/glean-hot-update-private.pem}"
GITEA_TOKEN_FILE="${GITEA_TOKEN_FILE:-$HOME/glean-secrets/glean-gitea-token}"
GITEA_URL="${GITEA_URL:-https://127.0.0.1:3080}"
GITEA_REPO="${GITEA_REPO:-pipcloud/glean}"
TAG=""
SKIP_UPLOAD=0
UPLOAD_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    --skip-upload) SKIP_UPLOAD=1; shift ;;
    --upload-only) UPLOAD_ONLY=1; shift ;;
    *) echo "未知参数：$1" >&2; exit 1 ;;
  esac
done

export PATH=/usr/local/bin:$PATH
export WINEDEBUG=-all
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
export NODE_OPTIONS=--max-old-space-size=8192

echo '=== 预检 ==='
command -v node >/dev/null || { echo '缺少 node'; exit 1; }
command -v wine >/dev/null || { echo '缺少 wine（需 /usr/local/bin/wine wrapper 指向 wine64）'; exit 1; }
grep -q wine64 "$(command -v wine)" 2>/dev/null || { echo 'wine 不是 wine64 wrapper，32 位 PE 会失败'; exit 1; }
for f in better_sqlite3.node .electron-abi.json ffmpeg-win32-x64.exe; do
  [ -f "$NATIVE_DIR/$f" ] || { echo "缺少原生产物：$NATIVE_DIR/$f" >&2; exit 1; }
done
[ -d "$NATIVE_DIR/sharp-win32-x64" ] || { echo "缺少原生产物：$NATIVE_DIR/sharp-win32-x64" >&2; exit 1; }
[ -f "$KEY_FILE" ] || { echo "缺少热更新私钥：$KEY_FILE" >&2; exit 1; }
GITEA_TOKEN="${GITEA_TOKEN:-$(cat "$GITEA_TOKEN_FILE" 2>/dev/null || true)}"
if [ "$SKIP_UPLOAD" -eq 0 ] && [ -z "$GITEA_TOKEN" ]; then
  echo "缺少 GITEA_TOKEN（环境变量或 $GITEA_TOKEN_FILE）" >&2
  exit 1
fi
echo '[release] 预检通过'

if [ "$UPLOAD_ONLY" -eq 1 ]; then
  echo '[release] --upload-only：跳过构建与热更新'
else
echo '=== NSIS 卸载器提取补丁（幂等） ==='
# electron-builder 在非 macOS 上用 wine 跑 32 位安装器提取卸载器必挂（wine64 只能跑 64 位 PE）；
# 改走纯 JS UninstallerReader，等价 macOS 分支行为。
node <<'PATCH_JS'
const fs = require("fs");
const p = "node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js";
const a = "if ((0, macosVersion_1.isMacOsCatalina)()) {";
const b = "if (process.platform !== \"win32\") {";
const s = fs.readFileSync(p, "utf8");
if (s.includes(a)) {
  fs.writeFileSync(p, s.replace(a, b));
  console.log("[release] NsisTarget 补丁已应用");
} else if (s.includes(b)) {
  console.log("[release] NsisTarget 补丁已存在");
} else {
  console.error("[release] NsisTarget.js 补丁锚点未找到，上游结构可能已变化");
  process.exit(1);
}
PATCH_JS

echo '=== win32 原生产物就位 ==='
mkdir -p backend/node_modules/better-sqlite3/build/Release backend/node_modules/@img backend/node_modules/ffmpeg-static
cp "$NATIVE_DIR/better_sqlite3.node" backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node
cp "$NATIVE_DIR/.electron-abi.json" backend/node_modules/better-sqlite3/build/Release/.electron-abi.json
rm -rf backend/node_modules/@img/sharp-win32-x64
cp -r "$NATIVE_DIR/sharp-win32-x64" backend/node_modules/@img/sharp-win32-x64
rm -f backend/node_modules/ffmpeg-static/ffmpeg
cp "$NATIVE_DIR/ffmpeg-win32-x64.exe" backend/node_modules/ffmpeg-static/ffmpeg.exe

echo '=== rebuild-native（win32 交叉） ==='
node scripts/rebuild-native.mjs --target-platform=win32 --target-arch=x64

echo '=== build:all ==='
npm run build:all

echo '=== electron-builder --win ==='
rm -rf dist-electron
npx electron-builder --config electron/builder.config.js --win --publish never

echo '=== 整包元数据校验 ==='
node build/verifyUpdateArtifactsCli.js dist-electron

echo '=== 热更新包（build-bundles → sign → verify） ==='
rm -rf release-hot
node scripts/hot-update/build-bundles.mjs --out release-hot
GLEAN_HOT_UPDATE_PRIVATE_KEY="$(cat "$KEY_FILE")" node scripts/hot-update/sign.mjs --dir release-hot
VER=$(node -p "require('./package.json').version")
node scripts/hot-update/verify.mjs --dir release-hot --version "$VER"

echo '=== 产物 ==='
ls -la dist-electron release-hot

fi  # UPLOAD_ONLY

if [ "$SKIP_UPLOAD" -eq 1 ]; then
  echo '[release] --skip-upload，流程结束'
  exit 0
fi

[ -n "$TAG" ] || TAG=$(git describe --tags --abbrev=0)
echo "=== 上传 Gitea Release：$TAG ==="
# 用 curl -F 上传；表单字段名必须是 attachment（Gitea 28.x swagger 定义，旧资料写的 file 会 500 no such file）；内网自签名证书用 -k。
API="$GITEA_URL/api/v1/repos/$GITEA_REPO"
AUTH=(-H "Authorization: token $GITEA_TOKEN")
json_field() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d)[process.argv[1]]||"")}catch{console.log("")}})' "$1"
}

REL_ID=$(curl -ksS "${AUTH[@]}" "$API/releases/tags/$TAG" | json_field id)
if [ -z "$REL_ID" ]; then
  HEAD=$(git rev-parse HEAD)
  REL_ID=$(curl -ksS "${AUTH[@]}" -H 'Content-Type: application/json' \
    -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\",\"target_commitish\":\"$HEAD\"}" \
    "$API/releases" | json_field id)
  [ -n "$REL_ID" ] || { echo '[upload] 创建 release 失败' >&2; exit 1; }
  echo "[upload] 已创建 release $TAG (#$REL_ID)"
fi

for dir in dist-electron release-hot; do
  [ -d "$dir" ] || continue
  for file in "$dir"/*; do
    [ -f "$file" ] || continue
    name=$(basename "$file")
    case "$name" in
      *setup.exe|*portable.exe|*.blockmap|latest.yml|glean-hot-*.zip|glean-hot-*.json) ;;
      *) continue ;;
    esac
    old=$(curl -ksS "${AUTH[@]}" "$API/releases/$REL_ID/assets" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=(JSON.parse(d)||[]).find(x=>x.name===process.argv[1]);console.log(a?a.id:"")}catch{console.log("")}})' "$name")
    if [ -n "$old" ]; then
      curl -ksS -f "${AUTH[@]}" -X DELETE "$API/releases/$REL_ID/assets/$old" >/dev/null
      echo "[upload] 删除旧资产 $name"
    fi
    curl -ksS -f "${AUTH[@]}" -F "attachment=@$file;filename=$name" \
      "$API/releases/$REL_ID/assets?name=$name" >/dev/null
    echo "[upload] $name"
  done
done

echo "[upload] done -> $GITEA_URL/$GITEA_REPO/releases/tag/$TAG"
echo '[release] 全部完成'
