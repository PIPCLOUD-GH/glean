#!/bin/bash
# Gitea Release 资产 → GitHub Release 同步（幂等，可重复执行）
#
# 用法：
#   bash scripts/gh-release-sync.sh [--tag v01.00.00]   # 缺省取 git describe --tags --abbrev=0
#
# 前置（一次性准备，2026-11-25 已在打包机就位）：
#   1. Gitea token 文件：GITEA_TOKEN_FILE（默认 $HOME/glean-secrets/glean-gitea-token）
#   2. GitHub token 文件：GH_TOKEN_FILE（默认 $HOME/glean-secrets/github-token），
#      须含 repo + workflow scope（仓库含 .github/workflows/，缺 workflow 会被 GitHub 拒推）
#   3. 同步目标：GH_REPO（默认 pipcloudlab/glean）
#   4. python3（清单比对）；打包机内网到 uploads.github.com 约 1~2.6MB/s
#
# 原理（以 Gitea 为单一事实源，按 资产名+尺寸 对齐）：
#   同名同尺寸跳过；同名异尺寸先删后传；GitHub 多出的资产删除；缺的补传。
#   下载走 Gitea web 路径——API /releases/assets/{id} 在 Gitea 28.x 返回 404 错误页
#   （19 字节），会把错误页当文件传上去，故下载后强制校验尺寸 == Gitea 清单尺寸。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GITEA_TOKEN_FILE="${GITEA_TOKEN_FILE:-$HOME/glean-secrets/glean-gitea-token}"
GH_TOKEN_FILE="${GH_TOKEN_FILE:-$HOME/glean-secrets/github-token}"
GITEA_URL="${GITEA_URL:-https://127.0.0.1:3080}"
GITEA_REPO="${GITEA_REPO:-pipcloudlab/glean}"
GH_REPO="${GH_REPO:-pipcloudlab/glean}"

TAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="$2"; shift 2 ;;
    *) echo "未知参数：$1" >&2; exit 1 ;;
  esac
done
[ -n "$TAG" ] || TAG=$(git describe --tags --abbrev=0)

GITEA_TOKEN="${GITEA_TOKEN:-$(cat "$GITEA_TOKEN_FILE" 2>/dev/null || true)}"
# GitHub token 可能被 Windows 侧写入 CRLF，去掉 \r\n
GH_TOKEN="${GH_TOKEN:-$(tr -d '\r\n' < "$GH_TOKEN_FILE" 2>/dev/null || true)}"
[ -n "$GITEA_TOKEN" ] || { echo "[gh-sync] 缺少 GITEA_TOKEN（$GITEA_TOKEN_FILE）" >&2; exit 1; }
[ -n "$GH_TOKEN" ] || { echo "[gh-sync] 缺少 GH_TOKEN（$GH_TOKEN_FILE，须含 repo+workflow scope）" >&2; exit 1; }

GA="$GITEA_URL/api/v1/repos/$GITEA_REPO"
GAPI="https://api.github.com"
UP="https://uploads.github.com"
W="$(mktemp -d /tmp/gh-release-sync.XXXXXX)"
trap 'rm -rf "$W"' EXIT

echo "[gh-sync] $GITEA_REPO@$TAG -> github.com/$GH_REPO"

# 1) Gitea 资产清单 + GitHub release payload（name/body 取自 Gitea）
curl -ksS -H "Authorization: token $GITEA_TOKEN" "$GA/releases/tags/$TAG" -o "$W/gt.json"
python3 - "$W/gt.json" "$W" "$TAG" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); w, tag = sys.argv[2], sys.argv[3]
if "assets" not in d:
    print(f"[gh-sync] Gitea release 不存在: {d.get('message','')}", file=sys.stderr)
    sys.exit(1)
json.dump({"tag_name": tag, "name": d.get("name") or tag, "body": d.get("body") or "",
           "draft": False, "prerelease": False}, open(f"{w}/payload.json", "w"))
print(f"[gh-sync] Gitea 资产 {len(d['assets'])} 个，共 {sum(a['size'] for a in d['assets'])/1048576:.1f} MB")
PY

# 2) 确保 GitHub release 存在（422=已存在则按 tag 取回）
CODE=$(curl -sS -o "$W/rel.json" -w "%{http_code}" -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" \
  -X POST "$GAPI/repos/$GH_REPO/releases" --data @"$W/payload.json")
if [ "$CODE" != "201" ]; then
  curl -sS -H "Authorization: Bearer $GH_TOKEN" "$GAPI/repos/$GH_REPO/releases/tags/$TAG" -o "$W/rel.json"
fi
REL_ID=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('id',''))" "$W/rel.json")
[ -n "$REL_ID" ] || { echo "[gh-sync] GitHub release 创建/查询失败: $(head -c 300 "$W/rel.json")" >&2; exit 1; }
echo "[gh-sync] GitHub release id=$REL_ID"

# 3) 比对两侧 → 删除清单 + 上传清单（todo 格式：尺寸 名称）
curl -sS -H "Authorization: Bearer $GH_TOKEN" "$GAPI/repos/$GH_REPO/releases/$REL_ID" -o "$W/gh.json"
python3 - "$W/gt.json" "$W/gh.json" "$W" <<'PY'
import json, sys
gt = json.load(open(sys.argv[1])); gh = json.load(open(sys.argv[2])); w = sys.argv[3]
gt_map = {a["name"]: a["size"] for a in gt["assets"]}
gh_map = {a["name"]: a for a in gh.get("assets", [])}
to_del = [a for a in gh.get("assets", []) if a["name"] not in gt_map or gt_map[a["name"]] != a["size"]]
todo = [(a["size"], a["name"]) for a in gt["assets"]
        if a["name"] not in gh_map or gh_map[a["name"]]["size"] != a["size"]]
skip = len(gt_map) - len(todo)
open(f"{w}/del.txt", "w").write("".join(f"{a['id']} {a['name']}\n" for a in to_del))
open(f"{w}/todo.txt", "w").write("".join(f"{s} {n}\n" for s, n in todo))
print(f"[gh-sync] skip={skip} delete={len(to_del)} upload={len(todo)}")
PY

# 4) 删多余/异尺寸资产
while read -r ID NAME; do
  if [ -z "$ID" ]; then continue; fi
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GH_TOKEN" \
    -X DELETE "$GAPI/repos/$GH_REPO/releases/assets/$ID")
  echo "[gh-sync] DEL $NAME -> $CODE"
done < "$W/del.txt"

# 5) 补传：Gitea web 路径下载 → 尺寸校验 → uploads.github.com 上传
FAILED=0
while read -r ASIZE NAME; do
  if [ -z "$NAME" ]; then continue; fi
  EN=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$NAME")
  CODE=$(curl -ksSL -o "$W/dl.tmp" -w "%{http_code}" -H "Authorization: token $GITEA_TOKEN" \
    --connect-timeout 10 "$GITEA_URL/$GITEA_REPO/releases/download/$TAG/$EN")
  SZ=$(stat -c%s "$W/dl.tmp" 2>/dev/null || echo 0)
  if [ "$CODE" != "200" ] || [ "$SZ" != "$ASIZE" ]; then
    echo "[gh-sync] FAIL_DL $NAME http=$CODE got=$SZ want=$ASIZE"
    FAILED=1; rm -f "$W/dl.tmp"; continue
  fi
  RES=$(curl -sS -o "$W/up.out" -w "%{http_code}" --connect-timeout 10 \
    -H "Authorization: Bearer $GH_TOKEN" -H "Content-Type: application/octet-stream" \
    --data-binary @"$W/dl.tmp" "$UP/repos/$GH_REPO/releases/$REL_ID/assets?name=$EN")
  if [ "$RES" = "201" ] || [ "$RES" = "200" ]; then
    echo "[gh-sync] UP $NAME ($(( ASIZE / 1048576 ))MB) -> $RES"
  else
    echo "[gh-sync] FAIL_UP $NAME -> $RES $(head -c 200 "$W/up.out")"
    FAILED=1
  fi
  rm -f "$W/dl.tmp"
done < "$W/todo.txt"

# 6) 终验：Gitea 每个资产在 GitHub 侧名+尺寸全对齐
curl -sS -H "Authorization: Bearer $GH_TOKEN" "$GAPI/repos/$GH_REPO/releases/$REL_ID" -o "$W/final.json"
VERIFY=$(python3 - "$W/gt.json" "$W/final.json" <<'PY'
import json, sys
gt = json.load(open(sys.argv[1])); gh = json.load(open(sys.argv[2]))
gm = {a["name"]: a["size"] for a in gh.get("assets", [])}
bad = [a["name"] for a in gt["assets"] if gm.get(a["name"]) != a["size"]]
print("OK" if not bad else "BAD " + ";".join(bad))
PY
)
if [ "$VERIFY" = "OK" ] && [ "$FAILED" -eq 0 ]; then
  echo "[gh-sync] ALL_SYNCED -> https://github.com/$GH_REPO/releases/tag/$TAG"
else
  echo "[gh-sync] SYNC_INCOMPLETE: $VERIFY（幂等，可直接重跑本脚本）" >&2
  exit 1
fi
