/**
 * Cloudflare Worker: narrowly scoped GitHub Contents API proxy for the portfolio admin.
 *
 * Protect this Worker with Cloudflare Access AND keep the JWT verification below enabled.
 * Required Worker secrets/vars:
 *   GITHUB_TOKEN (secret): fine-grained PAT scoped to fengrong888/Portfolio, Contents read/write
 *   ADMIN_PASSWORD (secret, optional): admin UI login password, verified server-side by POST /api/auth
 *   CF_ACCESS_TEAM_DOMAIN (var): e.g. your-team.cloudflareaccess.com (no https://)
 *   CF_ACCESS_AUD (var): Access application's AUD tag
 *   ALLOWED_ORIGIN (var): https://fengrong888.github.io
 *
 * Never expose GITHUB_TOKEN to the browser. If ADMIN_PASSWORD is not set,
 * /api/auth returns 503 (Access can then be the only admin gate).
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
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Session',
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

// ---------- /api/auth：服务端密码校验（密码仅存 Secret，绝不下发前端） ----------
// 限流：按 CF-Connecting-IP 滑窗 5 分钟，失败 ≥8 次拒绝 5 分钟，防暴力破解。
const authFails = new Map();
const AUTH_WINDOW_MS = 5 * 60 * 1000;
const AUTH_MAX_FAILS = 8;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function tooManyFails(ip) {
  const now = Date.now();
  const rec = authFails.get(ip);
  if (!rec || now - rec.t > AUTH_WINDOW_MS) return false;
  return rec.n >= AUTH_MAX_FAILS;
}

function recordFail(ip) {
  const now = Date.now();
  const rec = authFails.get(ip);
  if (!rec || now - rec.t > AUTH_WINDOW_MS) authFails.set(ip, { n: 1, t: now });
  else {
    rec.n += 1;
    rec.t = now;
  }
  // 防止 Map 无限增长：超过 10k 条时清理过期项
  if (authFails.size > 10000) {
    for (const [k, v] of authFails) {
      if (now - v.t > AUTH_WINDOW_MS) authFails.delete(k);
    }
  }
}

async function handleAuth(request, env, cors) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (request.method === 'GET') {
    // 探测端点：告知前端是否启用密码登录（不泄露任何秘密）
    return response(JSON.stringify({ enabled: !!env.ADMIN_PASSWORD }), 200, cors);
  }
  if (request.method !== 'POST') {
    return response(JSON.stringify({ error: 'Method not allowed' }), 405, { ...cors, Allow: 'GET, POST, OPTIONS' });
  }
  if (!env.ADMIN_PASSWORD) {
    return response(JSON.stringify({ error: 'Password login is not enabled' }), 503, cors);
  }
  if (tooManyFails(ip)) {
    return response(JSON.stringify({ error: 'Too many attempts, try again later' }), 429, cors);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return response(JSON.stringify({ error: 'Invalid JSON body' }), 400, cors);
  }
  const pw = body && typeof body.password === 'string' ? body.password : '';
  if (pw.length > 128) {
    return response(JSON.stringify({ error: 'Bad request' }), 400, cors);
  }
  if (timingSafeEqual(pw, env.ADMIN_PASSWORD)) {
    // 签发 30 天会话令牌（HMAC 签名；密钥由两个 Secret 派生，浏览器拿到的只是令牌本身）
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const payload = btoa(JSON.stringify({ exp })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const sig = await hmacHex(`${payload}.${exp}`, sessionKey(env));
    return response(JSON.stringify({ ok: true, session: `${payload}.${sig}` }), 200, cors);
  }
  recordFail(ip);
  return response(JSON.stringify({ error: 'Wrong password' }), 401, cors);
}

// 会话密钥：由 ADMIN_PASSWORD + GITHUB_TOKEN 两个 Secret 派生，不在请求/响应中出现
function sessionKey(env) {
  return `${env.ADMIN_PASSWORD || ''}::${env.GITHUB_TOKEN || ''}`;
}

async function hmacHex(data, key) {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return [...new Uint8Array(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 校验 X-Admin-Session 令牌（密码登录签发的会话）
async function verifySession(request, env) {
  const tok = request.headers.get('X-Admin-Session');
  if (!tok || typeof tok !== 'string') return false;
  const m = tok.match(/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/);
  if (!m) return false;
  let payload;
  try {
    payload = JSON.parse(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return false;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return false;
  const sig = await hmacHex(`${m[1]}.${payload.exp}`, sessionKey(env));
  return timingSafeEqual(sig, m[2]);
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
    // 密码登录端点：在 Access JWT 校验之前放行（Access 应用应排除 /api/auth 路径，
    // 或将其作为 Access 之外的独立登录入口；若 Access 覆盖了该路径，则只能走 Access 登录）
    if (url.pathname === '/api/auth') {
      return handleAuth(request, env, cors);
    }
    if (url.pathname !== '/api/contents') {
      return response(JSON.stringify({ error: 'Not found' }), 404, cors);
    }
    if (!['GET', 'PUT', 'POST', 'DELETE'].includes(request.method)) {
      return response(JSON.stringify({ error: 'Method not allowed' }), 405, { ...cors, Allow: 'GET, PUT, POST, DELETE, OPTIONS' });
    }
    // 鉴权：Cloudflare Access JWT 或密码登录签发的会话令牌，二者任一有效即放行。
    // 未配置 Access 环境变量时（接入前），仅密码会话生效。
    const authed = (await verifyAccessJwt(request, env)) || (await verifySession(request, env));
    if (!authed) {
      return response(JSON.stringify({ error: 'Unauthorized' }), 401, cors);
    }
    if (!env.GITHUB_TOKEN) {
      return response(JSON.stringify({ error: 'Server is not configured' }), 503, cors);
    }

    // 目标路径：优先取请求体 body.path（规避 Cloudflare WAF 对 query 路径穿越模式
    // 的拦截，国内账户常命中 "administrative rules" 403）；旧版 query ?path= 仍兼容。
    let path = url.searchParams.get('path') || '';
    let body = null;
    if (request.method !== 'GET') {
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > 9_000_000) return response(JSON.stringify({ error: 'Payload too large' }), 413, cors);
      try {
        body = await request.json();
      } catch {
        return response(JSON.stringify({ error: 'Invalid JSON body' }), 400, cors);
      }
      if (!body || typeof body !== 'object') {
        return response(JSON.stringify({ error: 'Invalid JSON body' }), 400, cors);
      }
      if (typeof body.path === 'string') path = body.path;
      // 写操作校验：POST/PUT 写 JSON 需 content；DELETE 需 sha
      if (request.method === 'DELETE') {
        if (typeof body.sha !== 'string') {
          return response(JSON.stringify({ error: 'A file SHA is required for deletion' }), 400, cors);
        }
      } else if (!(request.method === 'POST' && typeof body.content !== 'string')) {
        if (typeof body.content !== 'string' || body.content.length > 8_500_000) {
          return response(JSON.stringify({ error: 'Invalid or oversized content' }), 413, cors);
        }
      }
    }
    if (!allowedPath(path)) {
      return response(JSON.stringify({ error: 'Path not allowed' }), 400, cors);
    }

    // 映射到 GitHub Contents API：
    //   GET 读；POST 读（仅 body.path）→ GitHub GET；POST 写（带 content）/ PUT → GitHub PUT；DELETE → GitHub DELETE
    let upMethod = request.method;
    let upBody = body;
    if (request.method === 'POST') {
      if (body && typeof body.content === 'string') upMethod = 'PUT';
      else {
        upMethod = 'GET';
        upBody = null;
      }
    }
    if (upMethod === 'PUT' && body && typeof body.message !== 'string') {
      return response(JSON.stringify({ error: 'Invalid GitHub contents payload' }), 400, cors);
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(upBody ? { 'Content-Type': 'application/json' } : {}),
    };
    let upstream;
    try {
      upstream = await fetch(API + path.split('/').map(encodeURIComponent).join('/'), {
        method: upMethod,
        headers,
        ...(upBody ? { body: JSON.stringify(upBody) } : {}),
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
