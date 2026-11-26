#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE="${1:?Usage: sudo install-server.sh /absolute/prepared-release}"
[ "$(id -u)" = 0 ] || { echo 'Run as root on the deployment server.' >&2; exit 1; }
[ -f "$RELEASE/packages/app/dist/index.html" ] || { echo 'Run prepare.sh first.' >&2; exit 1; }
[ -x /usr/local/bin/bun ] || { echo 'Install Bun 1.3.9 at /usr/local/bin/bun.' >&2; exit 1; }
[ "$(/usr/local/bin/bun --version)" = 1.3.9 ] || exit 1
id synapdome-ui >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/synapdome-ui --shell /usr/sbin/nologin synapdome-ui
install -d -m 0750 -o synapdome-ui -g synapdome-ui /var/lib/synapdome-ui/{data,config,state,cache,engagements}
install -d -m 0750 -o root -g synapdome-ui /etc/synapdome-ui
install -d -m 0755 /opt/synapdome-ui
if [ ! -f /etc/synapdome-ui/runtime.env ]; then
  umask 077
  cp "$ROOT/runtime.env.example" /etc/synapdome-ui/runtime.env
  PASSWORD="$(openssl rand -hex 32)"
  sed -i "s/REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS/$PASSWORD/" /etc/synapdome-ui/runtime.env
  unset PASSWORD
fi
# Prepared source must be readable by the service user; never make it service-writable.
chmod -R a+rX "$RELEASE"
ln -sfn "$RELEASE" /opt/synapdome-ui/current
# The engine checks XDG_DATA_HOME/cyberstrike/web before source-relative dist.
install -d -m 0755 -o synapdome-ui -g synapdome-ui /var/lib/synapdome-ui/data/cyberstrike
ln -sfn "$RELEASE/packages/app/dist" /var/lib/synapdome-ui/data/cyberstrike/web
install -m 0644 "$ROOT/systemd/synapdome-ui.service" /etc/systemd/system/synapdome-ui.service
systemctl daemon-reload
echo 'Installed but NOT started. Configure provider credentials, lab tools and authenticated gateway; follow README.md.'
