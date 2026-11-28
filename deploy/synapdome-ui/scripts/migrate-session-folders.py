#!/usr/bin/env python3
"""Run as the service user with synapdome-ui stopped. Never moves shared legacy files."""
import argparse
import json
import re
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--database', required=True, type=Path)
parser.add_argument('--root', required=True, type=Path)
parser.add_argument('--backup', required=True, type=Path)
parser.add_argument('--project-id', help='Existing project ID for the fixed root, when consolidating projects')
args = parser.parse_args()
root = args.root.resolve(strict=True)
if not args.database.is_file():
    raise SystemExit('Existing database required')
args.backup.mkdir(mode=0o700, parents=True, exist_ok=False)
connection = sqlite3.connect(args.database)
with sqlite3.connect(args.backup / 'sessions-before.db') as backup:
    connection.backup(backup)
if args.project_id and not connection.execute('select 1 from project where id=?', (args.project_id,)).fetchone():
    raise SystemExit('Target project does not exist')
rows = connection.execute('select id,directory,title from session').fetchall()
changes = []
for sid, previous, title in rows:
    if not re.fullmatch(r'ses_[a-zA-Z0-9]+', sid):
        raise RuntimeError('Invalid session identifier')
    old = Path(previous)
    if old.parent == root and old.is_dir() and not old.is_symlink():
        continue
    folder = root / sid
    folder.mkdir(mode=0o700)  # A collision requires operator investigation.
    for name in ('uploads', 'evidence'):
        (folder / name).mkdir(mode=0o700)
    record = dict(id=sid, title=title, previousDirectory=previous, directory=str(folder))
    (folder / 'session.json').write_text(json.dumps(record, indent=2) + '\n')
    changes.append(record)
with connection:
    for record in changes:
        connection.execute('update session set directory=? where id=?', (record['directory'], record['id']))
        if args.project_id:
            connection.execute('update session set project_id=? where id=?', (args.project_id, record['id']))
(args.backup / 'migration.json').write_text(json.dumps(changes, indent=2) + '\n')
print(json.dumps({'migrated': len(changes), 'backup': str(args.backup)}))
