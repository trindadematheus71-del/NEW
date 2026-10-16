const enc = new TextEncoder();

function b64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function unb64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function getKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(secret) {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })));
  const key = await getKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return `${payload}.${b64url(signature)}`;
}

export async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)luxx_admin=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split('.');
  if (parts.length !== 2) return false;
  try {
    const key = await getKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify('HMAC', key, unb64url(parts[1]), enc.encode(parts[0]));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
    return Number(payload.exp) > Date.now();
  } catch (_) {
    return false;
  }
}

export function sessionCookie(token) {
  return `luxx_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

export function clearSessionCookie() {
  return 'luxx_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders }
  });
}
