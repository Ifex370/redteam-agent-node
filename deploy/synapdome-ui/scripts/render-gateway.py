#!/usr/bin/env python3
"""Fail closed until real session validation and TLS are configured. Output is secret."""
import base64, os, re, sys
from pathlib import Path
from urllib.parse import urlsplit

def render(env):
    names = ('WORKSPACE_HOST', 'TLS_CERT', 'TLS_KEY', 'AUTH_VERIFY_URL', 'CYBERSTRIKE_SERVER_PASSWORD')
    if any(not env.get(k) for k in names):
        raise ValueError('Set WORKSPACE_HOST, TLS_CERT, TLS_KEY, AUTH_VERIFY_URL and CYBERSTRIKE_SERVER_PASSWORD.')
    host = env['WORKSPACE_HOST']
    if not re.fullmatch(r'[a-zA-Z0-9.-]+', host) or '.' not in host:
        raise ValueError('WORKSPACE_HOST must be a DNS hostname.')
    url = urlsplit(env['AUTH_VERIFY_URL'])
    if url.scheme != 'http' or url.hostname != '127.0.0.1' or not url.port or url.username or url.query or url.fragment:
        raise ValueError('AUTH_VERIFY_URL must be a loopback HTTP session-verification endpoint with a port.')
    for name in ('TLS_CERT','TLS_KEY','AUTH_VERIFY_URL'):
        if not re.fullmatch(r'[a-zA-Z0-9_./:\-]+', env[name]):
            raise ValueError('Unsafe characters in '+name)
    if any(not Path(env[k]).is_file() for k in ('TLS_CERT','TLS_KEY')):
        raise ValueError('TLS certificate and key must exist.')
    if len(env['CYBERSTRIKE_SERVER_PASSWORD']) < 32:
        raise ValueError('Engine password must contain at least 32 characters.')
    values = {k:env[k] for k in names if k != 'CYBERSTRIKE_SERVER_PASSWORD'}
    values['ENGINE_BASIC'] = base64.b64encode(('cyberstrike:'+env['CYBERSTRIKE_SERVER_PASSWORD']).encode()).decode()
    result = (Path(__file__).resolve().parents[1]/'nginx/workspace.conf.template').read_text()
    for name,value in values.items():
        result = result.replace('${'+name+'}',value)
    return result

if __name__ == '__main__':
    try:
        data = render(os.environ)
        target = Path(sys.argv[1])
        # Never accidentally overwrite a live nginx configuration.
        fd = os.open(target, os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
        with os.fdopen(fd,'w') as stream: stream.write(data)
        print('Gateway configuration written. Run nginx -t before enabling it.')
    except (ValueError, OSError, IndexError) as err:
        sys.exit(str(err))
