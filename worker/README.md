# Secure portfolio admin API (Cloudflare Worker)

This is the server-side foundation for replacing the current browser-held GitHub PAT. **It is not active until deployed and the frontend is switched to use it.** The current GitHub Pages admin still uses its legacy browser-side token flow until the migration is completed.

## Why this exists

GitHub Pages is static hosting: a password check in JavaScript cannot protect the source or provide server-side authentication. This Worker keeps the GitHub token in a Worker secret, verifies Cloudflare Access JWTs, restricts writes to this repository's portfolio JSON and image folder, and only accepts requests from the portfolio origin.

## Deploy and configure (exact steps)

### 1. Deploy the Worker (choose ONE path)

**Path A — local Wrangler (recommended, deterministic):**
```bash
# 1. install wrangler once
npm i -g wrangler        # or: npx wrangler@4

# 2. log in to Cloudflare (opens browser)
wrangler login

# 3. from the repo root, edit wrangler.toml first:
#    - CF_ACCESS_TEAM_DOMAIN -> your real team domain (e.g. abc.cloudflareaccess.com)
#    - CF_ACCESS_AUD -> the AUD tag you will copy from the Access app in step 3
npx wrangler deploy

# 4. set the GitHub token secret (never commit it)
npx wrangler secret put GITHUB_TOKEN
```

**Path B — Cloudflare dashboard (Workers & Pages → Create → Worker):**
1. Create a Worker named `portfolio-admin` (do NOT connect it to the GitHub repo as "Workers Builds" — that would build the Vite site).
2. Replace the default worker code with the full content of `worker/index.js`.
3. In Settings → Variables, add:
   - `CF_ACCESS_TEAM_DOMAIN` = your team domain (no protocol)
   - `CF_ACCESS_AUD` = AUD tag from the Access app (step 3)
   - `ALLOWED_ORIGIN` = `https://fengrong888.github.io`
4. In Settings → Variables → Secrets, add `GITHUB_TOKEN` with a fine-grained PAT scoped only to `fengrong888/Portfolio`, Contents read/write, reasonable expiry.

> ⚠️ The existing `portfolio.1205898527.workers.dev` currently serves the built frontend site (mis-deployed via Workers Builds). Do not use that route as the admin API. Deploy the dedicated `portfolio-admin` Worker from `worker/index.js`. The old `portfolio` Worker can be deleted once the migration is verified, as the live site itself is GitHub Pages and does not depend on it.

### 2. Configure Cloudflare Access for the Worker URL

1. Cloudflare dashboard → **Zero Trust → Access → Applications** → **Add an application** → **Self-hosted**.
2. Application domain: `<your-worker>.workers.dev` (e.g. `portfolio-admin.<subdomain>.workers.dev`), keep "Application audience (AUD) Tag" visible — copy it into `CF_ACCESS_AUD`.
3. Add a policy (the only one needed): allow **your own identity** (your Cloudflare login email), session duration e.g. 1 day.
4. Make sure the Access app covers the `/api/*` paths (set the domain as above; the whole worker hostname is covered).

### 3. Verify the Worker locally (before going live)

```bash
npx wrangler dev
curl -i "http://localhost:8787/api/contents?path=docs/data/portfolio-data.json" \
  -H "Origin: https://fengrong888.github.io"
# Expect: 401 Unauthorized (no Access JWT) — never 200.
```

### 4. Switch the frontend to the Worker

Set in `src/lib/adminConfig.js`:
```js
export const ADMIN_API_URL = 'https://portfolio-admin.<your-subdomain>.workers.dev'
```
Then redeploy GitHub Pages (the Actions workflow builds automatically on push to main).

### 5. Test the live admin end-to-end

- Sign in through Access (browser will redirect once).
- Sync the JSON, upload an image, delete an image, reload on another device.
- If CORS/Access redirects fail, fix the Access app and `ALLOWED_ORIGIN` before continuing.

### 6. Cleanup

After the new path is confirmed working on all devices, revoke the old PAT that was entered in the browser (Settings → Developer settings → Fine-grained tokens). Do not revoke it before migration if the live admin still depends on it.

## API contract

- `GET /api/contents?path=docs/data/portfolio-data.json`
- `PUT /api/contents?path=docs/data/portfolio-data.json` with GitHub Contents API JSON payload
- `GET/PUT/DELETE /api/contents?path=docs/data/imgs/<filename>.<extension>`

The Worker rejects all other repository paths and methods. Configure Cloudflare rate limiting for this route as an additional defense. Do not expose the Worker token or disable Access/JWT verification.

## Important limitation

This PR adds the server-side API foundation and deployment instructions. It does not by itself secure the existing live admin UI; frontend migration and Cloudflare account configuration are separate required steps. No credentials or account settings are included in this repository.
