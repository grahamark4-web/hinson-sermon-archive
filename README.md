# Hinson Sermon Archive

A static, embeddable search app for Hinson Baptist Church. The original Squarespace collection remains the publishing and audio host. No Squarespace changes are made by this project.

## Features

- Search titles, speakers, series, and Scripture.
- Scripture queries match overlapping passages (Romans 8:28 finds Romans 8:18-39).
- Filter by Bible book, speaker, and publication year; sort oldest/newest/title.
- Listen to HTTPS audio on demand, or open the original sermon page.
- Direct Apple Podcasts and Spotify episode links where a verified match is available; separate show links let visitors follow the podcast.
- Mobile layout, accessible labels, shareable filter URLs, paginated results.
- Older HTTP audio links are flagged and are not embedded in HTTPS players.

## Catalog refresh

Run `python build_index.py` with Python 3.10+; no dependencies are required. It reads the public `/oursermons?format=json` collection in three concurrent year streams, parses audio-block metadata, and cross-checks links from `/sermonindex`. The speaker comes from audio metadata/tags, not the Squarespace account author. Scripture comes from the post title, then the audio title, then the excerpt. Publication dates use the collection's `publishOn` field in the church’s America/Los_Angeles timezone.

The crawler refuses to overwrite the catalog if requests fail, pagination repeats, coverage misses archive links, or the catalog shrinks by more than 5%. Review `catalog-report.json` for metadata gaps. It checks years 2000 through the current year; expand this range if earlier posts are added.

The GitHub workflow runs daily at 10:17 UTC and can be run manually under Actions → Refresh sermon catalog. GitHub scheduled runs can be delayed or disabled after 60 days without repository activity; check Actions if updates stop. The workflow requires contents write permission. An initial workflow push also runs the refresh.

## Verification

`node --check app.js`, `node --check search.js`, and `node test_search.cjs`.

## Cloudflare Pages

Connect this repository in Cloudflare Workers & Pages → create a Pages project.

- Production branch: `main`
- Framework: None
- Build command: leave blank
- Output directory: `.`

Cloudflare's Git integration should deploy committed catalog updates. Confirm its first deployment and the next catalog update in the Cloudflare deployment list. No API keys or paid backend are required.

To avoid publishing developer files, an optional build command is `mkdir -p dist && cp index.html app.js search.js styles.css sermons.json podcast-links.json _headers dist/`, with output directory `dist`.

## Squarespace embed (only after deployment is verified)

Replace `YOUR-APP.pages.dev` with the actual deployed hostname:

```html
<iframe src="https://YOUR-APP.pages.dev" title="Hinson Sermon Archive"
  style="width:100%;height:1100px;border:0;display:block" loading="lazy"></iframe>
```

Use a Code Block with HTML display enabled. Keep the source collection published and public; moving it to Not Linked hides it from navigation. Do not password-protect or unpublish it. Check desktop/mobile iframe height before changing navigation. The HTTP audio migration is a separate project.

## Platform episode links

`platform_links.py` refreshes Apple’s public episode lookup and Spotify’s publicly supplied show metadata. It matches Apple episodes to archive entries using the original MP3 filename, then a unique title and publication date within 14 days. Spotify titles are matched to the Apple episode first. Ambiguous matches are omitted. Verified links persist in `podcast-links.json` as the public feeds rotate; a temporary platform lookup failure retains the existing links and records a warning in the catalog report. Initial coverage is 100 Apple and 50 Spotify links, collected from the public catalogs. The daily Spotify metadata normally supplies the most recent 12 episodes, so new links accumulate over time. Platform links are omitted for unmatched sermons; the Follow links always open the podcast show.

## UX refinement and rollback (October 9, 2026)

The pre-refinement UI is preserved on branch `backup/pre-ux-refinement-2026-10-09` at commit `39ed9c1a9bb225749ccd428a31cc41cbd690ac93`. To undo only this design update, restore `index.html`, `styles.css`, and `app.js` from that branch to main and commit. Leave catalog files and the refresh workflow unchanged so newer sermons are retained. Cloudflare will deploy the restoration automatically.

Add `?embed=1` to the iframe URL to hide the app title and introduction when the surrounding church page supplies them. Existing embed URLs continue to work. The fixed iframe height remains unchanged; automatic height adjustment and a persistent player are separate enhancements.

## Historical audio priority

The daily refresh reads http://www.hinsonchurch.net/ and pairs the Subject and Date columns. It uses displayed dates, verifies MP3 availability, and overrides audio only for a unique exact catalog date. Repeated MP3 links and ambiguous dates are skipped. The original catalog metadata and sermon details links remain from hinsonchurch.org. The original HTTPS audio URL is retained in `originalAudio`.

`archive-audio.json` caches verified matches. Previously verified links survive temporary archive lookup failures. Reports list skipped unavailable dates. The HTTPS Worker streams only allowlisted recordings from this archive, supports byte ranges for seeking, and strips upstream cookies. When playback fails, an available original HTTPS recording is used as a fallback.

`wrangler.jsonc` adds the audio streaming route alongside the existing static assets. Run `python test_archive_audio.py` and `node test_worker.cjs` to check date matching and streaming. To undo this change, restore the pre-audio-priority branch and its catalog/configuration files while retaining later unrelated UI changes.

## Automatic iframe height

Replace the old fixed-height iframe with this complete Squarespace Code Block. Disable Display Source. JavaScript must be permitted by the site's plan and block settings. Check the published page while signed out; editor previews can suppress scripts. Only messages from this iframe and the app's exact origin can change its height. The app reports main content height after filtering, loading more results, opening audio, fonts loading, and responsive layout changes.

```html
<iframe
  id="hinson-sermon-archive"
  src="https://hinson-sermon-archive.grahamark4.workers.dev/?embed=1"
  title="Hinson Sermon Archive"
  scrolling="no"
  style="width:100%;height:1100px;border:0;display:block;overflow:hidden;"
  loading="lazy">
</iframe>
<script src="https://hinson-sermon-archive.grahamark4.workers.dev/embed-resize.js"></script>
```

The fallback height remains 1100px until the app reports its size. To revert, restore the original iframe block; app-side messages do not alter older embeds. The `?embed=1` setting hides the duplicate app title and introduction; omit it if those should remain visible.
