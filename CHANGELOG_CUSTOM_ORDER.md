# Update: Custom Portfolio Order

- Added persistent manual ordering for portfolio videos.
- Added up/down controls and a Save Order action in `/admin`.
- Homepage now sorts published works by `display_order`, with creation date as a tie-breaker.
- Newly uploaded MP4 and external TikTok/YouTube links are appended to the end.
- Added `SUPABASE_CUSTOM_ORDER.sql` for the one-time database migration.

Run the SQL migration before deploying this version. Existing records are backfilled in their previous newest-first order.

## Mobile TikTok-style portfolio experience

- Changed the mobile portfolio gallery into a full-width, edge-to-edge three-column 9:16 thumbnail grid.
- Removed mobile card metadata and autoplay previews from the grid so the first screen stays lightweight.
- Tapping any thumbnail opens a fullscreen vertical video feed with native vertical scroll snapping, previous/next navigation, and a close control.
- The feed follows the same published/custom portfolio order used by the gallery.
- Only the currently active slide mounts its video player; inactive slides show lightweight thumbnails.
- Desktop portfolio grid and desktop video modal remain unchanged.
