
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import content from '@astrojs/content';

export default defineConfig({
  integrations: [tailwind(), sitemap(), mdx(), content()],
  site: 'https://futurocientifico.vercel.app'
});
