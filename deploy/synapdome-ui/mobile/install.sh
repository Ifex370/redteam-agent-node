#!/usr/bin/env bash
set -euo pipefail
# This reproduces the proven Apple Silicon lab. Do not silently substitute x86 Android.
[ "$(uname -s):$(uname -m)" = 'Darwin:arm64' ] || { echo 'The proven image requires an Apple Silicon runner. Use connect-server.sh from that runner; qualify Linux emulation separately.' >&2; exit 1; }
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
[ -x "$SDKMANAGER" ] || { echo 'Install official Android command-line tools and set ANDROID_SDK_ROOT first.' >&2; exit 1; }
# Interactive licensing is intentional. No license acceptance is automated.
"$SDKMANAGER" --sdk_root="$SDK" --licenses
if [ ! -f "$SDK/emulator/source.properties" ] || [ ! -f "$SDK/platform-tools/source.properties" ] || [ ! -f "$SDK/system-images/android-35/google_apis/arm64-v8a/source.properties" ]; then
  "$SDKMANAGER" --sdk_root="$SDK" 'platform-tools' 'emulator' 'system-images;android-35;google_apis;arm64-v8a'
fi
python3 "$(dirname "$0")/verify-sdk.py" "$SDK"
AVD=SynapDome_Pixel_API35
if [ -f "$HOME/.android/avd/$AVD.ini" ]; then
  echo 'Existing AVD preserved. Version checks passed; no device data changed.'
else
  printf 'no\n' | "$SDK/cmdline-tools/latest/bin/avdmanager" create avd --name "$AVD" --package 'system-images;android-35;google_apis;arm64-v8a' --device pixel_7
  python3 - "$HOME/.android/avd/$AVD.avd/config.ini" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); data=dict(line.split('=',1) for line in p.read_text().splitlines() if '=' in line)
data.update({'hw.ramSize':'2G','hw.cpu.ncore':'4','hw.gpu.enabled':'no','hw.gpu.mode':'auto','vm.heapSize':'228M','disk.dataPartition.size':'10G'})
p.write_text(''.join(k+'='+v+'\n' for k,v in data.items()))
PY
fi
python3 -m venv "${FRIDA_VENV:-$HOME/.local/share/synapdome-frida}"
"${FRIDA_VENV:-$HOME/.local/share/synapdome-frida}/bin/python" -m pip install 'frida==17.8.2' 'frida-tools==14.6.0'
echo 'Ready. Run start.sh, then provision-frida.sh. Install test APKs separately.'
