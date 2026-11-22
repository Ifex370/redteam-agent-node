#!/usr/bin/env bash
set -euo pipefail
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
OUT="${1:?Usage: export-sdk.sh /private/path/android-sdk-baseline.tar.gz}"
[ ! -e "$OUT" ] || { echo 'Archive already exists.' >&2; exit 1; }
python3 "$(dirname "$0")/verify-sdk.py" "$SDK"
umask 077
# Only SDK tooling/system images. Excludes .android, AVD userdata, apps, accounts and keys.
tar -czf "$OUT" -C "$SDK" emulator platform-tools cmdline-tools system-images/android-35/google_apis/arm64-v8a
shasum -a 256 "$OUT" > "$OUT.sha256"
echo 'Store archive and checksum in your private artifact store, subject to Android SDK licensing. Never commit them.'
