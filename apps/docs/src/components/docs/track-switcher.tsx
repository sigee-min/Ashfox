import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getTrackItems, type DocsTrackId } from '@/lib/docs-track';

type TrackSwitcherProps = {
  locale: Locale;
  activeTrack: DocsTrackId;
};

export function TrackSwitcher({ locale, activeTrack }: TrackSwitcherProps) {
  const items = getTrackItems(locale, activeTrack);
  const title = locale === 'ko' ? '트랙 빠른 전환' : 'Track switch';

  return (
    <aside className="bb-track-switcher" aria-label={title}>
      <p className="bb-track-switcher__title">{title}</p>
      <div className="bb-track-switcher__list">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={item.active ? 'bb-track-switcher__item is-active' : 'bb-track-switcher__item'}
            aria-current={item.active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
