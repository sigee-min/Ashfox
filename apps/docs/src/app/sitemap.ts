import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { defaultLocale, locales } from '@/lib/i18n';
import { toAbsoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

const docsPath = (locale: string, slugs: string[]): string =>
  `/${locale}/docs${slugs.length > 0 ? `/${slugs.join('/')}` : ''}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  locales.forEach((locale) => {
    const homeUrl = toAbsoluteUrl(`/${locale}`);
    if (!seen.has(homeUrl)) {
      entries.push({ url: homeUrl, lastModified: now });
      seen.add(homeUrl);
    }
  });

  source.getPages().forEach((page) => {
    const locale = page.locale ?? defaultLocale;
    const url = toAbsoluteUrl(docsPath(locale, page.slugs));
    if (seen.has(url)) return;
    entries.push({ url, lastModified: now });
    seen.add(url);
  });

  const llmsTxt = toAbsoluteUrl('/llms.txt');
  const llmsFull = toAbsoluteUrl('/llms-full.txt');
  if (!seen.has(llmsTxt)) {
    entries.push({ url: llmsTxt, lastModified: now });
    seen.add(llmsTxt);
  }
  if (!seen.has(llmsFull)) {
    entries.push({ url: llmsFull, lastModified: now });
    seen.add(llmsFull);
  }

  return entries;
}
