from pathlib import Path
import subprocess
p=Path('/etc/nginx/sites-available/synapdome-ip');s=p.read_text()
if 'location /mobile/' not in s:
 s=s.replace('    location / {','''    location /mobile/ {
        if ($synap_bad_origin) { return 403; }
        set $synap_ws_check "$http_upgrade:$synap_ws_origin";
        if ($synap_ws_check ~* "^websocket:0$") { return 403; }
        auth_basic "SynapDome AT";
        auth_basic_user_file /etc/nginx/synapdome-operators;
        proxy_pass http://127.0.0.1:6080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $synap_connection;
        proxy_set_header Authorization "";
        proxy_set_header Cookie "";
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
    location / {''',1)
 p.write_text(s)
subprocess.run(['nginx','-t'],check=True)
subprocess.run(['systemctl','reload','nginx'],check=True)
p=Path('/etc/systemd/system/synapdome-android.service');s=p.read_text().replace(' -scale 0.4','').replace('ExecStart=/opt/android-sdk','ExecStartPre=/opt/android-sdk/platform-tools/adb start-server\nExecStart=/opt/android-sdk');p.write_text(s)
Path('/etc/systemd/system/synapdome-frida.service').write_text('''[Unit]
Description=Restore Android Frida connection
After=synapdome-android.service
[Service]
Type=oneshot
User=synapdome-ui
WorkingDirectory=/var/lib/synapdome-ui
Environment=HOME=/var/lib/synapdome-ui
Environment=ANDROID_SDK_ROOT=/opt/android-sdk
Environment=ADB_SERVER_SOCKET=tcp:127.0.0.1:5037
Environment=FRIDA_VENV=/opt/synapdome-tools/frida
ExecStart=/bin/bash /opt/synapdome-tools/provision-frida.sh
TimeoutStartSec=300
''')
Path('/etc/systemd/system/synapdome-frida.timer').write_text('''[Unit]
Description=Maintain local Android Frida connection
[Timer]
OnBootSec=90
OnUnitInactiveSec=60
[Install]
WantedBy=timers.target
''')
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','synapdome-frida.timer'],check=True)
