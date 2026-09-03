import type { MetadataRoute } from 'next';

const SITE_ORIGIN = 'https://clearpath-access.hanzlakhan2266.chatgpt.site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN },
    { url: `${SITE_ORIGIN}/studio` },
  ];
}
