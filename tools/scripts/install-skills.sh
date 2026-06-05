#!/usr/bin/env bash
# tools/scripts/install-skills.sh
#
# Restore 17 skills cho project (sau fresh clone hoặc wipe .claude/skills/).
# Project-scope only — KHÔNG dùng -g. Cài vào .claude/skills/<name>/
# rồi commit lên git (git track, team khác tự động có).
#
# Usage:
#   bash tools/scripts/install-skills.sh
#   bash tools/scripts/install-skills.sh --dry-run
#
# Idempotent: npx skills add skip nếu folder đã tồn tại.
# Source of truth: tools/scripts/skills-manifest.json (cùng folder).

set -euo pipefail

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$SCRIPT_DIR/skills-manifest.json"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_DIR="$PROJECT_ROOT/.claude/skills"

if [ ! -f "$MANIFEST" ]; then
  echo "✗ Manifest không tồn tại: $MANIFEST"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "✗ .claude/skills/ không tồn tại ở $PROJECT_ROOT"
  echo "  Tạo trước: mkdir -p .claude/skills"
  exit 1
fi

# Check jq
if ! command -v jq >/dev/null 2>&1; then
  echo "✗ jq chưa cài. Cài: brew install jq"
  exit 1
fi

TOTAL=$(jq '.skills | length' "$MANIFEST")
echo "→ Cài $TOTAL skills vào $TARGET_DIR (project scope)"
[ "$DRY_RUN" = true ] && echo "  [DRY-RUN] chỉ liệt kê, không chạy npx"
echo

FAILED=()
SKIPPED=()
INSTALLED=()

for i in $(seq 0 $((TOTAL - 1))); do
  name=$(jq -r ".skills[$i].name" "$MANIFEST")
  spec=$(jq -r ".skills[$i].spec" "$MANIFEST")

  if [ -d "$TARGET_DIR/$name" ] && [ -f "$TARGET_DIR/$name/SKILL.md" ]; then
    SKIPPED+=("$name")
    echo "  ⊙ $name (đã có, skip)"
    continue
  fi

  echo "  ▸ $name  ←  $spec"
  if [ "$DRY_RUN" = true ]; then
    continue
  fi

  if npx skills add "$spec" -y >/dev/null 2>&1; then
    INSTALLED+=("$name")
  else
    FAILED+=("$name ($spec)")
  fi
done

echo
echo "── Tổng kết ──"
echo "  Đã có sẵn: ${#SKIPPED[@]}"
echo "  Mới cài:   ${#INSTALLED[@]}"
echo "  Thất bại:  ${#FAILED[@]}"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo
  echo "✗ Thất bại (verify spec trên https://skills.sh/):"
  printf '  - %s\n' "${FAILED[@]}"
  exit 1
fi

if [ "$DRY_RUN" = true ]; then
  echo
  echo "Dry-run xong. Chạy lại không có --dry-run để cài thật."
else
  echo
  echo "Verify:"
  echo "  ls .claude/skills/ | wc -l     # expect 17"
  echo "  git add .claude/skills/ && git commit -m 'chore: refresh skill manifest'"
fi
