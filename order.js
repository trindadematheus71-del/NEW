import { json } from '../_lib/auth.js';
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: 'Banco D1 não está conectado.' }, 503);
  try {
    const body = await request.json();
    for (const key of ['customer_name', 'customer_phone', 'items_json', 'total', 'payment_method']) {
      if (body[key] === undefined || String(body[key]).trim() === '') return json({ ok: false, error: 'Dados do pedido incompletos.' }, 400);
    }
    let items;
    try { items = typeof body.items_json === 'string' ? JSON.parse(body.items_json) : body.items_json; } catch (_) { return json({ ok: false, error: 'Itens do pedido inválidos.' }, 400); }
    if (!Array.isArray(items) || items.length > 100) return json({ ok: false, error: 'Itens do pedido inválidos.' }, 400);
    const result = await env.DB.prepare(`INSERT INTO orders (customer_name, customer_phone, customer_email, customer_address, items_json, total, payment_method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'novo', CURRENT_TIMESTAMP)`)
      .bind(String(body.customer_name).slice(0,160), String(body.customer_phone).slice(0,40), String(body.customer_email || '').slice(0,190), String(body.customer_address || '').slice(0,500), JSON.stringify(items), Math.max(0, Number(body.total) || 0), String(body.payment_method).slice(0,80)).run();
    return json({ ok: true, order_id: result.meta?.last_row_id || null }, 201);
  } catch (_) {
    return json({ ok: false, error: 'Não foi possível registrar o pedido. Confira se executou schema.sql no banco D1.' }, 500);
  }
}
