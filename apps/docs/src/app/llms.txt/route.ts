import { source } from '@/lib/source';
import { defaultLocale } from '@/lib/i18n';
import { toAbsoluteUrl } from '@/lib/site';

export const revalidate = false;

const docsPath = (locale: string, slugs: string[]): string =>
  `/${locale}/docs${slugs.length > 0 ? `/${slugs.join('/')}` : ''}`;

export async function GET() {
  const pages = source
    .getPages()
    .map((page) => {
      const locale = page.locale ?? defaultLocale;
      const url = toAbsoluteUrl(docsPath(locale, page.slugs));
      return {
        locale,
        title: page.data.title,
        description: page.data.description,
        url,
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));

  const lines: string[] = [
    '# Ashfox Docs',
    '',
    `home: ${toAbsoluteUrl('/en')}`,
    `full-text: ${toAbsoluteUrl('/llms-full.txt')}`,
    '',
    '## Pages',
  ];

  pages.forEach((page) => {
    lines.push(`- [${page.locale}] ${page.title}: ${page.url}`);
    if (page.description) lines.push(`  summary: ${page.description}`);
  });

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
