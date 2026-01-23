import { getCollection } from 'astro:content';

export async function GET() {
  const site = import.meta.env.PUBLIC_SITE;
  const staticPaths = [
    '', // home
    'formacion',
    'recursos',
    'revistas',
    'apoya',
    'preguntona',
    'quienes-somos',
    'eduflash',
  ];

  const urls = staticPaths.map((path) => {
    const url = `${site}/${path}`;
    return `
      <url>
        <loc>${url}</loc>
        <changefreq>weekly</changefreq>
        <priority>${url === site + '/' ? '1.0' : '0.7'}</priority>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join('\n')}
  </urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}

