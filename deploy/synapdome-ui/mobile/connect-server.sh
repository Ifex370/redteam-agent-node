#!/usr/bin/env bash
set -euo pipefail
# Run on the emulator Mac. Server ports bind only to loopback.
HOST="${1:?Usage: connect-server.sh user@host /path/to/key}"
KEY="${2:?Supply the deployment SSH key path}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
"$SDK/platform-tools/adb" -s emulator-5554 get-state
"$SDK/platform-tools/adb" -s emulator-5554 forward tcp:27044 tcp:27042
exec ssh -N -T -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -R 127.0.0.1:15037:127.0.0.1:5037 \
  -R 127.0.0.1:27044:127.0.0.1:27044 "$HOST"
