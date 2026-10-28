/**
 * Cloudflare Worker: narrowly scoped GitHub Contents API proxy for the portfolio admin.
 *
 * Protect this Worker with Cloudflare Access AND keep the JWT verification below enabled.
 * Required Worker secrets/vars:
 *   GITHUB_TOKEN (secret): fine-grained PAT scoped to fengrong888/Portfolio, Contents read/write
 *   CF_ACCESS_TEAM_DOMAIN (var): e.g. your-team.cloudflareaccess.com (no https://)
 *   CF_ACCESS_AUD (var): Access application's AUD tag
 *   ALLOWED_ORIGIN (var): https://fengrong888.github.io
 *
 * Never expose GITHUB_TOKEN to the browser.
 */
const REPO = 'fengrong888/Portfolio';
const API = `https://api.github.com/repos/${REPO}/contents/`;
const JSON_FILE = 'docs/data/portfolio-data.json';
const IMAGE_PREFIX = 'docs/data/imgs/';

let jwksCache = null;
let jwksFetchedAt = 0;

function response(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || 'https://fengrong888.github.io';
  if (origin !== allowed) return {};
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getJwks(teamDomain) {
  const now = Date.now();
  if (jwksCache && now - jwksFetchedAt < 10 * 60 * 1000) return jwksCache;
  const domain = teamDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const res = await fetch(`https://${domain}/cdn-cgi/access/certs`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Unable to retrieve Access signing keys');
  jwksCache = await res.json();
  jwksFetchedAt = now;
  return jwksCache;
}

async function verifyAccessJwt(request, env) {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return false;
  try {
    const parts = assertion.split('.');
    if (parts.length !== 3) return false;
    const header = decodeJsonPart(parts[0]);
    const payload = decodeJsonPart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return false;

    const domain = env.CF_ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const issuer = `https://${domain}`;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== issuer || !Array.isArray(payload.aud) || !payload.aud.includes(env.CF_ACCESS_AUD)) return false;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return false;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return false;

    const jwks = await getJwks(domain);
    const jwk = (jwks.keys || []).find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(parts[2]),
      signed,
    );
  } catch {
    return false;
  }
}

function allowedPath(path) {
  if (path === JSON_FILE) return true;
  if (!path.startsWith(IMAGE_PREFIX)) return false;
  if (path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  // 严格文件名校验：仅允许安全字符、单扩展名、≤120 字符，防路径注入与畸形文件名
  const name = path.slice(IMAGE_PREFIX.length);
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(name)) return false;
  return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(name);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      if (origin !== (env.ALLOWED_ORIGIN || 'https://fengrong888.github.io')) {
        return response(JSON.stringify({ error: 'Origin not allowed' }), 403);
      }
      return new Response(null, { status: 204, headers: cors });
    }
    if (!cors['Access-Control-Allow-Origin']) {
      return response(JSON.stringify({ error: 'Origin not allowed' }), 403);
    }
    if (url.pathname !== '/api/contents') {
      return response(JSON.stringify({ error: 'Not found' }), 404, cors);
    }
    if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
      return response(JSON.stringify({ error: 'Method not allowed' }), 405, { ...cors, Allow: 'GET, PUT, DELETE, OPTIONS' });
    }
    if (!await verifyAccessJwt(request, env)) {
      return response(JSON.stringify({ error: 'Unauthorized' }), 401, cors);
    }
    if (!env.GITHUB_TOKEN) {
      return response(JSON.stringify({ error: 'Server is not configured' }), 503, cors);
    }

    const path = url.searchParams.get('path') || '';
    if (!allowedPath(path)) {
      return response(JSON.stringify({ error: 'Path not allowed' }), 400, cors);
    }

    let body;
    if (request.method !== 'GET') {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 9_000_000) return response(JSON.stringify({ error: 'Payload too large' }), 413, cors);
      try {
        body = await request.json();
      } catch {
        return response(JSON.stringify({ error: 'Invalid JSON body' }), 400, cors);
      }
      if (!body || typeof body !== 'object' || typeof body.message !== 'string') {
        return response(JSON.stringify({ error: 'Invalid GitHub contents payload' }), 400, cors);
      }
      if (request.method === 'PUT' && (typeof body.content !== 'string' || body.content.length > 8_500_000)) {
        return response(JSON.stringify({ error: 'Invalid or oversized content' }), 413, cors);
      }
      if (request.method === 'DELETE' && typeof body.sha !== 'string') {
        return response(JSON.stringify({ error: 'A file SHA is required for deletion' }), 400, cors);
      }
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    };
    let upstream;
    try {
      upstream = await fetch(API + path.split('/').map(encodeURIComponent).join('/'), {
        method: request.method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await upstream.text();
      return new Response(payload, {
        status: upstream.status,
        headers: {
          ...cors,
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return response(JSON.stringify({ error: 'GitHub API unavailable' }), 502, cors);
    }
  },
};
