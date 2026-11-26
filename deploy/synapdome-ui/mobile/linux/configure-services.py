from pathlib import Path
import subprocess
units={
'synapdome-android-display':'''[Unit]
Description=SynapDome Android virtual display
[Service]
User=synapdome-ui
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x1100x24 -nolisten tcp -ac
Restart=always
[Install]
WantedBy=multi-user.target
''',
'synapdome-android':'''[Unit]
Description=SynapDome Linux Android emulator
Requires=synapdome-android-display.service
After=synapdome-android-display.service
[Service]
User=synapdome-ui
Group=synapdome-ui
SupplementaryGroups=kvm
WorkingDirectory=/var/lib/synapdome-ui
Environment=HOME=/var/lib/synapdome-ui
Environment=ANDROID_SDK_ROOT=/opt/android-sdk
Environment=DISPLAY=:99
Environment=QT_X11_NO_MITSHM=1
ExecStartPre=/opt/android-sdk/platform-tools/adb start-server
ExecStart=/opt/android-sdk/emulator/emulator -avd SynapDome_Linux_API35 -port 5554 -gpu swiftshader -no-audio -no-metrics -no-snapshot-load -no-snapshot-save -camera-back none -camera-front none
Restart=always
RestartSec=5
TimeoutStopSec=30
[Install]
WantedBy=multi-user.target
''',
'synapdome-android-vnc':'''[Unit]
Description=SynapDome Android screen (loopback only)
Requires=synapdome-android-display.service
After=synapdome-android-display.service
[Service]
User=synapdome-ui
ExecStart=/usr/bin/x11vnc -display :99 -localhost -rfbport 5900 -nopw -forever -shared -noxdamage
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
''',
'synapdome-android-web':'''[Unit]
Description=SynapDome Android browser transport (loopback only)
After=synapdome-android-vnc.service
[Service]
User=synapdome-ui
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
'''}
# Use a single ADB version for the emulator and workspace.
subprocess.run(['/opt/android-sdk/platform-tools/adb','kill-server'])
p=Path('/opt/synapdome-tools/bin/adb');p.unlink(missing_ok=True);p.symlink_to('/opt/android-sdk/platform-tools/adb')
p=Path('/etc/synapdome-ui/runtime.env');s=p.read_text().replace('tcp:127.0.0.1:15037','tcp:127.0.0.1:5037');p.write_text(s)
p=Path('/var/lib/synapdome-ui/.android/avd/SynapDome_Linux_API35.avd/config.ini')
s=dict(l.split('=',1) for l in p.read_text().splitlines() if '=' in l)
s.update({'hw.ramSize':'3072','hw.cpu.ncore':'2','hw.gpu.enabled':'yes','hw.gpu.mode':'swiftshader','disk.dataPartition.size':'8G'})
p.write_text(''.join(k+'='+v+'\n' for k,v in s.items()))
for name,content in units.items():Path('/etc/systemd/system/'+name+'.service').write_text(content)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now',*units.keys()],check=True)
subprocess.run(['systemctl','restart','synapdome-ui'],check=True)
