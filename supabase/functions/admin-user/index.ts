// Tidyo superadmin: edit a customer's company and people (name, phone, e-mail) and set a temporary password.
// Only platform admins (is_platform_admin) can call it; every change goes to audit_log.
import { createClient } from 'npm:@supabase/supabase-js@2.46.1';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

function tempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = crypto.getRandomValues(new Uint8Array(10));
  return 'Tdy-' + Array.from(a, (b) => chars[b % chars.length]).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const caller = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const [{ data: me }, { data: ok }] = await Promise.all([caller.auth.getUser(), caller.rpc('is_platform_admin')]);
    if (!me?.user || !ok) return json({ error: 'not_allowed' }, 403);
    const body = await req.json() as { action: string; company_id: string; user_id?: string; name?: string; state?: string; address?: string; full_name?: string; phone?: string; email?: string;
      mode?: string; plan?: string; has_commercial?: boolean; commercial_tier?: number | null; interval?: string; status?: string; trial_ends_at?: string | null; current_period_end?: string | null };
    const { action, company_id } = body;
    if (!company_id) return json({ error: 'company_required' }, 400);
    const audit = (what: string, detail: Record<string, unknown>, row?: string) =>
      admin.from('audit_log').insert({ company_id, actor_id: me.user!.id, action: 'admin_' + what, table_name: 'admin-user', row_id: row || company_id, detail });
    // the user must belong to that company
    const inCompany = async (uid: string) => {
      const { data } = await admin.from('memberships').select('id').eq('company_id', company_id).eq('user_id', uid).limit(1);
      return !!data?.length;
    };

    if (action === 'get') {
      const [{ data: company }, { data: members }] = await Promise.all([
        admin.from('companies').select('id, name, state, address, mode, created_at, subscriptions(plan, status, has_commercial, commercial_tier, interval, trial_ends_at, current_period_end, discount_pct)').eq('id', company_id).maybeSingle(),
        admin.from('memberships').select('id, user_id, display_name, role, status').eq('company_id', company_id).not('user_id', 'is', null).order('created_at'),
      ]);
      const people = [];
      for (const m of members || []) {
        const [{ data: u }, { data: p }] = await Promise.all([admin.auth.admin.getUserById(m.user_id), admin.from('profiles').select('full_name, phone').eq('id', m.user_id).maybeSingle()]);
        people.push({ ...m, email: u?.user?.email || '', full_name: p?.full_name || m.display_name, phone: p?.phone || '', last_sign_in_at: u?.user?.last_sign_in_at || null, must_change_password: !!u?.user?.user_metadata?.must_change_password });
      }
      return json({ company, people });
    }
    if (action === 'update_company') {
      const patch: Record<string, unknown> = {};
      if (body.name?.trim()) patch.name = body.name.trim();
      if (body.state !== undefined) patch.state = body.state || null;
      if (body.address !== undefined) patch.address = body.address || null;
      if (body.mode && ['residential', 'commercial', 'both'].includes(body.mode)) patch.mode = body.mode;
      const { error } = await admin.from('companies').update(patch).eq('id', company_id);
      if (error) return json({ error: error.message }, 400);
      await audit('edit_company', patch);
      return json({ ok: true });
    }
    if (action === 'update_subscription') {
      const plans = ['essencial', 'pro', 'comercial'], statuses = ['trialing', 'active', 'past_due', 'paused', 'canceled'];
      if (!body.plan || !plans.includes(body.plan) || !body.status || !statuses.includes(body.status)) return json({ error: 'invalid_plan' }, 400);
      const com = body.plan === 'comercial' || (body.plan === 'pro' && !!body.has_commercial);
      const tier = com ? Math.min(4, Math.max(1, Number(body.commercial_tier) || 1)) : null;
      const patch = { plan: body.plan, has_commercial: com, commercial_tier: tier, interval: body.interval === 'year' ? 'year' : 'month', status: body.status,
        trial_ends_at: body.trial_ends_at || null, current_period_end: body.current_period_end || null, cancel_at_period_end: false, updated_at: new Date().toISOString() };
      const { error } = await admin.from('subscriptions').update(patch).eq('company_id', company_id);
      if (error) return json({ error: error.message }, 400);
      // the company must be able to use what the plan sells
      const mode = body.plan === 'essencial' ? 'residential' : body.plan === 'comercial' ? 'commercial' : com ? 'both' : 'residential';
      await admin.from('companies').update({ mode }).eq('id', company_id);
      await audit('edit_subscription', { ...patch, mode });
      return json({ ok: true });
    }
    if (!body.user_id || !(await inCompany(body.user_id))) return json({ error: 'user_not_in_company' }, 400);
    const uid = body.user_id;
    if (action === 'update_user') {
      if (body.email !== undefined) {
        const email = body.email.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
        const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
        if (error) return json({ error: error.message }, 400);
      }
      const prof: Record<string, unknown> = {};
      if (body.full_name?.trim()) prof.full_name = body.full_name.trim();
      if (body.phone !== undefined) prof.phone = body.phone.trim() || null;
      if (Object.keys(prof).length) {
        await admin.from('profiles').update(prof).eq('id', uid);
        if (prof.full_name) await admin.from('memberships').update({ display_name: prof.full_name }).eq('company_id', company_id).eq('user_id', uid);
      }
      await audit('edit_user', { email: body.email, ...prof }, uid);
      return json({ ok: true });
    }
    if (action === 'temp_password') {
      const password = tempPassword();
      const { data: u } = await admin.auth.admin.getUserById(uid);
      const { error } = await admin.auth.admin.updateUserById(uid, { password, user_metadata: { ...(u?.user?.user_metadata || {}), must_change_password: true } });
      if (error) return json({ error: error.message }, 400);
      await audit('temp_password', {}, uid);
      return json({ ok: true, password });
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
