# Linux-local Android and Frida deployment

## Required topology

SynapDome AT → local Linux ADB client/server → Android emulator → frida-server.
The Linux Frida client connects through a loopback ADB forward. No Mac, reverse SSH tunnel or Ollama connection is required. DeepSeek is the workspace model provider. Burp/browser extensions are outside this handoff.

## Verified state: 26 November 2026

- AT systemd service is active on the restored Linux server.
- Linux platform-tools and the Frida virtual environment exist under `/opt/synapdome-tools`.
- The host reports AMD EPYC 7R32 under a KVM hypervisor, but exposes no `/dev/kvm`; `modprobe kvm_amd` fails with `Operation not supported`. Being a KVM guest does not mean nested virtualization is available.
- A Linux emulator and server-local Frida process enumeration have **not** been validated. The previous Mac tunnel is not fulfillment of this deployment.
- Internet gateway authentication, Android screen access and reboot recovery still require acceptance. An active workspace service alone does not establish these.

## Host prerequisite

Use a Linux host exposing usable `/dev/kvm` to the dedicated runtime user. Confirm the instance's supported nested virtualization configuration before changing infrastructure. Do not substitute unaccelerated emulation and call it equivalent to the stable laptop baseline. Instance replacement or resizing can change cost and requires an explicit infrastructure decision.

Install official Android SDK command-line tools and Java, review the Android licenses, then install Linux emulator/platform-tools and a **rootable Google APIs** API 35 x86_64 image on an x86_64 host. Do not use a Google Play image for `adb root`. Record actual SDK revisions and checksums: the Mac ARM64 image revision is not a Linux x86_64 lockfile. Check approved APK ABI compatibility independently.

Create `SynapDome_Linux_API35` with `avdmanager`. Keep its writable data on persistent storage owned by the runtime user. Run the emulator and ADB under that same account, with access to KVM:

```sh
export ANDROID_SDK_ROOT=/opt/android-sdk
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
"$ANDROID_SDK_ROOT/emulator/emulator" -accel-check
"$ANDROID_SDK_ROOT/emulator/emulator" -avd SynapDome_Linux_API35 \
  -port 5554 -no-window -no-audio -no-metrics \
  -camera-back none -camera-front none
```

Use systemd to supervise the emulator under the runtime account after the foreground launch is validated. Configure restart-on-failure and persistent HOME/AVD paths. A headless emulator does not supply an internet-visible Android screen; a separately authenticated display gateway is required if that feature is needed. Never publish raw ADB, Frida, VNC or emulator console ports.

## Frida provisioning and connection

Install matching Linux clients with `mobile/install-server-client.sh` using official Linux platform-tools 37.0.1. It installs Frida 17.8.2 and frida-tools 14.6.0. After Android reports boot completion, run as the runtime user:

```sh
export ANDROID_SDK_ROOT=/opt/android-sdk
export ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
export ADB_SERIAL=emulator-5554
export FRIDA_VENV=/opt/synapdome-tools/frida
"$ANDROID_SDK_ROOT/platform-tools/adb" -s "$ADB_SERIAL" shell getprop sys.boot_completed
bash deploy/synapdome-ui/mobile/provision-frida.sh
```

The provisioning script detects ARM64 or x86_64, downloads the matching Android frida-server 17.8.2, verifies root and version, starts it and checks process enumeration through loopback port 27044. Re-run after emulator reboot. Do not expose frida-server on the host network.

Configure `/etc/synapdome-ui/runtime.env` with:

```ini
PATH=/opt/synapdome-tools/bin:/usr/local/bin:/usr/bin:/bin
ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
```

Restart AT after changing its environment. Retire the previous Mac tunnel and its loopback port 27044 listener before local provisioning; do not stop unrelated SSH sessions. Remove the obsolete tunnel account/credential only after checking its exclusive use.

## Acceptance before handover is called operational

1. Emulator hardware acceleration passes, Android boot property is `1`, and ADB reports `device`.
2. `frida-ps -H 127.0.0.1:27044` lists Android processes from the Linux runtime account and the AT service account.
3. An approved APK installs, launches and supports the authorized Frida workflow; verify its ABI compatibility.
4. Disconnect the Mac completely and repeat the check.
5. Reboot Linux and confirm emulator, Frida provisioning and AT recover automatically.
6. Verify authenticated internet access to AT, and Android display access if configured; unauthenticated requests must fail. Confirm private tool ports are unreachable externally.

MobSF static package scanning remains a separate module. This guide does not claim AT automatically dispatches every queued scanner or that main SynapDome SSO is already connected.
