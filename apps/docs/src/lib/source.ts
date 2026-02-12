import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { defaultLocale, docsI18n } from '@/lib/i18n';
import { toAbsoluteUrl, withBasePath } from '@/lib/site';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  i18n: docsI18n,
  plugins: [],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const locale = page.locale ?? defaultLocale;
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: withBasePath(`/${locale}/og/docs/${segments.join('/')}`),
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');
  const locale = page.locale ?? defaultLocale;
  const path = `/${locale}/docs${page.slugs.length > 0 ? `/${page.slugs.join('/')}` : ''}`;

  return `# ${page.data.title}

URL: ${toAbsoluteUrl(path)}

${processed}`;
}
