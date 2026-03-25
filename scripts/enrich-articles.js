// scripts/enrich-articles.js
// Objetivos:
//  - NO crear ni mantener description/summary/content (ahorro de traducción).
//  - Completar 'published' si falta (a partir de 'date').
//  - Ordenar por 'published' desc para que el primero sea el más reciente.
//  - Mantener objeto ligero para Make (title/title_es/url/source/date/published + category/tags).
//  - Limpiar HTML/entidades y evitar propagar traducciones rotas a tags/categorías.

import fs from 'fs';
import path from 'path';

// Permite ajustar rutas por ENV, con default compatibles con tu proyecto actual
const IN_PATH = process.env.ARTICLES_IN || './public/articles.json';
const OUT_PATH = process.env.ARTICLES_OUT || './public/articles_enriched.json';

// === Utilidades de texto ===
const cleanText = (text = '') => {
  return String(text || '')
    .replace(/<[^>]*>/g, '')          // elimina HTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const norm = (text = '') => cleanText(text).toLowerCase();

const looksBadTitle = (text = '') => {
  const t = norm(text);

  if (!t) return true;
  if (t.length < 3) return true;

  // errores típicos heredados de traducción / APIs
  if (t.includes('error 500')) return true;
  if (t.includes('server error')) return true;
  if (t.includes('please try again later')) return true;
  if (t.includes('service unavailable')) return true;
  if (t.includes('too many requests')) return true;

  // restos técnicos / html
  if (t.includes('<a')) return true;
  if (t.includes('href=')) return true;
  if (t.includes('</a>')) return true;

  return false;
};

// === Utilidades de fecha / URL ===
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

// === Categorización ligera ===
const detectCategory = (title = '') => {
  const t = norm(title);

  if (!t) return 'noticia';
  if (/journal|revista/.test(t)) return 'revista';
  if (/study|discovery|research|noticia|ciencia|scientist|science|investigaci/.test(t)) return 'noticia';

  return 'noticia';
};

// === Tags ===
const BAD_TAGS = new Set([
  'error',
  'server',
  'href',
  'http',
  'https',
  'www',
  'com',
  'net',
  'org',
  'html',
  'amp',
  'nbsp',
  'quot',
  'apos',
  'lt',
  'gt',
  'the',
  'and',
  'for',
  'with',
  'from',
  'una',
  'unas',
  'unos',
  'the',
  'los',
  'las',
  'del',
  'para'
]);

const generateTags = (title = '') => {
  return cleanText(title)
    .split(/\s+/)
    .map((t) => t.toLowerCase().replace(/[^a-záéíóúüñ0-9-]/gi, ''))
    .filter(Boolean)
    .filter((t) => t.length > 2)
    .filter((t) => !BAD_TAGS.has(t))
    .slice(0, 3);
};

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
  const title = cleanText(a.title || '');
  const rawTitleEs = cleanText(a.title_es || '');
  const title_es = looksBadTitle(rawTitleEs) ? '' : rawTitleEs;
  const url = normUrl(a.url || a.link || '');
  const source = cleanText(a.source || '');

  // Fecha/publicación
  const pubISO = toISO(a.published) || (a.date ? `${a.date}T00:00:00.000Z` : '');
  const date = cleanText(a.date || '') || toDateShort(pubISO);

  // Elegimos el mejor título disponible para categoría/tags
  const safeTitle = title_es || title;

  // Campos calculados para Make
  const category = detectCategory(safeTitle);
  const tags = generateTags(safeTitle);

  // Construimos SOLO los campos que queremos mantener
  return {
    title,
    title_es,
    url,
    source,
    published: pubISO,
    date,
    category,
    tags
  };
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
