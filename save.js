import { isAdmin, json } from '../_lib/auth.js';

function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value);
}
function mimeExt(mime) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[mime.toLowerCase()] || null;
}
async function storeImages(value, bucket, cache) {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    if (!isImageDataUrl(value)) throw new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.');
    const comma = value.indexOf(',');
    const meta = value.slice(5, comma).split(';')[0].toLowerCase();
    const ext = mimeExt(meta);
    if (!ext) throw new Error('Formato de imagem não suportado.');
    if (!bucket) throw new Error('Para salvar fotos permanentemente, conecte um bucket R2 com o nome de vínculo IMAGES no Cloudflare.');
    const binary = atob(value.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.byteLength > 5 * 1024 * 1024) throw new Error('Cada imagem deve ter no máximo 5 MB.');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hash = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
    const key = `i-${hash}.${ext}`;
    if (!cache.has(key)) {
      cache.add(key);
      await bucket.put(key, bytes, { httpMetadata: { contentType: meta, cacheControl: 'public, max-age=31536000, immutable' } });
    }
    return `/media/${key}`;
  }
  if (Array.isArray(value)) return Promise.all(value.map(v => storeImages(v, bucket, cache)));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = await storeImages(child, bucket, cache);
    return out;
  }
  return value;
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: 'Entre em /admin para acessar a administração.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'Banco D1 não está conectado. Configure a ligação DB no Cloudflare.' }, 503);
  try {
    const body = await request.json();
    if (!body || !body.settings || !Array.isArray(body.categories) || !Array.isArray(body.products)) return json({ ok: false, error: 'Dados da loja em formato inválido.' }, 400);
    if (body.products.length > 10000 || body.categories.length > 500) return json({ ok: false, error: 'A loja excedeu o limite permitido.' }, 413);
    const cache = new Set();
    const state = await storeImages({ settings: body.settings, categories: body.categories, products: body.products }, env.IMAGES, cache);
    const serialized = JSON.stringify(state);
    if (serialized.length > 1_800_000) return json({ ok: false, error: 'Os dados da loja ficaram grandes demais. Reduza o tamanho das imagens e tente novamente.' }, 413);
    await env.DB.prepare(`INSERT INTO store_state (id, state_json, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP`).bind(serialized).run();
    return json({ ok: true });
  } catch (error) {
    const message = String(error?.message || 'Erro ao salvar os dados.');
    return json({ ok: false, error: message.includes('bucket R2') || message.includes('Formato de imagem') || message.includes('imagem deve') || message.includes('grandes demais') ? message : 'Não foi possível salvar no servidor. Confira o banco D1, o vínculo de imagens R2 e o schema.sql.' }, 500);
  }
}
