import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://futurocientifico.es',
  trailingSlash: 'never',
  output: 'static', // 🔑 fuerza modo estático

  integrations: [
    tailwind(),
    mdx()
  ]
});
