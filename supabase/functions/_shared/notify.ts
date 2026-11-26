import type { SupabaseClient } from '@supabase/supabase-js';

import type { AlertEvaluation } from './alerts.ts';
import { HttpError, optionalEnv } from './http.ts';
import { adminClient } from './supabase.ts';

export type Locale = 'en' | 'ar' | 'es';

interface EmailTemplates {
  subject: string;
  intro: string;
  price: string;
  rsi: string;
  sma: string;
  macd: string;
  volume: string;
  complianceDowngrade: string;
  complianceOk: string;
  cta: string;
  footer: string;
}

const TEMPLATES: Record<Locale, EmailTemplates> = {
  en: {
    subject: 'Halal alert: {symbol}',
    intro: 'A price alert you set has been triggered.',
    price: '{symbol} is trading at {price}, meeting your target of {target} ({direction}).',
    rsi: "{symbol}'s RSI is {value} (threshold {threshold}).",
    sma: '{symbol} is at {value}, crossing your moving-average level of {threshold}.',
    macd: "{symbol}'s MACD is {value} (signal {threshold}).",
    volume: '{symbol} volume is {value}× its 20-day average (threshold {threshold}×).',
    complianceDowngrade:
      '{symbol} is no longer classified as halal ({status}). Review your holdings.',
    complianceOk: '{symbol} remains compliant.',
    cta: 'Open your dashboard',
    footer: 'You are receiving this because you enabled email alerts. Manage them in Settings.',
  },
  ar: {
    subject: 'تنبيه حلال: {symbol}',
    intro: 'تم تحقق تنبيه سعري قمت بإعداده.',
    price: '{symbol} يتداول عند {price}، محققاً هدفك {target} ({direction}).',
    rsi: 'مؤشر القوة النسبية لـ {symbol} هو {value} (الحد {threshold}).',
    sma: '{symbol} عند {value}، متجاوزاً متوسطك المتحرك {threshold}.',
    macd: 'مؤشر MACD لـ {symbol} هو {value} (الإشارة {threshold}).',
    volume: 'حجم تداول {symbol} يساوي {value}× متوسط 20 يوماً (الحد {threshold}×).',
    complianceDowngrade:
      'لم يعد {symbol} مصنفاً كحلال ({status}). راجع حيازاتك.',
    complianceOk: 'لا يزال {symbol} متوافقاً.',
    cta: 'افتح لوحة التحكم',
    footer: 'تصل إليك هذه الرسالة لأنك فعّلت تنبيهات البريد. يمكنك إدارتها من الإعدادات.',
  },
  es: {
    subject: 'Alerta halal: {symbol}',
    intro: 'Se ha activado una alerta de precio que configuraste.',
    price: '{symbol} cotiza a {price}, alcanzando tu objetivo de {target} ({direction}).',
    rsi: 'El RSI de {symbol} es {value} (umbral {threshold}).',
    sma: '{symbol} está en {value}, cruzando tu media móvil de {threshold}.',
    macd: 'El MACD de {symbol} es {value} (señal {threshold}).',
    volume: 'El volumen de {symbol} es {value}× su media de 20 días (umbral {threshold}×).',
    complianceDowngrade:
      '{symbol} ya no se clasifica como halal ({status}). Revisa tus posiciones.',
    complianceOk: '{symbol} sigue siendo conforme.',
    cta: 'Abrir tu panel',
    footer: 'Recibes esto porque activaste alertas por correo. Gestiónalas en Ajustes.',
  },
};

const MESSAGE_KEY_TO_TEMPLATE: Record<string, keyof EmailTemplates> = {
  'alerts.messages.price': 'price',
  'alerts.messages.rsi': 'rsi',
  'alerts.messages.sma': 'sma',
  'alerts.messages.macd': 'macd',
  'alerts.messages.volume': 'volume',
  'alerts.messages.complianceDowngrade': 'complianceDowngrade',
  'alerts.messages.complianceOk': 'complianceOk',
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderAlertEmail(input: {
  locale: Locale;
  evaluation: AlertEvaluation;
  appUrl: string;
}): RenderedEmail {
  const locale: Locale = input.locale in TEMPLATES ? input.locale : 'en';
  const templates = TEMPLATES[locale];
  const templateKey = MESSAGE_KEY_TO_TEMPLATE[input.evaluation.messageKey] ?? 'intro';
  const params = {
    ...input.evaluation.messageParams,
    price: input.evaluation.observedValue ?? '',
    value: input.evaluation.observedValue ?? '',
    target: input.evaluation.targetValue ?? '',
  };

  const detail =
    typeof templates[templateKey] === 'string' && templateKey !== 'subject'
      ? interpolate(templates[templateKey] as string, params)
      : interpolate(templates.intro, params);
  const subject = interpolate(templates.subject, params);
  const text = `${interpolate(templates.intro, params)}\n\n${detail}\n\n${templates.cta}: ${input.appUrl}\n\n${templates.footer}`;
  const html = `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;padding:24px;color:#111">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e5e7eb">
      <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin:0 0 12px">Halal Stock Engine</p>
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(subject)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 12px">${escapeHtml(interpolate(templates.intro, params))}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#f0fdfa;border-radius:10px">${escapeHtml(detail)}</p>
      <a href="${escapeHtml(input.appUrl)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600">${escapeHtml(templates.cta)}</a>
      <p style="font-size:12px;color:#6b7280;margin:24px 0 0">${escapeHtml(templates.footer)}</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<string | null> {
  const apiKey = optionalEnv('RESEND_API_KEY');
  if (!apiKey) throw new HttpError(503, 'email_not_configured');
  const from = optionalEnv('ALERT_EMAIL_FROM') ?? 'Halal Stock Engine <alerts@halalstockengine.app>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) throw new HttpError(502, 'email_send_failed', payload.message);
  return payload.id ?? null;
}

export async function sendExpoPush(
  messages: Array<{ to: string; title: string; body: string; data?: Record<string, unknown> }>,
): Promise<{ sent: number; errors: number; tickets: unknown }> {
  if (messages.length === 0) return { sent: 0, errors: 0, tickets: null };
  const token = optionalEnv('EXPO_PUSH_ACCESS_TOKEN');
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(
      messages.map((message) => ({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
        sound: 'default',
        priority: 'high',
        channelId: 'alerts',
      })),
    ),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ status?: string; message?: string }>;
  };
  if (!response.ok) throw new HttpError(502, 'push_send_failed');
  const tickets = payload.data ?? [];
  const errors = tickets.filter((ticket) => ticket.status === 'error').length;
  return { sent: tickets.length - errors, errors, tickets: payload };
}

/**
 * Fan-out for a triggered alert: in-app row, queued deliveries, then email and
 * push attempts. Individual channel failures never fail the whole batch.
 */
export async function dispatchAlert(input: {
  admin?: SupabaseClient;
  userId: string;
  email: string | null;
  locale: Locale;
  symbol: string;
  evaluation: AlertEvaluation;
  stockId: string;
  alertId: string;
  eventId: string;
  notifyEmail: boolean;
  notifyPush: boolean;
  appUrl: string;
}): Promise<{ email: 'sent' | 'failed' | 'skipped'; push: 'sent' | 'failed' | 'skipped' }> {
  const admin = input.admin ?? adminClient();
  const rendered = renderAlertEmail({
    locale: input.locale,
    evaluation: input.evaluation,
    appUrl: input.appUrl,
  });

  await admin.from('notifications').insert({
    user_id: input.userId,
    type: 'alert_triggered',
    title_key: rendered.subject,
    body: rendered.text.split('\n').filter(Boolean)[1] ?? rendered.subject,
    data: {
      alertId: input.alertId,
      stockId: input.stockId,
      symbol: input.symbol,
      eventId: input.eventId,
    },
  });

  const deliveryIds: Record<'email' | 'push', string | null> = { email: null, push: null };

  if (input.notifyEmail && input.email) {
    const { data } = await admin
      .from('notification_deliveries')
      .insert({
        alert_event_id: input.eventId,
        user_id: input.userId,
        channel: 'email',
        status: 'queued',
      })
      .select('id')
      .single();
    deliveryIds.email = data?.id ?? null;
  }

  if (input.notifyPush) {
    const { data } = await admin
      .from('notification_deliveries')
      .insert({
        alert_event_id: input.eventId,
        user_id: input.userId,
        channel: 'push',
        status: 'queued',
      })
      .select('id')
      .single();
    deliveryIds.push = data?.id ?? null;
  }

  let email: 'sent' | 'failed' | 'skipped' = 'skipped';
  if (input.notifyEmail && input.email) {
    try {
      const providerId = await sendEmail({
        to: input.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      email = 'sent';
      if (deliveryIds.email) {
        await admin
          .from('notification_deliveries')
          .update({ status: 'sent', provider_id: providerId, sent_at: new Date().toISOString() })
          .eq('id', deliveryIds.email);
      }
    } catch (error) {
      email = 'failed';
      console.error('[dispatchAlert] email failed', error);
      if (deliveryIds.email) {
        await admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
          })
          .eq('id', deliveryIds.email);
      }
    }
  }

  let push: 'sent' | 'failed' | 'skipped' = 'skipped';
  if (input.notifyPush) {
    try {
      const { data: tokens } = await admin
        .from('push_tokens')
        .select('token')
        .eq('user_id', input.userId);
      const list = (tokens ?? []).map((row) => row.token as string);
      if (list.length > 0) {
        const result = await sendExpoPush(
          list.map((token) => ({
            to: token,
            title: rendered.subject,
            body: rendered.text.split('\n').filter(Boolean)[1] ?? rendered.subject,
            data: { alertId: input.alertId, stockId: input.stockId },
          })),
        );
        push = result.sent > 0 ? 'sent' : 'failed';
      }
      if (deliveryIds.push) {
        await admin
          .from('notification_deliveries')
          .update({
            status: push === 'sent' ? 'sent' : push === 'failed' ? 'failed' : 'skipped',
            sent_at: push === 'sent' ? new Date().toISOString() : null,
          })
          .eq('id', deliveryIds.push);
      }
    } catch (error) {
      push = 'failed';
      console.error('[dispatchAlert] push failed', error);
      if (deliveryIds.push) {
        await admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            error: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
          })
          .eq('id', deliveryIds.push);
      }
    }
  }

  return { email, push };
}
