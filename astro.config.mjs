import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  // Dominio real del sitio (IMPRESCINDIBLE para sitemap)
  site: 'https://futurocientifico.es',

  // URLs limpias sin barra final
  trailingSlash: 'never',

  integrations: [
    tailwind(),

    sitemap({
      // Excluir la página 404 del sitemap
      filter: (page) => page && !page.endsWith('/404'),

      // Serialización segura (evita el error de reduce)
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
