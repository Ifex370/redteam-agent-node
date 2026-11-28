# Session storage and lifecycle

The UI asks for a folder name when New session is selected. The operator sets
`SYNAPDOME_SESSION_ROOT`; clients cannot select an arbitrary storage root.
Linux uses `/home/ubuntu`; local Mac development uses
`~/Documents/SynapDome/Sessions`. Do not copy the Mac `.env` to Linux.

Each named folder contains `uploads/` and `evidence/`. Names must start with a
letter or number, contain only letters, numbers, spaces, dots, underscores or
hyphens, and be at most 80 characters. Existing folders cannot be reused.
API-created sessions without a name receive a generated session-ID folder.
Canonical-path checks reject traversal and symlink escapes.

Archive hides the session from active lists and retains history and files.
Delete removes the session and its child session records from the database;
artifact files remain on disk. Neither operation silently deletes reports or APKs.
Use `report.md` for human-readable reports and relative links to `evidence/`.
Structured integrations may additionally produce `report.json`; this update does
not enforce a JSON report schema or implement a report-export redesign.

## Deployment

`prepare.sh` applies `session-storage.patch` after the existing branding patch.
The additional patch preserves the Linux embedded Android interface. It does not
modify the emulator, Frida, mobile runtime, gateway, model credentials or mobile
service units. Build on Linux using Bun 1.3.9; do not ship Mac build settings.

The service user needs read/write/traverse permission on the configured root.
For the existing Ubuntu deployment, grant only that user access with
`sudo setfacl -m u:synapdome-ui:rwx /home/ubuntu`; preserve permissions on `.ssh`
and other existing subdirectories. Application path validation is not an OS
sandbox for shell tools and is not a substitute for tenant authorization.
The main SynapDome integration must enforce ownership of session APIs and files.

Before enabling the root for an existing installation, stop only `synapdome-ui`,
back up its runtime environment, and run the migration as its service user:

```sh
sudo -u synapdome-ui python3 deploy/synapdome-ui/scripts/migrate-session-folders.py \
  --database /var/lib/synapdome-ui/data/cyberstrike/cyberstrike.db \
  --root /home/ubuntu \
  --project-id global \
  --backup /var/lib/synapdome-ui/session-backups/UNIQUE_RELEASE_NAME
```

For this non-Git home directory, `global` is the existing root project. Use the
actual existing project ID if your root belongs to a Git project.

The script backs up SQLite, assigns legacy sessions individual ID folders, and
records their previous directories. Shared legacy artifacts are retained in
place: it does not guess which session owns them or move system/source files.
Review `migration.json` when importing historical artifacts into their session
folders. Already migrated direct-child folders are retained.

Set `SYNAPDOME_SESSION_ROOT=/home/ubuntu` in the existing runtime environment,
switch the source and web links to the prepared release, then start only
`synapdome-ui`. Verify named creation, duplicate rejection, archive/delete, and
the unchanged mobile panel. Keep the old release, environment and database backup.
Rollback requires stopping the UI, restoring the environment and database backup
(including handling SQLite WAL files), restoring both release/web links, and
starting the UI. New sessions created after the backup must be reconciled first.
