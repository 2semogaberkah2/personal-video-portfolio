# Changelog

## TikTok-link version
- Replaced local video and thumbnail uploads with a TikTok video URL field in `/admin`.
- Validates full TikTok video URLs and extracts the numeric video ID.
- Plays selected videos using TikTok's official player iframe.
- Stores admin-added metadata in browser localStorage; no video file storage or database required for local demo.
- Documents that static hosting does not sync localStorage changes to public visitors; public projects can be committed in `src/data/projects.ts` and redeployed.
- Removed the form reset call that could access a null React `currentTarget` after async work.
