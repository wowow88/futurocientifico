import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel/static'; // Adaptador para Vercel

export default defineConfig({
  site: 'https://futurocientifico.es',
  trailingSlash: 'never',
  adapter: vercel(),

  integrations: [
    tailwind(),
    mdx(),
  ],
});
