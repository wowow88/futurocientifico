// scripts/ensure-title-es-free.mjs
// Traduce title_es si falta o es igual a title SIN DeepL.
// Prioridad:
//   1) MyMemory (en|es)
//   2) LibreTranslate (auto->es) si LIBRE_ENDPOINT válido
//
// Mejoras incluidas:
// - Limpieza previa de HTML y entidades
// - Validación anti-basura / anti-errores 500
// - Fallback seguro al título original
// - Conteo más coherente

import fs from 'fs';
import path from 'path';

// Entradas / salidas
const IN_PATH  = process.env.ARTICLES_IN  || 'public/articles_enriched.json';
const OUT_PATH = process.env.ARTICLES_OUT || IN_PATH;

// Control
const TITLES_PER_RUN = Number(process.env.TITLES_PER_RUN || 200);
const SLEEP_MS       = Number(process.env.SLEEP_MS || 800);
const FETCH_TIMEOUT  = Number(process.env.FETCH_TIMEOUT_MS || 15000);

// Identificación / endpoints
const PUBLIC_SITE = process.env.PUBLIC_SITE || 'https://futurocientifico.es';
const USER_AGENT = process.env.USER_AGENT || `curioscience-bot/1.0 (+${PUBLIC_SITE})`;
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || '';
const RAW_LIBRE = (process.env.LIBRE_ENDPOINT || '').toString().trim();

// --- Saneado de endpoint LibreTranslate ---
function sanitizeEndpoint(raw) {
  let s = (raw || '').trim();

  // quitar comillas externas
  s = s.replace(/^['"]|['"]$/g, '').trim();
  if (!s) return '';

  // añadir protocolo si falta
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;

  try {
    const u = new URL(s);
    u.hash = '';
    u.search = '';
    return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const LIBRE_ENDPOINT = sanitizeEndpoint(RAW_LIBRE);

// --- Utils ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (s) => (s || '').toString().trim().toLowerCase();

function cleanText(text = '') {
  return String(text || '')
    .replace(/<[^>]*>/g, '')   // elimina HTML
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTO(url, opts = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Heurística simple: ¿probablemente inglés?
const EN_SOURCES = new Set([
  'Nature',
  'Science.org',
  'arXiv',
  'PubMed',
  'Phys.org',
  'Scientific American',
  'New Scientist'
]);

function isProbablyEnglish(text, source) {
  if (EN_SOURCES.has((source || '').trim())) return true;

  const t = ` ${String(text || '').toLowerCase()} `;

  if (/[áéíóúüñ]/i.test(t)) return false;

  const enHints = [
    ' the ', ' of ', ' and ', ' for ', ' with ', ' from ', ' in ', ' on ', ' to ',
    ' study ', ' research ', ' scientist ', ' scientists ', ' new ', ' discovered ',
    ' reveals ', ' using '
  ];

  const asciiShare =
    t.replace(/[^\x00-\x7F]/g, '').length / Math.max(1, t.length);

  return asciiShare > 0.98 && enHints.some((h) => t.includes(h));
}

function needsTranslation(item) {
  const t = cleanText(item.title || '');
  const te = cleanText(item.title_es || '');

  if (!t) return false;
  if (!te) return true;

  return norm(te) === norm(t);
}

function isBadTranslation(text = '') {
  const t = cleanText(text).toLowerCase();

  if (!t) return true;

  // Errores típicos de servicios
  if (t.includes('error 500')) return true;
  if (t.includes('server error')) return true;
  if (t.includes('please try again later')) return true;
  if (t.includes('too many requests')) return true;
  if (t.includes('service unavailable')) return true;

  // HTML residual / basura técnica
  if (t.includes('<a')) return true;
  if (t.includes('href=')) return true;
  if (t.includes('</a>')) return true;

  // Respuestas demasiado pobres
  if (t.length < 3) return true;

  return false;
}

function applyTranslation(item, text) {
  const cleaned = cleanText(text);
  if (!cleaned || isBadTranslation(cleaned)) return false;
  item.title_es = cleaned;
  return true;
}

// --- Traductores ---

// MyMemory (en -> es)
async function translateWithMyMemory(text) {
  try {
    const base = 'https://api.mymemory.translated.net/get';
    const qp = new URLSearchParams({
      q: text,
      langpair: 'en|es'
    });

    if (MYMEMORY_EMAIL) qp.set('de', MYMEMORY_EMAIL);

    const res = await fetchWithTO(`${base}?${qp.toString()}`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!res.ok) {
      return { ok: false, status: res.status, text: '', same: false };
    }

    const data = await res.json().catch(() => ({}));

    let candidate = cleanText(data?.responseData?.translatedText || '');

    const matches = Array.isArray(data?.matches) ? data.matches : [];
    const best = matches
      .filter((m) => cleanText(m?.translation || ''))
      .sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0))[0];

    if (best?.translation) {
      candidate = cleanText(best.translation);
    }

    if (!candidate) {
      return { ok: false, status: 200, text: '', same: false };
    }

    return {
      ok: true,
      text: candidate,
      same: norm(candidate) === norm(text)
    };
  } catch (e) {
    console.warn('[MyMemory] error:', e?.message || e);
    return { ok: false, text: '', same: false };
  }
}

// LibreTranslate (auto -> es)
async function translateWithLibre(text) {
  if (!LIBRE_ENDPOINT) return { ok: false, text: '', same: false };

  try {
    const url = `${LIBRE_ENDPOINT}/translate`;

    const res = await fetchWithTO(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({
        q: text,
        source: 'auto',
        target: 'es',
        format: 'text'
      })
    });

    if (!res.ok) {
      return { ok: false, status: res.status, text: '', same: false };
    }

    const data = await res.json().catch(() => ({}));
    const out = cleanText(data?.translatedText || '');

    if (!out) {
      return { ok: false, status: 200, text: '', same: false };
    }

    return {
      ok: true,
      text: out,
      same: norm(out) === norm(text)
    };
  } catch (e) {
    console.warn('[LibreTranslate] error:', e?.message || e);
    return { ok: false, text: '', same: false };
  }
}

// --- Carga ---
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));

// Log ligero del endpoint saneado
if (LIBRE_ENDPOINT) {
  try {
    const u = new URL(LIBRE_ENDPOINT);
    console.log('LibreTranslate:', u.origin);
  } catch {
    console.log('LibreTranslate: endpoint inválido');
  }
} else {
  console.log('LibreTranslate: desactivado (LIBRE_ENDPOINT vacío o inválido)');
}

// --- Proceso ---
let tried = 0;
let translated = 0;
let byMM = 0;
let byLibre = 0;
let unchanged = 0;
let skipped = 0;

const out = [];

for (const it of items) {
  const item = { ...it };

  // Normaliza título original antes de trabajar
  item.title = cleanText(item.title || '');
  item.title_es = cleanText(item.title_es || '');

  if (!needsTranslation(item)) {
    skipped++;
    out.push(item);
    continue;
  }

  if (tried >= TITLES_PER_RUN) {
    out.push(item);
    continue;
  }

  tried++;

  const text = cleanText(item.title || '');
  const source = item.source || '';
  const mmFirst = isProbablyEnglish(text, source);

  let translatedThisItem = false;

  if (mmFirst) {
    const r = await translateWithMyMemory(text);

    if (r.ok && r.text) {
      const applied = applyTranslation(item, r.text);

      if (applied) {
        byMM++;
        translatedThisItem = true;
      } else {
        console.warn('❌ Traducción MyMemory descartada:', r.text);
      }

      // Si MyMemory devolvió lo mismo o algo malo, probamos Libre
      if ((!applied || r.same) && LIBRE_ENDPOINT) {
        const r2 = await translateWithLibre(text);
        const appliedLibre =
          r2.ok &&
          r2.text &&
          !r2.same &&
          applyTranslation(item, r2.text);

        if (appliedLibre) {
          byLibre++;
          translatedThisItem = true;
        } else if (r2.ok && r2.text) {
          console.warn('❌ Traducción Libre descartada:', r2.text);
        }
      }

      if (!item.title_es || isBadTranslation(item.title_es)) {
        item.title_es = item.title || '';
        unchanged++;
      } else if (translatedThisItem) {
        translated++;
      }

      out.push(item);
      await sleep(SLEEP_MS);
      continue;
    }

    // Fallback a Libre si MyMemory falla
    const r2 = await translateWithLibre(text);

    if (r2.ok && r2.text && applyTranslation(item, r2.text)) {
      byLibre++;
      translated++;
      out.push(item);
      await sleep(SLEEP_MS);
      continue;
    }

    if (r2.ok && r2.text) {
      console.warn('❌ Traducción Libre descartada:', r2.text);
    }
  } else {
    const r2 = await translateWithLibre(text);

    if (r2.ok && r2.text && !r2.same && applyTranslation(item, r2.text)) {
      byLibre++;
      translated++;
      out.push(item);
      await sleep(SLEEP_MS);
      continue;
    }

    if (r2.ok && r2.text && !r2.same) {
      console.warn('❌ Traducción Libre descartada:', r2.text);
    }

    const r = await translateWithMyMemory(text);

    if (r.ok && r.text && applyTranslation(item, r.text)) {
      byMM++;
      translated++;
      out.push(item);
      await sleep(SLEEP_MS);
      continue;
    }

    if (r.ok && r.text) {
      console.warn('❌ Traducción MyMemory descartada:', r.text);
    }
  }

  // 🔒 Fallback seguro final
  if (!item.title_es || isBadTranslation(item.title_es)) {
    item.title_es = item.title || '';
  }

  unchanged++;
  out.push(item);
  await sleep(SLEEP_MS);
}

// --- Guardado ---
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log(
  `ensure-title-es-free: traducidos=${translated}, intentos=${tried}, mymemory=${byMM}, libre=${byLibre}, sin_cambio=${unchanged}, omitidos=${skipped}`
);
console.log(`Archivo: ${OUT_PATH}`);
