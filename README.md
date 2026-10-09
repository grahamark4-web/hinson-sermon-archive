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
