import { BellRing, CheckCheck, ShieldAlert, Sparkles } from 'lucide-react';

import { formatRelativeTime, type AppNotification, type Locale } from '@hse/shared';

import { markAllNotificationsReadAction } from '@/app/actions/alerts';

export function NotificationList({
  notifications,
  unreadCount,
  locale,
  t,
}: {
  notifications: AppNotification[];
  unreadCount: number;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <section id="notifications" className="rounded-3xl border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">{t('dashboard.notifications')}</h2>
          <p className="text-[11px] text-ink-400">
            {unreadCount} {t('dashboard.unread')}
          </p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2.5 py-1.5 text-[10px] font-semibold text-ink-600 transition hover:text-ink-900"
            >
              <CheckCheck className="size-3" aria-hidden />
              {t('dashboard.markAllRead')}
            </button>
          </form>
        ) : null}
      </div>

      <ul className="divide-y divide-ink-100">
        {notifications.length === 0 ? (
          <li className="px-5 py-10 text-center text-xs text-ink-400">{t('dashboard.noChanges')}</li>
        ) : (
          notifications.map((notification) => {
            const Icon =
              notification.type === 'compliance_update'
                ? ShieldAlert
                : notification.type === 'broadcast'
                  ? Sparkles
                  : BellRing;
            return (
              <li
                key={notification.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${
                  notification.readAt ? '' : 'bg-brand-50/30'
                }`}
              >
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${
                    notification.type === 'compliance_update'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-brand-50 text-brand-700'
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink-900">{notification.titleKey}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                    {notification.body}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] text-ink-400">
                    {formatRelativeTime(notification.createdAt, locale)}
                  </span>
                  {!notification.readAt ? (
                    <span className="size-1.5 rounded-full bg-brand-600" aria-label="unread" />
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
