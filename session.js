import { isAdmin, json } from '../_lib/auth.js';
export async function onRequestGet({ request, env }) {
  return json({ ok: true, admin: await isAdmin(request, env) });
}
