"""Loopback-only, fixed-operation Android service controller; HTTPS gateway authenticates requests."""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UNITS = ['synapdome-android-display', 'synapdome-android', 'synapdome-android-vnc', 'synapdome-android-web', 'synapdome-frida.timer']

class Handler(BaseHTTPRequestHandler):
    def reply(self, code, data):
        payload = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path != '/start':
            return self.reply(404, {})
        try:
            subprocess.run(['systemctl', 'start', '--no-block', *UNITS], check=True, timeout=10, capture_output=True)
            self.reply(202, {'starting': True})
        except (subprocess.SubprocessError, OSError):
            self.reply(503, {'error': 'Android services unavailable'})

    def do_GET(self):
        if self.path != '/status':
            return self.reply(404, {})
        try:
            result = subprocess.run(['/usr/sbin/runuser', '-u', 'synapdome-ui', '--', '/opt/android-sdk/platform-tools/adb', '-s', 'emulator-5554', 'shell', 'getprop', 'sys.boot_completed'], capture_output=True, text=True, timeout=5, env={'HOME':'/var/lib/synapdome-ui','PATH':'/usr/bin:/bin','ADB_SERVER_SOCKET':'tcp:127.0.0.1:5037'})
            self.reply(200, {'ready': result.returncode == 0 and result.stdout.strip() == '1'})
        except (subprocess.SubprocessError, OSError):
            self.reply(200, {'ready': False})

ThreadingHTTPServer(('127.0.0.1', 6090), Handler).serve_forever()
