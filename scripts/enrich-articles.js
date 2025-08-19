// enrich-articles.js
// Objetivos:
//  - NO crear ni mantener description/summary/content (ahorro de traducción).
//  - Completar 'published' si falta (a partir de 'date').
//  - Ordenar por 'published' desc para que el primero sea el más reciente.
//  - Mantener objeto ligero para Make (title/title_es/url/source/date/published + category/tags).

import fs from 'fs';
import path from 'path';

// Permite ajustar rutas por ENV, con default compatibles con tu proyecto actual
const IN_PATH  = process.env.ARTICLES_IN  || './public/articles.json';
const OUT_PATH = process.env.ARTICLES_OUT || './public/articles_enriched.json';

// === Utilidades ===
const toISO = (d) => {
  const t = d ? Date.parse(d) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
};
const toDateShort = (d) => {
  const iso = toISO(d);
  return iso ? iso.slice(0, 10) : '';
};
const normUrl = (u = '') => {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const url = new URL(s);
    url.hash = '';
    url.search = '';
    return url.toString();
  } catch {
    return s;
  }
};

// Heurística básica de categoría (ligera y estable)
const detectCategory = (title = '') => {
  if (/journal|revista/i.test(title)) return 'revista';
  if (/study|discovery|research|noticia|ciencia/i.test(title)) return 'noticia';
  return 'noticia';
};

// Etiquetas muy breves (no sensibles a traducción)
const generateTags = (title = '') =>
  title
    .split(/\s+/)
    .slice(0, 3)
    .map((t) => t.toLowerCase().replace(/[^a-záéíóúüñ0-9-]/gi, ''))
    .filter(Boolean);

// === Carga ===
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}
const raw = fs.readFileSync(IN_PATH, 'utf-8');
const articles = JSON.parse(raw);

// === Transformación ===
const cleaned = articles.map((a) => {
  // Campos base
  const title     = (a.title || '').trim();
  const title_es  = (a.title_es || '').trim();
  const url       = normUrl(a.url || a.link || '');
  const source    = (a.source || '').trim();

  // Fecha/publicación
  const pubISO = toISO(a.published) || (a.date ? `${a.date}T00:00:00.000Z` : '');
  const date   = a.date || toDateShort(pubISO);

  // Campos calculados para Make
  const category = detectCategory(title_es || title);
  const tags     = generateTags(title_es || title);

  // Construimos SOLO los campos que queremos mantener
  const minimal = {
    title,
    title_es,
    url,
    source,
    published: pubISO,
    date,
    category,
    tags
  };

  return minimal;
});

// Ordenar descendente por published (si no hay, cae a date)
const stamp = (it) => Date.parse(it.published || it.date || 0) || 0;
const enriched = [...cleaned].sort((a, b) => stamp(b) - stamp(a));

// === Guardado ===
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(enriched, null, 2), 'utf8');

const removedInfo =
  'Campos eliminados: description, description_es, summary, summary_es, content, content_es';
console.log(`✅ Enriquecido guardado en ${OUT_PATH}`);
console.log(`   Entradas: ${enriched.length}`);
console.log(`   ${removedInfo}`);
console.log(
  `   Más reciente: ${enriched[0]?.date || ''} | ${enriched[0]?.source || ''} | ${enriched[0]?.title || ''}`
);

