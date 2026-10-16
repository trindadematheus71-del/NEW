export async function onRequestGet({ params, env }) {
  const key = String(params.key || '');
  if (!/^i-[a-f0-9]{64}\.(png|jpg|webp|gif)$/.test(key)) return new Response('Não encontrado', { status: 404 });
  if (!env.IMAGES) return new Response('Armazenamento de imagens não configurado', { status: 503 });
  const object = await env.IMAGES.get(key);
  if (!object) return new Response('Não encontrado', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(object.body, { headers });
}
