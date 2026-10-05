# Handover — Family Accounts

_Completed by the agent in step B6. Template below._

## Accounts (all under the family Gmail)
| Service | Login | What it holds |
|---|---|---|
| Gmail | family.accounts.app@gmail.com | Password resets + alerts for everything below |
| GitHub | (same) | Code, keep-alive + backup workflows, weekly backup artifacts |
| Supabase | (same, via GitHub) | Database and user logins |
| Vercel | (same, via GitHub) | Hosting, daily keep-alive cron |

## Where secrets live
- GitHub → repo Settings → Secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`
- Vercel → Project → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_DATA_MODE=live`, `CRON_SECRET`

## If something goes wrong
- **"The app won't load data" / Supabase emailed that the project is paused:** Supabase dashboard → the project → *Resume project*. Data is kept.
- **Forgot password:** Supabase → Authentication → Users → the user → *Send password recovery* or set a new password.
- **Keep-alive workflow failed (GitHub email):** open the run; if the project was paused, resume it, then *Re-run jobs*.
- **Restore from backup:** download the latest `db-backup-*` artifact from GitHub Actions; restore `data.sql` with `psql "<SUPABASE_DB_URL>" -f data.sql` into a fresh project that has the migrations applied.

## Things that will never need doing
- No servers to patch, no certificates to renew, no dependencies auto-upgrade — the deployed build keeps running as-is.

## Handover-day checklist
_(copied from docs/PLAN.md and ticked on the day)_
