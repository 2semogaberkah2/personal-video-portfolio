# Update: Custom Portfolio Order

- Added persistent manual ordering for portfolio videos.
- Added up/down controls and a Save Order action in `/admin`.
- Homepage now sorts published works by `display_order`, with creation date as a tie-breaker.
- Newly uploaded MP4 and external TikTok/YouTube links are appended to the end.
- Added `SUPABASE_CUSTOM_ORDER.sql` for the one-time database migration.

Run the SQL migration before deploying this version. Existing records are backfilled in their previous newest-first order.
