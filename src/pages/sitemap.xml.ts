import { getCollection } from 'astro:content';

export async function GET() {
  // Dominio base, limpio (sin barra final)
  const SITE = (import.meta.env.PUBLIC_SITE || 'https://futurocientifico.es')
    .replace(/\/+$/, '');

  // Rutas estáticas del sitio
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

  // URLs estáticas
  const staticUrls = staticPaths.map((path) => {
    const loc = path === '' ? `${SITE}/` : `${SITE}/${path}`;
    return `
      <url>
        <loc>${loc}</loc>
        <changefreq>weekly</changefreq>
        <priority>${path === '' ? '1.0' : '0.7'}</priority>
      </url>`;
  });

  // URLs dinámicas: artículos
  const articles = await getCollection('articles');

  const articleUrls = articles.map((article) => {
    const loc = `${SITE}/articulos/${article.slug}`;
    const lastmod = article.data?.date
      ? new Date(article.data.date).toISOString()
      : new Date().toISOString();

    return `
      <url>
        <loc>${loc}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
      </url>`;
  });

  // Sitemap final
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...articleUrls].join('\n')}
</urlset>`;

  return new Response(xml.trim(), {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}


