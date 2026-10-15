import { hasKey } from './i18n';

// Database rule errors → translation key (shown in the app's own toast or modal).
export function errorKey(message?: string | null): { key: string; params?: Record<string, string> } {
  if (!message) return { key: 'c.error' };
  const [code, detail, max] = message.split(':');
  if (code === 'plan_limit') return { key: `err.plan_limit.${detail}`, params: max ? { max } : undefined };
  if (/row-level security|permission denied|not_allowed|field_update_not_allowed/.test(message)) return { key: 'c.notAllowed' };
  if (/Invalid login credentials/i.test(message)) return { key: 'auth.badLogin' };
  if (/Email not confirmed/i.test(message)) return { key: 'auth.notConfirmed' };
  if (/Password should be/i.test(message)) return { key: 'auth.weak' };
  if (hasKey(`err.${code}`)) return { key: `err.${code}` };
  return { key: 'c.error' };
}
