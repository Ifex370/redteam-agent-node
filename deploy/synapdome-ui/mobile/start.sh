#!/usr/bin/env bash
set -euo pipefail
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
python3 "$(dirname "$0")/verify-sdk.py" "$SDK"
exec "$SDK/emulator/emulator" -avd SynapDome_Pixel_API35 -port 5554 -no-metrics -camera-back none -camera-front none
