#!/bin/bash
set -euo pipefail
[ "${ACCEPT_ANDROID_LICENSES:-}" = yes ] || { echo 'Review Android SDK licenses and rerun with ACCEPT_ANDROID_LICENSES=yes.' >&2; exit 1; }
[ -c /dev/kvm ] || { echo 'Enable nested virtualization first.' >&2; exit 1; }
cd /var/lib/synapdome-ui
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl python3-venv openjdk-21-jre-headless unzip xvfb x11vnc novnc websockify openbox libpulse0 libnss3 libxcomposite1 libxcursor1 libxi6 libxtst6 libxrandr2 libasound2t64 libegl1 libgl1 libxkbcommon-x11-0
usermod -aG kvm synapdome-ui
install -d -o synapdome-ui -g synapdome-ui /opt/android-sdk /var/lib/synapdome-ui/.android
if [ ! -x /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager ]; then
 curl -fL --retry 3 https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o /tmp/android-cli.zip
 echo '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  /tmp/android-cli.zip' | sha256sum -c -
 install -d /opt/android-sdk/cmdline-tools
 unzip -q /tmp/android-cli.zip -d /opt/android-sdk/cmdline-tools
 mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest
 chown -R synapdome-ui:synapdome-ui /opt/android-sdk
fi
# Explicit operator license acceptance required above; retain the SDK license record.
set +o pipefail
yes | sudo -u synapdome-ui env HOME=/var/lib/synapdome-ui /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk --licenses >/var/log/synapdome-android-licenses.log
result=${PIPESTATUS[1]}
set -o pipefail
[ "$result" = 0 ]
sudo -u synapdome-ui env HOME=/var/lib/synapdome-ui /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk 'platform-tools' 'emulator' 'system-images;android-35;google_apis;x86_64'
if [ ! -f /var/lib/synapdome-ui/.android/avd/SynapDome_Linux_API35.ini ]; then
 printf 'no\n' | sudo -u synapdome-ui env HOME=/var/lib/synapdome-ui ANDROID_SDK_ROOT=/opt/android-sdk /opt/android-sdk/cmdline-tools/latest/bin/avdmanager create avd -n SynapDome_Linux_API35 -k 'system-images;android-35;google_apis;x86_64' -d pixel_7
fi
sudo -u synapdome-ui /opt/android-sdk/emulator/emulator -accel-check

install -d /opt/synapdome-tools/bin
python3 -m venv /opt/synapdome-tools/frida
/opt/synapdome-tools/frida/bin/python -m pip install 'frida==17.8.2' 'frida-tools==14.6.0'
ln -sfn /opt/synapdome-tools/frida/bin/frida /opt/synapdome-tools/bin/frida
ln -sfn /opt/synapdome-tools/frida/bin/frida-ps /opt/synapdome-tools/bin/frida-ps
