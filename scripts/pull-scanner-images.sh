#!/usr/bin/env bash
# Pull the exact references declared by current adapters; does not run scans.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---pull}"
case "$MODE" in --list|--pull) ;; *) echo 'Usage: pull-scanner-images.sh [--list|--pull]' >&2; exit 2;; esac
IMAGES="$(python3 - "$ROOT" <<'PY'
import re,sys
from pathlib import Path
root=Path(sys.argv[1])
images=set()
for path in (root/'src/tools').glob('*.ts'):
    images.update(re.findall(r'const \w+Image = "([^"]+)";',path.read_text()))
if not images:
    raise SystemExit('No scanner images found; inspect source before deploying.')
print('\n'.join(sorted(images)))
PY
)"
if [ "$MODE" = --list ]; then printf '%s\n' "$IMAGES"; exit 0; fi
command -v docker >/dev/null
docker info >/dev/null
REPORT="${SCANNER_IMAGE_REPORT:-$ROOT/scanner-images-resolved.txt}"
umask 077
: > "$REPORT"
while IFS= read -r image; do
  docker pull "$image"
  docker image inspect --format '{{json .RepoTags}} {{json .RepoDigests}}' "$image" >> "$REPORT"
done <<< "$IMAGES"
printf 'Resolved image references written to %s\n' "$REPORT"
printf 'Review floating tags and validate each scanner before production use.\n'
