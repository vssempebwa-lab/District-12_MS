# Deployment

Six independent Next.js sites share one Supabase project and one session
cookie: the hub plus five subsidiaries. They deploy as six Netlify sites from a
single repository.

## Netlify site settings

Create one Netlify site per app. For every site set:

| Setting | Value |
| --- | --- |
| Base directory | `ecosystem` |
| Package directory | `apps/hub`, `apps/passito`, `apps/mariz`, `apps/rub-shoots`, `apps/shop-for-me` or `apps/expresso-point` |
| Build command | taken from `ecosystem/apps/<app>/netlify.toml` |
| Publish directory | taken from the same file (`apps/<app>/.next`) |

The build installs the workspace once at `ecosystem`, runs
`npm run check:deploy` against the site's environment, then runs the matching
`npm run build:<app>` with `@netlify/plugin-nextjs`.

`npm run check:deploy` fails the build when a required production value is
missing or invalid, so a site cannot go live in demo mode by accident.

## Environment variables

Every site needs the same values from [`.env.production.example`](../.env.production.example).
`NEXT_PUBLIC_*` values are baked into the build; the rest are runtime secrets.
The session secret and cookie domain must be identical on all six sites, or a
hub session will not be accepted by the subsidiaries.

## Domains and cookies

| App | Domain |
| --- | --- |
| hub | `hub.district12.co.ug` |
| passito | `passito.district12.co.ug` |
| mariz | `mariz.district12.co.ug` |
| rub-shoots | `rubshoots.district12.co.ug` |
| shop-for-me | `shopforme.district12.co.ug` |
| expresso-point | `expresso.district12.co.ug` |

With `D12_COOKIE_DOMAIN=.district12.co.ug`, the hub writes `d12_session` on the
parent domain and each subsidiary's `/auth/callback` re-issues the same cookie.
On localhost leave the variable blank: cookies are host-scoped and the ports do
not matter.

## Account hand-off

Production sign-in goes through Supabase Auth only (`D12_DEMO_MODE=false`).
Seeded `d12_iam_users` rows must point at a real Supabase Auth user before those
people can sign in:

```bash
# Report what is linked and what is missing
npm run link:seed-users

# Link rows whose email already exists in auth.users
npm run link:seed-users -- --apply

# Also create confirmed auth users for people who do not have one yet.
# Export D12_SEED_PASSWORD (12+ characters) for the run, then rotate it.
npm run link:seed-users -- --create --apply
```

`packages/db/sql/021_link_seed_auth_users.sql` performs the same email match as
a migration and is safe to re-run. Creating accounts is deliberately kept in the
script, not the migration, so it cannot happen during a deploy by accident.
Accounts created this way sign in with the bootstrap password and should change
it from the Supabase dashboard until a password-reset screen is added.
