#!/usr/bin/env bash
set -euo pipefail
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
SERIAL="${ADB_SERIAL:-emulator-5554}"
DIR="${FRIDA_CACHE:-$HOME/.cache/synapdome-frida}"
mkdir -p "$DIR"
"$ADB" -s "$SERIAL" get-state
[ "$("$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')" = arm64-v8a ] || { echo 'Device ABI does not match the ARM64 baseline.' >&2; exit 1; }
"$ADB" -s "$SERIAL" root
"$ADB" -s "$SERIAL" wait-for-device
[ "$("$ADB" -s "$SERIAL" shell id -u | tr -d '\r')" = 0 ] || { echo 'A rootable Google APIs image is required.' >&2; exit 1; }
if "$ADB" -s "$SERIAL" shell pidof frida-server >/dev/null; then
  [ "$("$ADB" -s "$SERIAL" shell /data/local/tmp/frida-server --version | tr -d '\r')" = 17.8.2 ] || { echo 'Running Frida differs from baseline; stop it deliberately before provisioning.' >&2; exit 1; }
  "$ADB" -s "$SERIAL" forward tcp:27044 tcp:27042
  exec "${FRIDA_VENV:-$HOME/.local/share/synapdome-frida}/bin/frida-ps" -H 127.0.0.1:27044
fi
FILE=frida-server-17.8.2-android-arm64
curl --fail --location --proto '=https' --tlsv1.2 "https://github.com/frida/frida/releases/download/17.8.2/$FILE.xz" -o "$DIR/$FILE.xz"
python3 - "$DIR/$FILE.xz" "$DIR/$FILE" <<'PY'
import lzma,sys
from pathlib import Path
Path(sys.argv[2]).write_bytes(lzma.decompress(Path(sys.argv[1]).read_bytes()))
PY
"$ADB" -s "$SERIAL" push "$DIR/$FILE" /data/local/tmp/frida-server
"$ADB" -s "$SERIAL" shell chmod 755 /data/local/tmp/frida-server
[ "$("$ADB" -s "$SERIAL" shell /data/local/tmp/frida-server --version | tr -d '\r')" = 17.8.2 ]
if ! "$ADB" -s "$SERIAL" shell pidof frida-server >/dev/null; then
  "$ADB" -s "$SERIAL" shell /data/local/tmp/frida-server -D
fi
"$ADB" -s "$SERIAL" forward tcp:27044 tcp:27042
"${FRIDA_VENV:-$HOME/.local/share/synapdome-frida}/bin/frida-ps" -H 127.0.0.1:27044
