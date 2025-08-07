# FuturoCientífico 🌟

> Plataforma educativa que acerca la ciencia a las nuevas generaciones.

## 🚀 ¿Qué es?

**FuturoCientífico** es una web construida con Astro + TailwindCSS para:

- Publicar noticias científicas automatizadas (desde arXiv, Nature, etc.)
- Ofrecer formación: rutas científicas, orientación y recursos
- Monetizar de forma ética (donaciones, afiliación, ebooks)

## 📁 Estructura

- `/pages/` → Rutas del sitio (formación, artículos, etc.)
- `/src/components/` → Componentes visuales reutilizables
- `/content/es/` → Artículos en español (Markdown)
- `/public/` → Assets (favicon, logo, manifest, json dinámico)

## 💻 Tecnologías

- Astro
- TailwindCSS
- GitHub Actions (automatización)
- RSS Feeds + Markdown + JSON
- PWA con Service Worker, manifest y soporte offline

## 🧪 Comandos básicos

```bash
pnpm install
pnpm dev        # Desarrollo local
pnpm build      # Compilación para producción

🔄 Automatizaciones destacadas

scripts/eduflash_pipeline.py → Noticias educativas automáticas (eduflash.json)

scripts/enrich-articles.js → Mejora de artículos científicos (articles_enriched.json)

Workflows: daily-update.yml, eduflash.yml

📄 Licencias

Código fuente: MIT License

Contenido educativo y artículos: Creative Commons BY-NC-SA 4.0

🌐 Sitio en producción

https://futurocientifico.vercel.app

☕ Apóyanos

https://buymeacoffee.com/futurociene
