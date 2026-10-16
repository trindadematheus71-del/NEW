import { json } from '../_lib/auth.js';
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ ok: false, error: 'Banco D1 não está conectado. Configure a ligação DB no Cloudflare.' }, 503);
  try {
    const row = await env.DB.prepare('SELECT state_json FROM store_state WHERE id = 1').first();
    return json({ ok: true, state: row ? JSON.parse(row.state_json) : null });
  } catch (error) {
    return json({ ok: false, error: 'Não foi possível ler os dados da loja. Confira se executou schema.sql no D1.' }, 500);
  }
}
