import type { Locale } from '@/lib/i18n';

export type DocsTrackId = 'blockbench-plugin' | 'ashfox' | 'mcp-spec';

type TrackMeta = {
  id: DocsTrackId;
  href: string;
  label: Record<Locale, string>;
};

const TRACKS: TrackMeta[] = [
  {
    id: 'blockbench-plugin',
    href: '/docs/users/blockbench-plugin',
    label: {
      en: 'Blockbench Plugin',
      ko: 'Blockbench Plugin',
    },
  },
  {
    id: 'ashfox',
    href: '/docs/users/ashfox',
    label: {
      en: 'Ashfox',
      ko: 'Ashfox',
    },
  },
  {
    id: 'mcp-spec',
    href: '/docs/users/mcp-spec',
    label: {
      en: 'MCP Spec',
      ko: 'MCP Spec',
    },
  },
];

const BLOCKBENCH_LEGACY_SECTIONS = new Set(['installation', 'getting-started', 'guides', 'tool-reference']);
const MCP_SPEC_TROUBLESHOOTING_PAGES = new Set([
  'revision-and-concurrency',
  'schema-and-client-cache',
  'validation-and-export',
]);

export function resolveDocsTrack(slug: string[] | undefined): DocsTrackId | null {
  if (!slug || slug.length < 2) return null;
  if (slug[0] !== 'users') return null;

  const section = slug[1];
  if (section === 'blockbench-plugin') return 'blockbench-plugin';
  if (section === 'ashfox') return 'ashfox';
  if (section === 'mcp-spec') return 'mcp-spec';

  if (BLOCKBENCH_LEGACY_SECTIONS.has(section)) return 'blockbench-plugin';

  if (section === 'troubleshooting') {
    const page = slug[2];
    if (page === 'connectivity') return 'ashfox';
    if (page && MCP_SPEC_TROUBLESHOOTING_PAGES.has(page)) return 'mcp-spec';
    return 'blockbench-plugin';
  }

  return null;
}

export function getTrackItems(locale: Locale, activeTrack: DocsTrackId) {
  return TRACKS.map((track) => ({
    id: track.id,
    href: `/${locale}${track.href}`,
    label: track.label[locale],
    active: track.id === activeTrack,
  }));
}

export function getTrackLabel(locale: Locale, track: DocsTrackId | null): string {
  if (!track) return locale === 'ko' ? '일반 문서' : 'General Docs';
  const found = TRACKS.find((item) => item.id === track);
  return found ? found.label[locale] : track;
}
