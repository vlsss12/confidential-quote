# Supabase configuration

The `/shop` page demonstrates sample quotes and account-scoped history. It does not take payment or accept real customer financial information.

## Database

Apply [`supabase/migrations/20261110000000_saved_quotes.sql`](supabase/migrations/20261110000000_saved_quotes.sql) to the `confidential-quote` Supabase project. The migration creates a history table with row-level security. Signed-in users may read or delete their own rows; only the server role can insert rows after validating the user's access token and recalculating the sample price.

## Vercel environment variables

Set these for Production in the Vercel project:

- `SUPABASE_URL`: project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the `sb_publishable_...` key. This is embedded into the browser bundle and is intended to be public.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only secret used by `/api/quotes`. Never put it in browser code, Git, a URL, or chat.

The build script rejects a non-publishable key before writing browser configuration. The API requires all three values and checks each session with Supabase Auth before allowing writes.

## Email sign-in URLs

In Supabase Auth URL Configuration, use the deployed `/shop` origin as the Site URL and add the exact shop URL to Redirect URLs, for example `https://confidential-quote.vercel.app/shop`. Update this if the production domain differs. Magic links require email delivery to be enabled in the Supabase project.

After setting environment variables and Auth URLs, redeploy Production. Until then the quote calculator works, but sign-in and history remain unavailable.
