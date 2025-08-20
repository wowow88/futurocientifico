// scripts/ensure-title-es-free.mjs
// Traduce title_es si falta o es igual a title, SIN DeepL.
// Intenta MyMemory (gratuito) y, si falla, LibreTranslate (si LIBRE_ENDPOINT está definido).

import fs from 'fs';
import path from 'path';

// Rutas (por ENV o por defecto)
const IN_PATH  = process.env.ARTICLES_IN  || 'workspace/astro/public/articles_enriched.json';
const OUT_PATH = process.env.ARTICLES_OUT || IN_PATH;

// Límites / tiempos
const TITLES_PER_RUN = Number(process.env.TITLES_PER_RUN || 200);
const SLEEP_MS       = Number(process.env.SLEEP_MS || 800);

// Identificación opcional para MyMemory (aumenta el límite si añades correo)
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || '';
// Endpoint opcional para LibreTranslate (p.ej. https://libretranslate.de)
const LIBRE_ENDPOINT = process.env.LIBRE_ENDPOINT || '';
const USER_AGENT     = process.env.USER_AGENT || 'curioscience-bot/1.0 (+https://futurocientifico.vercel.app)';

// Utilidades
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const norm  = s => (s || '').toString().trim().toLowerCase();

// ==== Traductores gratuitos ====

// MyMemory (auto → es)
async function translateWithMyMemory(text) {
  const base = 'https://api.mymemory.translated.net/get';
  const url  = `${base}?q=${encodeURIComponent(text)}&langpair=auto|es` + (MYMEMORY_EMAIL ? `&de=${encodeURIComponent(MYMEMORY_EMAIL)}` : '');
  const res  = await fetch(url, { headers: { 'User-Agent': USER_AGENT }});
  if (!res.ok) {
    // 429 = rate limit; 456 = daily limit
    return { ok: false, status: res.status, text: '' };
  }
  const data = await res.json();
  // respuesta principal
  let candidate = (data?.responseData?.translatedText || '').trim();
  // busca mejor match en matches
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  const best = matches
    .filter(m => (m?.translation || '').trim())
    .sort((a,b) => (Number(b.match)||0) - (Number(a.match)||0))[0];
  if (best && (best.translation || '').trim()) candidate = best.translation.trim();
  if (!candidate) return { ok: false, status: 200, text: '' };
  if (norm(candidate) === norm(text)) return { ok: true, text: candidate, same: true };
  return { ok: true, text: candidate, same: false };
}

// LibreTranslate (auto → es)
async function translateWithLibre(text) {
  if (!LIBRE_ENDPOINT) return { ok: false, text: '' };
  const url = `${LIBRE_ENDPOINT.replace(/\/+$/,'')}/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ q: text, source: 'auto', target: 'es', format: 'text' })
  });
  if (!res.ok) return { ok:false, status: res.status, text: '' };
  const data = await res.json();
  const out = (data?.translatedText || '').trim();
  if (!out) return { ok:false, status:200, text:'' };
  return { ok:true, text: out, same: norm(out) === norm(text) };
}

function needsTranslation(item) {
  const t  = (item.title || '').trim();
  const te = (item.title_es || '').trim();
  if (!t) return false;                 // nada que traducir
  if (!te) return true;                 // falta title_es
  return norm(te) === norm(t);          // es igual → forzar traducción
}

function keepFields(it) {
  // Asegura que sólo mantenemos campos ligeros (coherente con tu enrich)
  const { title, title_es, url, source, published, date, category, tags } = it;
  return { title, title_es, url, source, published, date, category, tags };
}

// === Carga
if (!fs.existsSync(IN_PATH)) {
  console.error(`❌ No existe ${IN_PATH}`);
  process.exit(1);
}
const items = JSON.parse(fs.readFileSync(IN_PATH, 'utf8'));

// === Procesado
let tried = 0, translated = 0, byMM = 0, byLibre = 0, unchanged = 0, skipped = 0;
const out = [];

for (const it of items) {
  const item = { ...it };
  if (!needsTranslation(item)) {
    skipped++;
    out.push(keepFields(item));
    continue;
  }

  if (tried >= TITLES_PER_RUN) {
    out.push(keepFields(item));
    continue;
  }

  tried++;
  const text = (item.title || '').trim();

  // 1) MyMemory
  let r = await translateWithMyMemory(text);
  if (r.ok && r.text) {
    item.title_es = r.text;
    translated++;
    byMM++;
    // si devolvió igual, intentamos LibreTranslate como “mejora”
    if (r.same && LIBRE_ENDPOINT) {
      await sleep(SLEEP_MS);
      const r2 = await translateWithLibre(text);
      if (r2.ok && r2.text && !r2.same) {
        item.title_es = r2.text;
        byLibre++;
      } else {
        unchanged++;
      }
    }
    out.push(keepFields(item));
    await sleep(SLEEP_MS);
    continue;
  }

  // 2) LibreTranslate (fallback)
  if (LIBRE_ENDPOINT) {
    r = await translateWithLibre(text);
    if (r.ok && r.text) {
      item.title_es = r.text;
      translated++;
      byLibre++;
      out.push(keepFields(item));
      await sleep(SLEEP_MS);
      continue;
    }
  }

  // 3) Nada funcionó → dejar como estaba (pero creamos title_es si estaba vacío)
  if (!item.title_es) item.title_es = item.title || '';
  unchanged++;
  out.push(keepFields(item));
  await sleep(SLEEP_MS);
}

// === Guardado
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

console.log(`ensure-title-es-free: traducidos=${translated}, intentos=${tried}, mymemory=${byMM}, libre=${byLibre}, sin_cambio=${unchanged}, omitidos=${skipped}`);
console.log(`Archivo: ${OUT_PATH}`);
