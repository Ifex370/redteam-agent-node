#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?Usage: prepare.sh /absolute/new-checkout}"
[ ! -e "$DEST" ] || { echo 'Destination already exists; choose a new release directory.' >&2; exit 1; }
command -v bun >/dev/null
[ "$(bun --version)" = 1.3.9 ] || { echo 'Install Bun 1.3.9 first.' >&2; exit 1; }
git clone --no-checkout https://github.com/CyberStrikeus/CyberStrike.git "$DEST"
git -C "$DEST" checkout --detach 2bda675b68c8f81412267a5b331b74539e2d4e19
git -C "$DEST" apply --check "$ROOT/patches/laptop-implementation.patch"
git -C "$DEST" apply "$ROOT/patches/laptop-implementation.patch"
git -C "$DEST" apply --check "$ROOT/patches/session-storage.patch"
git -C "$DEST" apply "$ROOT/patches/session-storage.patch"
cp "$ROOT/assets/synapdome-logo.png" "$DEST/packages/app/public/"
cp "$ROOT/assets/synapdome.json" "$DEST/packages/ui/src/theme/themes/"
cd "$DEST"
bun install --frozen-lockfile
cd packages/app
bun run typecheck
bun run build
printf '\nPrepared release: %s\n' "$DEST"
