# Database backups to Google Drive

A GitHub Actions job ([`.github/workflows/database-backup.yml`](../../.github/workflows/database-backup.yml))
runs every night at 03:15 Kampala time. It:

1. **Dumps** the Supabase database with `pg_dump`, in custom format. The dump covers the
   `public` schema (all `d12_*` data, RLS policies and functions) and the `auth` schema
   (sign-in users and password hashes).
2. **Validates** the dump with `pg_restore --list`. It must contain `d12_*` table data,
   including `d12_iam_users`.
3. **Encrypts** the dump with AES-256-GCM, using a key derived from `BACKUP_ENCRYPTION_KEY`.
   The backup holds password hashes and staff personal data, so Google only ever stores
   ciphertext.
4. **Uploads** to Google Drive with a resumable upload. Network failures are retried and
   resume where they stopped.
5. **Verifies** the Drive copy: its MD5 and size must match the local file. If they don't,
   the copy is trashed and the run fails.
6. **Prunes** old backups, but only after a verified upload. It keeps the newest backup of
   each of the last 14 days, 8 weeks and 12 months. Pruned files go to the Drive trash,
   which Google empties after 30 days, so nothing is lost immediately.
7. **Restore-checks** the newest backup in Drive. It downloads the file, checks its SHA-256,
   decrypts it and reads it with `pg_restore`. The check fails if the newest backup is more
   than 36 hours old.

If any step fails, the run fails, and GitHub emails the repository admins.

The Supabase dashboard's own daily backups are separate. They live inside Supabase and
are short-lived on the free and Pro plans. This job gives you an off-site copy that you
control.

## One-time setup

### 1. Database connection string

In Supabase, open **Project → Connect** and copy the **Session pooler** URI
(`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`).

- Don't use the direct connection: it is IPv6-only, and GitHub runners can't reach it.
- Don't use the transaction pooler on port 6543: `pg_dump` doesn't work through it.

### 2. Google OAuth client (for a normal Gmail / Google account)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   the **Google Drive API**.
2. Under **APIs & Services → OAuth consent screen**, set it up as **External**, then
   **publish it to "In production"**.

   > **Important:** while the consent screen is in "Testing", Google expires refresh tokens
   > after 7 days, and the backups would quietly stop working after a week.

   The job only asks for the `drive.file` scope. That scope is non-sensitive, so Google
   doesn't need to verify the app.
3. Under **Credentials → Create credentials → OAuth client ID**, choose **Desktop app**.
   Note the client ID and client secret.
4. On your machine, run:

   ```bash
   cd ecosystem
   GDRIVE_CLIENT_ID=... GDRIVE_CLIENT_SECRET=... npm run backup:auth
   ```

   Open the printed URL and sign in with the Google account that should own the backups.
   The script then prints a refresh token.

With `drive.file`, the job can only see files it created itself. It creates a folder called
**"District 12 database backups"** in that account's Drive on the first run. It can't read
anything else in the Drive.

**Google Workspace alternative:** create a service account, add it as a *Content manager*
of a Shared Drive folder, and set `GDRIVE_SERVICE_ACCOUNT_JSON` (the key file contents) and
`GDRIVE_FOLDER_ID` instead of the three OAuth values. Service accounts can't store files
in a personal "My Drive", because they have no storage quota there.

### 3. Encryption key

Generate one:

```bash
openssl rand -base64 48
```

**Store it in your password manager as well as in GitHub.** Without this key, the backups
can't be decrypted.

### 4. GitHub secrets and variables

In the repository, open **Settings → Secrets and variables → Actions**.

| Secret | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Session pooler URI from step 1 |
| `BACKUP_ENCRYPTION_KEY` | Key from step 3 |
| `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` | From step 2 |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | Only for the Workspace alternative |

Optional **variables**:

- `GDRIVE_FOLDER_ID`: pin a specific folder.
- `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`, `BACKUP_KEEP_MONTHLY`: change retention.

Then open **Actions → Database backup → Run workflow** to run it once by hand, and check
that the file appears in Drive.

GitHub turns off scheduled workflows in repositories with no commits for 60 days. If the
repository goes quiet, re-enable the workflow on the Actions tab.

## Restoring

Download and decrypt a backup. With no id, this takes the newest one; pass an id from
`npm run backup:list` to pick another. It needs `BACKUP_ENCRYPTION_KEY` and the Drive
credentials in your environment or in `ecosystem/.env.local`.

```bash
cd ecosystem
npm run backup:list
node scripts/backup-to-drive.mjs download            # newest
node scripts/backup-to-drive.mjs download <drive-id> # a specific one
```

A file downloaded by hand from the Drive website can be decrypted with:

```bash
node scripts/backup-to-drive.mjs decrypt d12-db-....dump.enc d12-db.dump
```

Restore the app data. Use a new Supabase project or a scratch database first; restore over
production only on purpose.

```bash
pg_restore --no-owner --clean --if-exists --schema=public -d "$TARGET_DB_URL" d12-db-....dump
```

Sign-in users live in the `auth` schema, which Supabase manages. To restore them into a
fresh project, restore the data only:

```bash
pg_restore --no-owner --data-only --schema=auth --table=users --table=identities -d "$TARGET_DB_URL" d12-db-....dump
```

Use a `pg_restore` with the same or a newer major version than the server (17 for current
Supabase projects).

Practise a restore into a scratch project every few months. The nightly restore check
proves the file is intact and readable. It doesn't prove your restore procedure works.
