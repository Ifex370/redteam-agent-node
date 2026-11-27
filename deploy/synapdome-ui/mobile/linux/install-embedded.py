from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parent
subprocess.run(['install','-m','644',str(ROOT / 'embed.html'),'/usr/share/novnc/embed.html'],check=True)
subprocess.run(['install','-m','644',str(ROOT / 'runtime.py'),'/opt/synapdome-tools/mobile-runtime.py'],check=True)
Path('/etc/systemd/system/synapdome-mobile-runtime.service').write_text('''[Unit]
Description=SynapDome private Android startup controller
After=network.target
[Service]
ExecStart=/usr/bin/python3 /opt/synapdome-tools/mobile-runtime.py
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
''')
p=Path('/etc/nginx/sites-available/synapdome-ip');s=p.read_text()
if 'location /mobile/runtime/' not in s:
 s=s.replace('    location /mobile/ {','''    location ~ ^/mobile/(vnc|vnc_lite)\\.html$ { return 302 /; }
    location /mobile/runtime/ {
        if ($synap_bad_origin) { return 403; }
        auth_basic "SynapDome AT";
        auth_basic_user_file /etc/nginx/synapdome-operators;
        proxy_pass http://127.0.0.1:6090/;
        proxy_set_header Authorization "";
        proxy_set_header Cookie "";
    }
    location /mobile/ {''')
 p.write_text(s)
subprocess.run(['nginx','-t'],check=True)
subprocess.run(['systemctl','daemon-reload'],check=True)
subprocess.run(['systemctl','enable','--now','synapdome-mobile-runtime'],check=True)
subprocess.run(['systemctl','reload','nginx'],check=True)
