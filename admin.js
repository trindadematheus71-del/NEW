import { createSessionToken, isAdmin, sessionCookie, clearSessionCookie } from './_lib/auth.js';

const page = (message = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#191919"><title>Administração | LUXX STORE AD</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:18px;background:#f6f1f2;color:#191919;font-family:Arial,sans-serif}.box{background:#fff;padding:28px;border-radius:18px;width:min(410px,100%);box-shadow:0 12px 40px #00000010}h1{margin-top:0;font-size:1.55rem}p{line-height:1.5;color:#5f585a}label{display:block;font-weight:bold;margin:18px 0 7px}input,button,a{width:100%;padding:13px;border-radius:10px;font:inherit}input{border:1px solid #ddd}button,a{display:block;margin-top:14px;border:0;background:#191919;color:#fff;text-align:center;text-decoration:none;font-weight:bold;cursor:pointer}.back{background:#eee;color:#191919}.error{color:#a72c3b;background:#fff0f1;padding:10px;border-radius:8px}</style></head><body><main class="box"><h1>LUXX STORE AD</h1><p>Área reservada ao proprietário da loja.</p>${message ? `<p class="error">${message}</p>` : ''}<form method="post" action="/admin"><label for="password">Senha administrativa</label><input id="password" name="password" type="password" required autocomplete="current-password"><button type="submit">Entrar para editar</button></form><a class="back" href="/">Voltar à loja</a></main></body></html>`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.searchParams.get('logout') === '1') {
    return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'GET') {
    if (await isAdmin(request, env)) return Response.redirect(new URL('/', request.url), 302);
    return new Response(page(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }

  if (request.method !== 'POST') return new Response('Método não permitido', { status: 405, headers: { Allow: 'GET, POST' } });
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return new Response(page('A configuração administrativa ainda não foi concluída no Cloudflare. Configure os secrets ADMIN_PASSWORD e SESSION_SECRET.'), { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const form = await request.formData();
  const password = String(form.get('password') || '');
  if (!password || password !== env.ADMIN_PASSWORD) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return new Response(page('Senha incorreta. Tente novamente.'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': sessionCookie(token), 'Cache-Control': 'no-store' } });
}
