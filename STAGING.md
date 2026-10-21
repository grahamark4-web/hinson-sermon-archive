# Hinson archive staging

All experimental work goes on `staging`. Production stays on `main`.

## Connect the test deployment

Create a separate Cloudflare Worker named `hinson-sermon-archive-staging`, connected to this repository with production branch `staging`. Set its deploy command to `npx wrangler deploy --config wrangler.staging.jsonc`. Do not attach church domains or change the existing production Worker or Squarespace iframe.

The intended address is `https://hinson-sermon-archive-staging.grahamark4.workers.dev/`; this is not a working deployment until Cloudflare creation and deployment are verified. This separate address is not password protected. Use Cloudflare Access if restricted access is needed.

## Review and release

1. Commit changes only to `staging` and review the separate test URL on desktop and mobile.
2. Keep public transcript search disabled until the owner requests restoration.
3. Refresh staging catalog data from main as needed. Daily scheduled refreshes continue on main.
4. After explicit approval to publish, open a pull request from staging to main. Review changes, then merge. The existing production integration deploys main.
5. Keep `wrangler.staging.jsonc` available for future test deployments. Production deploys must continue using `wrangler.jsonc`.

Validation: `node test_search.cjs`, `node test_worker.cjs`, `node test_transcripts.cjs`, and `TEST_TRANSCRIPTS_DISABLED=1 node test_transcript_ui.cjs` (browser dependencies required for UI checks).
