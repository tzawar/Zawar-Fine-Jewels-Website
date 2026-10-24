// ZAWAR Fine Jewels — Cloudflare Worker
// - Serves the static site in ./public
// - Redirects zawarfinejewels.in and www.* to https://zawarfinejewels.com
// - POST /api/notify saves a "notify me" sign-up into Supabase (table: launch_signups)
//
// Secrets (set in Cloudflare → Worker → Settings → Variables and Secrets):
//   SUPABASE_URL               e.g. https://abcd1234.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase → Project Settings → API keys → service_role / secret key

const PRIMARY_HOST = 'zawarfinejewels.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Canonical domain: .in and www → zawarfinejewels.com
    const host = url.hostname.toLowerCase();
    const isOurDomain = host.endsWith('zawarfinejewels.com') || host.endsWith('zawarfinejewels.in');
    if (isOurDomain && host !== PRIMARY_HOST) {
      url.hostname = PRIMARY_HOST;
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }

    // 2. Sign-up API
    if (url.pathname === '/api/notify') {
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
      }
      return handleNotify(request, env);
    }

    // 3. Video: answer byte-range requests (iPhone Safari needs these to play video)
    if (url.pathname.endsWith('.mp4')) {
      return serveVideo(request, env);
    }

    // 4. Everything else: static files
    const res = await env.ASSETS.fetch(request);
    return withSecurityHeaders(res);
  },
};

async function serveVideo(request, env) {
  const assetReq = new Request(new URL(request.url).toString(), { method: 'GET' });
  const res = await env.ASSETS.fetch(assetReq);
  if (!res.ok) return res;

  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const base = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
  };

  const range = request.headers.get('Range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m) {
    return new Response(request.method === 'HEAD' ? null : buf, { status: 200, headers: { ...base, 'Content-Length': String(size) } });
  }

  let start, end;
  if (m[1] === '') {            // bytes=-500 → last 500 bytes
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } });
  }

  const chunk = buf.slice(start, end + 1);
  return new Response(request.method === 'HEAD' ? null : chunk, {
    status: 206,
    headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(chunk.byteLength) },
  });
}

async function handleNotify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (body && typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase secrets are not set');
    return json({ error: 'Sign-ups are not open yet. Please write to concierge@zawarfinejewels.com.' }, 503);
  }

  const row = {
    email,
    source: 'launching-soon',
    country: request.cf && request.cf.country ? request.cf.country : null,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 300),
  };

  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/launch_signups?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      // Same email twice = quietly ignored, still a success for the visitor
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    console.error('Supabase insert failed', res.status, await res.text());
    return json({ error: 'Something went wrong. Please try again, or write to concierge@zawarfinejewels.com.' }, 502);
  }

  return json({ ok: true });
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

function withSecurityHeaders(res) {
  const r = new Response(res.body, res);
  r.headers.set('X-Content-Type-Options', 'nosniff');
  r.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  r.headers.set('X-Frame-Options', 'SAMEORIGIN');
  r.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return r;
}
