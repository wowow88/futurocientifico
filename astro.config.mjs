import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://futurocientifico.vercel.app',
  trailingSlash: 'never',
  integrations: [
    tailwind(),
    sitemap({
      // Excluye solo la 404 del sitemap (opcional)
      filter: (page) => !page.endsWith('/404'),
      // Añade metadatos útiles por URL
      serialize: (item) => ({
        ...item,
        changefreq: 'weekly',
        priority: item.url === 'https://futurocientifico.vercel.app/' ? 1.0 : 0.7,
        lastmod: new Date().toISOString()
      })
    }),
    mdx()
  ]
});
