#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME_PATH="${CODEX_HOME:-$HOME/.codex}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --codex-home)
      CODEX_HOME_PATH="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_ROOT="$REPO_ROOT/agents/codex/skills"
TARGET_ROOT="$CODEX_HOME_PATH/skills"

if [[ ! -d "$SOURCE_ROOT" ]]; then
  echo "Source skill directory not found: $SOURCE_ROOT" >&2
  exit 1
fi

mkdir -p "$TARGET_ROOT"

for src in "$SOURCE_ROOT"/*; do
  [[ -d "$src" ]] || continue
  name="$(basename "$src")"
  dst="$TARGET_ROOT/$name"
  rm -rf "$dst"
  cp -R "$src" "$dst"
  echo "Synced skill: $name"
done

echo "Done. Skills synced to $TARGET_ROOT"

