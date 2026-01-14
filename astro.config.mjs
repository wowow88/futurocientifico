import { defineConfig } from 'astro/config';
import vercelStatic from '@astrojs/vercel-static';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://futurocientifico.es',
  trailingSlash: 'never',
  output: 'static',
  adapter: vercelStatic(),
  integrations: [tailwind(), mdx()],
});

