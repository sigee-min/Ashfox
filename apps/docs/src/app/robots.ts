import type { MetadataRoute } from 'next';
import { resolveMetadataBase, toAbsoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Claude-SearchBot', allow: '/' },
    ],
    sitemap: toAbsoluteUrl('/sitemap.xml'),
    host: resolveMetadataBase().origin,
  };
}
