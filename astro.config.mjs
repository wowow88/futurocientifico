import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/static'; // ✅ Adapter para Vercel

export default defineConfig({
  site: 'https://futurocientifico.es',
  trailingSlash: 'never',
  adapter: vercel(),

  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => page && !page.endsWith('/404'),
      serialize: (item) => {
        if (!item || typeof item.url !== 'string') return null;
        return {
          ...item,
          changefreq: 'weekly',
          priority: item.url === 'https://futurocientifico.es/' ? 1.0 : 0.7,
          lastmod: new Date().toISOString(),
        };
      },
    }),
    mdx(),
  ],
});

