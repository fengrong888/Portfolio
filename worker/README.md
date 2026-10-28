# Secure portfolio admin API (Cloudflare Worker)

This is the server-side foundation for replacing the current browser-held GitHub PAT. **It is not active until deployed and the frontend is switched to use it.** The current GitHub Pages admin still uses its legacy browser-side token flow until the migration is completed.

## Why this exists

GitHub Pages is static hosting: a password check in JavaScript cannot protect the source or provide server-side authentication. This Worker keeps the GitHub token in a Worker secret, verifies Cloudflare Access JWTs, restricts writes to this repository's portfolio JSON and image folder, and only accepts requests from the portfolio origin.

## Deploy and configure

1. Create a Cloudflare Worker and deploy `worker/index.js` (or use Wrangler with the account's preferred project setup).
2. Configure a Cloudflare Access self-hosted application for the Worker URL. Create a policy allowing only your own identity. Copy the application's AUD tag.
3. Set Worker variables:
   - `CF_ACCESS_TEAM_DOMAIN`: your team domain, such as `example.cloudflareaccess.com` (no protocol).
   - `CF_ACCESS_AUD`: the Access application's AUD tag.
   - `ALLOWED_ORIGIN`: `https://fengrong888.github.io`.
4. Add a Worker secret named `GITHUB_TOKEN`. Use a fine-grained PAT scoped only to `fengrong888/Portfolio`, with Contents read/write and a short, reasonable expiry. Never put this token in GitHub Pages build variables or frontend source.
5. Ensure Access is enabled on the Worker hostname and test that an unauthenticated request returns 401/Access denial, while an authenticated request can read the portfolio JSON.
6. Set `ADMIN_API_URL` in `src/lib/adminConfig.js` to the Worker origin (for example, `https://portfolio-admin-api.example.workers.dev`) and redeploy the site. The frontend then sends GitHub Contents requests through the Worker, includes Access cookies, and removes the old PAT from that browser's localStorage.
7. Test the live admin end-to-end: sign in through Access, sync the JSON file, upload an image, and verify another device sees the update. If CORS/Access redirects fail, do not continue; fix the Access app and allowed origin first.
8. After the new path is confirmed working, revoke the old PAT that was entered in the browser. Do not revoke it before migration if the current live admin still depends on it.

The UI and client library now support this Worker mode, but `ADMIN_API_URL` is intentionally empty by default. Until you deploy/configure the Worker and set that URL, the live site continues using the legacy flow.

## API contract

- `GET /api/contents?path=docs/data/portfolio-data.json`
- `PUT /api/contents?path=docs/data/portfolio-data.json` with GitHub Contents API JSON payload
- `GET/PUT/DELETE /api/contents?path=docs/data/imgs/<filename>.<extension>`

The Worker rejects all other repository paths and methods. Configure Cloudflare rate limiting for this route as an additional defense. Do not expose the Worker token or disable Access/JWT verification.

## Important limitation

This PR adds the server-side API foundation and deployment instructions. It does not by itself secure the existing live admin UI; frontend migration and Cloudflare account configuration are separate required steps. No credentials or account settings are included in this repository.
