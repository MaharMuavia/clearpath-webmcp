import type { MetadataRoute } from 'next';

const SITE_ORIGIN = 'https://clearpath-access.hanzlakhan2266.chatgpt.site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
