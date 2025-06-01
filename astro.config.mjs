import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://futurocientifico.vercel.app',
  integrations: [tailwind(), sitemap(), mdx()]
});
