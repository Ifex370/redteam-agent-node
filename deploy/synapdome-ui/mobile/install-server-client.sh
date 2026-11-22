#!/usr/bin/env bash
set -euo pipefail
TOOLS="${1:?Usage: sudo install-server-client.sh /absolute/linux-platform-tools}"
[ "$(uname -s)" = Linux ] && [ "$(id -u)" = 0 ] || { echo 'Run on Linux as root.' >&2; exit 1; }
grep -q '^Pkg.Revision=37.0.1$' "$TOOLS/source.properties" || { echo 'Use Linux Android platform-tools 37.0.1, matching the Mac ADB server.' >&2; exit 1; }
"$TOOLS/adb" version
install -d -m 0755 /opt/synapdome-tools/bin
install -d -m 0755 /opt/synapdome-tools/platform-tools
cp -R "$TOOLS"/. /opt/synapdome-tools/platform-tools/
ln -sfn /opt/synapdome-tools/platform-tools/adb /opt/synapdome-tools/bin/adb
python3 -m venv /opt/synapdome-tools/frida
/opt/synapdome-tools/frida/bin/python -m pip install 'frida==17.8.2' 'frida-tools==14.6.0'
ln -sfn /opt/synapdome-tools/frida/bin/frida /opt/synapdome-tools/bin/frida
ln -sfn /opt/synapdome-tools/frida/bin/frida-ps /opt/synapdome-tools/bin/frida-ps
