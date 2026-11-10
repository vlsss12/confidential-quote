# Enable persistent demo orders

The public shop accepts **demo orders only**. It does not collect payment or personal information.

1. Create a Supabase project and run [`supabase/orders.sql`](supabase/orders.sql) in its SQL Editor.
2. In Vercel, open the `confidential-quote` project’s Production environment variables and add:
   - `SUPABASE_URL`: the project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-side `service_role` secret. Never put this value in browser code, Git, or chat.
3. Redeploy Production. The shop enables its order button only after it can reach the required table.

The API recalculates the selected sample price with the FHE engine, persists orders through a restricted database function, and uses the browser-generated UUID as an idempotency key. The public database role cannot read or insert orders. Orders are labeled `demo_order`; there is no payment, fulfillment, or customer identity attached.
