import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/static';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://futurocientifico.es',
  output: 'static',
  trailingSlash: 'never',
  adapter: vercel({ split: false }),
  integrations: [tailwind(), mdx()],
});


