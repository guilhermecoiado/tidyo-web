// Sends one notification as a web push to the user's devices.
// Called by a database trigger with { id }. It sends each notification once (pushed_at),
// only to that notification's owner, so the public endpoint cannot be used to spam.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

type L = 'pt-BR' | 'en' | 'es';
const T: Record<string, [string, string, string]> = {
  job_issue: ['{who} reportou um problema em {client}', '{who} reported a problem at {client}', '{who} reportó un problema en {client}'],
  expense_pending: ['{who} enviou um gasto para aprovar', '{who} submitted an expense to approve', '{who} envió un gasto por aprobar'],
  job_completed: ['Serviço concluído em {client}', 'Job completed at {client}', 'Servicio terminado en {client}'],
  job_rated: ['{client} avaliou a visita com {rating} estrelas', '{client} rated the visit {rating} stars', '{client} calificó la visita con {rating} estrellas'],
  job_assigned: ['Novo serviço: {client}', 'New job: {client}', 'Nuevo servicio: {client}'],
  support_reply: ['O suporte respondeu sua mensagem', 'Support replied to your message', 'Soporte respondió tu mensaje'],
  message: ['Nova mensagem de {who}', 'New message from {who}', 'Nuevo mensaje de {who}'],
  tidy_daily: ['Tidy: há itens que pedem atenção hoje ({total})', 'Tidy: items need your attention today ({total})', 'Tidy: hay puntos que necesitan atención hoy ({total})'],
  route_ready: ['Sua rota de {date} está pronta: {stops} paradas', 'Your route for {date} is ready: {stops} stops', 'Tu ruta del {date} está lista: {stops} paradas'],
  join_request: ['{who} pediu para entrar na equipe', '{who} asked to join the team', '{who} pidió unirse al equipo'],
  join_approved: ['Seu acesso à equipe foi aprovado', 'Your team access was approved', 'Tu acceso al equipo fue aprobado'],
  time_auto_closed: ['O ponto de {who} ficou aberto e foi fechado após 14h. Revise as horas.', '{who}’s shift was left open and closed after 14h. Please review the hours.', 'El turno de {who} quedó abierto y se cerró a las 14h. Revisa las horas.'],
  lead_new: ['Novo pedido de orçamento: {who}', 'New quote request: {who}', 'Nuevo pedido de presupuesto: {who}'],
  proposal_accepted: ['{client} aceitou a proposta do contrato', '{client} accepted the contract proposal', '{client} aceptó la propuesta del contrato'],
  client_request: ['{client} fez um pedido: {text}', '{client} sent a request: {text}', '{client} hizo un pedido: {text}'],
};
const idx: Record<L, number> = { 'pt-BR': 0, en: 1, es: 2 };

function render(kind: string, data: Record<string, unknown>, lang: L) {
  if (kind === 'broadcast') {
    const c = (data[lang] || data.en || data['pt-BR'] || {}) as { title?: string; body?: string };
    return { title: c.title || 'Tidyo', body: c.body || '' };
  }
  const row = T[kind];
  let s = row ? row[idx[lang] ?? 1] : 'Tidyo';
  for (const [k, v] of Object.entries(data)) s = s.split(`{${k}}`).join(String(v ?? ''));
  return { title: 'Tidyo', body: s };
}

Deno.serve(async (req) => {
  try {
    const { id } = await req.json();
    if (!id) return new Response('missing id', { status: 400 });
    const { data: n } = await db.from('notifications').select('id, user_id, kind, data, link, pushed_at').eq('id', id).maybeSingle();
    if (!n || n.pushed_at) return new Response('skip');
    await db.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', id);

    const [{ data: subs }, { data: prof }, { data: cfg }] = await Promise.all([
      db.from('push_subscriptions').select('id, endpoint, p256dh, auth_key').eq('user_id', n.user_id),
      db.from('profiles').select('language').eq('id', n.user_id).maybeSingle(),
      db.rpc('push_config'),
    ]);
    if (!subs?.length || !cfg?.vapid_private) return new Response('no devices');
    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
    const msg = render(n.kind, (n.data || {}) as Record<string, unknown>, (prof?.language || 'en') as L);
    const payload = JSON.stringify({ ...msg, url: n.link || '/', tag: n.kind });

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload, { TTL: 86400 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id); // device unsubscribed
      }
    }));
    return new Response('sent');
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
